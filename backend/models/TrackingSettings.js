import mongoose from "mongoose";

export const DEFAULT_TRACKING_SETTINGS = {
  externalTrackingEnabled: true, // Master kill switch for external API tracking
  autoRefreshEnabled: false, // Auto-refresh in background (OFF by default)
  scheduledSyncEnabled: false, // Scheduled bulk sync jobs (OFF by default)
  perShipmentCooldownMinutes: 30, // 30-min per-shipment cooldown
  maxConcurrentRequests: 1, // Concurrency limit
  maxBatchSize: 10, // Max parcels per bulk refresh
  globalDailyBudget: 100, // Total external requests allowed per day
  globalMonthlyBudget: 1000, // Total external requests allowed per month
  circuitBreakers: {
    trackcourier_account1: {
      isTripped: true, // Account 1 is currently quota-exhausted (HTTP 402). Active until reset.
      reason: "TrackCourier Account 1 quota exhausted (HTTP 402) - active until quota reset",
      trippedAt: new Date(),
      tripUntil: null,
    },
    trackcourier_account2: {
      isTripped: false, // Account 2 backup key (clean / independent circuit breaker)
      reason: null,
      trippedAt: null,
      tripUntil: null,
    },
    trackcourier_account3: {
      isTripped: false, // Account 3 tertiary key (clean / independent circuit breaker)
      reason: null,
      trippedAt: null,
      tripUntil: null,
    },
    trackcourier: {
      isTripped: true,
      reason: "TrackCourier Account 1 quota exhausted (HTTP 402)",
      trippedAt: new Date(),
      tripUntil: null,
    },
    delhivery: { isTripped: false, reason: null, trippedAt: null, tripUntil: null },
    dtdc: { isTripped: false, reason: null, trippedAt: null, tripUntil: null },
    shadowfax: { isTripped: false, reason: null, trippedAt: null, tripUntil: null },
    ekart: { isTripped: false, reason: null, trippedAt: null, tripUntil: null },
    shree_maruti: { isTripped: false, reason: null, trippedAt: null, tripUntil: null },
  },
  providers: {
    trackcourier_account1: {
      enabled: true, // Primary TrackCourier account
      dailyBudget: 10,
      monthlyBudget: 100,
    },
    trackcourier_account2: {
      enabled: true, // Secondary TrackCourier account (attempted when Account 1 fails)
      dailyBudget: 10,
      monthlyBudget: 100,
    },
    trackcourier_account3: {
      enabled: true, // Tertiary TrackCourier account (attempted when Accounts 1 & 2 fail)
      dailyBudget: 10,
      monthlyBudget: 100,
    },
    trackcourier: {
      enabled: true,
      dailyBudget: 10,
      monthlyBudget: 100,
    },
    delhivery: {
      enabled: true,
      dailyBudget: 500,
      monthlyBudget: 10000,
    },
    dtdc: {
      enabled: true,
      dailyBudget: 500,
      monthlyBudget: 10000,
    },
    shadowfax: {
      enabled: true,
      dailyBudget: 500,
      monthlyBudget: 10000,
    },
    ekart: {
      enabled: true,
      dailyBudget: 500,
      monthlyBudget: 10000,
    },
    shree_maruti: {
      enabled: true,
      dailyBudget: 500,
      monthlyBudget: 10000,
    },
  },
};

const providerSettingSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    dailyBudget: { type: Number, default: 100 },
    monthlyBudget: { type: Number, default: 1000 },
  },
  { _id: false },
);

const circuitBreakerSchema = new mongoose.Schema(
  {
    isTripped: { type: Boolean, default: false },
    reason: { type: String, default: null },
    trippedAt: { type: Date, default: null },
    tripUntil: { type: Date, default: null },
  },
  { _id: false },
);

export const trackingSettingsSchema = new mongoose.Schema(
  {
    externalTrackingEnabled: { type: Boolean, default: DEFAULT_TRACKING_SETTINGS.externalTrackingEnabled },
    autoRefreshEnabled: { type: Boolean, default: DEFAULT_TRACKING_SETTINGS.autoRefreshEnabled },
    scheduledSyncEnabled: { type: Boolean, default: DEFAULT_TRACKING_SETTINGS.scheduledSyncEnabled },
    perShipmentCooldownMinutes: { type: Number, default: DEFAULT_TRACKING_SETTINGS.perShipmentCooldownMinutes },
    maxConcurrentRequests: { type: Number, default: DEFAULT_TRACKING_SETTINGS.maxConcurrentRequests },
    maxBatchSize: { type: Number, default: DEFAULT_TRACKING_SETTINGS.maxBatchSize },
    globalDailyBudget: { type: Number, default: DEFAULT_TRACKING_SETTINGS.globalDailyBudget },
    globalMonthlyBudget: { type: Number, default: DEFAULT_TRACKING_SETTINGS.globalMonthlyBudget },
    circuitBreakers: {
      trackcourier_account1: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.trackcourier_account1 }),
      },
      trackcourier_account2: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.trackcourier_account2 }),
      },
      trackcourier_account3: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.trackcourier_account3 }),
      },
      trackcourier: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.trackcourier }),
      },
      delhivery: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.delhivery }),
      },
      dtdc: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.dtdc }),
      },
      shadowfax: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.shadowfax }),
      },
      ekart: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.ekart }),
      },
      shree_maruti: {
        type: circuitBreakerSchema,
        default: () => ({ ...DEFAULT_TRACKING_SETTINGS.circuitBreakers.shree_maruti }),
      },
    },
    providers: {
      trackcourier_account1: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.trackcourier_account1 }) },
      trackcourier_account2: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.trackcourier_account2 }) },
      trackcourier_account3: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.trackcourier_account3 }) },
      trackcourier: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.trackcourier }) },
      delhivery: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.delhivery }) },
      dtdc: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.dtdc }) },
      shadowfax: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.shadowfax }) },
      ekart: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.ekart }) },
      shree_maruti: { type: providerSettingSchema, default: () => ({ ...DEFAULT_TRACKING_SETTINGS.providers.shree_maruti }) },
    },
    updated_at: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    bufferCommands: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        return ret;
      },
    },
  },
);

export const TrackingSettings = mongoose.models.TrackingSettings || mongoose.model("TrackingSettings", trackingSettingsSchema);
