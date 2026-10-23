import { createTrackingResult, mapStatus, isGenuinePickupScan, isVerifiedPickupScan } from "./base.js";

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

/**
 * Resolves the secondary TrackCourier API key checking multiple standard variable names
 */
export function getTrackCourierBackupKey() {
  return (
    process.env.TRACKCOURIER_BACKUP_API_KEY ||
    process.env.TRACKCOURIER_SECONDARY_API_KEY ||
    process.env.TRACKCOURIER_ACCOUNT2_API_KEY ||
    process.env.TRACKCOURIER_KEY_2 ||
    process.env.TRACKCOURIER_API_KEY_2 ||
    null
  );
}

/**
 * Resolves the tertiary TrackCourier API key checking multiple standard variable names
 */
export function getTrackCourierTertiaryKey() {
  return (
    process.env.TRACKCOURIER_TERTIARY_API_KEY ||
    process.env.TRACKCOURIER_ACCOUNT3_API_KEY ||
    process.env.TRACKCOURIER_KEY_3 ||
    process.env.TRACKCOURIER_API_KEY_3 ||
    process.env.TRACKCOURIER_THIRD_API_KEY ||
    null
  );
}

/**
 * Checks whether TrackCourier API key is configured
 * @param {number|string} account - 1 for primary, 2 for secondary, 3 for tertiary
 */
export function hasTrackCourierKey(account = 1) {
  const acc = Number(account);
  if (acc === 3) {
    return !!getTrackCourierTertiaryKey();
  }
  if (acc === 2) {
    return !!getTrackCourierBackupKey();
  }
  return !!process.env.TRACKCOURIER_API_KEY;
}

/**
 * Checks whether backup TrackCourier Account 2 key is configured
 */
export function hasTrackCourierBackupKey() {
  return !!getTrackCourierBackupKey();
}

/**
 * Checks whether tertiary TrackCourier Account 3 key is configured
 */
export function hasTrackCourierTertiaryKey() {
  return !!getTrackCourierTertiaryKey();
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
  if (s === "out_for_delivery" || s === "outfordelivery") return "Shipped / Picked Up";
  if (s === "in_transit" || s === "intransit") return "Shipped / Picked Up";
  if (s === "pending" || s === "inforeceived" || s === "info_received" || s === "pickup_scheduled") return "Ready to Pick";
  if (s === "exception") {
    return mapStatus(mostRecentStatus) || "Shipped / Picked Up";
  }
  return mapStatus(rawStatus) || mapStatus(mostRecentStatus) || null;
}

/**
 * Fetches tracking information from TrackCourier.io across Account 1, 2, or 3
 * Endpoint: GET https://api.trackcourier.io/v1/track?courier={slug}&tracking_number={waybill}
 * Header: X-API-Key: {TRACKCOURIER_API_KEY} | {TRACKCOURIER_BACKUP_API_KEY} | {TRACKCOURIER_TERTIARY_API_KEY}
 *
 * @param {string} courierName - Name of courier service
 * @param {string} waybill - Tracking/AWB number
 * @param {Object} options - Options e.g. { account: 1 | 2 | 3 }
 */
export async function fetchTrackCourier(courierName, waybill, options = {}) {
  const account = Number(options?.account) === 3 ? 3 : Number(options?.account) === 2 ? 2 : 1;
  const key =
    account === 3
      ? getTrackCourierTertiaryKey()
      : account === 2
        ? getTrackCourierBackupKey()
        : process.env.TRACKCOURIER_API_KEY;

  const source = `trackcourier_account${account}`;
  const provider = `TrackCourier.io (Account ${account})`;
  const slug = getTrackCourierSlug(courierName) || String(courierName || "").toLowerCase().replace(/\s+/g, "");

  if (!key) {
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source,
      provider,
      error:
        account === 3
          ? "Missing TRACKCOURIER_TERTIARY_API_KEY in environment"
          : account === 2
            ? "Missing TRACKCOURIER_BACKUP_API_KEY in environment"
            : "Missing TRACKCOURIER_API_KEY in environment",
    });
  }

  if (!waybill) {
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source,
      provider,
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
        source,
        provider,
        error: `${provider} authentication failed (HTTP 401: Invalid API key)`,
        statusCode: 401,
        isAuthError: true,
      });
    }

    if (response.status === 402) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: `${provider} quota exceeded (HTTP 402)`,
        statusCode: 402,
        isQuotaError: true,
      });
    }

    if (response.status === 429) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: `${provider} rate limit reached (HTTP 429)`,
        statusCode: 429,
        isRateLimitError: true,
      });
    }

    if (response.status === 404) {
      const errPayload = await response.json().catch(() => ({}));
      const errMsg =
        errPayload.error?.message ||
        errPayload.message ||
        errPayload.detail ||
        `Shipment not found on ${provider} (courier: ${slug})`;
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: errMsg,
      });
    }

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      const errMsg =
        errPayload.error?.message ||
        errPayload.message ||
        errPayload.detail ||
        `${provider} HTTP ${response.status}`;
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: errMsg,
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!payload.success || !payload.data) {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: payload.detail || payload.message || payload.error?.message || `No tracking data returned by ${provider}`,
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

    // pickupAt is resolved from genuine physical checkpoints below
    let pickupAt = null;

    let deliveredAt = null;
    if (data.ShipmentSummary?.delivered_on_date) {
      const timePart = data.ShipmentSummary.delivered_on_time ? ` ${data.ShipmentSummary.delivered_on_time}` : "";
      const parsed = new Date(`${data.ShipmentSummary.delivered_on_date}${timePart}`);
      if (!isNaN(parsed.getTime())) deliveredAt = parsed.toISOString();
    }

    // Parse checkpoints
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
          source,
        };
      })
      .sort((a, b) => (new Date(b.date || 0) > new Date(a.date || 0) ? 1 : -1));

    for (let i = history.length - 1; i >= 0; i--) {
      const cp = history[i];
      if (isVerifiedPickupScan(cp.description || cp.status) && cp.date) {
        pickupAt = cp.date;
        break;
      }
    }

    const latestCheckpoint = history[0];
    const location = latestCheckpoint?.location || destination || origin || null;
    const eventDate = latestCheckpoint?.date || null;
    const eventDescription = mostRecentStatus || latestCheckpoint?.description || rawStatus;
    const internalStatus = normalizeTrackCourierStatus(data.status || data.ShipmentState, mostRecentStatus);

    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      status: internalStatus,
      rawStatus: rawStatus ? `[${source}] ${rawStatus}` : null,
      location,
      eventDate,
      eventDescription,
      estimatedDelivery,
      origin,
      destination,
      pickupAt,
      deliveredAt,
      source,
      provider,
      error: internalStatus ? null : (rawStatus ? null : "No status update available yet"),
      history,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return createTrackingResult({
        courier: courierName,
        trackingNumber: waybill,
        source,
        provider,
        error: `${provider} request timed out`,
      });
    }
    return createTrackingResult({
      courier: courierName,
      trackingNumber: waybill,
      source,
      provider,
      error: error.message,
    });
  }
}
