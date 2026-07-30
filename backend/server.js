import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";

dotenv.config();

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/brajmart_shipping_labels";
const DEFAULT_CLIENT_ORIGINS = ["http://localhost:8080", "https://labels.brajmart.com"];
const CLIENT_ORIGINS = [
  ...DEFAULT_CLIENT_ORIGINS,
  process.env.CLIENT_ORIGIN,
  process.env.CLIENT_ORIGINS,
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
]
  .flatMap((value) => String(value || "").split(","))
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const ALLOWED_CLIENT_ORIGINS = new Set(CLIENT_ORIGINS);
const SESSION_COOKIE = "brajmart_session";
const SESSION_DAYS = 7;
const IS_HOSTED_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.RENDER === "true" ||
  !!process.env.RENDER_EXTERNAL_URL;
const STATUSES = ["Pending", "Shipped", "Delivered", "RTO"];
const DEFAULT_PASSWORD_HASH = "f6412bd354418eb6e2bc75d56ba896d9b9f6d0047d6a0ee0d9782f6ec5528d65";
const DEFAULT_SENDER_PROFILES = [
  {
    name: "Shri Radha Govind Store",
    address: "",
    phone: "",
    website: "shriradhagovindstore.com",
    review_url: "",
    sort_order: 0,
  },
  {
    name: "Profile 2",
    address: "",
    phone: "",
    website: "",
    review_url: "",
    sort_order: 1,
  },
];

const TRACKINGMORE_SLUGS = {
  Shadowfax: "shadowfax",
  Xpressbees: "xpressbees",
  "Ecom Express": "ecom-express",
  "India Post": "india-post",
  Delhivery: "delhivery",
  DTDC: "dtdc",
  "Shree Maruti Courier": "shreemaruticourier",
};
const AUTO_TRACK_COURIERS = new Set(["Delhivery", "DTDC", ...Object.keys(TRACKINGMORE_SLUGS)]);

const labelSchema = new mongoose.Schema(
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
    last_tracking_update: { type: Date, default: null },
    raw_courier_status: { type: String, default: null },
    last_tracking_error: { type: String, default: null },
    sender_name: { type: String, default: null, trim: true },
    sender_address: { type: String, default: null, trim: true },
    sender_phone: { type: String, default: null, trim: true },
    sender_website: { type: String, default: null, trim: true },
    sender_review_url: { type: String, default: null, trim: true },
    sender_profile_id: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "SenderProfile" },
    created_at: { type: Date, default: Date.now, immutable: true },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        ret.created_at = new Date(ret.created_at).toISOString();
        for (const key of ["last_tracking_update"]) {
          ret[key] = ret[key] ? new Date(ret[key]).toISOString() : null;
        }
        return ret;
      },
    },
  },
);

labelSchema.index({ created_at: -1 });
labelSchema.index({ status: 1 });
labelSchema.index({ tracking_id: 1 });

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const sessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User", index: true },
    token_hash: { type: String, required: true, unique: true, index: true },
    expires_at: { type: Date, required: true, expires: 0 },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const senderProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    review_url: { type: String, default: "", trim: true },
    sort_order: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now, immutable: true },
    updated_at: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        ret.created_at = new Date(ret.created_at).toISOString();
        ret.updated_at = new Date(ret.updated_at).toISOString();
        return ret;
      },
    },
  },
);

senderProfileSchema.index({ sort_order: 1, created_at: 1 });

