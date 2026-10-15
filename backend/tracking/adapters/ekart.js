import {
  createTrackingResult,
  mapStatus,
  detectRtoStatus,
  detectFailure,
  isOutOfDelivery,
} from "./base.js";

const COURIER_NAME = "Ekart";
const EKART_TRACK_BASE_URL = "https://app.elite.ekartlogistics.in/api/v1/track";

/**
 * Normalizes Ekart-specific status strings into standard internal statuses:
 * "Pending" | "Shipped" | "Delivered" | "RTO" | null
 */
export function mapEkartStatus(rawStatus) {
  if (!rawStatus) return null;
  const s = String(rawStatus).toLowerCase().trim();

  // Delivered
  if (
    s === "delivered" ||
    s === "rto delivered" ||
    s.includes("delivered successfully") ||
    s.includes("successful-delivery")
  ) {
    if (s.includes("rto")) return "RTO";
    return "Delivered";
  }

  // RTO / Failure / Exceptions
  if (
    s.includes("rto") ||
    s.includes("undelivered") ||
    s.includes("cancelled") ||
    s.includes("canceled") ||
    s.includes("lost") ||
    s.includes("damaged") ||
    s.includes("not serviceable") ||
    s.includes("delivery failed") ||
    s.includes("unable to deliver") ||
    s.includes("refused") ||
    s.includes("rejected")
  ) {
    return "RTO";
  }

  // Pending / Not picked / Order placed
  if (
    s === "order placed" ||
    s.includes("order placed") ||
    s.includes("pickup pending") ||
    s.includes("pickup scheduled") ||
    s.includes("pickup not attempted") ||
    s.includes("not picked") ||
    s.includes("manifest") ||
    s.includes("label created")
  ) {
    return "Pending";
  }

  // Shipped / Transit / OFD / Delayed
  if (
    s.includes("picked up") ||
    s.includes("in transit") ||
    s.includes("intransit") ||
    s.includes("out for delivery") ||
    s.includes("out for del") ||
    s.includes("ofd") ||
    s.includes("shipment delayed") ||
    s.includes("dispatched") ||
    s.includes("booked")
  ) {
    return "Shipped";
  }

  return mapStatus(rawStatus);
}

/**
 * Parses numeric epoch millisecond timestamp or string date into an ISO date string
 */
