const THEME_KEY = "zima:accent-theme";

/** Zima accent (Stripe-style indigo). Kept in sync with :root in app/globals.css. */
export const ACCENT_THEME = {
  accent: "#635bff",
  soft: "#f0efff",
  hover: "#5046e5",
  border: "#c9c6ff",
  rgb: "99, 91, 255",
} as const;

/** @deprecated kept for backwards compatibility; use ACCENT_THEME. */
export const BLACK_THEME = ACCENT_THEME;

export function applyTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", ACCENT_THEME.accent);
  root.style.setProperty("--accent-soft", ACCENT_THEME.soft);
  root.style.setProperty("--accent-hover", ACCENT_THEME.hover);
  root.style.setProperty("--accent-border", ACCENT_THEME.border);
  root.style.setProperty("--accent-rgb", ACCENT_THEME.rgb);
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    /* ignore */
  }
}