const Label = mongoose.model("Label", labelSchema);
const User = mongoose.model("User", userSchema);
const Session = mongoose.model("Session", sessionSchema);
const SenderProfile = mongoose.model("SenderProfile", senderProfileSchema);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_CLIENT_ORIGINS.has(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use((req, _res, next) => {
  if (req.url === "/api/v1") req.url = "/api";
  else if (req.url.startsWith("/api/v1/")) req.url = `/api/${req.url.slice("/api/v1/".length)}`;
  next();
});

function hashSecret(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizePassword(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim();
}

function secureCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: IS_HOSTED_PRODUCTION ? "none" : "lax",
    secure: IS_HOSTED_PRODUCTION,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function nullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function buildLabelPayload(body, partial = false) {
  const required = [
    "receiver_name",
    "receiver_address_line1",
    "receiver_city",
    "receiver_state",
    "receiver_pincode",
    "receiver_mobile_1",
    "courier_name",
    "tracking_id",
  ];
  const payload = {};

  for (const field of required) {
    if (body[field] === undefined) {
      if (!partial) throw Object.assign(new Error(`${field} is required`), { status: 400 });
      continue;
    }
    const value = String(body[field]).trim();
    if (!value) throw Object.assign(new Error(`${field} is required`), { status: 400 });
    payload[field] = value;
  }

  for (const field of [
    "receiver_address_line2",
    "receiver_mobile_2",
    "order_reference",
    "notes",
    "last_tracking_update",
    "raw_courier_status",
    "last_tracking_error",
    "sender_name",
    "sender_address",
    "sender_phone",
    "sender_website",
    "sender_review_url",
    "sender_profile_id",
  ]) {
    const value = nullableText(body[field]);
    if (value !== undefined) payload[field] = value;
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      throw Object.assign(new Error("Invalid status"), { status: 400 });
    }
    payload.status = body.status;
  } else if (!partial) {
    payload.status = "Pending";
  }

  return payload;
}

function buildSenderProfilePayload(body, partial = false) {
  const payload = {};

  if (body.name === undefined) {
    if (!partial) throw Object.assign(new Error("name is required"), { status: 400 });
  } else {
    const name = String(body.name).trim();
    if (!name) throw Object.assign(new Error("name is required"), { status: 400 });
    payload.name = name;
  }

  for (const field of ["address", "phone", "website", "review_url"]) {
    if (body[field] !== undefined) payload[field] = String(body[field] || "").trim();
  }

  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    if (!Number.isFinite(sortOrder)) {
      throw Object.assign(new Error("sort_order must be a number"), { status: 400 });
    }
    payload.sort_order = sortOrder;
  }

  payload.updated_at = new Date();
  return payload;
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = await Session.findOne({
      token_hash: hashSecret(token),
      expires_at: { $gt: new Date() },
    })
      .populate("user_id", "username")
      .lean();
    if (!session?.user_id) return res.status(401).json({ error: "Unauthorized" });
    req.user = { id: session.user_id._id.toString(), username: session.user_id.username };
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const passwordHash = hashSecret(normalizePassword(req.body?.password));
    const user = await User.findOne({ username });

    if (!user || !secureCompare(passwordHash, user.password_hash)) {
      return res.status(401).json({ ok: false, error: "Invalid username or password" });
    }

    const token = createToken();
    await Session.create({
      user_id: user._id,
      token_hash: hashSecret(token),
      expires_at: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({ ok: true, user: { username: user.username } });
  }),
);

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.json({ authenticated: false, user: null });
    const session = await Session.findOne({
      token_hash: hashSecret(token),
      expires_at: { $gt: new Date() },
    })
      .populate("user_id", "username")
      .lean();
    res.json({
      authenticated: !!session?.user_id,
      user: session?.user_id ? { username: session.user_id.username } : null,
    });
  }),
);

app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await Session.deleteOne({ token_hash: hashSecret(token) });
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  }),
);

app.get(
  "/api/labels",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const labels = await Label.find().sort({ created_at: -1 });
    res.json(labels.map((label) => label.toJSON()));
  }),
);

app.post(
  "/api/labels",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.create(buildLabelPayload(req.body));
    res.status(201).json(label.toJSON());
  }),
);

app.get(
  "/api/labels/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ error: "Label not found" });
    res.json(label.toJSON());
  }),
);

