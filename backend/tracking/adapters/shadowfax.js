import {
  createTrackingResult,
  mapStatus,
  detectRtoStatus,
  detectFailure,
} from "./base.js";
import { fetchTrackCourier, hasTrackCourierKey } from "./trackcourier.js";
import { isCircuitBreakerTripped } from "../controller.js";

const COURIER_NAME = "Shadowfax";

/**
 * Checks whether SHADOWFAX_API_TOKEN is present in the environment
 */
export function hasShadowfaxToken() {
  return !!process.env.SHADOWFAX_API_TOKEN;
}

/**
 * Checks whether OAuth2 credentials (SHADOWFAX_CLIENT_ID and SHADOWFAX_CLIENT_SECRET) are present
 */
export function isShadowfaxOAuthConfigured() {
  return !!(process.env.SHADOWFAX_CLIENT_ID && process.env.SHADOWFAX_CLIENT_SECRET);
}

/**
 * In-memory cache for OAuth2 access token
 */
let cachedOAuthToken = null;
let cachedOAuthExpiresAt = 0;

/**
 * Clears the in-memory OAuth2 token cache
 */
export function clearShadowfaxOAuthCache() {
  cachedOAuthToken = null;
  cachedOAuthExpiresAt = 0;
}

/**
 * Exchanges client credentials for a short-lived Bearer token (valid 1 hour)
 * Endpoint: POST {baseUrl}/v1/clients/token/
 * Authentication: HTTP Basic Auth (client_id:client_secret)
 * Body: grant_type=client_credentials
 */
