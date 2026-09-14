import { createTrackingResult, mapStatus } from "./base.js";

const COURIER_NAME = "Shree Maruti Courier";
const PROVIDER_NAME = "Shree Maruti Direct";
const DIRECT_TRACKING_BASE_URL = "https://apis-hubops.innofulfill.com/tracking/v2";

export const MARUTI_DEFAULT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// In-memory global upstream 429 cooldown tracker
let globalMarutiBlockedUntil = 0;
let globalMarutiBlockReason = null;

export function getMarutiGlobalCooldown() {
  const now = Date.now();
  if (globalMarutiBlockedUntil > now) {
    const remainingSeconds = Math.ceil((globalMarutiBlockedUntil - now) / 1000);
    return {
      isBlocked: true,
      blockedUntil: new Date(globalMarutiBlockedUntil).toISOString(),
      remainingSeconds,
      reason: globalMarutiBlockReason || "Shree Maruti tracking is temporarily rate-limited.",
    };
  }
  return { isBlocked: false, remainingSeconds: 0 };
}

export function setMarutiGlobalCooldown(seconds, reason = null) {
  const now = Date.now();
  const safeSeconds = Math.max(10, Math.min(seconds || 60, 24 * 3600)); // cap at 24 hours
  globalMarutiBlockedUntil = now + safeSeconds * 1000;
  globalMarutiBlockReason = reason;
}

export function clearMarutiGlobalCooldown() {
  globalMarutiBlockedUntil = 0;
  globalMarutiBlockReason = null;
}

/**
 * Normalizes Shree Maruti direct status category & subcategory into standard LabelStatus
 */
function normalizeShreeMarutiStatus(category, subcategory, rawStatus) {
  const cat = String(category || "").toUpperCase().trim();
  const sub = String(subcategory || "").toLowerCase().trim();
  const raw = String(rawStatus || "").toLowerCase().trim();

  // 1. Delivered
  if (
    cat === "DELIVERED" ||
    sub.includes("order has been delivered") ||
    sub.includes("delivered successfully") ||
    (raw.includes("delivered") && !raw.includes("undeliver") && !raw.includes("rto"))
  ) {
    return "Delivered";
  }

  // 2. RTO
  if (cat.includes("RTO") || sub.includes("rto") || raw.includes("rto")) {
    return "RTO";
  }

  // 3. Out for Delivery
  if (
    cat === "OUT_FOR_DELIVERY" ||
    sub.includes("out for delivery") ||
    sub.includes("out for del") ||
    sub === "ofd"
  ) {
    return "Shipped";
  }

  // 4. In Transit
  if (
    cat === "IN_TRANSIT" ||
    sub.includes("intransit") ||
    sub.includes("in transit") ||
    sub.includes("departed") ||
    sub.includes("processed at the intransit hub") ||
    raw.includes("inscan") ||
    raw.includes("outscan")
  ) {
    return "Shipped";
  }

  // 5. Pending / Pickup
  if (
    cat === "ORDER_CONFIRMED" ||
    cat === "READY_FOR_DISPATCH" ||
    sub.includes("order has been confirmed") ||
    sub.includes("ready to be dispatched") ||
    sub.includes("manifested") ||
    sub.includes("booked")
  ) {
    return "Pending";
  }

  // Fallback to base status mapper
  return mapStatus(sub || raw);
}

/**
 * Direct Shree Maruti Courier Tracking Adapter
 *
 * Directly queries Shree Maruti's official live tracking endpoint:
 * https://apis-hubops.innofulfill.com/tracking/v2/{awb}
 *
 * Extracts origin, destination, intermediate hubs, exact event timestamps,
 * location descriptions, delivery dates, and full checkpoint movement history.
 *
 * @param {string} trackingNumber - Shree Maruti AWB number
 * @param {Object} options - Options: { lastMarutiSync, force, cooldownMs }
 */