app.patch(
  "/api/labels/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.findByIdAndUpdate(req.params.id, buildLabelPayload(req.body, true), {
      new: true,
      runValidators: true,
    });
    if (!label) return res.status(404).json({ error: "Label not found" });
    res.json(label.toJSON());
  }),
);

app.delete(
  "/api/labels/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const deleted = await Label.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Label not found" });
    res.status(204).end();
  }),
);

app.get(
  "/api/sender-profiles",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const profiles = await SenderProfile.find().sort({ sort_order: 1, created_at: 1 });
    res.json(profiles.map((profile) => profile.toJSON()));
  }),
);

app.post(
  "/api/sender-profiles",
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await SenderProfile.create(buildSenderProfilePayload(req.body));
    res.status(201).json(profile.toJSON());
  }),
);

app.patch(
  "/api/sender-profiles/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Sender profile not found" });
    }
    const profile = await SenderProfile.findByIdAndUpdate(
      req.params.id,
      buildSenderProfilePayload(req.body, true),
      {
        new: true,
        runValidators: true,
      },
    );
    if (!profile) return res.status(404).json({ error: "Sender profile not found" });
    res.json(profile.toJSON());
  }),
);

app.delete(
  "/api/sender-profiles/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Sender profile not found" });
    }
    const deleted = await SenderProfile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Sender profile not found" });
    res.status(204).end();
  }),
);

app.get("/api/tracking/credentials", requireAuth, (_req, res) => {
  res.json(getTrackingCredentialsStatus());
});

app.post(
  "/api/tracking/labels/:id/register",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ ok: false, error: "Label not found" });
    res.json(await trackingMoreRegister(label.courier_name, label.tracking_id));
  }),
);

app.post(
  "/api/tracking/labels/:id/refresh",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ error: "Label not found" });
    res.json(await refreshOneLabel(label));
  }),
);

app.post(
  "/api/tracking/refresh-all",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await refreshAllLabels());
  }),
);

app.post(
  "/api/public/hooks/refresh-tracking",
  asyncHandler(async (req, res) => {
    const configuredSecret = process.env.PUBLIC_TRACKING_HOOK_SECRET;
    if (configuredSecret) {
      const headerSecret = req.get("x-hook-secret") || req.query.secret;
      if (headerSecret !== configuredSecret) return res.status(401).json({ error: "Unauthorized" });
    }
    res.json(await refreshAllLabels());
  }),
);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.name === "CastError" ? 404 : 500);
  const message = status >= 500 ? "Server error" : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

function getTrackingCredentialsStatus() {
  return {
    delhivery: !!process.env.DELHIVERY_API_TOKEN,
    dtdc: !!process.env.DTDC_API_TOKEN,
    trackingmore: !!process.env.TRACKINGMORE_API_KEY,
  };
}

function mapStatus(rawInput) {
  if (!rawInput) return null;
  const raw = String(rawInput).toLowerCase();
  if (raw === "pending" || raw.includes("pending001")) return "Pending";
  if (raw.includes("deliver") && !raw.includes("undeliver") && !raw.includes("not deliver"))
    return "Delivered";
  if (
    raw.includes("rto") ||
    raw.includes("return") ||
    raw.includes("undelivered") ||
    raw.includes("refused")
  )
    return "RTO";
  if (
    raw.includes("in transit") ||
    raw.includes("intransit") ||
    raw.includes("dispatch") ||
    raw.includes("shipped") ||
    raw.includes("out for delivery") ||
    raw.includes("picked") ||
    raw.includes("manifested") ||
    raw.includes("info received") ||
    raw.includes("available_for_pickup")
  ) {
    return "Shipped";
  }
  return null;
}

