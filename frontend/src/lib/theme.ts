import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "shipping_dashboard_theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Ignore localStorage access errors
  }
  return "system";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore
    }

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const isCurrentlyDark =
        prev === "dark" ||
        (prev === "system" &&
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      return isCurrentlyDark ? "light" : "dark";
    });
  };

  return { theme, setTheme, toggleTheme };
}
