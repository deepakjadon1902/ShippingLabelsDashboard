// Server-only tracking helpers. Never imported from client code.
// Handles direct courier APIs (Delhivery, DTDC) and TrackingMore for the rest.

export type InternalStatus = "Pending" | "Shipped" | "Delivered" | "RTO";

export const TRACKINGMORE_SLUGS: Record<string, string> = {
  Shadowfax: "shadowfax",
  Xpressbees: "xpressbees",
  "Ecom Express": "ecom-express",
  "India Post": "india-post",
  // Fallback slugs — used when the primary courier API fails, and as the
  // only source for Shree Maruti (no direct tracking API).
  Delhivery: "delhivery",
  DTDC: "dtdc",
  "Shree Maruti Courier": "shreemaruticourier",
};

// Couriers we auto-refresh. Shree Maruti is included via TrackingMore; manual
// status edits from the dashboard still work as before.
export const AUTO_TRACK_COURIERS = new Set<string>([
  "Delhivery",
  "DTDC",
  ...Object.keys(TRACKINGMORE_SLUGS),
]);

export function mapStatus(rawInput: string | null | undefined): InternalStatus | null {
  if (!rawInput) return null;
  const raw = rawInput.toLowerCase();
  if (raw === "pending" || raw.includes("pending001")) return "Pending";
  if (
    raw.includes("deliver") &&
    !raw.includes("undeliver") &&
    !raw.includes("not deliver")
  )
    return "Delivered";
  if (
    raw.includes("rto") ||
    raw.includes("return") ||
    raw.includes("returned") ||
    raw.includes("undelivered") ||
    raw.includes("refused")
  )
    return "RTO";
  if (
    raw.includes("in transit") ||
    raw.includes("intransit") ||
    raw.includes("dispatch") ||
    raw.includes("shipped") ||
    raw.includes("out for delivery") ||
    raw.includes("in-transit") ||
    raw.includes("transit") ||
    raw.includes("picked") ||
    raw.includes("manifested") ||
    raw.includes("info received") ||
    raw.includes("inforeceived") ||
    raw.includes("available_for_pickup")
  )
    return "Shipped";
  return null;
}

export interface TrackingResult {
  internalStatus: InternalStatus | null;
  rawStatus: string | null;
  error: string | null;
}

const FALLBACK_TRACKINGMORE_API_KEY = "-79v7-y0hl-yry6-xb6g6iwdmqxp";
const FALLBACK_DELHIVERY_API_TOKEN = "de41deae72274feca0751366310bd9095578886a";
const FALLBACK_DTDC_API_TOKEN = "58d5dcf428c775221ad7589aac90a2";

function envOrFallback(envName: string, fallback: string): string {
  const value = process.env[envName];
  return value && value.trim() ? value.trim() : fallback;
}

export function getDelhiveryToken(): string {
  return envOrFallback("DELHIVERY_API_TOKEN", FALLBACK_DELHIVERY_API_TOKEN);
}

export function getDTdcToken(): string {
  return envOrFallback("DTDC_API_TOKEN", FALLBACK_DTDC_API_TOKEN);
}

export function getTrackingMoreKey(): string {
  return envOrFallback("TRACKINGMORE_API_KEY", FALLBACK_TRACKINGMORE_API_KEY);
}

export function getTrackingCredentialsStatus() {
  return {
    delhivery: !!getDelhiveryToken(),
    dtdc: !!getDTdcToken(),
    trackingmore: !!getTrackingMoreKey(),
  };
}

