import mongoose from "mongoose";
import { TrackingSettings, DEFAULT_TRACKING_SETTINGS } from "../models/TrackingSettings.js";
import { TrackingLedger } from "../models/TrackingLedger.js";

/**
 * In-memory state for tracking controller
 */
let cachedSettings = { ...DEFAULT_TRACKING_SETTINGS };
let isSettingsLoaded = false;

// Provider circuit breakers: { [provider]: { isTripped: boolean, reason: string, trippedAt: Date, tripUntil: Date|null } }
const circuitBreakers = {
  ...DEFAULT_TRACKING_SETTINGS.circuitBreakers,
};

// Per-shipment cooldown timestamps: Map<"provider:awb", timestampMs>
const shipmentLastRequestMap = new Map();

// Deduplication map: Map<"provider:awb", Promise>
const inFlightRequests = new Map();

// Last request outcomes for quick reporting
const providerLastOutcomes = {
  trackcourier_account1: { lastSuccess: null, lastError: null, lastErrorTime: null },
  trackcourier_account2: { lastSuccess: null, lastError: null, lastErrorTime: null },
  trackcourier_account3: { lastSuccess: null, lastError: null, lastErrorTime: null },
  trackcourier: { lastSuccess: null, lastError: null, lastErrorTime: null },
  delhivery: { lastSuccess: null, lastError: null, lastErrorTime: null },
  dtdc: { lastSuccess: null, lastError: null, lastErrorTime: null },
  shadowfax: { lastSuccess: null, lastError: null, lastErrorTime: null },
  ekart: { lastSuccess: null, lastError: null, lastErrorTime: null },
  shree_maruti: { lastSuccess: null, lastError: null, lastErrorTime: null },
};

// Mutex / Queue for concurrency limiting
let activeConcurrentCount = 0;
const waitingQueue = [];

function acquireConcurrencySlot(maxConcurrent = 1) {
  if (activeConcurrentCount < maxConcurrent) {
    activeConcurrentCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitingQueue.push(resolve);
  });
}

function releaseConcurrencySlot() {
  if (waitingQueue.length > 0) {
    const next = waitingQueue.shift();
    next();
  } else {
    activeConcurrentCount = Math.max(0, activeConcurrentCount - 1);
  }
}

/**
 * Normalizes provider name to canonical key
 */
export function getProviderKey(providerName) {
  const s = String(providerName || "").toLowerCase().replace(/[\s.-]+/g, "_");
  if (s.includes("account3") || s.includes("account_3") || s.includes("tertiary") || s.includes("account 3")) return "trackcourier_account3";
  if (s.includes("account2") || s.includes("account_2") || s.includes("backup") || s.includes("secondary") || s.includes("account 2")) return "trackcourier_account2";
  if (s.includes("account1") || s.includes("account_1") || s.includes("primary") || s.includes("account 1")) return "trackcourier_account1";
  if (s === "trackcourier" || s.includes("trackcourier")) return "trackcourier_account1";
  if (s.includes("delhivery")) return "delhivery";
  if (s.includes("dtdc")) return "dtdc";
  if (s.includes("shadowfax")) return "shadowfax";
  if (s.includes("ekart")) return "ekart";
  if (s.includes("maruti")) return "shree_maruti";
  return "unknown";
}

/**
 * Loads or initializes tracking settings from MongoDB
 */
export async function initTrackingSettings() {
  if (mongoose.connection.readyState !== 1) {
    return cachedSettings;
  }
  try {
    const doc = await TrackingSettings.findOne().maxTimeMS(2000);
    if (doc) {
      cachedSettings = {
        ...DEFAULT_TRACKING_SETTINGS,
        ...doc.toJSON(),
        providers: {
          ...DEFAULT_TRACKING_SETTINGS.providers,
          ...(doc.providers ? doc.providers.toObject?.() || doc.providers : {}),
        },
        circuitBreakers: {
          ...DEFAULT_TRACKING_SETTINGS.circuitBreakers,
          ...(doc.circuitBreakers ? doc.circuitBreakers.toObject?.() || doc.circuitBreakers : {}),
        },
      };
      if (cachedSettings.circuitBreakers) {
        Object.assign(circuitBreakers, cachedSettings.circuitBreakers);
      }
    } else {
      const created = await TrackingSettings.create(DEFAULT_TRACKING_SETTINGS);
      cachedSettings = created.toJSON();
    }
    isSettingsLoaded = true;
  } catch (err) {
    // MongoDB might not be connected yet (e.g. during standalone tests)
    isSettingsLoaded = false;
  }
  return cachedSettings;
}

