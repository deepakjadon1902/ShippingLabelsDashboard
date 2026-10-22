import { createTrackingResult, mapStatus } from "./base.js";
import { fetchTrackCourier, hasTrackCourierKey } from "./trackcourier.js";
import { isCircuitBreakerTripped } from "../controller.js";

const COURIER_NAME = "DTDC";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function hasDtdcToken() {
  return !!process.env.DTDC_API_TOKEN;
}

/**
 * Parses DTDC date string (e.g. DD/MM/YYYY or YYYY-MM-DD) and optional time
 */
function parseDtdcDate(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const cleanDate = String(dateStr).trim();
    // Check if format is DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const [_, day, month, year] = dmyMatch;
      const timePart = timeStr ? ` ${String(timeStr).trim()}` : " 00:00:00";
      const isoCandidate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${timePart}`);
      if (!isNaN(isoCandidate.getTime())) return isoCandidate.toISOString();
    }
    const directDate = new Date(cleanDate + (timeStr ? ` ${timeStr}` : ""));
    return isNaN(directDate.getTime()) ? null : directDate.toISOString();
  } catch {
    return null;
  }
}

/**
 * Direct DTDC API call (PRIMARY)
 */
async function fetchDtdcDirect(waybill) {
  const token = process.env.DTDC_API_TOKEN;
  if (!token) {
    return { ok: false, error: "Missing DTDC_API_TOKEN" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(
      "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": token,
          "X-Access-Token": token,
          "X-API-KEY": token,
        },
        body: JSON.stringify({ trkType: "cnno", strcnno: waybill, addtnlDtl: "Y" }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (response.status === 401) {
      return {
        ok: false,
        statusCode: 401,
        isAuthError: true,
        error: "DTDC Direct API Authentication Failed (HTTP 401: Token invalid or expired)",
      };
    }
    if (response.status === 404) {
      return { ok: false, statusCode: 404, error: "Shipment not found in DTDC system" };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        statusCode: response.status,
        error: `DTDC Direct API Server Error (HTTP ${response.status})`,
      };
    }
    if (!response.ok) {
      return { ok: false, statusCode: response.status, error: `DTDC HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));

    // Header info
    const header = data.trackHeader || {};
    const rawStatus =
      header.strStatusDesc ||
      header.strStatus ||
      data.trackDetails?.[0]?.strAction ||
      null;

    const estimatedDelivery = header.strExpectedDeliveryDate
      ? String(header.strExpectedDeliveryDate).trim()
      : null;

    // Track details / checkpoints
    const rawEvents = Array.isArray(data.trackDetails) ? data.trackDetails : [];
    const history = rawEvents.map((event) => {
      const date = parseDtdcDate(event.strActionDate, event.strActionTime);
      const location = event.strLocation || event.strOrigin || event.strDestination || null;
      const description = event.strAction || event.strRemarks || rawStatus || "";
      return {
        date,
        location,
        description,
        status: event.strAction || null,
        source: "dtdc",
      };
    });

    const latestEvent = history[0];
    const location = latestEvent?.location || header.strDestination || header.strOrigin || null;
    const eventDate = latestEvent?.date || null;
    const eventDescription = latestEvent?.description || rawStatus || null;

    const internalStatus = mapStatus(rawStatus) || mapStatus(latestEvent?.description);

    if (!rawStatus && !internalStatus && history.length === 0) {
      return { ok: false, error: "No DTDC status in response" };
    }

    return {
      ok: true,
      result: createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        status: internalStatus,
        rawStatus: rawStatus ? `[direct] ${rawStatus}` : null,
        location,
        eventDate,
        eventDescription,
        estimatedDelivery,
        source: "direct",
        provider: "DTDC Direct",
        error: internalStatus ? null : (rawStatus ? null : "No status found"),
        history,
      }),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "DTDC Direct API request timed out" };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * DTDC Tracking Adapter
 * 1. Primary: Direct DTDC API (Direct first choice where supported)
 * 2. Fallback: Multi-tier TrackCourier (Account 1 -> Account 2 -> Account 3)
 *
 * @param {string} trackingNumber - DTDC Waybill / Consignment Number
 * @param {Object} options - Options including { lastTrackcourierSync, force }
 */
export async function trackDTDC(trackingNumber, options = {}) {
  const waybill = String(trackingNumber || "").trim();
  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "DTDC Direct",
      error: "Tracking number is required",
    });
  }

  // 1. Try DTDC Direct API (Primary)
  const direct = await fetchDtdcDirect(waybill);
  if (direct.ok && direct.result && (direct.result.status || direct.result.rawStatus)) {
    return direct.result;
  }

  // 2. TrackCourier Multi-Account Fallback (Secondary: Account 1 -> Account 2 -> Account 3)
  for (const account of [1, 2, 3]) {
    const breakerKey = `trackcourier_account${account}`;
    if (hasTrackCourierKey(account) && !isCircuitBreakerTripped(breakerKey)) {
      const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account });
      const isSuccess = fallback && !fallback.error && (fallback.status || fallback.rawStatus);
      if (isSuccess) {
        return {
          ...fallback,
          provider: `TrackCourier.io (Account ${account})`,
          source: `trackcourier_account${account}`,
          error: null, // Clear direct error on successful backup so UI treats tracking as fully successful
        };
      }
    }
  }

  // 3. Fallback exhausted or unconfigured
  return (
    direct.result ||
    createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "DTDC Direct",
      error: direct.error
        ? `${direct.error} (TrackCourier fallback exhausted or unavailable)`
        : "DTDC direct tracking failed",
      statusCode: direct.statusCode || 500,
      isAuthError: direct.isAuthError || false,
    })
  );
}
