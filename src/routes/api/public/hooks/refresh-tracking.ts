import { createFileRoute } from "@tanstack/react-router";

// Called by pg_cron twice daily. Refreshes all non-final labels via courier APIs.
export const Route = createFileRoute("/api/public/hooks/refresh-tracking")({
  server: {
    handlers: {
      POST: async () => {
        const [{ supabaseAdmin }, tracking] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/tracking.server"),
        ]);
        const { data: rows, error } = await supabaseAdmin
          .from("labels")
          .select("id, courier_name, tracking_id, status")
          .not("status", "in", "(Delivered,RTO)");
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

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
            const result = await tracking.fetchTrackingForCourier(
              row.courier_name,
              row.tracking_id,
            );
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
            console.error("refresh-tracking error", row.id, e);
          }
        }
        return Response.json({ ok: true, total: rows?.length ?? 0, processed, skipped, failed, updated });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run refresh" }),
    },
  },
});