/**
 * Gets the current active tracking settings
 */
export function getTrackingSettings() {
  return cachedSettings;
}

/**
 * Updates tracking settings in-memory and in MongoDB
 */
export async function updateTrackingSettings(updates = {}) {
  const current = cachedSettings;
  const mergedProviders = {
    ...current.providers,
    ...(updates.providers || {}),
  };
  if (updates.providers?.trackcourier) {
    mergedProviders.trackcourier_account1 = {
      ...(mergedProviders.trackcourier_account1 || {}),
      ...updates.providers.trackcourier,
    };
  }
  if (updates.providers?.trackcourier_account1) {
    mergedProviders.trackcourier = {
      ...(mergedProviders.trackcourier || {}),
      ...updates.providers.trackcourier_account1,
    };
  }
  const merged = {
    ...current,
    ...updates,
    providers: mergedProviders,
    circuitBreakers: {
      ...current.circuitBreakers,
      ...(updates.circuitBreakers || {}),
    },
    updated_at: new Date(),
  };

  cachedSettings = merged;

  if (mongoose.connection.readyState === 1) {
    try {
      await TrackingSettings.findOneAndUpdate({}, merged, { upsert: true, new: true }).maxTimeMS(2000);
    } catch (err) {
      // In-memory update still active
    }
  }

  return cachedSettings;
}

/**
 * Manually trips a provider's circuit breaker
 */
export function tripCircuitBreaker(provider, reason, durationMs = null) {
  const p = getProviderKey(provider);
  const tripUntil = durationMs ? new Date(Date.now() + durationMs) : null;
  circuitBreakers[p] = {
    isTripped: true,
    reason,
    trippedAt: new Date(),
    tripUntil,
  };
  if (p === "trackcourier_account1") {
    circuitBreakers.trackcourier = { ...circuitBreakers[p] };
  }
  cachedSettings.circuitBreakers = { ...circuitBreakers };
  if (mongoose.connection.readyState === 1) {
    const updateFields = { [`circuitBreakers.${p}`]: circuitBreakers[p] };
    if (p === "trackcourier_account1") {
      updateFields["circuitBreakers.trackcourier"] = circuitBreakers[p];
    }
    TrackingSettings.updateOne({}, { $set: updateFields }).catch(() => {});
  }
}

/**
 * Resets a provider's circuit breaker
 */
export function resetCircuitBreaker(provider) {
  const p = getProviderKey(provider);
  circuitBreakers[p] = {
    isTripped: false,
    reason: null,
    trippedAt: null,
    tripUntil: null,
  };
  if (p === "trackcourier_account1") {
    circuitBreakers.trackcourier = { ...circuitBreakers[p] };
  }
  cachedSettings.circuitBreakers = { ...circuitBreakers };
  if (mongoose.connection.readyState === 1) {
    const updateFields = { [`circuitBreakers.${p}`]: circuitBreakers[p] };
    if (p === "trackcourier_account1") {
      updateFields["circuitBreakers.trackcourier"] = circuitBreakers[p];
    }
    TrackingSettings.updateOne({}, { $set: updateFields }).catch(() => {});
  }
}

/**
 * Checks whether a circuit breaker is currently active
 */
export function isCircuitBreakerTripped(provider) {
  const p = getProviderKey(provider);
  const cb = circuitBreakers[p];
  if (!cb || !cb.isTripped) return false;

  // If breaker had a temporary duration and time passed, auto-reset
  if (cb.tripUntil && Date.now() > cb.tripUntil.getTime()) {
    cb.isTripped = false;
    cb.reason = null;
    cb.tripUntil = null;
    return false;
  }

  return true;
}

/**
 * Checks per-shipment cooldown status
 * Returns: { isCoolingDown: boolean, remainingSeconds: number }
 */
