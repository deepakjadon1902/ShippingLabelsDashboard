import test from "node:test";
import assert from "node:assert/strict";

import { isGenuinePickupScan, mapStatus, createTrackingResult } from "../tracking/adapters/base.js";
import { applyTrackingResultToLabel } from "../tracking/index.js";
import { trackShreeMaruti } from "../tracking/adapters/shree-maruti.js";
import { trackDelhivery } from "../tracking/adapters/delhivery.js";
import { fetchDtdcDirect } from "../tracking/adapters/dtdc.js";
import { fetchTrackCourier } from "../tracking/adapters/trackcourier.js";
import { trackEkart, mapEkartStatus } from "../tracking/adapters/ekart.js";
import { normalizeShadowfaxStatus } from "../tracking/adapters/shadowfax.js";

test("Pickup Workflow: Shree Maruti pre-pickup vs genuine pickup scan", async () => {
  const origFetch = globalThis.fetch;
  try {
    // 1. Pre-pickup: Order confirmed / ready for dispatch
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        orderInformation: {
            createdAt: "2026-10-23T08:00:00Z",
            sourceLocation: { city: "Vrindavan", state: "Uttar Pradesh" },
          },
          statuses: [
            {
              category: "READY_FOR_DISPATCH",
              subcategory: "Consignment is ready to be dispatched",
              statusTimestamp: new Date("2026-10-23T08:30:00Z").getTime(),
            },
            {
              category: "ORDER_CONFIRMED",
              subcategory: "Order has been confirmed and manifested",
              statusTimestamp: new Date("2026-10-23T08:00:00Z").getTime(),
            },
          ],
      }),
    });

    const resPre = await trackShreeMaruti("MARUTI_PRE_123", { force: true });
    assert.equal(resPre.status, "Ready to Pick", "Manifested / ready for dispatch must be Ready to Pick");
    assert.equal(resPre.pickupAt, null, "Must NOT set pickupAt for pre-pickup events");

    // 2. Genuine physical pickup: IN_TRANSIT with inward scan
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        orderInformation: {
            createdAt: "2026-10-23T08:00:00Z",
            sourceLocation: { city: "Vrindavan", state: "Uttar Pradesh" },
          },
          statuses: [
            {
              category: "IN_TRANSIT",
              subcategory: "Inscan at Mathura Hub",
              status: "inscan",
              statusTimestamp: new Date("2026-10-23T14:30:00Z").getTime(),
            },
            {
              category: "READY_FOR_DISPATCH",
              subcategory: "Consignment is ready to be dispatched",
              statusTimestamp: new Date("2026-10-23T08:30:00Z").getTime(),
            },
          ],
      }),
    });

    const resPicked = await trackShreeMaruti("MARUTI_PICKED_123", { force: true });
    assert.equal(resPicked.status, "Shipped / Picked Up", "Physical inscan must transition to Shipped / Picked Up");
    assert.equal(resPicked.pickupAt, "2026-10-23T14:30:00.000Z", "pickupAt must be set to physical inscan timestamp");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Pickup Workflow: Delhivery pre-pickup vs genuine pickup scan", async () => {
  const origFetch = globalThis.fetch;
  const origToken = process.env.DELHIVERY_API_TOKEN;
  process.env.DELHIVERY_API_TOKEN = "mock_delhivery_token";

  try {
    // 1. Pre-pickup: Manifested without physical scans
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        Success: true,
        ShipmentData: [
          {
            Shipment: {
              Status: {
                Status: "Manifested",
                Instructions: "Data received, awaiting parcel handover",
                StatusDateTime: "2026-10-23T09:00:00Z",
              },
              PickUpDate: "2026-10-23T10:00:00Z", // Scheduled date in API
              Scans: [],
            },
          },
        ],
      }),
    });

    const resPre = await trackDelhivery("DELHIVERY_PRE_123");
    assert.equal(resPre.status, "Ready to Pick", "Manifested must map to Ready to Pick");
    assert.equal(resPre.pickupAt, null, "Must NOT set pickupAt when parcel has zero physical scans");

    // 2. Genuine physical pickup: Picked scan
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        Success: true,
        ShipmentData: [
          {
            Shipment: {
              Status: {
                Status: "In Transit",
                Instructions: "In Transit to Sorting Center",
                StatusDateTime: "2026-10-23T15:00:00Z",
              },
              PickUpDate: "2026-10-23T12:30:00Z",
              Scans: [
                {
                  ScanDetail: {
                    Scan: "In Transit",
                    Instructions: "Dispatched from Hub",
                    ScanDateTime: "2026-10-23T15:00:00Z",
                  },
                },
                {
                  ScanDetail: {
                    Scan: "Picked",
                    Instructions: "Shipment picked up from merchant",
                    ScanDateTime: "2026-10-23T12:30:00Z",
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    const resPicked = await trackDelhivery("DELHIVERY_PICKED_123");
    assert.equal(resPicked.status, "Shipped / Picked Up");
    assert.equal(new Date(resPicked.pickupAt).toISOString(), "2026-10-23T12:30:00.000Z");
  } finally {
    globalThis.fetch = origFetch;
    process.env.DELHIVERY_API_TOKEN = origToken;
  }
});

test("Pickup Workflow: DTDC pre-pickup vs genuine pickup scan", async () => {
  const origFetch = globalThis.fetch;
  const origToken = process.env.DTDC_API_TOKEN;
  process.env.DTDC_API_TOKEN = "mock_dtdc_token";

  try {
    // 1. Pre-pickup: Booked / Softdata uploaded
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        trackHeader: {
          strStatus: "Booked",
          strStatusDesc: "Softdata uploaded - Consignment Booked",
        },
        trackDetails: [
          {
            strAction: "Booked",
            strActionDate: "23/10/2026",
            strActionTime: "10:00 AM",
            strRemarks: "Booking details received",
          },
        ],
      }),
    });

    const preRes = await fetchDtdcDirect("DTDC_PRE_123");
    assert.equal(preRes.ok, true);
    assert.equal(preRes.result.status, "Ready to Pick");
    assert.equal(preRes.result.pickupAt, null);

    // 2. Genuine physical pickup: Inscan at Origin Hub
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        trackHeader: {
          strStatus: "In Transit",
          strStatusDesc: "In Transit to Destination",
        },
        trackDetails: [
          {
            strAction: "In Transit",
            strActionDate: "23/10/2026",
            strActionTime: "04:30 PM",
            strRemarks: "Dispatched from Agra Hub",
          },
          {
            strAction: "Inscan",
            strActionDate: "23/10/2026",
            strActionTime: "01:15 PM",
            strRemarks: "Parcel picked up and scanned at hub",
          },
        ],
      }),
    });

    const pickedRes = await fetchDtdcDirect("DTDC_PICKED_123");
    assert.equal(pickedRes.ok, true);
    assert.equal(pickedRes.result.status, "Shipped / Picked Up");
  } finally {
    globalThis.fetch = origFetch;
    process.env.DTDC_API_TOKEN = origToken;
  }
});

