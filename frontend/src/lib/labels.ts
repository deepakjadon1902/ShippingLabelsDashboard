export type LabelStatus = "Pending" | "Shipped" | "Delivered" | "RTO";

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
  last_tracking_update?: string | null;
  raw_courier_status?: string | null;
  last_tracking_error?: string | null;
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

// --- API ---

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

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
  trackingmore: boolean;
}> {
  return api("/tracking/credentials");
}

export async function refreshLabelTracking(id: string): Promise<{
  skipped: boolean;
  reason?: string;
  rawStatus?: string | null;
  error?: string | null;
  updatedStatus?: LabelStatus;
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

export async function registerTrackingMoreForLabel(id: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  return api(`/tracking/labels/${id}/register`, { method: "POST" });
}
