import {
  createTrackingResult,
  mapStatus,
  detectRtoStatus,
  detectFailure,
  isOutOfDelivery,
} from "./base.js";
import { fetchTrackCourier, hasTrackCourierKey } from "./trackcourier.js";

const COURIER_NAME = "Shadowfax";

export function hasShadowfaxToken() {
  return !!(process.env.SHADOWFAX_API_TOKEN || process.env.SHADOWFAX_API_KEY);
}

/**
 * Direct Shadowfax API tracking (used when enterprise credentials are provided)
 * Endpoint: GET https://api.shadowfax.in/api/v2/clients/requests/{waybill}
 */
async function fetchShadowfaxDirect(waybill) {
  const token = process.env.SHADOWFAX_API_TOKEN || process.env.SHADOWFAX_API_KEY;
  if (!token) {
    return { ok: false, error: "Missing SHADOWFAX_API_TOKEN in environment" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const url = `https://api.shadowfax.in/api/v2/clients/requests/${encodeURIComponent(waybill)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: `Shadowfax Direct API Authentication Failed (HTTP ${response.status})`,
      };
    }

    if (response.status === 404) {
      return { ok: false, error: "Shipment not found in Shadowfax system" };
    }

    if (!response.ok) {
      return { ok: false, error: `Shadowfax Direct HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    const rawStatus = data.status || data.current_status || null;
    const location = data.location || data.current_city || null;
    const eventDate = data.updated_at || data.status_time || null;
    const eventDescription = data.status_description || rawStatus || null;
    const estimatedDelivery = data.promised_delivery_date || data.expected_delivery_date || null;
    const origin = data.pickup_city || data.origin || null;
    const destination = data.delivery_city || data.destination || null;
    const pickupAt = data.pickup_time || null;
    const deliveredAt = data.delivered_time || null;

    const rtoStage = detectRtoStatus(rawStatus || eventDescription);
    const internalStatus = mapStatus(rawStatus);

    const rawCheckpoints = Array.isArray(data.tracking_history)
      ? data.tracking_history
      : Array.isArray(data.scans)
        ? data.scans
        : [];

    const history = rawCheckpoints.map((cp) => ({
      date: cp.time || cp.created_at || cp.date ? new Date(cp.time || cp.created_at || cp.date).toISOString() : null,
      description: String(cp.status || cp.description || cp.activity || "").trim(),
      location: cp.location || cp.city ? String(cp.location || cp.city).trim() : null,
      status: cp.status ? String(cp.status).trim() : null,
      source: "direct",
    }));

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
        origin,
        destination,
        pickupAt,
        deliveredAt,
        rtoStatus: rtoStage,
        source: "direct",
        provider: "Shadowfax Direct",
        history,
      }),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "Shadowfax Direct API request timed out" };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Tracks a Shadowfax shipment using Direct API if credentials are provided,
 * otherwise routes through TrackCourier.io partner tracking adapter.
 *
 * @param {string} trackingNumber - Shadowfax waybill/AWB
 * @param {Object} options - Tracking options
 * @returns {Promise<Object>} Normalized tracking result
 */
export async function trackShadowfax(trackingNumber, options = {}) {
  const waybill = String(trackingNumber || "").trim();

  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "Shadowfax",
      error: "Tracking number is required",
    });
  }

  // 1. Direct Shadowfax API (if credentials configured)
  if (hasShadowfaxToken()) {
    const direct = await fetchShadowfaxDirect(waybill);
    if (direct.ok && direct.result && (direct.result.status || direct.result.rawStatus)) {
      return direct.result;
    }
  }

  // 2. TrackCourier.io Partner Tracker (Primary in absence of direct credentials)
  if (hasTrackCourierKey()) {
    const fallback = await fetchTrackCourier(COURIER_NAME, waybill);
    return fallback;
  }

  // 3. Neither Direct nor TrackCourier credentials available
  return createTrackingResult({
    courier: COURIER_NAME,
    trackingNumber: waybill,
    source: "none",
    provider: "Shadowfax",
    error: "No tracking credentials available for Shadowfax (requires SHADOWFAX_API_TOKEN or TRACKCOURIER_API_KEY)",
  });
}
