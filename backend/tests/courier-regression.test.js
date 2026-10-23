import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrackingResult,
  mapStatus,
  detectRtoStatus,
  detectFailure,
  calculateTAT,
  calculateDelay,
  mergeCheckpoints,
} from "../tracking/adapters/base.js";

import { getTrackCourierSlug } from "../tracking/adapters/trackcourier.js";
import { isCourierAutoTrackable, AUTO_TRACK_COURIERS, applyTrackingResultToLabel } from "../tracking/index.js";

test("Courier Regression: Auto-trackable couriers set contains all core providers", () => {
  const coreCouriers = [
    "Delhivery",
    "DTDC",
    "Shree Maruti Courier",
    "Ekart",
    "Shadowfax",
    "India Post",
  ];

  for (const c of coreCouriers) {
    assert.equal(isCourierAutoTrackable(c), true, `${c} must be auto-trackable`);
  }
});

test("Courier Regression: TrackCourier slugs map accurately", () => {
  assert.equal(getTrackCourierSlug("Delhivery"), "delhivery");
  assert.equal(getTrackCourierSlug("DTDC"), "dtdc");
  assert.equal(getTrackCourierSlug("India Post"), "indiapost");
  assert.equal(getTrackCourierSlug("Shadowfax"), "shadowfax");
  assert.equal(getTrackCourierSlug("Ekart"), "ekart");
  assert.equal(getTrackCourierSlug("Shree Maruti Courier"), "shreemaruticourier");
});

test("Courier Regression: Status mapping preserves data integrity", () => {
  assert.equal(mapStatus("delivered"), "Delivered");
  assert.equal(mapStatus("DELIVERED"), "Delivered");
  assert.equal(mapStatus("in transit"), "Shipped");
  assert.equal(mapStatus("out for delivery"), "Shipped");
  assert.equal(mapStatus("booked"), "Shipped");
  assert.equal(mapStatus("manifested"), "Pending");
  assert.equal(mapStatus("rto"), "RTO");
  assert.equal(mapStatus("returned"), "RTO");
});

test("Courier Regression: RTO lifecycle stages are accurately detected", () => {
  assert.equal(detectRtoStatus("RTO delivered to sender"), "RTO Delivered / Returned");
  assert.equal(detectRtoStatus("Return hub arrival"), "RTO Hub");
  assert.equal(detectRtoStatus("RTO in transit back to origin"), "RTO In Transit");
  assert.equal(detectRtoStatus("Customer refused, return initiated"), "RTO Initiated");
});

test("Courier Regression: Delivery failures detect actionable reason", () => {
  const failure1 = detectFailure("Customer not available at address");
  assert.equal(failure1.isAttempted, true);
  assert.match(failure1.reason, /Customer unavailable/);

  const failure2 = detectFailure("Incomplete address, landmark missing");
  assert.equal(failure2.isFailed, true);
  assert.match(failure2.reason, /address/);
});

test("Courier Regression: TAT (Turnaround Time) calculation", () => {
  const start = new Date("2026-10-01T10:00:00Z");
  const end = new Date("2026-10-03T16:00:00Z"); // 54 hours
  const tat = calculateTAT(start, end);
  assert.equal(tat.tatHours, 54);
  assert.match(tat.tatDisplay, /2 Days 6 Hours/);
});

test("Courier Regression: Delay detection against SLA", () => {
  const pastEstimated = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const delay = calculateDelay(pastEstimated, "Shipped");
  assert.equal(delay.isDelayed, true);
  assert.ok(delay.delayedDays >= 2);
});

test("Courier Regression: Merge checkpoints removes duplicates and sorts chronologically", () => {
  const existing = [
    { date: "2026-10-01T10:00:00Z", description: "Dispatched", location: "Delhi", source: "direct" },
  ];
  const incoming = [
    { date: "2026-10-01T10:00:00Z", description: "Dispatched", location: "Delhi", source: "backup" },
    { date: "2026-10-02T12:00:00Z", description: "Out for Delivery", location: "Mumbai", source: "backup" },
  ];

  const merged = mergeCheckpoints(existing, incoming);
  assert.equal(merged.length, 2, "Duplicate checkpoint must be merged");
  assert.equal(merged[0].description, "Out for Delivery", "Latest event must be first");
});

test("Courier Regression: Genuine long-duration shipment TAT calculation is not rejected", () => {
  const pickup = new Date("2026-09-18T07:36:38.000Z");
  const delivered = new Date("2026-10-22T12:22:17.000Z");
  const tat = calculateTAT(pickup, delivered);
  assert.equal(tat.tatHours, 820.8);
  assert.equal(tat.tatDisplay, "34 Days 4 Hours");
});

