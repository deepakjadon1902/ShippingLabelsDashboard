/**
 * Base tracking utilities, status normalization, TAT calculation,
 * delay detection, and checkpoint de-duplication.
 */

/**
 * Normalizes raw courier status into standard internal status:
 * "Pending" | "Shipped" | "Delivered" | "RTO" | null
 */
export function mapStatus(rawInput) {
  if (!rawInput) return null;
  const raw = String(rawInput).toLowerCase().trim();

  // Conservative check for Delivered
  if (
    (raw.includes("deliver") || raw === "dl" || raw === "successful-delivery") &&
    !raw.includes("undeliver") &&
    !raw.includes("not deliver") &&
    !raw.includes("un-deliver") &&
    !raw.includes("failed") &&
    !raw.includes("attempt") &&
    !raw.includes("out for deliver") &&
    !raw.includes("out for del") &&
    !raw.includes("delivery attempt")
  ) {
    return "Delivered";
  }

  // RTO / Returned / Refused / Undelivered / Cancelled / Rejected
  if (
    raw.includes("rto") ||
    raw.includes("return") ||
    raw.includes("undelivered") ||
    raw.includes("refused") ||
    raw.includes("rejected") ||
    raw.includes("cancelled") ||
    raw.includes("canceled") ||
    raw.includes("delivery failed") ||
    raw.includes("unable to deliver")
  ) {
    return "RTO";
  }

  // Pending / Manifested / Ready to Ship / Pickup scheduled / Info received
  if (
    raw === "pending" ||
    raw.includes("pending") ||
    raw.includes("manifest") ||
    raw.includes("ready to ship") ||
    raw.includes("pickup scheduled") ||
    raw.includes("pickup not attempted") ||
    raw.includes("pickup pending") ||
    raw.includes("pickup unattempted") ||
    raw.includes("info received") ||
    raw.includes("data received") ||
    raw.includes("label created") ||
    raw.includes("order created") ||
    raw.includes("not picked")
  ) {
    return "Pending";
  }

  // Shipped / In Transit / Picked / Dispatched / Out for Delivery / Booked
  if (
    raw.includes("in transit") ||
    raw.includes("intransit") ||
    raw.includes("transit") ||
    raw.includes("dispatch") ||
    raw.includes("shipped") ||
    raw.includes("out for delivery") ||
    raw.includes("out for del") ||
    raw.includes("ofd") ||
    raw.includes("picked") ||
    raw.includes("pickup") ||
    raw.includes("booked") ||
    raw.includes("available_for_pickup") ||
    raw === "it" ||
    raw === "bk"
  ) {
    return "Shipped";
  }

  return null;
}

/**
 * Checks if status indicates "Out for Delivery"
 */
export function isOutOfDelivery(rawInput) {
  if (!rawInput) return false;
  const raw = String(rawInput).toLowerCase();
  return (
    raw.includes("out for delivery") ||
    raw.includes("out for del") ||
    raw.includes("out_for_delivery") ||
    raw === "ofd"
  );
}

/**
 * Categorizes RTO progression stages
 */
export function detectRtoStatus(rawInput) {
  if (!rawInput) return null;
  const raw = String(rawInput).toLowerCase();

  if (
    raw.includes("rto delivered") ||
    raw.includes("returned to shipper") ||
    raw.includes("returned to client") ||
    raw.includes("return delivered") ||
    raw.includes("delivered to sender") ||
    raw.includes("rto complete")
  ) {
    return "RTO Delivered / Returned";
  }

  if (raw.includes("rto hub") || raw.includes("return hub")) {
    return "RTO Hub";
  }

  if (
    raw.includes("rto in transit") ||
    raw.includes("return in transit") ||
    raw.includes("returning to origin") ||
    raw.includes("return dispatch")
  ) {
    return "RTO In Transit";
  }

  if (
    raw.includes("rto") ||
    raw.includes("return initiated") ||
    raw.includes("return booked") ||
    raw.includes("undelivered") ||
    raw.includes("refused")
  ) {
    return "RTO Initiated";
  }

  return null;
}

/**
 * Detects delivery failure reason and distinguishes between delivery attempt and permanent failure
 */
export function detectFailure(rawInput) {
  if (!rawInput) return { isFailed: false, isAttempted: false, reason: null };
  const raw = String(rawInput).toLowerCase();

  let reason = null;
  let isFailed = false;
  let isAttempted = false;

  if (raw.includes("customer unavailable") || raw.includes("customer not available") || raw.includes("door locked") || raw.includes("premises closed")) {
    reason = "Customer unavailable / Premises closed";
    isAttempted = true;
  } else if (raw.includes("address") && (raw.includes("incorrect") || raw.includes("incomplete") || raw.includes("not found") || raw.includes("issue"))) {
    reason = "Incomplete / Incorrect address";
    isFailed = true;
  } else if (raw.includes("refused") || raw.includes("rejected") || raw.includes("cod not ready")) {
    reason = "Customer refused delivery";
    isFailed = true;
  } else if (raw.includes("undelivered") || raw.includes("delivery failed")) {
    reason = "Delivery failed";
    isFailed = true;
  } else if (raw.includes("attempted") || raw.includes("delivery attempt") || raw.includes("reattempt")) {
    reason = "Delivery attempted";
    isAttempted = true;
  }

  return { isFailed, isAttempted, reason };
}

/**
 * Formats a millisecond duration into a clean human-readable string:
 * e.g. "1 Day 20 Hours", "2 Days 5 Hours", "18 Hours", "45 Minutes"
 */
