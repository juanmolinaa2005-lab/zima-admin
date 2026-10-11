const THEME_KEY = "zima:accent-theme";

/** Zima accent (brushed black metal). Kept in sync with :root in app/globals.css. */
export const ACCENT_THEME = {
  accent: "#141416",
  soft: "#f3f4f6",
  hover: "#2a2a2e",
  border: "#d4d4d8",
  rgb: "20, 20, 22",
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
