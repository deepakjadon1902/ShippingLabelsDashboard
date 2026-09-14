import { getApiBaseUrl } from "./api-base";

export type LabelStatus = "Pending" | "Shipped" | "Delivered" | "RTO";

export interface TrackingHistoryItem {
  date?: string | null;
  description: string;
  location?: string | null;
  status?: string | null;
  source?: string | null;
}

export interface Label {
  id: string;
  created_at: string;
  receiver_name: string;
  receiver_address_line1: string;
  receiver_address_line2: string | null;
  receiver_city: string;
  receiver_state: string;
  receiver_pincode: string;
  receiver_mobile_1: string;
  receiver_mobile_2: string | null;
  courier_name: string;
  tracking_id: string;
  order_reference: string | null;
  status: LabelStatus;
  notes: string | null;

  // Tracking timestamps & audit
  last_tracking_update?: string | null;
  last_successful_sync?: string | null;
  last_sync_attempt?: string | null;
  last_trackcourier_sync?: string | null;
  last_maruti_sync?: string | null;
  raw_courier_status?: string | null;
  last_tracking_error?: string | null;
  api_status_conflict?: string | null;

  // Real-time tracking location & events
  tracking_location?: string | null;
  tracking_event_date?: string | null;
  tracking_event_description?: string | null;
  tracking_estimated_delivery?: string | null;
  tracking_source?: string | null;
  tracking_provider?: string | null;
  tracking_history?: TrackingHistoryItem[];

  // Route & movement locations
  origin_location?: string | null;
  destination_location?: string | null;

  // Delivery timestamps & Turnaround Time (TAT)
  pickup_at?: string | null;
  delivered_at?: string | null;
  tat_hours?: number | null;
  tat_display?: string | null;

  // Delay & Delivery failure detection
  is_delayed?: boolean;
  delayed_days?: number;
  is_delivery_failed?: boolean;
  delivery_failure_reason?: string | null;

  // RTO Lifecycle
  rto_status?: string | null;
  rto_initiated_at?: string | null;
  rto_returned_at?: string | null;

  // Sender profile snapshot
  sender_name?: string | null;
  sender_address?: string | null;
  sender_phone?: string | null;
  sender_website?: string | null;
  sender_review_url?: string | null;
  sender_profile_id?: string | null;
}

export type LabelInput = Omit<Label, "id" | "created_at">;

export const COMMON_COURIERS = [
  "Delhivery",
  "Shree Maruti Courier",
  "DTDC",
  "Xpressbees",
  "Ecom Express",
  "Shadowfax",
  "India Post",
];

export const STATUSES: LabelStatus[] = ["Pending", "Shipped", "Delivered", "RTO"];

const TRACKING_URLS: Record<string, (id: string) => string> = {
  Delhivery: (id) => `https://www.delhivery.com/tracking?tracking_id=${id}`,
  "Shree Maruti Courier": (id) => `https://www.shreemaruti.com/tracking?awb=${id}`,
  DTDC: (id) => `https://www.dtdc.com/tracking?awbNo=${id}`,
  Xpressbees: (id) => `https://www.xpressbees.com/track?awb=${id}`,
  "Ecom Express": (id) => `https://ecomexpress.in/tracking/?awb_field=${id}`,
  Shadowfax: (id) => `https://tracker.shadowfax.in/#/tracking/${id}`,
  "India Post": (id) =>
    `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${id}`,
};

export function getTrackingUrl(courier: string, trackingId: string): string | null {
  const fn = TRACKING_URLS[courier];
  return fn ? fn(trackingId) : null;
}

export function getQrPayload(_courier: string, trackingId: string): string {
  return trackingId;
}

export function isLabelOutOfDelivery(label: Label): boolean {
  if (label.status === "Delivered" || label.status === "RTO") return false;
  const raw =
    `${label.raw_courier_status || ""} ${label.tracking_event_description || ""}`.toLowerCase();
  return raw.includes("out for delivery") || raw.includes("out for del") || raw.includes("ofd");
}

export type OperationalStage =
  | "Delivered"
  | "Out for Delivery"
  | "Delivery Attempted"
  | "Failed / NDR"
  | "RTO Returned"
  | "RTO Initiated"
  | "RTO"
  | "In Transit"
  | "Pending";

