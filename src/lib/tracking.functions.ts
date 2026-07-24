import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getTrackingCredsStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    delhivery: !!process.env.DELHIVERY_API_TOKEN,
    dtdc: !!process.env.DTDC_API_TOKEN,
    trackingmore: !!process.env.TRACKINGMORE_API_KEY,
  };
});

export const refreshLabelTracking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, tracking] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./tracking.server"),
    ]);
    const { data: row, error } = await supabaseAdmin
      .from("labels")
      .select("id, courier_name, tracking_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message || "Label not found");
    if (row.courier_name === "Shree Maruti Courier") {
      return { skipped: true, reason: "Shree Maruti — manual only" };
    }
    if (!tracking.AUTO_TRACK_COURIERS.has(row.courier_name)) {
      return { skipped: true, reason: `No tracking API for ${row.courier_name}` };
    }
    const result = await tracking.fetchTrackingForCourier(row.courier_name, row.tracking_id);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_tracking_update: now,
      raw_courier_status: result.rawStatus ?? undefined,
      last_tracking_error: result.error,
    };
    // Only overwrite status if we mapped it AND the label isn't already Delivered/RTO
    if (result.internalStatus && row.status !== "Delivered" && row.status !== "RTO") {
      patch.status = result.internalStatus;
    }
    const { error: upErr } = await supabaseAdmin.from("labels").update(patch).eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    return { skipped: false, ...result, updatedStatus: patch.status ?? row.status };
  });

export const refreshAllTracking = createServerFn({ method: "POST" }).handler(async () => {
  const [{ supabaseAdmin }, tracking] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./tracking.server"),
  ]);
  const { data: rows, error } = await supabaseAdmin
    .from("labels")
    .select("id, courier_name, tracking_id, status")
    .not("status", "in", "(Delivered,RTO)");
  if (error) throw new Error(error.message);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let updated = 0;

  for (const row of rows ?? []) {
    if (!tracking.AUTO_TRACK_COURIERS.has(row.courier_name)) {
      skipped++;
      continue;
    }
    processed++;
    try {
      const result = await tracking.fetchTrackingForCourier(row.courier_name, row.tracking_id);
      const patch: Record<string, unknown> = {
        last_tracking_update: new Date().toISOString(),
        raw_courier_status: result.rawStatus ?? undefined,
        last_tracking_error: result.error,
      };
      if (result.internalStatus && row.status !== "Delivered" && row.status !== "RTO") {
        patch.status = result.internalStatus;
        updated++;
      }
      await supabaseAdmin.from("labels").update(patch).eq("id", row.id);
      if (result.error) failed++;
    } catch (e) {
      failed++;
      await supabaseAdmin
        .from("labels")
        .update({
          last_tracking_update: new Date().toISOString(),
          last_tracking_error: (e as Error).message,
        })
        .eq("id", row.id);
    }
  }

  return { total: rows?.length ?? 0, processed, skipped, failed, updated };
});

export const registerTrackingMoreForLabel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, tracking] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./tracking.server"),
    ]);
    const { data: row } = await supabaseAdmin
      .from("labels")
      .select("courier_name, tracking_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false, error: "Label not found" };
    if (!tracking.TRACKINGMORE_SLUGS[row.courier_name]) {
      return { ok: false, error: "Not a TrackingMore courier" };
    }
    return tracking.trackingMoreRegister(row.courier_name, row.tracking_id);
  });

export const runTrackingSelfTest = createServerFn({ method: "POST" }).handler(async () => {
  const tracking = await import("./tracking.server");
  const results: Record<string, unknown> = {};
  results.credentials = {
    delhivery: !!process.env.DELHIVERY_API_TOKEN,
    dtdc: !!process.env.DTDC_API_TOKEN,
    trackingmore: !!process.env.TRACKINGMORE_API_KEY,
  };
  results.autoCouriers = Array.from(tracking.AUTO_TRACK_COURIERS);
  results.trackingMoreSlugs = tracking.TRACKINGMORE_SLUGS;
  results.shreeMarutiSkipped = !tracking.AUTO_TRACK_COURIERS.has("Shree Maruti Courier");
  results.statusMapping = {
    Delivered: tracking.mapStatus("Delivered"),
    Dispatched: tracking.mapStatus("Dispatched"),
    "In Transit": tracking.mapStatus("In Transit"),
    RTO: tracking.mapStatus("RTO Delivered"),
    Unknown: tracking.mapStatus("gibberish"),
  };
  return results;
});
