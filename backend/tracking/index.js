import {
  createTrackingResult,
  mapStatus,
  isOutOfDelivery,
  detectRtoStatus,
  detectFailure,
  calculateTAT,
  calculateDelay,
  mergeCheckpoints,
} from "./adapters/base.js";
import { trackDTDC, hasDtdcToken } from "./adapters/dtdc.js";
import {
  trackShreeMaruti,
  getMarutiGlobalCooldown,
  clearMarutiGlobalCooldown,
} from "./adapters/shree-maruti.js";
import { trackDelhivery, hasDelhiveryToken } from "./adapters/delhivery.js";
import {
  fetchTrackCourier,
  hasTrackCourierKey,
  TRACKCOURIER_SLUGS,
} from "./adapters/trackcourier.js";
import { trackEkart } from "./adapters/ekart.js";
import {
  trackShadowfax,
  hasShadowfaxToken,
  isShadowfaxDirectConfigured,
  normalizeShadowfaxWebhookPayload,
} from "./adapters/shadowfax.js";
import {
  executeTrackRequest,
  getTrackingSettings,
  updateTrackingSettings,
  getTrackingUsageStats,
  resetCircuitBreaker,
  tripCircuitBreaker,
  isCircuitBreakerTripped,
} from "./controller.js";

export {
  normalizeShadowfaxWebhookPayload,
  executeTrackRequest,
  getTrackingSettings,
  updateTrackingSettings,
  getTrackingUsageStats,
  resetCircuitBreaker,
  tripCircuitBreaker,
  isCircuitBreakerTripped,
};

export const AUTO_TRACK_COURIERS = new Set([
  "Delhivery",
  "DTDC",
  "Shree Maruti Courier",
  "Ekart",
  "Ekart Logistics",
  "Shadowfax",
  "India Post",
  "IndiaPost",
  ...Object.keys(TRACKCOURIER_SLUGS),
]);

export function getTrackingCredentialsStatus() {
  return {
    delhivery: hasDelhiveryToken(),
    dtdc: hasDtdcToken(),
    trackcourier: hasTrackCourierKey(1),
    trackcourier_account1: hasTrackCourierKey(1),
    trackcourier_account2: hasTrackCourierKey(2),
    trackcourier_account3: hasTrackCourierKey(3),
    shadowfax: isShadowfaxDirectConfigured(),
  };
}

export function isCourierAutoTrackable(courierName) {
  return AUTO_TRACK_COURIERS.has(courierName);
}

/**
 * Routes tracking requests to the appropriate courier adapter through the central controller.
 * Implements a controlled 3-tier cascade across TrackCourier accounts (Account 1 -> Account 2 -> Account 3).
 *
 * @param {string} courierName - Name of the courier service
 * @param {string} trackingNumber - Waybill or AWB number
 * @param {Object} options - Additional options e.g. { lastTrackcourierSync, force, source }
 */