test("Pickup Workflow: TrackCourier pre-pickup vs genuine pickup scan", async () => {
  const origFetch = globalThis.fetch;
  const origKey = process.env.TRACKCOURIER_API_KEY;
  process.env.TRACKCOURIER_API_KEY = "mock_tc_key";

  try {
    // 1. Pre-pickup: booked_on_date only (must NOT be used as pickupAt)
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: "pending",
          MostRecentStatus: "Info Received",
          ShipmentSummary: {
            booked_on_date: "2026-10-23",
            booked_on_time: "09:30:00",
          },
          Checkpoints: [
            {
              Date: "2026-10-23",
              Time: "09:30:00",
              Activity: "Electronic Shipping Info Received",
              CheckpointState: "pending",
            },
          ],
        },
      }),
    });

    const resPre = await fetchTrackCourier("India Post", "TC_PRE_123", { account: 1 });
    assert.equal(resPre.status, "Ready to Pick");
    assert.equal(resPre.pickupAt, null, "booked_on_date must NOT be treated as pickupAt");

    // 2. Genuine physical scan
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: "in_transit",
          MostRecentStatus: "Item Picked Up",
          Checkpoints: [
            {
              Date: "2026-10-23",
              Time: "13:00:00",
              Activity: "Item Picked Up by Courier",
              CheckpointState: "in_transit",
            },
            {
              Date: "2026-10-23",
              Time: "09:30:00",
              Activity: "Electronic Shipping Info Received",
              CheckpointState: "pending",
            },
          ],
        },
      }),
    });

    const resPicked = await fetchTrackCourier("India Post", "TC_PICKED_123", { account: 1 });
    assert.equal(resPicked.status, "Shipped / Picked Up");
    assert.ok(resPicked.pickupAt);
  } finally {
    globalThis.fetch = origFetch;
    process.env.TRACKCOURIER_API_KEY = origKey;
  }
});