async function refreshOneLabel(label) {
  if (!AUTO_TRACK_COURIERS.has(label.courier_name)) {
    return { skipped: true, reason: `No tracking API for ${label.courier_name}` };
  }

  const result = await fetchTrackingForCourier(label.courier_name, label.tracking_id);
  const patch = {
    last_tracking_update: new Date(),
    raw_courier_status: result.rawStatus,
    last_tracking_error: result.error,
  };

  if (result.internalStatus && label.status !== "Delivered" && label.status !== "RTO") {
    patch.status = result.internalStatus;
  }

  Object.assign(label, patch);
  await label.save();
  return { skipped: false, ...result, updatedStatus: patch.status || label.status };
}

async function refreshAllLabels() {
  const labels = await Label.find({ status: { $nin: ["Delivered", "RTO"] } });
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let updated = 0;

  for (const label of labels) {
    if (!AUTO_TRACK_COURIERS.has(label.courier_name)) {
      skipped++;
      continue;
    }
    processed++;
    try {
      const before = label.status;
      const result = await refreshOneLabel(label);
      if (result.error) failed++;
      if (result.updatedStatus && result.updatedStatus !== before) updated++;
    } catch (error) {
      failed++;
      label.last_tracking_update = new Date();
      label.last_tracking_error = error.message;
      await label.save();
    }
  }

  return { total: labels.length, processed, skipped, failed, updated };
}

async function fetchTrackingForCourier(courierName, waybill) {
  if (courierName === "Delhivery") {
    const direct = await fetchDelhivery(waybill);
    if (direct.internalStatus)
      return { ...direct, rawStatus: tagSource(direct.rawStatus, "direct"), source: "direct" };
    const fallback = await fetchTrackingMore(courierName, waybill);
    if (fallback.internalStatus)
      return {
        ...fallback,
        rawStatus: tagSource(fallback.rawStatus, "trackingmore"),
        source: "trackingmore",
      };
    return {
      internalStatus: null,
      rawStatus: null,
      error: `direct: ${direct.error || "no status"} | trackingmore: ${fallback.error || "no status"}`,
      source: "none",
    };
  }

  if (courierName === "DTDC") {
    const direct = await fetchDTDC(waybill);
    if (direct.internalStatus)
      return { ...direct, rawStatus: tagSource(direct.rawStatus, "direct"), source: "direct" };
    const fallback = await fetchTrackingMore(courierName, waybill);
    if (fallback.internalStatus)
      return {
        ...fallback,
        rawStatus: tagSource(fallback.rawStatus, "trackingmore"),
        source: "trackingmore",
      };
    return {
      internalStatus: null,
      rawStatus: null,
      error: `direct: ${direct.error || "no status"} | trackingmore: ${fallback.error || "no status"}`,
      source: "none",
    };
  }

  if (TRACKINGMORE_SLUGS[courierName]) {
    const result = await fetchTrackingMore(courierName, waybill);
    if (result.internalStatus)
      return {
        ...result,
        rawStatus: tagSource(result.rawStatus, "trackingmore"),
        source: "trackingmore",
      };
    return {
      internalStatus: null,
      rawStatus: null,
      error: "Auto-tracking unavailable - manual only",
      source: "none",
    };
  }

  return {
    internalStatus: null,
    rawStatus: null,
    error: `No tracking API for ${courierName}`,
    source: "none",
  };
}