export async function trackShipment(courierName, trackingNumber, options = {}) {
  const courier = String(courierName || "").trim();
  const waybill = String(trackingNumber || "").trim();
  const source = options.source || "manual";
  const force = !!options.force;

  if (!waybill) {
    return createTrackingResult({
      courier,
      trackingNumber: waybill,
      source: "none",
      error: "Tracking number is required",
    });
  }

  // 1. Primary Tracking Provider Execution
  let primaryResult = null;

  if (courier === "DTDC") {
    primaryResult = await executeTrackRequest({
      provider: "DTDC",
      courier,
      awb: waybill,
      source,
      force,
      cooldownMs: options.cooldownMs,
      executeFn: () => trackDTDC(waybill, options),
    });
  } else if (courier === "Shree Maruti Courier") {
    primaryResult = await executeTrackRequest({
      provider: "Shree Maruti Courier",
      courier,
      awb: waybill,
      source,
      force,
      cooldownMs: options.cooldownMs,
      executeFn: () => trackShreeMaruti(waybill, options),
    });
  } else if (courier === "Delhivery") {
    primaryResult = await executeTrackRequest({
      provider: "Delhivery",
      courier,
      awb: waybill,
      source,
      force,
      cooldownMs: options.cooldownMs,
      executeFn: () => trackDelhivery(waybill),
    });
  } else if (courier === "Ekart" || courier === "Ekart Logistics") {
    primaryResult = await executeTrackRequest({
      provider: "Ekart",
      courier,
      awb: waybill,
      source,
      force,
      cooldownMs: options.cooldownMs,
      executeFn: () => trackEkart(waybill),
    });
  } else if (courier === "Shadowfax") {
    const providerName = isShadowfaxDirectConfigured() ? "Shadowfax" : (hasTrackCourierKey() ? "TrackCourier" : "Shadowfax");
    primaryResult = await executeTrackRequest({
      provider: providerName,
      courier,
      awb: waybill,
      source,
      force,
      cooldownMs: options.cooldownMs,
      executeFn: () => trackShadowfax(waybill, options),
    });
  } else if (courier === "India Post" || courier === "IndiaPost" || TRACKCOURIER_SLUGS[courier]) {
    // 1. Primary: TrackCourier Account 1
    let resAccount1 = null;
    if (hasTrackCourierKey(1) && !isCircuitBreakerTripped("trackcourier_account1")) {
      resAccount1 = await executeTrackRequest({
        provider: "TrackCourier (Account 1)",
        courier,
        awb: waybill,
        source,
        force,
        cooldownMs: options.cooldownMs,
        executeFn: () => fetchTrackCourier(courier, waybill, { account: 1 }),
      });
    } else {
      resAccount1 = {
        skipped: true,
        isCircuitBreakerActive: isCircuitBreakerTripped("trackcourier_account1"),
        reason: isCircuitBreakerTripped("trackcourier_account1")
          ? "TrackCourier Account 1 circuit breaker active (HTTP 402 quota exhausted)"
          : "TrackCourier Account 1 key not configured",
        provider: "TrackCourier (Account 1)",
        courier,
        trackingNumber: waybill,
      };
    }

    const isAccount1Success =
      resAccount1 &&
      !resAccount1.error &&
      !resAccount1.skipped &&
      (resAccount1.status || resAccount1.rawStatus);

    if (isAccount1Success) {
      primaryResult = resAccount1;
    } else if (resAccount1?.cooldownActive || resAccount1?.reason?.includes("globally disabled")) {
      primaryResult = resAccount1;
    } else if (hasTrackCourierKey(2) && !isCircuitBreakerTripped("trackcourier_account2")) {
      // 2. Secondary: TrackCourier Account 2 (attempted when Account 1 fails/tripped/exhausted)
      const resAccount2 = await executeTrackRequest({
        provider: "TrackCourier (Account 2)",
        courier,
        awb: waybill,
        source: "fallback",
        force,
        cooldownMs: options.cooldownMs,
        executeFn: () => fetchTrackCourier(courier, waybill, { account: 2 }),
      });

      const isAccount2Success =
        resAccount2 &&
        !resAccount2.error &&
        !resAccount2.skipped &&
        (resAccount2.status || resAccount2.rawStatus);

      if (isAccount2Success) {
        primaryResult = {
          ...resAccount2,
          error: null, // Clear error from Account 1 so UI notifications do not show false quota warning
        };
      } else if (resAccount2?.cooldownActive || resAccount2?.reason?.includes("globally disabled")) {
        primaryResult = resAccount2;
      } else if (hasTrackCourierKey(3) && !isCircuitBreakerTripped("trackcourier_account3")) {
        // 3. Tertiary: TrackCourier Account 3 (attempted when Accounts 1 & 2 fail/tripped/exhausted)
        const resAccount3 = await executeTrackRequest({
          provider: "TrackCourier (Account 3)",
          courier,
          awb: waybill,
          source: "fallback",
          force,
          cooldownMs: options.cooldownMs,
          executeFn: () => fetchTrackCourier(courier, waybill, { account: 3 }),
        });

        const isAccount3Success =
          resAccount3 &&
          !resAccount3.error &&
          !resAccount3.skipped &&
          (resAccount3.status || resAccount3.rawStatus);

        if (isAccount3Success) {
          primaryResult = {
            ...resAccount3,
            error: null, // Clear errors from Accounts 1 & 2
          };
        } else {
          primaryResult = {
            ...resAccount1,
            error: `All TrackCourier accounts failed or quota exhausted. Account 1: ${resAccount1?.error || resAccount1?.reason || "Unavailable"}. Account 2: ${resAccount2?.error || resAccount2?.reason || "Unavailable"}. Account 3: ${resAccount3?.error || resAccount3?.reason || "Unavailable"}`,
          };
        }
      } else {
        primaryResult = {
          ...resAccount1,
          error: `TrackCourier Account 1 failed (${resAccount1?.error || resAccount1?.reason || "HTTP 402"}) and Account 2 failed (${resAccount2?.error || resAccount2?.reason || "Unavailable"})`,
        };
      }
    } else if (hasTrackCourierKey(3) && !isCircuitBreakerTripped("trackcourier_account3")) {
      // Direct failover to Account 3 if Account 2 is not configured or tripped
      const resAccount3 = await executeTrackRequest({
        provider: "TrackCourier (Account 3)",
        courier,
        awb: waybill,
        source: "fallback",
        force,
        cooldownMs: options.cooldownMs,
        executeFn: () => fetchTrackCourier(courier, waybill, { account: 3 }),
      });

      const isAccount3Success =
        resAccount3 &&
        !resAccount3.error &&
        !resAccount3.skipped &&
        (resAccount3.status || resAccount3.rawStatus);

      if (isAccount3Success) {
        primaryResult = {
          ...resAccount3,
          error: null, // Clear error from Account 1
        };
      } else {
        primaryResult = {
          ...resAccount1,
          error: `TrackCourier Account 1 failed (${resAccount1?.error || resAccount1?.reason || "HTTP 402"}) and Account 3 failed (${resAccount3?.error || resAccount3?.reason || "Unavailable"})`,
        };
      }
    } else {
      primaryResult = resAccount1;
    }
  } else {
    primaryResult = createTrackingResult({
      courier,
      trackingNumber: waybill,
      source: "none",
      error: `No tracking API available for ${courier}`,
    });
  }

  return primaryResult;
}