test("Pickup Workflow: Ekart & Shadowfax status mappers enforce Ready to Pick before pickup", () => {
  // Ekart
  assert.equal(mapEkartStatus("Order Placed"), "Ready to Pick");
  assert.equal(mapEkartStatus("Pickup Scheduled"), "Ready to Pick");
  assert.equal(mapEkartStatus("Pickup Pending"), "Ready to Pick");
  assert.equal(mapEkartStatus("Booked"), "Ready to Pick");
  assert.equal(mapEkartStatus("Picked Up"), "Shipped / Picked Up");
  assert.equal(mapEkartStatus("In Transit"), "Shipped / Picked Up");
  assert.equal(mapEkartStatus("Out for Delivery"), "Shipped / Picked Up");

  // Shadowfax
  assert.equal(normalizeShadowfaxStatus("manifest", "Order Created"), "Ready to Pick");
  assert.equal(normalizeShadowfaxStatus("pending", "Pickup Scheduled"), "Ready to Pick");
  assert.equal(normalizeShadowfaxStatus("allocated", "Rider assigned"), "Ready to Pick");
  assert.equal(normalizeShadowfaxStatus("picked_up", "Picked up"), "Shipped / Picked Up");
  assert.equal(normalizeShadowfaxStatus("in_transit", "In transit"), "Shipped / Picked Up");
});

test("Pickup Workflow: applyTrackingResultToLabel preserves Ready to Pick and updates to Shipped / Picked Up only upon scan", () => {
  const label = {
    created_at: new Date("2026-10-23T08:00:00Z"),
    status: "Ready to Pick",
    pickup_at: null,
    tracking_history: [],
  };

  // Sync 1: Manifested response from courier
  const sync1 = createTrackingResult({
    courier: "Delhivery",
    trackingNumber: "D100",
    status: "Ready to Pick",
    eventDescription: "Pickup scheduled for tomorrow morning",
    eventDate: "2026-10-23T08:30:00Z",
    history: [
      { date: "2026-10-23T08:30:00Z", description: "Pickup scheduled", status: "manifested" },
    ],
  });

  applyTrackingResultToLabel(label, sync1);
  assert.equal(label.status, "Ready to Pick");
  assert.equal(label.pickup_at, null);

  // Sync 2: Courier physically collects parcel and scans it
  const sync2 = createTrackingResult({
    courier: "Delhivery",
    trackingNumber: "D100",
    status: "Shipped / Picked Up",
    eventDescription: "Parcel collected by courier driver",
    eventDate: "2026-10-23T11:45:00Z",
    history: [
      { date: "2026-10-23T11:45:00Z", description: "Shipment picked up", status: "picked" },
      { date: "2026-10-23T08:30:00Z", description: "Pickup scheduled", status: "manifested" },
    ],
  });

  applyTrackingResultToLabel(label, sync2);
  assert.equal(label.status, "Shipped / Picked Up");
  assert.ok(label.pickup_at instanceof Date);
  assert.equal(label.pickup_at.toISOString(), "2026-10-23T11:45:00.000Z");
});