async function fetchDelhivery(waybill) {
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token)
    return { internalStatus: null, rawStatus: null, error: "Missing DELHIVERY_API_TOKEN" };
  try {
    const response = await fetch(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}&ref_ids=`,
      {
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      },
    );
    if (!response.ok)
      return { internalStatus: null, rawStatus: null, error: `Delhivery ${response.status}` };
    const data = await response.json();
    if (data.Success === false || data.Error) {
      return {
        internalStatus: null,
        rawStatus: null,
        error: data.Error || data.rmk || "Delhivery no status",
      };
    }
    const shipment = data.ShipmentData?.[0]?.Shipment?.Status;
    const raw = shipment?.Status || shipment?.Instructions || shipment?.StatusType || null;
    return {
      internalStatus: mapStatus(raw),
      rawStatus: raw,
      error: raw ? null : "No status in response",
    };
  } catch (error) {
    return { internalStatus: null, rawStatus: null, error: error.message };
  }
}

async function fetchDTDC(waybill) {
  const token = process.env.DTDC_API_TOKEN;
  if (!token) return { internalStatus: null, rawStatus: null, error: "Missing DTDC_API_TOKEN" };
  try {
    const response = await fetch(
      "https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": token },
        body: JSON.stringify({ trkType: "cnno", strcnno: waybill, addtnlDtl: "Y" }),
      },
    );
    if (!response.ok)
      return { internalStatus: null, rawStatus: null, error: `DTDC ${response.status}` };
    const data = await response.json();
    const raw =
      data.trackHeader?.strStatusDesc ||
      data.trackHeader?.strStatus ||
      data.trackDetails?.[0]?.strAction ||
      null;
    return {
      internalStatus: mapStatus(raw),
      rawStatus: raw,
      error: raw ? null : "No status in response",
    };
  } catch (error) {
    return { internalStatus: null, rawStatus: null, error: error.message };
  }
}

async function trackingMoreRegister(courierName, waybill) {
  const key = process.env.TRACKINGMORE_API_KEY;
  const slug = TRACKINGMORE_SLUGS[courierName];
  if (!key) return { ok: false, error: "Missing TRACKINGMORE_API_KEY" };
  if (!slug) return { ok: false, error: `No TrackingMore slug for ${courierName}` };
  try {
    const response = await fetch("https://api.trackingmore.com/v4/trackings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Tracking-Api-Key": key },
      body: JSON.stringify({ tracking_number: waybill, courier_code: slug }),
    });
    const data = await response.json().catch(() => ({}));
    const code = data.code || data.meta?.code || response.status;
    if ([200, 201, 4101, 4218].includes(code) || response.ok) return { ok: true, error: null };
    return {
      ok: false,
      error: data.meta?.message || data.message || `TrackingMore create ${code}`,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function fetchTrackingMore(courierName, waybill) {
  const key = process.env.TRACKINGMORE_API_KEY;
  const slug = TRACKINGMORE_SLUGS[courierName];
  if (!key) return { internalStatus: null, rawStatus: null, error: "Missing TRACKINGMORE_API_KEY" };
  if (!slug)
    return {
      internalStatus: null,
      rawStatus: null,
      error: `No TrackingMore slug for ${courierName}`,
    };
  try {
    const registered = await trackingMoreRegister(courierName, waybill);
    if (!registered.ok) {
      return {
        internalStatus: null,
        rawStatus: null,
        error: registered.error || "TrackingMore create failed",
      };
    }
    const url = `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${encodeURIComponent(waybill)}&courier_code=${slug}`;
    const response = await fetch(url, { headers: { "Tracking-Api-Key": key } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        internalStatus: null,
        rawStatus: null,
        error: data.meta?.message || data.message || `TrackingMore ${response.status}`,
      };
    }
    const first = data.data?.[0];
    const raw = first?.delivery_status || first?.latest_event || first?.status_info || null;
    return { internalStatus: mapStatus(raw), rawStatus: raw, error: raw ? null : "No status yet" };
  } catch (error) {
    return { internalStatus: null, rawStatus: null, error: error.message };
  }
}

function tagSource(raw, source) {
  return raw ? `[${source}] ${raw}` : raw;
}

async function seedAdminUser() {
  const username = (process.env.APP_USERNAME || "brajmaster").trim().toLowerCase();
  const passwordHash = process.env.APP_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;
  await User.updateOne(
    { username },
    { $set: { username, password_hash: passwordHash } },
    { upsert: true },
  );
}

async function seedSenderProfiles() {
  const count = await SenderProfile.countDocuments();
  if (count > 0) return;
  await SenderProfile.insertMany(DEFAULT_SENDER_PROFILES);
}

async function start() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await seedAdminUser();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