export function getOperationalStage(label: Label): OperationalStage {
  if (label.status === "Delivered") {
    return "Delivered";
  }
  if (isLabelRtoReturned(label)) {
    return "RTO Returned";
  }
  if (label.status === "RTO" || (label.rto_status && label.rto_status.includes("RTO"))) {
    return label.rto_status === "RTO Initiated" ? "RTO Initiated" : "RTO";
  }
  if (isLabelOutOfDelivery(label)) {
    return "Out for Delivery";
  }
  if (
    label.is_delivery_failed ||
    (label.delivery_failure_reason && label.delivery_failure_reason.length > 0)
  ) {
    const reason = (label.delivery_failure_reason || "").toLowerCase();
    const raw =
      `${label.raw_courier_status || ""} ${label.tracking_event_description || ""}`.toLowerCase();
    if (
      reason.includes("attempt") ||
      raw.includes("attempt") ||
      raw.includes("unavailable") ||
      raw.includes("closed") ||
      raw.includes("door locked")
    ) {
      return "Delivery Attempted";
    }
    return "Failed / NDR";
  }
  if (label.status === "Shipped" || label.pickup_at) {
    return "In Transit";
  }
  return "Pending";
}

export function isLabelDelayed(label: Label): boolean {
  if (label.status === "Delivered" || label.rto_status === "RTO Delivered / Returned") return false;
  if (label.is_delayed) return true;
  if (label.tracking_estimated_delivery) {
    const est = new Date(label.tracking_estimated_delivery).getTime();
    if (!isNaN(est) && Date.now() > est) return true;
  }
  return false;
}

export function isLabelRtoReturned(label: Label): boolean {
  return (
    label.rto_status === "RTO Delivered / Returned" ||
    (label.status === "RTO" && !!label.rto_returned_at)
  );
}