export async function trackShreeMaruti(trackingNumber, options = {}) {
  const waybill = String(trackingNumber || "").trim();
  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: PROVIDER_NAME,
      error: "Tracking number is required",
    });
  }

  const now = Date.now();

  // 1. Check global upstream 429 cooldown (blocks both automatic and manual refresh)
  const globalCheck = getMarutiGlobalCooldown();
  if (globalCheck.isBlocked) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: PROVIDER_NAME,
      error: `Shree Maruti tracking is temporarily rate-limited. Please try again after the courier cooldown (${globalCheck.remainingSeconds}s remaining).`,
    });
  }

  // 2. Check per-shipment cooldown (default 12 hours). Manual refresh (force: true) bypasses this per-shipment cooldown.
  const { lastMarutiSync, force = false, cooldownMs = MARUTI_DEFAULT_COOLDOWN_MS } = options;
  if (!force && lastMarutiSync) {
    const lastSyncTime = new Date(lastMarutiSync).getTime();
    if (!isNaN(lastSyncTime) && now - lastSyncTime < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - lastSyncTime)) / 60000);
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: PROVIDER_NAME,
        error: `Shree Maruti sync skipped: shipment checked within cooldown (${remainingMinutes}m remaining).`,
      });
    }
  }

  const endpoint = `${DIRECT_TRACKING_BASE_URL}/${encodeURIComponent(waybill)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return createTrackingResult({
          courier: COURIER_NAME,
          trackingNumber: waybill,
          source: "direct",
          provider: PROVIDER_NAME,
          error: "Shree Maruti did not return tracking data for this AWB.",
        });
      }
      if (response.status === 429) {
        // Read Retry-After header if provided
        const retryAfterHeader = response.headers.get("retry-after");
        let retryAfterSeconds = 60; // default 60s minimum backoff
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            retryAfterSeconds = parsed;
          }
        }
        // Activate global cooldown so subsequent shipments in this or next batch don't hammer the server
        setMarutiGlobalCooldown(
          retryAfterSeconds,
          "Shree Maruti tracking is temporarily rate-limited. Please try again after the courier cooldown.",
        );

        return createTrackingResult({
          courier: COURIER_NAME,
          trackingNumber: waybill,
          source: "direct",
          provider: PROVIDER_NAME,
          error: `Shree Maruti tracking is temporarily rate-limited. Please try again after the courier cooldown (${retryAfterSeconds}s).`,
        });
      }
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: PROVIDER_NAME,
        error: `Direct tracking service temporarily unavailable (HTTP ${response.status}).`,
      });
    }

    const data = await response.json().catch(() => null);

    if (!data || (!data.orderInformation && (!Array.isArray(data.statuses) || data.statuses.length === 0))) {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: PROVIDER_NAME,
        error: "No tracking update available from Shree Maruti yet.",
      });
    }

    // Extract Origin Location
    let origin = null;
    if (data.orderInformation?.sourceLocation) {
      const sl = data.orderInformation.sourceLocation;
      const parts = [sl.city, sl.state].filter(Boolean);
      origin = parts.join(", ");
    }

    // Extract Destination Location
    let destination = null;
    if (data.orderInformation?.destinationLocation) {
      const dl = data.orderInformation.destinationLocation;
      const parts = [dl.city, dl.state].filter(Boolean);
      destination = parts.join(", ");
    }

    // Process Statuses & Checkpoint History
    const rawStatuses = Array.isArray(data.statuses) ? data.statuses : [];
    
    // Sort descending by timestamp (newest first)
    const sortedStatuses = [...rawStatuses].sort((a, b) => {
      const ta = Number(a.statusTimestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0));
      const tb = Number(b.statusTimestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0));
      return tb - ta;
    });

    const history = sortedStatuses.map((s) => {
      const timestamp = s.statusTimestamp
        ? new Date(Number(s.statusTimestamp)).toISOString()
        : s.createdAt
          ? new Date(s.createdAt).toISOString()
          : null;
      const description = s.subcategory || s.event || s.status || "Checkpoint reached";
      const location = s.location || s.cpDetails?.cpName || null;

      return {
        date: timestamp,
        description: description.trim(),
        location: location ? location.trim() : null,
        status: s.category || s.status || null,
        source: "direct",
      };
    });

    // Determine latest event
    const latest = sortedStatuses[0] || {};
    const latestCategory = latest.category || "";
    const latestSubcategory = latest.subcategory || "";
    const latestLocation = latest.location || latest.cpDetails?.cpName || null;
    const latestEventDate = latest.statusTimestamp
      ? new Date(Number(latest.statusTimestamp)).toISOString()
      : latest.createdAt
        ? new Date(latest.createdAt).toISOString()
        : null;

    const normalizedStatus = normalizeShreeMarutiStatus(
      latestCategory,
      latestSubcategory,
      latest.status,
    );

    // Identify Delivered Event & Timestamp
    let deliveredAt = null;
    for (const s of sortedStatuses) {
      const cat = String(s.category || "").toUpperCase().trim();
      const sub = String(s.subcategory || "").toLowerCase().trim();
      if (cat === "DELIVERED" || sub.includes("order has been delivered")) {
        deliveredAt = s.statusTimestamp
          ? new Date(Number(s.statusTimestamp)).toISOString()
          : s.createdAt
            ? new Date(s.createdAt).toISOString()
            : null;
        break;
      }
    }

    // Identify Pickup Timestamp
    let pickupAt = null;
    for (let i = sortedStatuses.length - 1; i >= 0; i--) {
      const s = sortedStatuses[i];
      const cat = String(s.category || "").toUpperCase().trim();
      const st = String(s.status || "").toLowerCase().trim();
      if (
        cat === "IN_TRANSIT" ||
        st.includes("inscan") ||
        st.includes("outscan") ||
        st.includes("pickup") ||
        st.includes("dispatched")
      ) {
        pickupAt = s.statusTimestamp
          ? new Date(Number(s.statusTimestamp)).toISOString()
          : s.createdAt
            ? new Date(s.createdAt).toISOString()
            : null;
        break;
      }
    }

    // Identify RTO Lifecycle
    let rtoStatus = null;
    let rtoInitiatedAt = null;
    let rtoReturnedAt = null;

    const isRto =
      data.orderInformation?.movement_type === "rto" ||
      latestCategory.includes("RTO") ||
      latestSubcategory.toLowerCase().includes("rto");

    if (isRto) {
      if (latestCategory === "RTO_DELIVERED" || latestSubcategory.toLowerCase().includes("rto delivered")) {
        rtoStatus = "RTO Delivered / Returned";
        rtoReturnedAt = latestEventDate;
      } else if (latestCategory === "RTO_INITIATED" || latestSubcategory.toLowerCase().includes("rto initiated")) {
        rtoStatus = "RTO Initiated";
        rtoInitiatedAt = latestEventDate;
      } else {
        rtoStatus = "RTO In Transit";
      }

      // Check history for specific RTO timestamps if not in latest
      for (const s of sortedStatuses) {
        const cat = String(s.category || "").toUpperCase().trim();
        const sub = String(s.subcategory || "").toLowerCase().trim();
        if ((cat === "RTO_INITIATED" || sub.includes("rto initiated")) && !rtoInitiatedAt) {
          rtoInitiatedAt = s.statusTimestamp ? new Date(Number(s.statusTimestamp)).toISOString() : null;
        }
        if ((cat === "RTO_DELIVERED" || sub.includes("rto delivered")) && !rtoReturnedAt) {
          rtoReturnedAt = s.statusTimestamp ? new Date(Number(s.statusTimestamp)).toISOString() : null;
        }
      }
    }

    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      status: normalizedStatus,
      rawStatus: latestSubcategory || latest.status || latestCategory || "Active",
      location: latestLocation,
      eventDate: latestEventDate,
      eventDescription: latestSubcategory || latest.event || latest.status || null,
      source: "direct",
      provider: PROVIDER_NAME,
      origin,
      destination,
      deliveredAt,
      pickupAt,
      rtoStatus,
      rtoInitiatedAt,
      rtoReturnedAt,
      history,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: PROVIDER_NAME,
        error: "Direct Shree Maruti tracking request timed out.",
      });
    }
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: PROVIDER_NAME,
      error: `Direct Shree Maruti service temporarily unavailable: ${error.message}`,
    });
  }
}
