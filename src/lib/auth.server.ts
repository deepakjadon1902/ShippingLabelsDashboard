import { getRequest } from "@tanstack/react-start/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const APP_SESSION_COOKIE = "brajmart_session";
const SESSION_DAYS = 7;
const DEFAULT_USERNAME = "brajmaster";
const DEFAULT_PASSWORD_HASH =
  "f6412bd354418eb6e2bc75d56ba896d9b9f6d0047d6a0ee0d9782f6ec5528d65";

export type AuthUser = {
  id: string;
  username: string;
};

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function authSecret(): string {
  return (
    process.env.APP_AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_URL ||
    "brajmart-local-auth"
  );
}

function sign(value: string): string {
  return createHmac("sha256", authSecret()).update(value, "utf8").digest("hex");
}

function defaultUser(): AuthUser {
  return { id: "00000000-0000-0000-0000-000000000001", username: DEFAULT_USERNAME };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePassword(value: string): string {
  return value.normalize("NFKC").trim();
}

export function isDefaultAppCredential(username: string, password: string): boolean {
  return (
    normalizeUsername(username) === DEFAULT_USERNAME &&
    secureCompare(hashSecret(normalizePassword(password)), DEFAULT_PASSWORD_HASH)
  );
}

function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${DEFAULT_USERNAME}.${expiresAt}.${nonce}`;
  return `v1.${payload}.${sign(payload)}`;
}

export function sessionCookie(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${APP_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function getSessionTokenFromRequest(request = getRequest()): string | null {
  return parseCookies(request?.headers.get("cookie") ?? null)[APP_SESSION_COOKIE] ?? null;
}

function verifySignedSession(token: string): AuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return null;

  const [, username, expiresAtValue, nonce, signature] = parts;
  if (username !== DEFAULT_USERNAME || !nonce) return null;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const payload = `${username}.${expiresAtValue}.${nonce}`;
  if (!secureCompare(sign(payload), signature)) return null;
  return defaultUser();
}

export async function findAppUserByCredentials(
  username: string,
  password: string,
): Promise<AuthUser | null> {
  if (!isDefaultAppCredential(username, password)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_users" as never)
    .select("id, username, password_hash")
    .eq("username", DEFAULT_USERNAME)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as unknown as AuthUser & { password_hash: string } | null;
  const expectedHash = row?.password_hash ?? DEFAULT_PASSWORD_HASH;
  if (!secureCompare(hashSecret(normalizePassword(password)), expectedHash)) return null;

  return row ? { id: row.id, username: row.username } : defaultUser();
}

export async function loginAndCreateAppSession(
  username: string,
  password: string,
  token: string,
): Promise<AuthUser | null> {
  if (!isDefaultAppCredential(username, password)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .rpc("login_app_user" as never, {
      p_username: DEFAULT_USERNAME,
      p_password_hash: hashSecret(normalizePassword(password)),
      p_token_hash: hashSecret(token),
      p_expires_at: expiresAt,
    } as never)
    .maybeSingle();

  if (error) {
    console.warn(`[Auth] Supabase session RPC unavailable, using signed cookie fallback: ${error.message}`);
    return defaultUser();
  }
  return ((data ?? null) as unknown as AuthUser | null) ?? defaultUser();
}

export async function createAppSession(userId: string, token: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from("app_sessions" as never).insert({
    user_id: userId,
    token_hash: hashSecret(token),
    expires_at: expiresAt,
  } as never);
  if (error) throw new Error(error.message);
}

export async function deleteAppSession(token: string | null): Promise<void> {
  if (!token) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("delete_app_session" as never, {
      p_token_hash: hashSecret(token),
    } as never);
    if (!error) return;

    await supabaseAdmin
      .from("app_sessions" as never)
      .delete()
      .eq("token_hash", hashSecret(token));
  } catch (error) {
    console.warn(`[Auth] Supabase logout cleanup skipped: ${(error as Error).message}`);
  }
}

export async function getCurrentAppUser(request = getRequest()): Promise<AuthUser | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;

  const signedUser = verifySignedSession(token);
  if (signedUser) return signedUser;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpcResult = await supabaseAdmin
    .rpc("validate_app_session" as never, {
      p_token_hash: hashSecret(token),
    } as never)
    .maybeSingle();
  if (!rpcResult.error) return (rpcResult.data ?? null) as unknown as AuthUser | null;

  const { data, error } = await supabaseAdmin
    .from("app_sessions" as never)
    .select("expires_at, app_users(id, username)")
    .eq("token_hash", hashSecret(token))
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as unknown as {
    expires_at: string;
    app_users: AuthUser | null;
  } | null;
  if (!row?.app_users) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await deleteAppSession(token);
    return null;
  }

  return row.app_users;
}

export async function requireAppUser(request = getRequest()): Promise<AuthUser> {
  const user = await getCurrentAppUser(request);
  if (!user) throw new Error("Unauthorized: Please log in first");
  return user;
}