export async function getShadowfaxOAuthToken(forceRefresh = false) {
  const clientId = process.env.SHADOWFAX_CLIENT_ID;
  const clientSecret = process.env.SHADOWFAX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (!forceRefresh && cachedOAuthToken && cachedOAuthExpiresAt > now + 60000) {
    return cachedOAuthToken;
  }

  const baseUrl = getShadowfaxBaseUrl();
  if (!baseUrl) return null;
  const base = baseUrl.replace(/\/+$/, "");
  const apiBase = base.endsWith("/api") ? base : `${base}/api`;
  const tokenUrl = `${apiBase}/v1/clients/token/`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Shadowfax OAuth2 token exchange failed (HTTP ${response.status}): ${err.error || err.message || response.statusText}`,
    );
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Shadowfax OAuth2 response missing access_token");
  }

  cachedOAuthToken = data.access_token;
  const expiresInSec = Number(data.expires_in) || 3600;
  cachedOAuthExpiresAt = now + expiresInSec * 1000;
  return cachedOAuthToken;
}

/**
 * Returns the configured base URL for Shadowfax API
 * E.g. process.env.SHADOWFAX_BASE_URL (or null if unconfigured)
 */
export function getShadowfaxBaseUrl() {
  const url = process.env.SHADOWFAX_BASE_URL;
  return url ? String(url).trim().replace(/\/+$/, "") : null;
}

/**
 * Resolves the appropriate Authorization header:
 * 1. OAuth2 client credentials flow -> Bearer <access_token>
 * 2. Static Bearer token override (SHADOWFAX_BEARER_TOKEN) -> Bearer <token>
 * 3. Static Token Authentication (SHADOWFAX_API_TOKEN from SFX 360 Partner Portal) -> Token <token>
 */
export async function getShadowfaxAuthHeader(forceRefresh = false) {
  if (isShadowfaxOAuthConfigured()) {
    const token = await getShadowfaxOAuthToken(forceRefresh);
    if (token) return `Bearer ${token}`;
  }

  if (process.env.SHADOWFAX_BEARER_TOKEN) {
    return `Bearer ${process.env.SHADOWFAX_BEARER_TOKEN.trim()}`;
  }

  if (process.env.SHADOWFAX_API_TOKEN) {
    return `Token ${process.env.SHADOWFAX_API_TOKEN.trim()}`;
  }

  return null;
}

/**
 * The direct API is only considered configured when BOTH valid authentication credentials
 * (Token, OAuth2, or Bearer) and a confirmed base URL are provided.
 */
export function isShadowfaxDirectConfigured() {
  const hasAuth =
    hasShadowfaxToken() ||
    isShadowfaxOAuthConfigured() ||
    Boolean(process.env.SHADOWFAX_BEARER_TOKEN);
  return hasAuth && Boolean(getShadowfaxBaseUrl());
}

/**
 * Parses numeric epoch timestamp or ISO/date string into a valid ISO string
 */
function toIsoDate(val) {
  if (!val) return null;
  const num = Number(val);
  const date = Number.isFinite(num) ? new Date(num) : new Date(val);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Normalizes Shadowfax status strings into standard internal statuses:
 * "Pending" | "Shipped" | "Delivered" | "RTO" | null
 */
export function normalizeShadowfaxStatus(rawStatus, statusDisplay) {
  const s = String(rawStatus || "").toLowerCase().trim();
  const d = String(statusDisplay || "").toLowerCase().trim();
  const combined = `${s} ${d}`;

  // Delivered
  if (
    (combined.includes("delivered") || s === "dl") &&
    !combined.includes("undelivered") &&
    !combined.includes("rto") &&
    !combined.includes("not delivered")
  ) {
    return "Delivered";
  }

  // RTO / Returned / Refused / Failure
  if (
    combined.includes("rto") ||
    combined.includes("returned") ||
    combined.includes("undelivered") ||
    combined.includes("cancelled") ||
    combined.includes("canceled") ||
    combined.includes("rejected") ||
    combined.includes("delivery failed") ||
    combined.includes("failed delivery")
  ) {
    return "RTO";
  }

  // Pending / Manifest / Unassigned
  if (
      combined.includes("ready to pick") ||
      combined.includes("pending") ||
      combined.includes("manifest") ||
      combined.includes("allocated") ||
      combined.includes("unassigned") ||
      combined.includes("order placed") ||
      combined.includes("order created") ||
      combined.includes("pickup scheduled") ||
      combined.includes("pickup requested")
    ) {
      return "Ready to Pick";
    }

  // Shipped / In Transit / Out for Delivery / Picked up
  if (
    combined.includes("picked up") ||
    combined.includes("picked_up") ||
    combined.includes("in transit") ||
    combined.includes("in_transit") ||
    combined.includes("out for delivery") ||
    combined.includes("out_for_delivery") ||
    combined.includes("reach") ||
    combined.includes("dispatched") ||
    combined.includes("ofd")
  ) {
    return "Shipped / Picked Up";
  }

  return mapStatus(statusDisplay) || mapStatus(rawStatus) || null;
}

/**
 * Normalizes a raw response from official Shadowfax API (GET /api/v4/clients/orders/{awb}/track/)
 * into a standardized tracking result object.
 *
 * @param {Object} data - Raw JSON response from Shadowfax
 * @param {string} waybill - The queried tracking number / AWB
 * @returns {Object} Standardized tracking result
 */
export function normalizeShadowfaxResponse(data, waybill) {
  if (!data || typeof data !== "object") {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "Shadowfax Direct",
      error: "Empty or invalid response from Shadowfax API",
    });
  }

  const orderDetails = data.order_details || null;
  if (!orderDetails && !Array.isArray(data.tracking_details)) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "direct",
      provider: "Shadowfax Direct",
      error: data.message || "No order details or tracking events returned by Shadowfax API",
    });
  }

  const rawStatus = orderDetails?.status || null;
  const statusDisplay = orderDetails?.status_display || null;
  const rawStatusString = statusDisplay || rawStatus || null;

  // Process and sort tracking_details checkpoints (chronological descending: newest first)
  const rawDetails = Array.isArray(data.tracking_details) ? data.tracking_details : [];
  const history = rawDetails
    .map((item) => {
      const date = toIsoDate(item.created);
      const description = String(item.remarks || item.status || "").trim();
      const location = item.location ? String(item.location).trim() : null;
      const status = item.status
        ? String(item.status)
        : item.status_id
          ? String(item.status_id)
          : null;

      return {
        date,
        description,
        location,
        status,
        source: "direct",
      };
    })
    .filter((cp) => cp.date || cp.description || cp.status)
    .sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    });

  const latestCheckpoint = history[0];

  // Route & Origin / Destination
  const pickupDetails = orderDetails?.pickup_details;
  const deliveryDetails = orderDetails?.delivery_details;

  const origin =
    (typeof pickupDetails === "object" && pickupDetails?.city ? String(pickupDetails.city).trim() : null) ||
    (typeof pickupDetails === "string" ? pickupDetails.trim() : null) ||
    null;

  const destination =
    (typeof deliveryDetails === "object" && deliveryDetails?.city ? String(deliveryDetails.city).trim() : null) ||
    (typeof deliveryDetails === "string" ? deliveryDetails.trim() : null) ||
    null;

  // Location resolution
  const location =
    latestCheckpoint?.location ||
    destination ||
    origin ||
    null;

  // Event timestamp & description
  const eventDate = latestCheckpoint?.date || toIsoDate(orderDetails?.order_date) || null;
  const eventDescription = latestCheckpoint?.description || statusDisplay || rawStatus || null;

  // Expected delivery date
  const estimatedDelivery = toIsoDate(orderDetails?.promised_delivery_date);

  // Normalized internal status
  const internalStatus = normalizeShadowfaxStatus(rawStatus, statusDisplay);

  // Pickup timestamp: extracted ONLY when supported by actual tracking events
  let pickupAt = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const c = history[i];
    const desc = `${c.description} ${c.status || ""}`.toLowerCase();
    if (
      desc.includes("picked up") ||
      desc.includes("pickup completed") ||
      desc.includes("pickup successful") ||
      desc.includes("item picked") ||
      desc.includes("item collected")
    ) {
      if (c.date) {
        pickupAt = c.date;
        break;
      }
    }
  }

  // Delivered timestamp: extracted ONLY when shipment is Delivered and supported by actual event
  let deliveredAt = null;
  if (internalStatus === "Delivered") {
    for (const c of history) {
      const desc = `${c.description} ${c.status || ""}`.toLowerCase();
      if (
        desc.includes("deliver") &&
        !desc.includes("undeliver") &&
        !desc.includes("out for deliver") &&
        !desc.includes("attempt") &&
        !desc.includes("rto")
      ) {
        if (c.date) {
          deliveredAt = c.date;
          break;
        }
      }
    }
  }

  // RTO Lifecycle detection
  const rtoStage =
    detectRtoStatus(rawStatusString || latestCheckpoint?.description) ||
    (rawStatusString?.toLowerCase().includes("rto") ? "RTO Initiated" : null);

  let rtoInitiatedAt = null;
  let rtoReturnedAt = null;
  if (rtoStage) {
    for (const c of history) {
      const desc = `${c.description} ${c.status || ""}`.toLowerCase();
      if (
        desc.includes("rto delivered") ||
        desc.includes("returned to origin") ||
        desc.includes("return delivered")
      ) {
        if (c.date && !rtoReturnedAt) rtoReturnedAt = c.date;
      } else if (desc.includes("rto") || desc.includes("return")) {
        if (c.date && !rtoInitiatedAt) rtoInitiatedAt = c.date;
      }
    }
  }

  return createTrackingResult({
    courier: COURIER_NAME,
    trackingNumber: waybill,
    status: internalStatus,
    rawStatus: rawStatusString ? `[direct] ${rawStatusString}` : null,
    location,
    eventDate,
    eventDescription,
    estimatedDelivery,
    origin,
    destination,
    pickupAt,
    deliveredAt,
    rtoStatus: rtoStage,
    rtoInitiatedAt,
    rtoReturnedAt,
    source: "direct",
    provider: "Shadowfax Direct",
    error: internalStatus ? null : (rawStatusString ? null : "No status update available yet"),
    history,
  });
}

/**
 * Direct Shadowfax API tracking (Single AWB)
 * Endpoint: GET {baseUrl}/v4/clients/orders/{awb_number}/track/
 * Header: Authorization: Token {SHADOWFAX_API_TOKEN} or Bearer {access_token}
 */
export async function fetchShadowfaxDirect(waybill, retryAuth = true) {
  const baseUrl = getShadowfaxBaseUrl();
  if (!baseUrl) {
    return { ok: false, error: "Missing SHADOWFAX_BASE_URL in environment (requires confirmed endpoint)" };
  }

  const authHeader = await getShadowfaxAuthHeader();
  if (!authHeader) {
    return { ok: false, error: "Missing Shadowfax authentication credentials in environment (SHADOWFAX_API_TOKEN or SHADOWFAX_CLIENT_ID + SHADOWFAX_CLIENT_SECRET)" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const base = baseUrl.replace(/\/+$/, "");
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;
    const url = `${apiBase}/v4/clients/orders/${encodeURIComponent(waybill)}/track/`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // If 401 and using OAuth2 client credentials, force refresh token once and retry
    if (response.status === 401 && retryAuth && isShadowfaxOAuthConfigured()) {
      clearShadowfaxOAuthCache();
      return fetchShadowfaxDirect(waybill, false);
    }

    if (response.status === 400) {
      const errPayload = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: `Shadowfax Direct API Bad Request (HTTP 400): ${errPayload.message || errPayload.error || "Invalid request"}`,
      };
    }

    if (response.status === 401) {
      return {
        ok: false,
        error: "Shadowfax Direct API Authentication Failed (HTTP 401: Invalid, expired, or environment-mismatched token)",
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        error: "Shadowfax Direct API Access Forbidden (HTTP 403: Unauthorized client account)",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        error: `Shipment "${waybill}" not found in Shadowfax system (HTTP 404)`,
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        error: "Shadowfax Direct API rate limit exceeded (HTTP 429)",
      };
    }

    if (response.status >= 500) {
      return {
        ok: false,
        error: `Shadowfax Direct API Server Error (HTTP ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Shadowfax Direct HTTP ${response.status}`,
      };
    }

    const payload = await response.json().catch(() => ({}));
    const result = normalizeShadowfaxResponse(payload, waybill);
    return { ok: !result.error, result };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "Shadowfax Direct API request timed out" };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Direct Shadowfax API tracking (Bulk AWBs - Max 50 per batch)
 * Endpoint: POST {baseUrl}/v4/clients/bulk_track/
 * Header: Authorization: Token {SHADOWFAX_API_TOKEN} or Bearer {access_token}
 * Body: { "awb_numbers": ["AWB1", "AWB2"] }
 */
export async function fetchShadowfaxBulk(awbNumbers) {
  const baseUrl = getShadowfaxBaseUrl();
  if (!baseUrl) {
    return { ok: false, error: "Missing SHADOWFAX_BASE_URL in environment" };
  }

  const authHeader = await getShadowfaxAuthHeader();
  if (!authHeader) {
    return { ok: false, error: "Missing Shadowfax authentication credentials in environment" };
  }

  const batch = Array.isArray(awbNumbers)
    ? awbNumbers.map((a) => String(a).trim()).filter(Boolean).slice(0, 50)
    : [];

  if (batch.length === 0) {
    return { ok: false, error: "No valid AWB numbers provided for bulk tracking" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const base = baseUrl.replace(/\/+$/, "");
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;
    const url = `${apiBase}/v4/clients/bulk_track/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ awb_numbers: batch }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: `Shadowfax Bulk Track HTTP ${response.status}` };
    }

    const payload = await response.json().catch(() => ({}));
    return { ok: true, data: payload };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "Shadowfax Bulk Track request timed out" };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Normalizes an incoming Shadowfax push webhook payload into standardized tracking updates.
 * Supports single event objects, arrays of events, and wrapped data structures.
 *
 * @param {Object|Array} payload - Inbound webhook payload from Shadowfax Client Push URL
 * @returns {Array<Object>} List of normalized updates with { awb, internalStatus, rawStatus, location, remarks, eventDate, rawPayload }
 */
export function normalizeShadowfaxWebhookPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  const items = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [payload];

  const results = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    const awb =
      item.awb_number ||
      item.awb ||
      item.tracking_number ||
      item.order_details?.awb_number ||
      item.data?.awb_number ||
      null;

    if (!awb) continue;

    const rawStatus =
      item.status ||
      item.status_display ||
      item.order_details?.status ||
      item.order_details?.status_display ||
      null;

    const statusDisplay =
      item.status_display ||
      item.order_details?.status_display ||
      rawStatus;

    const location =
      item.location ||
      item.tracking_details?.[0]?.location ||
      item.order_details?.delivery_details?.city ||
      null;

    const remarks =
      item.remarks ||
      item.message ||
      item.tracking_details?.[0]?.remarks ||
      null;

    const eventDate =
      toIsoDate(item.timestamp) ||
      toIsoDate(item.created) ||
      toIsoDate(item.order_details?.order_date) ||
      new Date().toISOString();

    const internalStatus = normalizeShadowfaxStatus(rawStatus, statusDisplay);

    results.push({
      awb: String(awb).trim(),
      internalStatus,
      rawStatus: String(statusDisplay || rawStatus || "").trim(),
      location: location ? String(location).trim() : null,
      remarks: remarks ? String(remarks).trim() : null,
      eventDate,
      rawPayload: item,
    });
  }

  return results;
}