export function checkShipmentCooldown(providerKey, awb, cooldownMinutes) {
  const key = `${providerKey}:${String(awb).trim()}`;
  const lastTime = shipmentLastRequestMap.get(key);
  if (!lastTime) return { isCoolingDown: false, remainingSeconds: 0 };

  const cooldownMs = (cooldownMinutes ?? cachedSettings.perShipmentCooldownMinutes ?? 30) * 60 * 1000;
  const elapsed = Date.now() - lastTime;

  if (elapsed < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return { isCoolingDown: true, remainingSeconds };
  }

  return { isCoolingDown: false, remainingSeconds: 0 };
}

/**
 * Records that a shipment was queried at this timestamp
 */
export function recordShipmentQuery(providerKey, awb) {
  const key = `${providerKey}:${String(awb).trim()}`;
  shipmentLastRequestMap.set(key, Date.now());
}

// In-flight active reservations to prevent concurrent overshooting of daily budgets
const inFlightProviderDaily = new Map();
let inFlightGlobalDaily = 0;

// Providers with verified unmetered/unlimited allowances exempt from finite global metered quotas
export const UNMETERED_PROVIDERS = new Set(["shree_maruti"]);

export function isUnmeteredProvider(providerKey) {
  const p = getProviderKey(providerKey);
  return UNMETERED_PROVIDERS.has(p);
}

export function getInFlightProviderDaily(providerKey) {
  const p = getProviderKey(providerKey);
  return inFlightProviderDaily.get(p) || 0;
}

export function getInFlightGlobalDaily() {
  return inFlightGlobalDaily;
}

export function resetInFlightReservations() {
  inFlightProviderDaily.clear();
  inFlightGlobalDaily = 0;
}

/**
 * Safe tracking diagnostics logger. Never logs credentials, tokens, or customer PII.
 */
export function logTrackingDiagnostic(level, message, meta = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(meta)) {
    const lk = key.toLowerCase();
    if (
      lk.includes("token") ||
      lk.includes("secret") ||
      lk.includes("key") ||
      lk.includes("pass") ||
      lk.includes("auth") ||
      lk.includes("phone") ||
      lk.includes("mobile") ||
      lk.includes("address") ||
      lk.includes("email") ||
      lk.includes("name")
    ) {
      continue;
    }
    sanitized[key] = value;
  }
  if (process.env.NODE_ENV !== "test") {
    console.log(`[TRACKING_DIAGNOSTIC] [${level.toUpperCase()}] ${message}`, JSON.stringify(sanitized));
  }
  return { level, message, meta: sanitized };
}

/**
 * Queries request counts from the request ledger for metered providers (excluding unmetered providers like Shree Maruti Direct)
 * for today and the current month.
 */
export async function getGlobalUsage() {
  if (mongoose.connection.readyState !== 1) {
    return { today: 0, month: 0 };
  }
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const meteredFilter = { provider: { $nin: Array.from(UNMETERED_PROVIDERS) } };
  try {
    const [todayCount, monthCount] = await Promise.all([
      TrackingLedger.countDocuments({ ...meteredFilter, timestamp: { $gte: startOfDay } }).maxTimeMS(2000),
      TrackingLedger.countDocuments({ ...meteredFilter, timestamp: { $gte: startOfMonth } }).maxTimeMS(2000),
    ]);
    return { today: todayCount, month: monthCount };
  } catch (err) {
    return { today: 0, month: 0 };
  }
}

/**
 * Queries request counts from the request ledger for today and the current calendar month
 */
export async function getProviderUsage(providerKey) {
  if (mongoose.connection.readyState !== 1) {
    return { today: 0, month: 0 };
  }

  const p = getProviderKey(providerKey);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const providerFilter = p === "trackcourier_account1"
    ? { $in: ["trackcourier_account1", "trackcourier"] }
    : p;

  try {
    const [todayCount, monthCount] = await Promise.all([
      TrackingLedger.countDocuments({
        provider: providerFilter,
        timestamp: { $gte: startOfDay },
      }).maxTimeMS(2000),
      TrackingLedger.countDocuments({
        provider: providerFilter,
        timestamp: { $gte: startOfMonth },
      }).maxTimeMS(2000),
    ]);

    return { today: todayCount, month: monthCount };
  } catch (err) {
    return { today: 0, month: 0 };
  }
}

