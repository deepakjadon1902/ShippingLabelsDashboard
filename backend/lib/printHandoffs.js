const DEFAULT_TTL_SECONDS = 90;

export function normalizePrintHandoffTtl(value) {
  const parsed = Number(value ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(300, Math.max(30, Math.trunc(parsed)));
}

function httpBaseUrl(value, name) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  return url;
}

export function buildPrintHandoffRedeemUrl(publicApiUrl, token) {
  const url = new URL(
    "/api/v1/auth/print-handoffs/redeem",
    httpBaseUrl(publicApiUrl, "PUBLIC_API_URL"),
  );
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildLabelPrintUrl(publicAppUrl, labelId) {
  const url = new URL("/print", httpBaseUrl(publicAppUrl, "PUBLIC_APP_URL"));
  url.searchParams.set("ids", labelId);
  return url.toString();
}

export function isValidPrintHandoffToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

export function redactPrintHandoffUrl(value) {
  const url = String(value || "");
  if (!/\/auth\/print-handoffs\/redeem(?:\?|$)/.test(url)) return url;
  return url.replace(
    /(\/auth\/print-handoffs\/redeem)(?:\?[^#]*)?/,
    "$1?token=[REDACTED]",
  );
}