export function formatDuration(diffMs: number | null | undefined): string | null {
  if (diffMs == null || isNaN(diffMs) || diffMs < 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
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

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "Not available from courier";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Not available from courier";
    return `${d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}, ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Not available from courier";
  }
}

export interface DetailedTatMetrics {
  pickupToDeliveredMs: number | null;
  pickupToDeliveredDisplay: string | null;
  dispatchedToDeliveredMs: number | null;
  dispatchedToDeliveredDisplay: string | null;
  pickupToRtoReturnedMs: number | null;
  pickupToRtoReturnedDisplay: string | null;
  expectedDiffDays: number | null;
  performanceLabel: string;
  isDelayed: boolean;
  delayedDays: number;
  outForDeliveryAt: string | null;
  firstAttemptAt: string | null;
}

export function getDetailedTatMetrics(label: Label): DetailedTatMetrics {
  const pickupTime = label.pickup_at ? new Date(label.pickup_at).getTime() : null;
  const createdTime = label.created_at ? new Date(label.created_at).getTime() : null;
  const deliveredTime = label.delivered_at ? new Date(label.delivered_at).getTime() : null;
  const rtoReturnedTime = label.rto_returned_at ? new Date(label.rto_returned_at).getTime() : null;

  // 1. Pickup -> Delivered
  let pickupToDeliveredMs: number | null = null;
  let pickupToDeliveredDisplay: string | null = null;
  if (pickupTime && deliveredTime && deliveredTime >= pickupTime) {
    pickupToDeliveredMs = deliveredTime - pickupTime;
    pickupToDeliveredDisplay = formatDuration(pickupToDeliveredMs);
  }

  // 2. Dispatched (created_at) -> Delivered
  let dispatchedToDeliveredMs: number | null = null;
  let dispatchedToDeliveredDisplay: string | null = null;
  if (createdTime && deliveredTime && deliveredTime >= createdTime) {
    dispatchedToDeliveredMs = deliveredTime - createdTime;
    dispatchedToDeliveredDisplay = formatDuration(dispatchedToDeliveredMs);
  }

  // 3. Pickup -> RTO Returned
  let pickupToRtoReturnedMs: number | null = null;
  let pickupToRtoReturnedDisplay: string | null = null;
  const rtoStart = pickupTime || createdTime;
  if (rtoStart && rtoReturnedTime && rtoReturnedTime >= rtoStart) {
    pickupToRtoReturnedMs = rtoReturnedTime - rtoStart;
    pickupToRtoReturnedDisplay = formatDuration(pickupToRtoReturnedMs);
  }

  // 4. Expected vs Actual Delivery diff
  let expectedDiffDays: number | null = null;
  let isDelayed = !!label.is_delayed;
  let delayedDays = label.delayed_days || 0;
  let performanceLabel = "On Time";

  if (label.tracking_estimated_delivery) {
    const estDate = new Date(label.tracking_estimated_delivery);
    if (!isNaN(estDate.getTime())) {
      const comparePoint = deliveredTime || (label.status === "Delivered" ? Date.now() : null);
      if (comparePoint) {
        const diffDays = Math.floor((comparePoint - estDate.getTime()) / (1000 * 60 * 60 * 24));
        expectedDiffDays = diffDays;
        if (diffDays > 0) {
          isDelayed = true;
          delayedDays = diffDays;
          performanceLabel = `Delayed by ${diffDays} ${diffDays === 1 ? "Day" : "Days"}`;
        } else {
          performanceLabel = "On Time";
        }
      }
    }
  }

  // 5. Scan history for OFD and First Attempt timestamps
  let outForDeliveryAt: string | null = null;
  let firstAttemptAt: string | null = null;

  if (Array.isArray(label.tracking_history)) {
    // History is usually sorted newest first. Reverse to scan chronologically.
    const sortedAsc = [...label.tracking_history].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return ta - tb;
    });

    for (const cp of sortedAsc) {
      const desc = `${cp.description || ""} ${cp.status || ""}`.toLowerCase();
      if (!outForDeliveryAt && (desc.includes("out for delivery") || desc.includes("out for del") || desc === "ofd")) {
        if (cp.date) outForDeliveryAt = cp.date;
      }
      if (!firstAttemptAt && (desc.includes("attempt") || desc.includes("undeliver") || desc.includes("unavailable") || desc.includes("door locked"))) {
        if (cp.date) firstAttemptAt = cp.date;
      }
    }
  }

  return {
    pickupToDeliveredMs,
    pickupToDeliveredDisplay: pickupToDeliveredDisplay || label.tat_display || null,
    dispatchedToDeliveredMs,
    dispatchedToDeliveredDisplay,
    pickupToRtoReturnedMs,
    pickupToRtoReturnedDisplay,
    expectedDiffDays,
    performanceLabel,
    isDelayed,
    delayedDays,
    outForDeliveryAt,
    firstAttemptAt,
  };
}

// --- API ---

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listLabels(): Promise<Label[]> {
  return api<Label[]>("/labels");
}

export async function getLabel(id: string): Promise<Label | null> {
  try {
    return await api<Label>(`/labels/${id}`);
  } catch (error) {
    if ((error as Error).message === "Label not found") return null;
    throw error;
  }
}

export async function createLabel(input: LabelInput): Promise<Label> {
  return api<Label>("/labels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateLabel(id: string, input: Partial<LabelInput>): Promise<Label> {
  return api<Label>(`/labels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteLabel(id: string): Promise<void> {
  await api<void>(`/labels/${id}`, { method: "DELETE" });
}

export async function getTrackingCredsStatus(): Promise<{
  delhivery: boolean;
  dtdc: boolean;
  trackcourier: boolean;
}> {
  return api("/tracking/credentials");
}

export async function refreshLabelTracking(id: string): Promise<{
  skipped: boolean;
  reason?: string;
  rawStatus?: string | null;
  error?: string | null;
  updatedStatus?: LabelStatus;
  location?: string | null;
  eventDate?: string | null;
  eventDescription?: string | null;
  estimatedDelivery?: string | null;
  source?: string;
  history?: TrackingHistoryItem[];
}> {
  return api(`/tracking/labels/${id}/refresh`, { method: "POST" });
}

export async function refreshAllTracking(): Promise<{
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  updated: number;
}> {
  return api("/tracking/refresh-all", { method: "POST" });
}
