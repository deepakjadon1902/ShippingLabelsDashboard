import { createTrackingResult, mapStatus } from "./base.js";

/**
 * Supported courier slugs on TrackCourier.io
 */
export const TRACKCOURIER_SLUGS = {
  DTDC: "dtdc",
  Delhivery: "delhivery",
  "Blue Dart": "bluedart",
  Shadowfax: "shadowfax",
  Xpressbees: "xpressbees",
  "Ecom Express": "ecomexpress",
  "India Post": "indiapost",
};

export function hasTrackCourierKey() {
  return !!process.env.TRACKCOURIER_API_KEY;
}

export function getTrackCourierSlug(courierName) {
  if (!courierName) return null;
  const name = String(courierName).trim();
  if (TRACKCOURIER_SLUGS[name]) return TRACKCOURIER_SLUGS[name];

  const lower = name.toLowerCase();
  for (const [key, slug] of Object.entries(TRACKCOURIER_SLUGS)) {
    if (key.toLowerCase() === lower || slug.toLowerCase() === lower) {
      return slug;
    }
  }

  // Handle common variations and aliases
  if (
    lower === "indiapost" ||
    lower === "india-post" ||
    lower === "india post" ||
    lower === "speed post" ||
    lower === "speedpost"
  ) {
    return "indiapost";
  }
  if (
    lower === "ecom express" ||
    lower === "ecomexpress" ||
    lower === "ecom-express"
  ) {
    return "ecomexpress";
  }
  if (lower === "shadowfax") {
    return "shadowfax";
  }

  return lower.replace(/[\s-]+/g, "");
}

/**
 * Normalizes TrackCourier status values ("pending", "in_transit", "intransit", "out_for_delivery", "delivered", "exception")
 */
function normalizeTrackCourierStatus(rawStatus, mostRecentStatus) {
  const s = String(rawStatus || "").toLowerCase().trim();
  if (s === "delivered") return "Delivered";
  if (s === "out_for_delivery" || s === "outfordelivery") return "Shipped";
  if (s === "in_transit" || s === "intransit") return "Shipped";
  if (s === "pending" || s === "inforeceived" || s === "info_received") return "Pending";
  if (s === "exception") {
    return mapStatus(mostRecentStatus) || "Shipped";
  }
  return mapStatus(rawStatus) || mapStatus(mostRecentStatus) || null;
}

/**
 * Fetches tracking information from TrackCourier.io
 * Endpoint: GET https://api.trackcourier.io/v1/track?courier={slug}&tracking_number={waybill}
 * Header: X-API-Key: {TRACKCOURIER_API_KEY}
 */
export async function fetchTrackCourier(courierName, waybill) {
  const key = process.env.TRACKCOURIER_API_KEY;
  const slug = getTrackCourierSlug(courierName) || String(courierName || "").toLowerCase().replace(/\s+/g, "");

  if (!key) {
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source: "trackcourier",
      provider: "TrackCourier.io",
      error: "Missing TRACKCOURIER_API_KEY in environment",
    });
  }

  if (!waybill) {
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source: "trackcourier",
      provider: "TrackCourier.io",
      error: "Tracking number is required",
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const url = `https://api.trackcourier.io/v1/track?courier=${encodeURIComponent(
      slug,
    )}&tracking_number=${encodeURIComponent(waybill)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: "TrackCourier.io authentication failed (HTTP 401: Invalid API key)",
      });
    }

    if (response.status === 402) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: "TrackCourier.io quota exceeded (HTTP 402)",
      });
    }

    if (response.status === 404) {
      const errPayload = await response.json().catch(() => ({}));
      const errMsg =
        errPayload.error?.message ||
        errPayload.message ||
        errPayload.detail ||
        `Shipment not found on TrackCourier.io (courier: ${slug})`;
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: errMsg,
      });
    }

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      const errMsg =
        errPayload.error?.message ||
        errPayload.message ||
        errPayload.detail ||
        `TrackCourier.io HTTP ${response.status}`;
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: errMsg,
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!payload.success || !payload.data) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: payload.detail || payload.message || payload.error?.message || "No tracking data returned by TrackCourier.io",
      });
    }

    const data = payload.data;
    const rawStatus = data.status || data.MostRecentStatus || null;
    const mostRecentStatus = data.MostRecentStatus || null;
    const origin =
      data.OriginCity ||
      data.ShipmentSummary?.booked_at ||
      data.Origin ||
      null;
    const destination =
      data.DestinationCity ||
      data.ShipmentSummary?.destination ||
      data.Destination ||
      null;
    const estimatedDelivery = data.ExpectedDeliveryDate || null;

    let pickupAt = null;
    if (data.ShipmentSummary?.booked_on_date) {
      const timePart = data.ShipmentSummary.booked_on_time ? ` ${data.ShipmentSummary.booked_on_time}` : "";
      const parsed = new Date(`${data.ShipmentSummary.booked_on_date}${timePart}`);
      if (!isNaN(parsed.getTime())) pickupAt = parsed.toISOString();
    }

    let deliveredAt = null;
    if (data.ShipmentSummary?.delivered_on_date) {
      const timePart = data.ShipmentSummary.delivered_on_time ? ` ${data.ShipmentSummary.delivered_on_time}` : "";
      const parsed = new Date(`${data.ShipmentSummary.delivered_on_date}${timePart}`);
      if (!isNaN(parsed.getTime())) deliveredAt = parsed.toISOString();
    }

    // Parse checkpoints (TrackCourier returns data.Checkpoints or data.checkpoints)
    const rawCheckpoints = Array.isArray(data.Checkpoints)
      ? data.Checkpoints
      : Array.isArray(data.checkpoints)
        ? data.checkpoints
        : [];

    const history = rawCheckpoints
      .map((cp) => {
        let date = null;
        if (cp.timestamp) {
          date = new Date(cp.timestamp).toISOString();
        } else if (cp.Date) {
          const timePart = cp.Time ? ` ${cp.Time}` : " 00:00:00";
          const parsed = new Date(`${cp.Date}${timePart}`);
          if (!isNaN(parsed.getTime())) date = parsed.toISOString();
        }
        const description = cp.Activity || cp.status || cp.description || "";
        const location = cp.Location || cp.location || null;
        const status = cp.CheckpointState || cp.status || null;

        return {
          date: date && !isNaN(new Date(date).getTime()) ? date : null,
          description: String(description).trim(),
          location: location ? String(location).trim() : null,
          status: status ? String(status).trim() : null,
          source: "trackcourier",
        };
      })
      .sort((a, b) => (new Date(b.date || 0) > new Date(a.date || 0) ? 1 : -1));

    const latestCheckpoint = history[0];
    const location = latestCheckpoint?.location || destination || origin || null;
    const eventDate = latestCheckpoint?.date || null;
    const eventDescription = mostRecentStatus || latestCheckpoint?.description || rawStatus;
    const internalStatus = normalizeTrackCourierStatus(data.status || data.ShipmentState, mostRecentStatus);

    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      status: internalStatus,
      rawStatus: rawStatus ? `[trackcourier] ${rawStatus}` : null,
      location,
      eventDate,
      eventDescription,
      estimatedDelivery,
      origin,
      destination,
      pickupAt,
      deliveredAt,
      source: "trackcourier",
      provider: "TrackCourier.io",
      error: internalStatus ? null : (rawStatus ? null : "No status update available yet"),
      history,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source: "trackcourier",
        provider: "TrackCourier.io",
        error: "TrackCourier.io request timed out",
      });
    }
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source: "trackcourier",
      provider: "TrackCourier.io",
      error: error.message,
    });
  }
}