test("Courier Regression: Invalid and out-of-order timestamps return null TAT", () => {
  const pickup = new Date("2026-10-22T12:00:00Z");
  const deliveredEarlier = new Date("2026-10-20T10:00:00Z"); // delivered before pickup
  assert.deepEqual(calculateTAT(pickup, deliveredEarlier), { tatHours: null, tatDisplay: null });
  assert.deepEqual(calculateTAT(null, deliveredEarlier), { tatHours: null, tatDisplay: null });
  assert.deepEqual(calculateTAT("invalid-date", deliveredEarlier), { tatHours: null, tatDisplay: null });
});

test("Courier Regression: Timezone and midnight boundary crossing calculates exact TAT", () => {
  const start = new Date("2026-10-20T23:30:00Z");
  const end = new Date("2026-10-21T02:00:00Z"); // 2.5 hours crossing midnight
  const tat = calculateTAT(start, end);
  assert.equal(tat.tatHours, 2.5);
  assert.equal(tat.tatDisplay, "2 Hours");
});

test("Courier Regression: Old completed shipments preserve accurate historical TAT", () => {
  const start = new Date("2026-07-01T08:00:00Z");
  const end = new Date("2026-07-05T14:30:00Z"); // 4 days 6.5 hours
  const tat = calculateTAT(start, end);
  assert.equal(tat.tatHours, 102.5);
  assert.equal(tat.tatDisplay, "4 Days 6 Hours");
});

test("Courier Regression: Missing pickup timestamp does NOT invent TAT from created_at", () => {
  const label = {
    created_at: new Date("2026-10-10T10:00:00Z"),
    pickup_at: null,
    delivered_at: null,
    status: "Shipped",
    tracking_history: [],
  };

  const trackingResult = createTrackingResult({
    courier: "Delhivery",
    trackingNumber: "13090325802010",
    status: "Delivered",
    deliveredAt: "2026-10-14T15:00:00Z",
    pickupAt: null, // Courier did NOT provide pickup timestamp
    history: [
      { date: "2026-10-14T15:00:00Z", description: "Delivered", status: "DELIVERED" },
    ],
  });

  applyTrackingResultToLabel(label, trackingResult);

  assert.equal(label.status, "Delivered");
  assert.equal(label.pickup_at, null);
  assert.equal(label.tat_hours, null, "Must NOT invent TAT when pickup is missing");
  assert.equal(label.tat_display, null, "Must NOT invent TAT display when pickup is missing");
});

test("Courier Regression: Recycled AWB checkpoints from prior lifecycles are filtered out", () => {
  const label = {
    created_at: new Date("2026-10-17T11:22:38Z"),
    pickup_at: null,
    delivered_at: null,
    status: "Shipped",
    tracking_history: [
      {
        date: "2026-09-18T07:36:38.000Z",
        description: "Shipment being processed at the InTransit Hub BENGALURU-NAGAWARA",
        location: "BENGALURU-NAGAWARA",
        status: "IN_TRANSIT",
      },
    ],
  };

  const trackingResult = createTrackingResult({
    courier: "Shree Maruti Courier",
    trackingNumber: "26288200067281",
    status: "Delivered",
    pickupAt: "2026-10-17T15:55:22.000Z",
    deliveredAt: "2026-10-22T12:22:17.000Z",
    history: [
      {
        date: "2026-10-22T12:22:17.000Z",
        description: "Order has been delivered",
        location: "NOIDA-CO",
        status: "DELIVERED",
      },
      {
        date: "2026-10-17T15:55:22.000Z",
        description: "Shipment being processed at the InTransit Hub MATHURA HUB",
        location: "MATHURA HUB",
        status: "IN_TRANSIT",
      },
      {
        date: "2026-10-17T13:31:57.000Z",
        description: "Order is ready to be dispatched",
        location: "MATHURA",
        status: "READY_FOR_DISPATCH",
      },
    ],
  });

  applyTrackingResultToLabel(label, trackingResult);

  assert.equal(label.status, "Delivered");
  assert.equal(new Date(label.pickup_at).toISOString(), "2026-10-17T15:55:22.000Z");
  assert.equal(new Date(label.delivered_at).toISOString(), "2026-10-22T12:22:17.000Z");
  assert.equal(label.tat_hours, 116.4);
  assert.equal(label.tat_display, "4 Days 20 Hours");
  // Ensure the stale Sept 18 checkpoint was purged
  const hasStaleSept18 = label.tracking_history.some((c) => c.date?.includes("2026-09-18"));
  assert.equal(hasStaleSept18, false, "Stale recycled checkpoint must be excluded");
});
