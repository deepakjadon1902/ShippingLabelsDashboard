import { createTrackingResult, mapStatus, detectRtoStatus, isOutOfDelivery } from "./base.js";
import { fetchTrackCourier, hasTrackCourierKey } from "./trackcourier.js";

const COURIER_NAME = "Delhivery";

export function hasDelhiveryToken() {
  return !!process.env.DELHIVERY_API_TOKEN;
}

async function fetchDelhiveryDirect(waybill) {
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) return { ok: false, error: "Missing DELHIVERY_API_TOKEN" };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(
        waybill,
      )}&ref_ids=`,
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (response.status === 401) {
      return {
        ok: false,
        error: "Delhivery Direct API Authentication Failed (HTTP 401: Token invalid or unauthorized)",
      };
    }
    if (response.status === 404) {
      return { ok: false, error: "Shipment not found in Delhivery system" };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        error: `Delhivery Direct API Server Error (HTTP ${response.status})`,
      };
    }
    if (!response.ok) {
      return { ok: false, error: `Delhivery HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.Success === false || data.Error) {
      return {
        ok: false,
        error: data.Error || data.rmk || "Shipment not scanned or not found in Delhivery",
      };
    }

    const shipmentData = data.ShipmentData?.[0]?.Shipment;
    if (!shipmentData) {
      return {
        ok: false,
        error: "No shipment data returned by Delhivery API (package not scanned yet)",
      };
    }

    const statusObj = shipmentData.Status;
    const rawStatus =
      statusObj?.Status || statusObj?.Instructions || statusObj?.StatusType || null;

    const location =
      statusObj?.StatusLocation || shipmentData.DeliveryLocation || null;
    const eventDate = statusObj?.StatusDateTime || null;
    const eventDescription = statusObj?.Instructions || rawStatus || null;
    const estimatedDelivery = shipmentData.ExpectedDeliveryDate || null;

    // Route locations
    const origin = shipmentData.Origin || null;
    const destination =
      shipmentData.Destination ||
      (shipmentData.Consignee?.City
        ? `${shipmentData.Consignee.City}, ${shipmentData.Consignee.State || ""}`.trim()
        : shipmentData.DeliveryLocation || null);

    // Pickup & Delivery Timestamps
    const pickupAt = shipmentData.PickUpDate || shipmentData.PickedupDate || null;
    const isDeliveredStatus =
      (statusObj?.Status || "").toLowerCase() === "delivered" ||
      (statusObj?.Instructions || "").toLowerCase().includes("delivered");
    const deliveredAt =
      shipmentData.DeliveryDate ||
      (isDeliveredStatus ? statusObj?.StatusDateTime : null);

    // RTO information
    const rtoStage =
      detectRtoStatus(rawStatus || statusObj?.Instructions) ||
      (shipmentData.RTOStartedDate ? "RTO Initiated" : null);
    const rtoInitiatedAt = shipmentData.RTOStartedDate || null;
    const rtoReturnedAt = shipmentData.ReturnedDate || null;

    // Check scans history if present
    const rawScans = Array.isArray(shipmentData.Scans) ? shipmentData.Scans : [];
    const history = rawScans
      .map((scan) => {
        const detail = scan.ScanDetail || scan;
        return {
          date: detail.ScanDateTime || detail.StatusDateTime || null,
          location: detail.ScannedLocation || null,
          description: detail.Instructions || detail.Scan || "",
          status: detail.Scan || null,
          source: "direct",
        };
      })
      .sort((a, b) => (new Date(b.date || 0) > new Date(a.date || 0) ? 1 : -1));

    const internalStatus = mapStatus(rawStatus) || (isDeliveredStatus ? "Delivered" : null);

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
        source: "direct",
        provider: "Delhivery Direct",
        origin,
        destination,
        pickupAt,
        deliveredAt,
        rtoStatus: rtoStage,
        rtoInitiatedAt,
        rtoReturnedAt,
        error: rawStatus ? null : "No status found",
        history,
      }),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "Delhivery Direct API request timed out" };
    }
    return { ok: false, error: error.message };
  }
}

export async function trackDelhivery(trackingNumber) {
  const waybill = String(trackingNumber || "").trim();
  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "Delhivery Direct",
      error: "Tracking number is required",
    });
  }

  // 1. Direct Delhivery API (PRIMARY)
  const direct = await fetchDelhiveryDirect(waybill);
  if (direct.ok && direct.result && (direct.result.status || direct.result.rawStatus)) {
    return direct.result;
  }

  // 2. TrackCourier fallback (ONLY if direct fails and key is configured)
  if (hasTrackCourierKey()) {
    const fallback = await fetchTrackCourier(COURIER_NAME, waybill);
    if (fallback.status || fallback.rawStatus) {
      return fallback;
    }
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "Delhivery Direct",
      error: `Delhivery direct: ${direct.error || "no status"} | TrackCourier fallback: ${
        fallback.error || "no status"
      }`,
    });
  }

  return (
    direct.result ||
    createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "Delhivery Direct",
      error: direct.error || "Delhivery direct tracking failed",
    })
  );
}

