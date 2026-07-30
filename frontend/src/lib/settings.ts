import { useEffect, useState } from "react";

export const DEFAULT_WEBSITE_NAME = "www.brajmart.com";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getWebsiteName(): string {
  return DEFAULT_WEBSITE_NAME;
}

export function setWebsiteName(_value: string): void {
  window.dispatchEvent(new Event("shiplabel:settings"));
}

export function useWebsiteName(): [string, (v: string) => void] {
  return [DEFAULT_WEBSITE_NAME, setWebsiteName];
}

export interface SenderProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  review_url: string;
  sort_order?: number;
}

export type SenderProfileInput = Omit<SenderProfile, "id">;

export const DEFAULT_SENDERS: SenderProfile[] = [
  {
    id: "default-1",
    name: "Shri Radha Govind Store",
    address: "",
    phone: "",
    website: "shriradhagovindstore.com",
    review_url: "",
    sort_order: 0,
  },
  {
    id: "default-2",
    name: "Profile 2",
    address: "",
    phone: "",
    website: "",
    review_url: "",
    sort_order: 1,
  },
];

export async function listSenderProfiles(): Promise<SenderProfile[]> {
  return api<SenderProfile[]>("/sender-profiles");
}

export async function createSenderProfile(
  input: Partial<SenderProfileInput>,
): Promise<SenderProfile> {
  return api<SenderProfile>("/sender-profiles", {
    method: "POST",
    body: JSON.stringify({
      name: input.name || "New profile",
      address: input.address || "",
      phone: input.phone || "",
      website: input.website || "",
      review_url: input.review_url || "",
      sort_order: input.sort_order ?? Date.now(),
    }),
  });
}

export async function updateSenderProfile(
  id: string,
  input: Partial<SenderProfileInput>,
): Promise<SenderProfile> {
  return api<SenderProfile>(`/sender-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteSenderProfile(id: string): Promise<void> {
  await api<void>(`/sender-profiles/${id}`, { method: "DELETE" });
}

export function useSenderProfiles(): [SenderProfile[], () => Promise<void>, boolean] {
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const next = await listSenderProfiles();
    setProfiles(next);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listSenderProfiles()
      .then((next) => {
        if (alive) setProfiles(next);
      })
      .catch(() => {
        if (alive) setProfiles([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return [profiles, refresh, loading];
}
