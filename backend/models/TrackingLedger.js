import mongoose from "mongoose";

export const trackingLedgerSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    provider: {
      type: String,
      required: true,
      index: true,
      enum: [
        "trackcourier",
        "trackcourier_account1",
        "trackcourier_account2",
        "trackcourier_account3",
        "delhivery",
        "dtdc",
        "shadowfax",
        "ekart",
        "shree_maruti",
        "unknown",
      ],
    },
    courier_name: { type: String, required: true },
    awb: { type: String, required: true, index: true },
    source: {
      type: String,
      default: "manual",
      enum: ["manual", "batch", "fallback", "webhook", "cron", "test"],
    },
    status_code: { type: Number, default: null },
    success: { type: Boolean, default: false },
    error_message: { type: String, default: null },
    duration_ms: { type: Number, default: 0 },
    quota_consumed: { type: Number, default: 1 },
  },
  {
    versionKey: false,
    bufferCommands: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        ret.timestamp = ret.timestamp ? new Date(ret.timestamp).toISOString() : null;
        return ret;
      },
    },
  },
);

trackingLedgerSchema.index({ timestamp: -1 });
trackingLedgerSchema.index({ provider: 1, timestamp: -1 });
trackingLedgerSchema.index({ awb: 1, timestamp: -1 });

export const TrackingLedger =
  mongoose.models.TrackingLedger ||
  mongoose.model("TrackingLedger", trackingLedgerSchema);
