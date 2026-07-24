import { useEffect, useState } from "react";

const KEY = "shiplabel:website_name";
export const DEFAULT_WEBSITE_NAME = "shriradhagovindstore.com";

export function getWebsiteName(): string {
  if (typeof window === "undefined") return DEFAULT_WEBSITE_NAME;
  return window.localStorage.getItem(KEY) ?? DEFAULT_WEBSITE_NAME;
}

export function setWebsiteName(value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, value);
  window.dispatchEvent(new Event("shiplabel:settings"));
}

export function useWebsiteName(): [string, (v: string) => void] {
  const [name, setName] = useState<string>(DEFAULT_WEBSITE_NAME);
  useEffect(() => {
    setName(getWebsiteName());
    const handler = () => setName(getWebsiteName());
    window.addEventListener("shiplabel:settings", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("shiplabel:settings", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return [
    name,
    (v: string) => {
      setWebsiteName(v);
      setName(v);
    },
  ];
}

// ============ Sender profiles ============

export interface SenderProfile {
  name: string;
  address: string;
  phone: string;
  website: string;
  review_url: string;
}

const SENDERS_KEY = "shiplabel:sender_profiles";

export const DEFAULT_SENDERS: [SenderProfile, SenderProfile] = [
  {
    name: "Shri Radha Govind Store",
    address: "",
    phone: "",
    website: "shriradhagovindstore.com",
    review_url: "",
  },
  {
    name: "Profile 2",
    address: "",
    phone: "",
    website: "",
    review_url: "",
  },
];

export function getSenderProfiles(): [SenderProfile, SenderProfile] {
  if (typeof window === "undefined") return DEFAULT_SENDERS;
  try {
    const raw = window.localStorage.getItem(SENDERS_KEY);
    if (!raw) return DEFAULT_SENDERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) {
      return [
        { ...DEFAULT_SENDERS[0], ...parsed[0] },
        { ...DEFAULT_SENDERS[1], ...parsed[1] },
      ];
    }
  } catch {
    // fall through
  }
  return DEFAULT_SENDERS;
}

export function setSenderProfiles(profiles: [SenderProfile, SenderProfile]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SENDERS_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("shiplabel:settings"));
}

export function useSenderProfiles(): [
  [SenderProfile, SenderProfile],
  (p: [SenderProfile, SenderProfile]) => void,
] {
  const [profiles, setProfiles] = useState<[SenderProfile, SenderProfile]>(DEFAULT_SENDERS);
  useEffect(() => {
    setProfiles(getSenderProfiles());
    const handler = () => setProfiles(getSenderProfiles());
    window.addEventListener("shiplabel:settings", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("shiplabel:settings", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return [
    profiles,
    (p) => {
      setSenderProfiles(p);
      setProfiles(p);
    },
  ];
}
