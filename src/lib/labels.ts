import { supabase } from "@/integrations/supabase/client";

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
  "India Post": (id) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${id}`,
};

export function getTrackingUrl(courier: string, trackingId: string): string | null {
  const fn = TRACKING_URLS[courier];
  return fn ? fn(trackingId) : null;
}

export function getQrPayload(_courier: string, trackingId: string): string {
  return trackingId;
}

// --- API ---

export async function listLabels(): Promise<Label[]> {
  const { data, error } = await supabase
    .from("labels" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Label[];
}

export async function getLabel(id: string): Promise<Label | null> {
  const { data, error } = await supabase
    .from("labels" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Label | null;
}

export async function createLabel(input: LabelInput): Promise<Label> {
  const { data, error } = await supabase
    .from("labels" as never)
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Label;
}

export async function updateLabel(id: string, input: Partial<LabelInput>): Promise<Label> {
  const { data, error } = await supabase
    .from("labels" as never)
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Label;
}

export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase.from("labels" as never).delete().eq("id", id);
  if (error) throw error;
}
