import mongoose from "mongoose";

export const STATUSES = ["Pending", "Shipped", "Delivered", "RTO"];

export const labelSchema = new mongoose.Schema(
  {
    receiver_name: { type: String, required: true, trim: true },
    receiver_address_line1: { type: String, required: true, trim: true },
    receiver_address_line2: { type: String, default: null, trim: true },
    receiver_city: { type: String, required: true, trim: true },
    receiver_state: { type: String, required: true, trim: true },
    receiver_pincode: { type: String, required: true, trim: true },
    receiver_mobile_1: { type: String, required: true, trim: true },
    receiver_mobile_2: { type: String, default: null, trim: true },
    courier_name: { type: String, required: true, trim: true },
    tracking_id: { type: String, required: true, trim: true },
    order_reference: { type: String, default: null, trim: true },
    status: { type: String, enum: STATUSES, default: "Pending" },
    notes: { type: String, default: null, trim: true },

    // Tracking timestamps & audit
    last_tracking_update: { type: Date, default: null },
    last_successful_sync: { type: Date, default: null },
    last_sync_attempt: { type: Date, default: null },
    last_trackcourier_sync: { type: Date, default: null },
    last_maruti_sync: { type: Date, default: null },
    raw_courier_status: { type: String, default: null },
    last_tracking_error: { type: String, default: null },
    api_status_conflict: { type: String, default: null }, // "API Conflict", "Verification Required" or null

    // Real-time tracking location & events
    tracking_location: { type: String, default: null, trim: true },
    tracking_event_date: { type: Date, default: null },
    tracking_event_description: { type: String, default: null, trim: true },
    tracking_estimated_delivery: { type: String, default: null, trim: true },
    tracking_source: { type: String, default: null, trim: true },
    tracking_provider: { type: String, default: null, trim: true },

    // Complete checkpoint history
    tracking_history: [
      {
        date: { type: Date, default: null },
        description: { type: String, default: "" },
        location: { type: String, default: null },
        status: { type: String, default: null },
        source: { type: String, default: null },
      },
    ],

    // Route locations
    origin_location: { type: String, default: null, trim: true },
    destination_location: { type: String, default: null, trim: true },

    // Delivery & TAT (Turnaround Time) metrics
    pickup_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    tat_hours: { type: Number, default: null },
    tat_display: { type: String, default: null, trim: true },

    // Delay identification
    is_delayed: { type: Boolean, default: false },
    delayed_days: { type: Number, default: 0 },

    // Delivery failure / attempt tracking
    is_delivery_failed: { type: Boolean, default: false },
    delivery_failure_reason: { type: String, default: null, trim: true },

    // RTO lifecycle tracking
    rto_status: { type: String, default: null, trim: true }, // "RTO Initiated" | "RTO In Transit" | "RTO Hub" | "RTO Delivered / Returned"
    rto_initiated_at: { type: Date, default: null },
    rto_returned_at: { type: Date, default: null },

    // Sender profile snapshot
    sender_name: { type: String, default: null, trim: true },
    sender_address: { type: String, default: null, trim: true },
    sender_phone: { type: String, default: null, trim: true },
    sender_website: { type: String, default: null, trim: true },
    sender_review_url: { type: String, default: null, trim: true },
    sender_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: "SenderProfile",
    },
    created_at: { type: Date, default: Date.now, immutable: true },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        if (ret.created_at) {
          const d = new Date(ret.created_at);
          ret.created_at = isNaN(d.getTime()) ? null : d.toISOString();
        }
        const dateFields = [
          "last_tracking_update",
          "last_successful_sync",
          "last_sync_attempt",
          "last_trackcourier_sync",
          "last_maruti_sync",
          "tracking_event_date",
          "pickup_at",
          "delivered_at",
          "rto_initiated_at",
          "rto_returned_at",
        ];
        for (const key of dateFields) {
          if (ret[key]) {
            const d = new Date(ret[key]);
            ret[key] = isNaN(d.getTime()) ? null : d.toISOString();
          } else {
            ret[key] = null;
          }
        }
        if (Array.isArray(ret.tracking_history)) {
          ret.tracking_history = ret.tracking_history.map((h) => {
            let dateStr = null;
            if (h.date) {
              const d = new Date(h.date);
              dateStr = isNaN(d.getTime()) ? null : d.toISOString();
            }
            return {
              date: dateStr,
              description: h.description || "",
              location: h.location || null,
              status: h.status || null,
              source: h.source || null,
            };
          });
        }
        return ret;
      },
    },
  },
);

labelSchema.index({ created_at: -1 });
labelSchema.index({ status: 1 });
labelSchema.index({ tracking_id: 1 });
labelSchema.index({ delivered_at: -1 });
labelSchema.index({ is_delayed: 1 });
labelSchema.index({ courier_name: 1, status: 1 });

export const Label = mongoose.models.Label || mongoose.model("Label", labelSchema);
export default Label;
