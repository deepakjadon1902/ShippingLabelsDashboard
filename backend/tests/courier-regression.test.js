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
import { isCourierAutoTrackable, AUTO_TRACK_COURIERS } from "../tracking/index.js";

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