/**
 * Retrieves full tracking usage statistics for admin settings UI
 */
export async function getTrackingUsageStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let globalToday = 0;
  let globalMonth = 0;
  const providerStats = {};

  const providers = [
    "trackcourier_account1",
    "trackcourier_account2",
    "trackcourier_account3",
    "delhivery",
    "dtdc",
    "shadowfax",
    "ekart",
    "shree_maruti",
  ];

  if (mongoose.connection.readyState === 1) {
    try {
      const meteredFilter = { provider: { $nin: Array.from(UNMETERED_PROVIDERS) } };
      const [gToday, gMonth] = await Promise.all([
        TrackingLedger.countDocuments({ ...meteredFilter, timestamp: { $gte: startOfDay } }).maxTimeMS(2000),
        TrackingLedger.countDocuments({ ...meteredFilter, timestamp: { $gte: startOfMonth } }).maxTimeMS(2000),
      ]);
      globalToday = gToday;
      globalMonth = gMonth;

      for (const p of providers) {
        const providerFilter = p === "trackcourier_account1"
          ? { $in: ["trackcourier_account1", "trackcourier"] }
          : p;

        const [today, month] = await Promise.all([
          TrackingLedger.countDocuments({ provider: providerFilter, timestamp: { $gte: startOfDay } }).maxTimeMS(2000),
          TrackingLedger.countDocuments({ provider: providerFilter, timestamp: { $gte: startOfMonth } }).maxTimeMS(2000),
        ]);

        const cfg = cachedSettings.providers?.[p] || {};
        const cb = circuitBreakers[p] || {};
        const outcome = providerLastOutcomes[p] || {};

        providerStats[p] = {
          enabled: !!cfg.enabled,
          dailyBudget: cfg.dailyBudget || 100,
          monthlyBudget: cfg.monthlyBudget || 1000,
          usedToday: today,
          usedThisMonth: month,
          remainingDaily: Math.max(0, (cfg.dailyBudget || 100) - today),
          remainingMonthly: Math.max(0, (cfg.monthlyBudget || 1000) - month),
          isCircuitBreakerTripped: isCircuitBreakerTripped(p),
          circuitBreakerReason: cb.reason || null,
          circuitBreakerTrippedAt: cb.trippedAt ? cb.trippedAt.toISOString() : null,
          lastSuccess: outcome.lastSuccess ? outcome.lastSuccess.toISOString() : null,
          lastError: outcome.lastError || null,
          lastErrorTime: outcome.lastErrorTime ? outcome.lastErrorTime.toISOString() : null,
        };
      }
    } catch (err) {
      // Return fallback stats if db query failed
    }
  } else {
    for (const p of providers) {
      const cfg = cachedSettings.providers?.[p] || {};
      const cb = circuitBreakers[p] || {};
      const outcome = providerLastOutcomes[p] || {};
      providerStats[p] = {
        enabled: !!cfg.enabled,
        dailyBudget: cfg.dailyBudget || 100,
        monthlyBudget: cfg.monthlyBudget || 1000,
        usedToday: 0,
        usedThisMonth: 0,
        remainingDaily: cfg.dailyBudget || 100,
        remainingMonthly: cfg.monthlyBudget || 1000,
        isCircuitBreakerTripped: isCircuitBreakerTripped(p),
        circuitBreakerReason: cb.reason || null,
        circuitBreakerTrippedAt: cb.trippedAt ? cb.trippedAt.toISOString() : null,
        lastSuccess: outcome.lastSuccess ? outcome.lastSuccess.toISOString() : null,
        lastError: outcome.lastError || null,
        lastErrorTime: outcome.lastErrorTime ? outcome.lastErrorTime.toISOString() : null,
      };
    }
  }

  return {
    settings: cachedSettings,
    global: {
      externalTrackingEnabled: cachedSettings.externalTrackingEnabled,
      autoRefreshEnabled: cachedSettings.autoRefreshEnabled,
      scheduledSyncEnabled: cachedSettings.scheduledSyncEnabled,
      perShipmentCooldownMinutes: cachedSettings.perShipmentCooldownMinutes,
      maxBatchSize: cachedSettings.maxBatchSize,
      usedToday: globalToday,
      usedThisMonth: globalMonth,
      dailyBudget: cachedSettings.globalDailyBudget,
      monthlyBudget: cachedSettings.globalMonthlyBudget,
      remainingDaily: Math.max(0, cachedSettings.globalDailyBudget - globalToday),
      remainingMonthly: Math.max(0, cachedSettings.globalMonthlyBudget - globalMonth),
    },
    providers: providerStats,
  };
}