export function formatDuration(diffMs) {
  if (diffMs == null || isNaN(diffMs) || diffMs < 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "Day" : "Days"}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "Hour" : "Hours"}`);
  }
  if (parts.length === 0) {
    parts.push(`${Math.max(1, mins)} ${mins === 1 ? "Minute" : "Minutes"}`);
  }
  return parts.join(" ");
}

/**
 * Calculates Turnaround Time (TAT) in hours and formatted string
 */
export function calculateTAT(startDate, endDate) {
  if (!startDate || !endDate) return { tatHours: null, tatDisplay: null };
  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (isNaN(start) || isNaN(end) || end < start) {
      return { tatHours: null, tatDisplay: null };
    }

    const diffMs = end - start;
    const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
    const display = formatDuration(diffMs);

    return { tatHours: totalHours, tatDisplay: display };
  } catch {
    return { tatHours: null, tatDisplay: null };
  }
}

/**
 * Calculates delay status against expected delivery date
 */
export function calculateDelay(estimatedDeliveryStr, status) {
  if (!estimatedDeliveryStr) return { isDelayed: false, delayedDays: 0 };
  if (status === "Delivered" || status === "RTO") {
    return { isDelayed: false, delayedDays: 0 };
  }

  try {
    const estDate = new Date(estimatedDeliveryStr);
    if (isNaN(estDate.getTime())) return { isDelayed: false, delayedDays: 0 };

    const now = new Date();
    // Compare day boundaries
    if (now.getTime() > estDate.getTime()) {
      const diffMs = now.getTime() - estDate.getTime();
      const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return { isDelayed: true, delayedDays: days };
    }
  } catch {
    // Ignore date parse error
  }

  return { isDelayed: false, delayedDays: 0 };
}

/**
 * De-duplicates and merges checkpoints to avoid duplicates on repeated syncs
 * Checkpoint identity is: timestamp + description + location
 */
export function mergeCheckpoints(existing = [], incoming = []) {
  const seen = new Set();
  const merged = [];

  // Helper to build unique key for checkpoint using exact timestamp
  const makeKey = (c) => {
    const d = c.date ? new Date(c.date).getTime() : "";
    const desc = String(c.description || c.status || "").toLowerCase().trim();
    const loc = String(c.location || "").toLowerCase().trim();
    return `${d}_${desc}_${loc}`;
  };

  for (const c of incoming) {
    if (!c || (!c.description && !c.status && !c.date)) continue;
    const key = makeKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        date: c.date ? new Date(c.date).toISOString() : null,
        description: String(c.description || c.status || "").trim(),
        location: c.location ? String(c.location).trim() : null,
        status: c.status ? String(c.status).trim() : null,
        source: c.source ? String(c.source).trim() : null,
      });
    }
  }

  for (const c of existing) {
    if (!c || (!c.description && !c.status && !c.date)) continue;
    const key = makeKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        date: c.date ? new Date(c.date).toISOString() : null,
        description: String(c.description || c.status || "").trim(),
        location: c.location ? String(c.location).trim() : null,
        status: c.status ? String(c.status).trim() : null,
        source: c.source ? String(c.source).trim() : null,
      });
    }
  }

  // Sort chronologically descending (newest event first)
  merged.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });

  return merged;
}

/**
 * Standardized tracking result factory
 */
export function createTrackingResult({
  courier,
  trackingNumber,
  status = null,
  rawStatus = null,
  location = null,
  eventDate = null,
  eventDescription = null,
  estimatedDelivery = null,
  source = "none",
  provider = null,
  origin = null,
  destination = null,
  deliveredAt = null,
  pickupAt = null,
  rtoStatus = null,
  rtoInitiatedAt = null,
  rtoReturnedAt = null,
  error = null,
  history = [],
}) {
  const isoEventDate = eventDate ? new Date(eventDate).toISOString() : null;
  const isoDeliveredAt = deliveredAt ? new Date(deliveredAt).toISOString() : null;
  const isoPickupAt = pickupAt ? new Date(pickupAt).toISOString() : null;
  const activeProvider = provider || (source === "direct" ? `${courier} Direct` : source === "trackcourier" ? "TrackCourier.io" : "None");

  return {
    courier,
    trackingNumber: String(trackingNumber).trim(),
    trackingId: String(trackingNumber).trim(),
    status: status || null,
    rawStatus: rawStatus || null,
    location: location || null,
    currentLocation: location || null,
    eventDate: isoEventDate,
    latestEventAt: isoEventDate,
    eventDescription: eventDescription || null,
    latestEvent: eventDescription || null,
    estimatedDelivery: estimatedDelivery || null,
    expectedDelivery: estimatedDelivery || null,
    lastUpdated: new Date().toISOString(),
    source,
    provider: activeProvider,
    origin: origin || null,
    destination: destination || null,
    deliveredAt: isoDeliveredAt,
    pickupAt: isoPickupAt,
    pickedUpAt: isoPickupAt,
    rtoStatus: rtoStatus || null,
    rtoInitiatedAt: rtoInitiatedAt ? new Date(rtoInitiatedAt).toISOString() : null,
    rtoReturnedAt: rtoReturnedAt ? new Date(rtoReturnedAt).toISOString() : null,
    error: error || null,
    syncError: error || null,
    history: Array.isArray(history)
      ? history
          .map((item) => ({
            date: item.date ? new Date(item.date).toISOString() : null,
            description: String(item.description || item.status || "").trim(),
            location: item.location ? String(item.location).trim() : null,
            status: item.status ? String(item.status).trim() : null,
            source: item.source || source,
          }))
          .filter((item) => item.description || item.status || item.date)
      : [],
  };
}
