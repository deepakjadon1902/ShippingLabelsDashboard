import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import { Label, STATUSES } from "./models/Label.js";
import {
  AUTO_TRACK_COURIERS,
  getTrackingCredentialsStatus,
  refreshOneLabel,
  getMarutiGlobalCooldown,
} from "./tracking/index.js";

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
    "last_successful_sync",
    "last_sync_attempt",
    "raw_courier_status",
    "last_tracking_error",
    "api_status_conflict",
    "tracking_location",
    "tracking_event_date",
    "tracking_event_description",
    "tracking_estimated_delivery",
    "tracking_source",
    "tracking_provider",
    "origin_location",
    "destination_location",
    "pickup_at",
    "delivered_at",
    "tat_display",
    "delivery_failure_reason",
    "rto_status",
    "rto_initiated_at",
    "rto_returned_at",
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

  if (body.tat_hours !== undefined) {
    payload.tat_hours = Number.isFinite(Number(body.tat_hours)) ? Number(body.tat_hours) : null;
  }
  if (body.is_delayed !== undefined) {
    payload.is_delayed = Boolean(body.is_delayed);
  }
  if (body.delayed_days !== undefined) {
    payload.delayed_days = Number(body.delayed_days) || 0;
  }
  if (body.is_delivery_failed !== undefined) {
    payload.is_delivery_failed = Boolean(body.is_delivery_failed);
  }

  if (Array.isArray(body.tracking_history)) {
    payload.tracking_history = body.tracking_history;
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
  "/api/tracking/labels/:id/refresh",
  requireAuth,
  asyncHandler(async (req, res) => {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ error: "Label not found" });

    // Protect against active upstream rate limit
    if (label.courier_name === "Shree Maruti Courier") {
      const globalCheck = getMarutiGlobalCooldown();
      if (globalCheck.isBlocked) {
        return res.json({
          skipped: true,
          error: `Shree Maruti tracking is temporarily rate-limited. Please try again after the courier cooldown (${globalCheck.remainingSeconds}s remaining).`,
          status: label.status,
          rawStatus: label.raw_courier_status,
        });
      }
    }

    res.json(await refreshOneLabel(label, { force: true }));
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

async function refreshAllLabels(filter = {}) {
  const query = {
    status: { $nin: ["Delivered", "RTO"] },
    ...filter,
  };
  const labels = await Label.find(query);
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

    // Pacing delay: 2.5 seconds for Shree Maruti Courier, 400ms for other carriers
    const pacingDelayMs = label.courier_name === "Shree Maruti Courier" ? 2500 : 400;
    await new Promise((resolve) => setTimeout(resolve, pacingDelayMs));
  }

  return { total: labels.length, processed, skipped, failed, updated };
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
