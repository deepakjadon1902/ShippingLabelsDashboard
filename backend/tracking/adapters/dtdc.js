import { createTrackingResult, mapStatus } from "./base.js";
import { fetchTrackCourier, hasTrackCourierKey } from "./trackcourier.js";

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
        headers: { "Content-Type": "application/json", "api-key": token },
        body: JSON.stringify({ trkType: "cnno", strcnno: waybill, addtnlDtl: "Y" }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (response.status === 401) {
      return {
        ok: false,
        error: "DTDC Direct API Authentication Failed (HTTP 401: Token invalid or expired)",
      };
    }
    if (response.status === 404) {
      return { ok: false, error: "Shipment not found in DTDC system" };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        error: `DTDC Direct API Server Error (HTTP ${response.status})`,
      };
    }
    if (!response.ok) {
      return { ok: false, error: `DTDC HTTP ${response.status}` };
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
 * 1. Primary: Direct DTDC API
 * 2. Fallback: TrackCourier.io (polled at most once every 24 hours per shipment unless forced)
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

  // 2. TrackCourier.io Fallback (Secondary)
  if (hasTrackCourierKey()) {
    const { lastTrackcourierSync, force = false } = options;
    const now = Date.now();

    // Enforce 24-hour rate limit gate for TrackCourier.io calls unless manual force refresh
    if (!force && lastTrackcourierSync) {
      const lastSyncTime = new Date(lastTrackcourierSync).getTime();
      if (!isNaN(lastSyncTime) && now - lastSyncTime < ONE_DAY_MS) {
        // Less than 24h since last TrackCourier query. Skip calling TrackCourier.
        return createTrackingResult({
          courier: COURIER_NAME,
          trackingNumber: waybill,
          source: "none",
          provider: "DTDC Direct",
          error: `DTDC direct: ${direct.error || "unavailable"} | TrackCourier skipped (polled within 24h)`,
        });
      }
    }

    const fallback = await fetchTrackCourier(COURIER_NAME, waybill);
    if (fallback.status || fallback.rawStatus) {
      return {
        ...fallback,
        provider: "TrackCourier.io",
      };
    }

    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: fallback.source || "none",
      provider: fallback.provider || "TrackCourier.io",
      error: `DTDC direct: ${direct.error || "no status"} | TrackCourier: ${
        fallback.error || "no status"
      }`,
    });
  }

  // If TrackCourier key is not configured, report direct error and missing fallback key
  return (
    direct.result ||
    createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "DTDC Direct",
      error: direct.error
        ? `${direct.error} (TrackCourier fallback not configured: missing TRACKCOURIER_API_KEY)`
        : "DTDC direct tracking failed",
    })
  );
}


