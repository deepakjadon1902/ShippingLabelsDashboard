const LIVE_FRONTEND_HOST = "labels.brajmart.com";
const LIVE_API_BASE_URL = "/api/v1";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname === LIVE_FRONTEND_HOST) {
    return LIVE_API_BASE_URL;
  }

  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.PROD) return LIVE_API_BASE_URL;
  return "/api";
}