// ---------------- Delhivery ----------------
export async function fetchDelhivery(waybill: string): Promise<TrackingResult> {
  const token = getDelhiveryToken();
  if (!token) return { internalStatus: null, rawStatus: null, error: "Missing DELHIVERY_API_TOKEN" };
  try {
    const res = await fetch(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}&ref_ids=`,
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!res.ok) return { internalStatus: null, rawStatus: null, error: `Delhivery ${res.status}` };
    const data = (await res.json()) as {
      Success?: boolean;
      Error?: string;
      rmk?: string;
      ShipmentData?: Array<{
        Shipment?: {
          Status?: { Status?: string; StatusType?: string; Instructions?: string };
        };
      }>;
    };
    if (data.Success === false || data.Error) {
      return { internalStatus: null, rawStatus: null, error: data.Error || data.rmk || "Delhivery no status" };
    }
    const shipment = data.ShipmentData?.[0]?.Shipment?.Status;
    const raw = shipment?.Status || shipment?.Instructions || shipment?.StatusType || null;
    return { internalStatus: mapStatus(raw), rawStatus: raw, error: raw ? null : "No status in response" };
  } catch (e) {
    return { internalStatus: null, rawStatus: null, error: (e as Error).message };
  }
}

// ---------------- DTDC ----------------
// DTDC's tracking endpoint. Uses the customer's api-key header.
export async function fetchDTDC(waybill: string): Promise<TrackingResult> {
  const token = getDTdcToken();
  if (!token) return { internalStatus: null, rawStatus: null, error: "Missing DTDC_API_TOKEN" };
  try {
    const res = await fetch(
      "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": token,
        },
        body: JSON.stringify({
          trkType: "cnno",
          strcnno: waybill,
          addtnlDtl: "Y",
        }),
      },
    );
    if (!res.ok) return { internalStatus: null, rawStatus: null, error: `DTDC ${res.status}` };
    const data = (await res.json()) as {
      trackHeader?: { strStatus?: string; strStatusDesc?: string };
      trackDetails?: Array<{ strAction?: string; strActionDate?: string }>;
    };
    const raw =
      data.trackHeader?.strStatusDesc ||
      data.trackHeader?.strStatus ||
      data.trackDetails?.[0]?.strAction ||
      null;
    return { internalStatus: mapStatus(raw), rawStatus: raw, error: raw ? null : "No status in response" };
  } catch (e) {
    return { internalStatus: null, rawStatus: null, error: (e as Error).message };
  }
}

// ---------------- TrackingMore ----------------
const TM_BASE = "https://api.trackingmore.com/v4";

export async function trackingMoreRegister(
  courierName: string,
  waybill: string,
): Promise<{ ok: boolean; error: string | null }> {
  const key = getTrackingMoreKey();
  const slug = TRACKINGMORE_SLUGS[courierName];
  if (!key) return { ok: false, error: "Missing TRACKINGMORE_API_KEY" };
  if (!slug) return { ok: false, error: `No TrackingMore slug for ${courierName}` };
  try {
    const res = await fetch(`${TM_BASE}/trackings/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Tracking-Api-Key": key,
      },
      body: JSON.stringify({ tracking_number: waybill, courier_code: slug }),
    });
    // 200/201 created, 4101/4218 already exists — all OK for the two-step flow.
    const data = (await res.json().catch(() => ({}))) as { code?: number; meta?: { code?: number; message?: string }; message?: string };
    const code = data.code ?? data.meta?.code ?? res.status;
    if (code === 200 || code === 201 || code === 4101 || code === 4218 || res.ok) return { ok: true, error: null };
    return { ok: false, error: data.meta?.message || data.message || `TrackingMore create ${code}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function fetchTrackingMore(
  courierName: string,
  waybill: string,
): Promise<TrackingResult> {
  const key = getTrackingMoreKey();
  const slug = TRACKINGMORE_SLUGS[courierName];
  if (!key) return { internalStatus: null, rawStatus: null, error: "Missing TRACKINGMORE_API_KEY" };
  if (!slug) return { internalStatus: null, rawStatus: null, error: `No TM slug for ${courierName}` };
  try {
    const registered = await trackingMoreRegister(courierName, waybill);
    if (!registered.ok) {
      return { internalStatus: null, rawStatus: null, error: registered.error || "TrackingMore create failed" };
    }
    const url = `${TM_BASE}/trackings/get?tracking_numbers=${encodeURIComponent(waybill)}&courier_code=${slug}`;
    const res = await fetch(url, { headers: { "Tracking-Api-Key": key } });
    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{ delivery_status?: string; latest_event?: string; status_info?: string }>;
      meta?: { code?: number; message?: string };
      message?: string;
    };
    if (!res.ok) return { internalStatus: null, rawStatus: null, error: data.meta?.message || data.message || `TrackingMore ${res.status}` };
    const first = data.data?.[0];
    if (!first) {
      return { internalStatus: null, rawStatus: null, error: "TrackingMore returned no tracking data after create" };
    }
    const raw = first.delivery_status || first.latest_event || first.status_info || null;
    return { internalStatus: mapStatus(raw), rawStatus: raw, error: raw ? null : "No status yet" };
  } catch (e) {
    return { internalStatus: null, rawStatus: null, error: (e as Error).message };
  }
}

// ---------------- Router with fallback ----------------
export type TrackingSource = "direct" | "trackingmore" | "none";
export interface TrackingResultWithSource extends TrackingResult {
  source: TrackingSource;
}

export async function fetchTrackingForCourier(
  courierName: string,
  waybill: string,
): Promise<TrackingResultWithSource> {
  const isDelhivery = courierName === "Delhivery";
  const isDTDC = courierName === "DTDC";

  // Step 1: Try the direct courier API for Delhivery / DTDC first.
  if (isDelhivery || isDTDC) {
    const direct = isDelhivery ? await fetchDelhivery(waybill) : await fetchDTDC(waybill);
    if (direct.internalStatus) {
      return { ...direct, rawStatus: tagSource(direct.rawStatus, "direct"), source: "direct" };
    }
    // Step 2: Direct failed or returned no mappable status — try TrackingMore fallback.
    if (TRACKINGMORE_SLUGS[courierName]) {
      const fb = await fetchTrackingMore(courierName, waybill);
      if (fb.internalStatus) {
        return { ...fb, rawStatus: tagSource(fb.rawStatus, "trackingmore"), source: "trackingmore" };
      }
      // Both failed — surface the more informative error.
      return {
        internalStatus: null,
        rawStatus: null,
        error: `direct: ${direct.error ?? "no status"} | trackingmore: ${fb.error ?? "no status"}`,
        source: "none",
      };
    }
    return { ...direct, source: "none" };
  }

  // TrackingMore-only couriers (Shadowfax, Xpressbees, Ecom Express, India Post, Shree Maruti).
  if (TRACKINGMORE_SLUGS[courierName]) {
    const r = await fetchTrackingMore(courierName, waybill);
    if (r.internalStatus) {
      return { ...r, rawStatus: tagSource(r.rawStatus, "trackingmore"), source: "trackingmore" };
    }
    // Friendly fallback for couriers where TM coverage is spotty (e.g. Shree Maruti).
    return {
      internalStatus: null,
      rawStatus: null,
      error: "Auto-tracking unavailable — manual only",
      source: "none",
    };
  }
  return { internalStatus: null, rawStatus: null, error: `No tracking API for ${courierName}`, source: "none" };
}

function tagSource(raw: string | null, source: TrackingSource): string | null {
  if (!raw) return raw;
  return `[${source}] ${raw}`;
}