/**
 * Central controller that wraps all external courier tracking requests.
 *
 * Enforces:
 * 1. Global kill switch
 * 2. Provider kill switch
 * 3. Circuit breaker for quota exhaustion (402) and rate limits (429)
 * 4. Daily and monthly request budgets
 * 5. Per-shipment cooldown (with force override for manual clicks)
 * 6. Deduplication of concurrent identical requests
 * 7. Concurrency limiting
 * 8. Safe ledger logging without exposing tokens
 *
 * @param {Object} params
 * @param {string} params.provider - Provider name (e.g. "TrackCourier", "TrackCourier (Account 1)", "TrackCourier (Account 2)", "TrackCourier (Account 3)", "DTDC")
 * @param {string} params.courier - Courier name (e.g. "India Post", "Shadowfax")
 * @param {string} params.awb - Tracking/AWB number
 * @param {string} params.source - Request source ("manual", "batch", "fallback", "webhook", "cron")
 * @param {Function} params.executeFn - Async function returning TrackingResult
 * @param {boolean} params.force - Force bypass cooldown if requested by user
 */
export function executeTrackRequest({
  provider,
  courier,
  awb,
  source = "manual",
  executeFn,
  force = false,
  cooldownMs = null,
}) {
  const providerKey = getProviderKey(provider);
  const cleanAwb = String(awb || "").trim();
  const dedupKey = `${providerKey}:${cleanAwb}`;

  // Synchronous deduplication: if identical query is already running, return existing promise immediately
  if (inFlightRequests.has(dedupKey)) {
    return inFlightRequests.get(dedupKey);
  }

  const requestPromise = (async () => {
    let hasReservedSlot = false;
    const isUnmetered = isUnmeteredProvider(providerKey);
    try {
      // 1. Global kill switch check
      if (!cachedSettings.externalTrackingEnabled) {
        return {
          skipped: true,
          reason: "External API tracking is globally disabled by administrator policy",
          error: "External tracking disabled",
          provider,
          courier,
          trackingNumber: cleanAwb,
        };
      }

      // 2. Provider-specific switch check
      const providerCfg = cachedSettings.providers?.[providerKey] || (providerKey === "trackcourier_account1" ? cachedSettings.providers?.trackcourier : null);
      if (providerCfg && providerCfg.enabled === false) {
        return {
          skipped: true,
          reason: `Provider "${provider}" is currently disabled by administrator policy`,
          error: `Provider ${provider} disabled`,
          provider,
          courier,
          trackingNumber: cleanAwb,
        };
      }

      // 3. Circuit breaker check (e.g. 402 quota exhaustion, 429 rate limit)
      if (isCircuitBreakerTripped(providerKey)) {
        const cb = circuitBreakers[providerKey];
        return {
          skipped: true,
          isCircuitBreakerActive: true,
          reason: `Provider "${provider}" is temporarily paused by circuit breaker (${cb.reason})`,
          error: `Provider ${provider} quota limit or rate limit active: ${cb.reason}`,
          provider,
          courier,
          trackingNumber: cleanAwb,
        };
      }

      // 4. Per-shipment cooldown check
      if (!force) {
        const cooldownMinutes = cooldownMs
          ? Math.ceil(cooldownMs / 60000)
          : cachedSettings.perShipmentCooldownMinutes;
        const cooldown = checkShipmentCooldown(providerKey, cleanAwb, cooldownMinutes);
        if (cooldown.isCoolingDown) {
          return {
            skipped: true,
            cooldownActive: true,
            remainingSeconds: cooldown.remainingSeconds,
            reason: `Shipment cooldown active (${cooldown.remainingSeconds}s remaining). Wait before querying ${provider} again.`,
            provider,
            courier,
            trackingNumber: cleanAwb,
          };
        }
      }

      // 5. Global Daily and Monthly budget check (with in-flight reservation accounting)
      // Only metered providers are constrained by the finite global budget.
      // Unmetered providers (e.g. Shree Maruti Direct) have independent unlimited allowances and are governed by their own provider budget.
      if (!isUnmetered) {
        const globalDailyBudget = cachedSettings.globalDailyBudget;
        const globalMonthlyBudget = cachedSettings.globalMonthlyBudget;
        if (globalDailyBudget || globalMonthlyBudget) {
          const globalUsage = await getGlobalUsage();
          const effectiveGlobalToday = globalUsage.today + inFlightGlobalDaily;

          if (globalDailyBudget && effectiveGlobalToday >= globalDailyBudget) {
            logTrackingDiagnostic("warn", "Global daily quota budget reached", {
              provider,
              courier,
              awb: cleanAwb,
              usedToday: effectiveGlobalToday,
              dailyBudget: globalDailyBudget,
              source,
            });
            return {
              skipped: true,
              reason: `Global daily quota budget reached (${effectiveGlobalToday}/${globalDailyBudget})`,
              error: `Global daily budget exhausted (${effectiveGlobalToday}/${globalDailyBudget})`,
              provider,
              courier,
              trackingNumber: cleanAwb,
            };
          }

          if (globalMonthlyBudget && globalUsage.month >= globalMonthlyBudget) {
            logTrackingDiagnostic("warn", "Global monthly quota budget reached", {
              provider,
              courier,
              awb: cleanAwb,
              usedMonth: globalUsage.month,
              monthlyBudget: globalMonthlyBudget,
              source,
            });
            return {
              skipped: true,
              reason: `Global monthly quota budget reached (${globalUsage.month}/${globalMonthlyBudget})`,
              error: `Global monthly budget exhausted (${globalUsage.month}/${globalMonthlyBudget})`,
              provider,
              courier,
              trackingNumber: cleanAwb,
            };
          }
        }
      }

      // 6. Provider-specific Daily and Monthly budget check (with in-flight reservation accounting)
      if (providerCfg) {
        const usage = await getProviderUsage(providerKey);
        const inFlightForProvider = inFlightProviderDaily.get(providerKey) || 0;
        const effectiveProviderToday = usage.today + inFlightForProvider;

        if (providerCfg.dailyBudget && effectiveProviderToday >= providerCfg.dailyBudget) {
          tripCircuitBreaker(providerKey, `Daily budget reached (${effectiveProviderToday}/${providerCfg.dailyBudget})`);
          logTrackingDiagnostic("warn", `Daily budget exhausted for ${provider}`, {
            provider,
            courier,
            awb: cleanAwb,
            usedToday: effectiveProviderToday,
            dailyBudget: providerCfg.dailyBudget,
            source,
          });
          return {
            skipped: true,
            reason: `Daily quota budget reached for ${provider} (${effectiveProviderToday}/${providerCfg.dailyBudget})`,
            error: `Daily budget exhausted for ${provider}`,
            provider,
            courier,
            trackingNumber: cleanAwb,
          };
        }

        if (providerCfg.monthlyBudget && usage.month >= providerCfg.monthlyBudget) {
          tripCircuitBreaker(providerKey, `Monthly budget reached (${usage.month}/${providerCfg.monthlyBudget})`);
          logTrackingDiagnostic("warn", `Monthly budget exhausted for ${provider}`, {
            provider,
            courier,
            awb: cleanAwb,
            usedMonth: usage.month,
            monthlyBudget: providerCfg.monthlyBudget,
            source,
          });
          return {
            skipped: true,
            reason: `Monthly quota budget reached for ${provider} (${usage.month}/${providerCfg.monthlyBudget})`,
            error: `Monthly budget exhausted for ${provider}`,
            provider,
            courier,
            trackingNumber: cleanAwb,
          };
        }
      }

      // Atomically reserve quota slot for both global and provider budgets
      hasReservedSlot = true;
      if (!isUnmetered) {
        inFlightGlobalDaily++;
      }
      inFlightProviderDaily.set(providerKey, (inFlightProviderDaily.get(providerKey) || 0) + 1);

      // 7. Concurrency Limiter & In-Flight Tracking
      const maxConcurrent = cachedSettings.maxConcurrentRequests || 1;
      await acquireConcurrencySlot(maxConcurrent);
      const startTime = Date.now();
      let result = null;
      let statusCode = 200;
      let errorMessage = null;
      let isSuccess = false;

      logTrackingDiagnostic("info", "Starting tracking execution", {
        provider,
        courier,
        awb: cleanAwb,
        source,
      });

      try {
        result = await executeFn();

        statusCode = result.statusCode || (result.error ? 500 : 200);
        errorMessage = result.error || null;
        isSuccess = !result.error && (!!result.status || !!result.rawStatus);

        // Inspect for non-retryable errors
        const isActualQuota =
          result.isQuotaError ||
          statusCode === 402 ||
          (providerKey.startsWith("trackcourier") && (errorMessage?.includes("402") || errorMessage?.toLowerCase().includes("quota exceeded")));

        if (isActualQuota) {
          statusCode = 402;
          tripCircuitBreaker(providerKey, "Quota exhausted (HTTP 402)");
        } else if (result.isRateLimitError || statusCode === 429 || errorMessage?.includes("429") || errorMessage?.toLowerCase().includes("too many requests")) {
          statusCode = 429;
          // Trip rate limit breaker for 120 seconds
          tripCircuitBreaker(providerKey, "Rate limit reached (HTTP 429)", 120 * 1000);
        } else if (result.isAuthError || statusCode === 401 || statusCode === 403 || (providerKey === "dtdc" && errorMessage?.includes("401"))) {
          tripCircuitBreaker(providerKey, `Authentication failed (HTTP ${statusCode === 403 ? 403 : 401})`);
        }

        // Record outcomes
        const outcome = providerLastOutcomes[providerKey] || (providerLastOutcomes[providerKey] = {});
        if (isSuccess) {
          outcome.lastSuccess = new Date();
        } else {
          outcome.lastError = errorMessage;
          outcome.lastErrorTime = new Date();
        }

        // Record shipment cooldown
        recordShipmentQuery(providerKey, cleanAwb);

        return result;
      } catch (err) {
        errorMessage = err.message || "Unknown error during tracking execution";
        statusCode = 500;
        isSuccess = false;

        const outcome = providerLastOutcomes[providerKey] || (providerLastOutcomes[providerKey] = {});
        outcome.lastError = errorMessage;
        outcome.lastErrorTime = new Date();

        return {
          error: errorMessage,
          source: providerKey,
          provider,
          courier,
          trackingNumber: cleanAwb,
          statusCode,
        };
      } finally {
        const durationMs = Date.now() - startTime;
        releaseConcurrencySlot();

        logTrackingDiagnostic(isSuccess ? "info" : "warn", "Completed tracking execution", {
          provider,
          courier,
          awb: cleanAwb,
          source,
          statusCode,
          success: isSuccess,
          durationMs,
        });

        // Safe ledger logging
        if (mongoose.connection.readyState === 1) {
          try {
            await TrackingLedger.create({
              provider: providerKey,
              courier_name: courier,
              awb: cleanAwb,
              source,
              status_code: statusCode,
              success: isSuccess,
              error_message: errorMessage ? errorMessage.slice(0, 300) : null,
              duration_ms: durationMs,
              quota_consumed: 1,
            });
          } catch (ledgerErr) {
            // Ignore ledger db write errors in testing/disconnected state
          }
        }
      }
    } finally {
      if (hasReservedSlot) {
        if (!isUnmetered) {
          inFlightGlobalDaily = Math.max(0, inFlightGlobalDaily - 1);
        }
        const curReserved = inFlightProviderDaily.get(providerKey) || 0;
        if (curReserved <= 1) {
          inFlightProviderDaily.delete(providerKey);
        } else {
          inFlightProviderDaily.set(providerKey, curReserved - 1);
        }
      }
    }
  })();

  inFlightRequests.set(dedupKey, requestPromise);
  requestPromise.finally(() => {
    inFlightRequests.delete(dedupKey);
  });
  return requestPromise;
}

// Initialize on module load
initTrackingSettings().catch(() => {});
