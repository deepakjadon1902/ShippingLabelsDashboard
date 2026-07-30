const LIVE_API_BASE_URL = "https://brajmart-hr-platform-yg6r.onrender.com/api/v1";

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.PROD) return LIVE_API_BASE_URL;
  return "/api";
}
