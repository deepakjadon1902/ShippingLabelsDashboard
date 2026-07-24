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