/**
 * Applies a normalized tracking result onto a Mongoose Label document
 * with strict data truth, duplicate prevention, and operational metrics calculation.
 */
export function applyTrackingResultToLabel(label, trackingResult) {
  const now = new Date();
  label.last_sync_attempt = now;
  label.last_tracking_update = now;

  // Track when TrackCourier fallback was actually queried
  if (trackingResult.source === "trackcourier" || trackingResult.source?.startsWith("trackcourier_account")) {
    label.last_trackcourier_sync = now;
  }

  // Track when Shree Maruti Direct was successfully/cleanly queried
  if (
    label.courier_name === "Shree Maruti Courier" &&
    trackingResult.source === "direct" &&
    !trackingResult.error?.includes("cooldown") &&
    !trackingResult.error?.includes("skipped") &&
    !trackingResult.error?.includes("rate-limited")
  ) {
    label.last_maruti_sync = now;
  }

  // Audit and error tracking
  if (!trackingResult.error) {
    label.last_successful_sync = now;
    label.last_tracking_error = null;
  } else {
    // Preserve error string for audit
    label.last_tracking_error = trackingResult.error;
  }

  if (trackingResult.rawStatus) {
    label.raw_courier_status = trackingResult.rawStatus;
  }

  if (trackingResult.location) {
    label.tracking_location = trackingResult.location;
  }
  if (trackingResult.eventDate) {
    label.tracking_event_date = new Date(trackingResult.eventDate);
  }
  if (trackingResult.eventDescription) {
    label.tracking_event_description = trackingResult.eventDescription;
  }
  if (trackingResult.estimatedDelivery) {
    label.tracking_estimated_delivery = trackingResult.estimatedDelivery;
  }
  if (trackingResult.source && trackingResult.source !== "none") {
    label.tracking_source = trackingResult.source;
  }
  if (trackingResult.provider) {
    label.tracking_provider = trackingResult.provider;
  } else if (trackingResult.source === "direct") {
    label.tracking_provider = `${label.courier_name} Direct`;
  } else if (trackingResult.source === "trackcourier_account3") {
    label.tracking_provider = "TrackCourier.io (Account 3)";
  } else if (trackingResult.source === "trackcourier_account2") {
    label.tracking_provider = "TrackCourier.io (Account 2)";
  } else if (trackingResult.source === "trackcourier" || trackingResult.source === "trackcourier_account1") {
    label.tracking_provider = "TrackCourier.io (Account 1)";
  }

  // De-duplicate and merge checkpoints
  const mergedHistory = mergeCheckpoints(label.tracking_history || [], trackingResult.history || []);
  label.tracking_history = mergedHistory;

  // Route locations: Use direct courier route if provided, otherwise fallback to address/checkpoints
  if (trackingResult.destination) {
    label.destination_location = trackingResult.destination;
  } else if (!label.destination_location && label.receiver_city) {
    label.destination_location = `${label.receiver_city}${label.receiver_state ? `, ${label.receiver_state}` : ""}`;
  }

  if (trackingResult.origin) {
    label.origin_location = trackingResult.origin;
  } else if (!label.origin_location) {
    if (label.sender_address) {
      const parts = label.sender_address.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
      label.origin_location = parts[parts.length - 1] || parts[0] || null;
    }
    // Or from the earliest checkpoint
    if (!label.origin_location && mergedHistory.length > 0) {
      const earliest = mergedHistory[mergedHistory.length - 1];
      if (earliest?.location) label.origin_location = earliest.location;
    }
  }

  // Pickup timestamp detection
  if (trackingResult.pickupAt) {
    label.pickup_at = new Date(trackingResult.pickupAt);
  } else if (!label.pickup_at && mergedHistory.length > 0) {
    for (let i = mergedHistory.length - 1; i >= 0; i--) {
      const c = mergedHistory[i];
      const desc = (c.description || c.status || "").toLowerCase();
      if (
        desc.includes("pick") ||
        desc.includes("book") ||
        desc.includes("manifest") ||
        desc.includes("received") ||
        desc.includes("in transit")
      ) {
        if (c.date) {
          label.pickup_at = new Date(c.date);
          break;
        }
      }
    }
  }

  // Failure & attempt detection
  const failureAnalysis = detectFailure(trackingResult.rawStatus || trackingResult.eventDescription);
  label.is_delivery_failed = failureAnalysis.isFailed;
  if (failureAnalysis.reason) {
    label.delivery_failure_reason = failureAnalysis.reason;
  }

  // RTO Lifecycle stages
  if (trackingResult.rtoStatus) {
    label.rto_status = trackingResult.rtoStatus;
    if (trackingResult.rtoInitiatedAt) {
      label.rto_initiated_at = new Date(trackingResult.rtoInitiatedAt);
    } else if (!label.rto_initiated_at) {
      label.rto_initiated_at = trackingResult.eventDate ? new Date(trackingResult.eventDate) : now;
    }
    if (trackingResult.rtoReturnedAt) {
      label.rto_returned_at = new Date(trackingResult.rtoReturnedAt);
    } else if (trackingResult.rtoStatus === "RTO Delivered / Returned" && !label.rto_returned_at) {
      label.rto_returned_at = trackingResult.eventDate ? new Date(trackingResult.eventDate) : now;
    }
  } else {
    const rtoStage = detectRtoStatus(trackingResult.rawStatus || trackingResult.eventDescription);
    if (rtoStage) {
      label.rto_status = rtoStage;
      if (!label.rto_initiated_at) {
        label.rto_initiated_at = trackingResult.eventDate ? new Date(trackingResult.eventDate) : now;
      }
      if (rtoStage === "RTO Delivered / Returned" && !label.rto_returned_at) {
        label.rto_returned_at = trackingResult.eventDate ? new Date(trackingResult.eventDate) : now;
      }
    }
  }

  // Status transitions & API conflict protection
  const prevStatus = label.status;
  const newStatus = trackingResult.status;

  if (prevStatus === "Delivered" && newStatus && newStatus !== "Delivered") {
    // Conflict protection: Never downgrade a confirmed Delivered shipment due to incomplete response
    label.api_status_conflict = `API Conflict: response reported "${newStatus}" but shipment was already confirmed Delivered`;
  } else if (newStatus && prevStatus !== "Delivered" && prevStatus !== "RTO") {
    label.status = newStatus;
    label.api_status_conflict = null;
  }

  // Delivery timestamp detection
  if (trackingResult.deliveredAt) {
    label.delivered_at = new Date(trackingResult.deliveredAt);
  } else if (label.status === "Delivered" && !label.delivered_at) {
    let deliveryDateFound = null;
    for (const c of mergedHistory) {
      const desc = (c.description || c.status || "").toLowerCase();
      if (desc.includes("deliver") && !desc.includes("undeliver") && !desc.includes("attempt")) {
        if (c.date) {
          deliveryDateFound = new Date(c.date);
          break;
        }
      }
    }
    const candidateDate = deliveryDateFound || (trackingResult.eventDate ? new Date(trackingResult.eventDate) : null);
    if (candidateDate && !isNaN(candidateDate.getTime())) {
      label.delivered_at = candidateDate;
    }
  }

  // Calculate TAT (Turnaround Time)
  if (label.delivered_at) {
    const startPoint = label.pickup_at || label.created_at;
    const tat = calculateTAT(startPoint, label.delivered_at);
    label.tat_hours = tat.tatHours;
    label.tat_display = tat.tatDisplay;
  }

  // Calculate delay against expected delivery
  const delayInfo = calculateDelay(label.tracking_estimated_delivery, label.status);
  label.is_delayed = delayInfo.isDelayed;
  label.delayed_days = delayInfo.delayedDays;

  return {
    label,
    statusChanged: label.status !== prevStatus,
    previousStatus: prevStatus,
    newStatus: label.status,
  };
}