function toIsoDate(val) {
  if (!val) return null;
  const num = Number(val);
  const date = Number.isFinite(num) ? new Date(num) : new Date(val);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Fetches real-time shipment tracking data from Ekart Open Tracking API
 *
 * Endpoint: GET https://app.elite.ekartlogistics.in/api/v1/track/{AWB}
 * Authentication: None (Open endpoint)
 *
 * @param {string} trackingNumber - Ekart Waybill / AWB (e.g. LUAP0001603051)
 * @returns {Promise<Object>} Normalized tracking result
 */
export async function trackEkart(trackingNumber) {
  const waybill = String(trackingNumber || "").trim();

  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "Ekart Direct",
      error: "Tracking number is required",
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const url = `${EKART_TRACK_BASE_URL}/${encodeURIComponent(waybill)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Ekart Direct",
        error: "Shipment not found in Ekart system",
      });
    }

    if (response.status === 429) {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Ekart Direct",
        error: "Ekart API rate limit reached (HTTP 429). Please retry after cooldown.",
      });
    }

    if (response.status >= 500) {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Ekart Direct",
        error: `Ekart Direct API Server Error (HTTP ${response.status})`,
      });
    }

    if (!response.ok) {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Ekart Direct",
        error: `Ekart Direct API HTTP ${response.status}`,
      });
    }

    const data = await response.json().catch(() => ({}));
    const trackObj = data.track || {};

    const rawStatus = trackObj.status || trackObj.desc || null;
    const internalStatus = mapEkartStatus(rawStatus);

    const location = trackObj.location ? String(trackObj.location).trim() : null;
    const eventDate = toIsoDate(trackObj.ctime);
    const eventDescription = trackObj.desc || rawStatus || null;
    const estimatedDelivery = toIsoDate(data.edd);
    const pickupAt = toIsoDate(trackObj.pickupTime);

    // Parse chronological details checkpoints
    const rawDetails = Array.isArray(trackObj.details) ? trackObj.details : [];
    const history = rawDetails
      .filter((d) => d && (d.ctime || d.status || d.location || d.desc))
      .map((detail) => {
        const date = toIsoDate(detail.ctime);
        const status = detail.status ? String(detail.status).trim() : null;
        const desc = detail.desc ? String(detail.desc).trim() : "";
        const description = desc || status || "";
        const loc = detail.location ? String(detail.location).trim() : null;

        return {
          date,
          description,
          location: loc,
          status,
          source: "direct",
        };
      });

    // Ensure the top-level track event is represented in history
    if (eventDate || rawStatus || location || eventDescription) {
      const topDescription = eventDescription || rawStatus || "";
      const alreadyRepresented = history.some((h) => {
        const sameTime =
          h.date &&
          eventDate &&
          Math.abs(new Date(h.date).getTime() - new Date(eventDate).getTime()) < 1000;
        const sameStatus =
          (h.status || "").toLowerCase() === (rawStatus || "").toLowerCase();
        const sameDesc =
          (h.description || "").toLowerCase() === topDescription.toLowerCase();
        const sameLoc =
          (h.location || "").toLowerCase() === (location || "").toLowerCase();
        return sameTime && (sameStatus || sameDesc) && sameLoc;
      });

      if (!alreadyRepresented) {
        history.push({
          date: eventDate,
          description: topDescription,
          location,
          status: rawStatus,
          source: "direct",
        });
      }
    }

    // Sort checkpoints descending (newest event first)
    history.sort((a, b) => (new Date(b.date || 0) > new Date(a.date || 0) ? 1 : -1));

    // Determine deliveredAt only when a Delivered event exists
    let deliveredAt = null;
    if (internalStatus === "Delivered") {
      const delEvent = history.find((h) => {
        const s = (h.status || h.description || "").toLowerCase();
        return (
          s.includes("delivered") &&
          !s.includes("undelivered") &&
          !s.includes("rto")
        );
      });
      deliveredAt = delEvent?.date || eventDate || null;
    }

    // RTO lifecycle stages
    const rtoStage = detectRtoStatus(rawStatus || trackObj.desc);
    let rtoInitiatedAt = null;
    let rtoReturnedAt = null;
    if (rtoStage) {
      const rtoEvent = history.find((h) => {
        const s = (h.status || h.description || "").toLowerCase();
        return s.includes("rto") || s.includes("return");
      });
      if (rtoEvent?.date) {
        rtoInitiatedAt = rtoEvent.date;
      }
      if (rtoStage === "RTO Delivered / Returned") {
        rtoReturnedAt = rtoEvent?.date || eventDate || null;
      }
    }

    // Origin location from earliest scan if available
    let origin = null;
    if (history.length > 0) {
      const earliest = history[history.length - 1];
      if (earliest?.location) origin = earliest.location;
    }

    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: data.wbn || waybill,
      status: internalStatus,
      rawStatus: rawStatus ? `[direct] ${rawStatus}` : null,
      location,
      eventDate,
      eventDescription,
      estimatedDelivery,
      source: "direct",
      provider: "Ekart Direct",
      origin,
      destination: null,
      pickupAt,
      deliveredAt,
      rtoStatus: rtoStage,
      rtoInitiatedAt,
      rtoReturnedAt,
      error: rawStatus ? null : "No status found in Ekart response",
      history,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Ekart Direct",
        error: "Ekart Direct API request timed out",
      });
    }
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "Ekart Direct",
      error: error.message || "Failed to fetch Ekart tracking",
    });
  }
}