/**
 * Routes Shadowfax tracking:
 * 1. Primary: Direct official API (when SHADOWFAX_API_TOKEN and SHADOWFAX_BASE_URL are configured)
 * 2. Fallback: TrackCourier.io (when direct is unconfigured or returns unavailable)
 *
 * @param {string} trackingNumber - Shadowfax waybill/AWB
 * @param {Object} options - Tracking options
 * @returns {Promise<Object>} Normalized tracking result
 */
export async function trackShadowfax(trackingNumber, options = {}) {
  const waybill = String(trackingNumber || "").trim();

  if (!waybill) {
    return createTrackingResult({
      courier: COURIER_NAME,
      trackingNumber: waybill,
      source: "none",
      provider: "Shadowfax",
      error: "Tracking number is required",
    });
  }

  // 1. Direct Shadowfax API (PRIMARY when credentials & confirmed base URL exist)
  if (isShadowfaxDirectConfigured()) {
    const direct = await fetchShadowfaxDirect(waybill);
    if (direct.ok && direct.result && (direct.result.status || direct.result.rawStatus)) {
      return direct.result;
    }

    // Secondary fallback to TrackCourier (Account 1 -> Account 2 -> Account 3) if direct fails
    if (hasTrackCourierKey(1) && !isCircuitBreakerTripped("trackcourier_account1")) {
      const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 1 });
      if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
    }
    if (hasTrackCourierKey(2) && !isCircuitBreakerTripped("trackcourier_account2")) {
      const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 2 });
      if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
    }
    if (hasTrackCourierKey(3) && !isCircuitBreakerTripped("trackcourier_account3")) {
      const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 3 });
      if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
    }

    return (
      direct.result ||
      createTrackingResult({
        courier: COURIER_NAME,
        trackingNumber: waybill,
        source: "direct",
        provider: "Shadowfax Direct",
        error: direct.error || "Shadowfax direct tracking failed",
      })
    );
  }

  // 2. TrackCourier.io Partner Tracker (Used when direct credentials/URL are not yet configured)
  if (hasTrackCourierKey(1) && !isCircuitBreakerTripped("trackcourier_account1")) {
    const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 1 });
    if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
  }
  if (hasTrackCourierKey(2) && !isCircuitBreakerTripped("trackcourier_account2")) {
    const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 2 });
    if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
  }
  if (hasTrackCourierKey(3) && !isCircuitBreakerTripped("trackcourier_account3")) {
    const fallback = await fetchTrackCourier(COURIER_NAME, waybill, { account: 3 });
    if (fallback.status || fallback.rawStatus) return { ...fallback, error: null };
  }

  // 3. No tracking credentials configured
  return createTrackingResult({
    courier: COURIER_NAME,
    trackingNumber: waybill,
    source: "none",
    provider: "Shadowfax",
    error: "No tracking credentials available for Shadowfax (requires SHADOWFAX_API_TOKEN + SHADOWFAX_BASE_URL or TRACKCOURIER_API_KEY)",
  });
}