/**
 * Refreshes tracking for a single Label document
 *
 * @param {Object} label - Mongoose Label document
 * @param {Object} options - Options e.g. { force: boolean }
 */
export async function refreshOneLabel(label, options = {}) {
  // Terminal status check: do not poll if already delivered or RTO returned, unless force refresh
  const isTerminal =
    label.status === "Delivered" ||
    label.rto_status === "RTO Delivered / Returned";

  if (isTerminal && !options.force) {
    return {
      skipped: true,
      reason: `Shipment is in terminal state (${label.status || label.rto_status})`,
      status: label.status,
    };
  }

  if (!isCourierAutoTrackable(label.courier_name)) {
    return {
      skipped: true,
      reason: `No tracking API for ${label.courier_name}`,
      status: label.status,
    };
  }

  const trackingResult = await trackShipment(label.courier_name, label.tracking_id, {
    lastTrackcourierSync: label.last_trackcourier_sync,
    lastMarutiSync: label.last_maruti_sync,
    force: options.force || false,
    cooldownMs: options.cooldownMs,
    source: options.source || "manual",
    allowFallback: options.allowFallback || false,
  });

  if (trackingResult.skipped) {
    return {
      skipped: true,
      reason: trackingResult.reason,
      status: label.status,
      cooldownActive: !!trackingResult.cooldownActive,
      remainingSeconds: trackingResult.remainingSeconds || 0,
      isCircuitBreakerActive: !!trackingResult.isCircuitBreakerActive,
    };
  }

  const { statusChanged, newStatus } = applyTrackingResultToLabel(label, trackingResult);

  await label.save();

  return {
    skipped: false,
    ok: !trackingResult.error,
    ...trackingResult,
    statusChanged,
    updatedStatus: newStatus,
    delivered_at: label.delivered_at,
    pickup_at: label.pickup_at,
    tat_display: label.tat_display,
    is_delayed: label.is_delayed,
    rto_status: label.rto_status,
  };
}

export {
  mapStatus,
  isOutOfDelivery,
  getMarutiGlobalCooldown,
  clearMarutiGlobalCooldown,
};
