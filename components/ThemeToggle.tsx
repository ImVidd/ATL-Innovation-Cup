"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// Must match the inline script in app/layout.tsx, which applies the saved choice before first paint.
export const THEME_STORAGE_KEY = "ta-grader-theme";

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");

// The theme in effect: the grader's saved choice (data-theme on <html>), otherwise the OS setting.
function currentTheme(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return systemDark().matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = systemDark();
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export default function ThemeToggle() {
  // null on the server and during hydration, where the theme is not known yet.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private windows). The choice still applies until the page reloads.
    }
  }

  return (
    <button
      type="button"
      className="btn-ghost h-10 w-10 !px-0 text-base"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
