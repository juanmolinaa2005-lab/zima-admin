# Shared UI primitives

Custom CSS utilities (no shadcn). Theme forced to ink black.

## ThemeProvider
- File: `components/theme/ThemeProvider.tsx`
- Description: Applies BLACK_THEME CSS variables on mount.

```tsx
"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme();
  }, []);

  return <>{children}</>;
}

```

## theme.ts
- File: `lib/theme.ts`
- Description: Accent token applicator.

```tsx
const THEME_KEY = "zima:accent-theme";

export const BLACK_THEME = {
  accent: "#111827",
  soft: "#f3f4f6",
  hover: "#030712",
  border: "#d1d5db",
  rgb: "17, 24, 39",
} as const;

export function applyTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", BLACK_THEME.accent);
  root.style.setProperty("--accent-soft", BLACK_THEME.soft);
  root.style.setProperty("--accent-hover", BLACK_THEME.hover);
  root.style.setProperty("--accent-border", BLACK_THEME.border);
  root.style.setProperty("--accent-rgb", BLACK_THEME.rgb);
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    /* ignore */
  }
}

```

## CSS primitives (`app/globals.css`)
Classes: `.ui-btn-primary`, `.ui-btn-secondary`, `.ui-input`, `.ui-card`, `.ui-chip`, `.ui-tag*`.

```css
@import "tailwindcss";

@font-face {
  font-family: Pacifico;
  src: url("/fonts/Pacifico-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --background: #f7f7f8;
  --foreground: #111827;
  --accent: #111827;
  --accent-soft: #f3f4f6;
  --accent-hover: #030712;
  --accent-border: #d1d5db;
  --accent-rgb: 17, 24, 39;
  --surface: #ffffff;
  --muted: #6b7280;
  --muted-soft: #9ca3af;
  --border: #ebebef;
  --border-strong: #e0e0e6;
  --success: #16a34a;
  --danger: #dc2626;
  --radius-sm: 0.625rem;
  --radius-md: 0.875rem;
  --radius-lg: 1rem;
  --radius-xl: 1.125rem;
  --radius-pill: 9999px;
  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
  --shadow-md: 0 4px 16px rgba(17, 24, 39, 0.06);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.18s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}

.ui-card {
  border: 1px solid var(--border);
  border-radius: 1.375rem;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.ui-block {
  border-radius: 1.375rem;
  background: #f4f5f7;
  padding: 1rem;
}

.ui-page {
  padding: 1.25rem;
}

.ui-pill {
  border-radius: var(--radius-pill);
}

.ui-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  padding: 0.6rem 1.1rem;
  font-size: 13px;
  font-weight: 600;
  color: white;
  transition: background 0.15s ease;
}

.ui-btn-primary:hover {
  background: var(--accent-hover);
}

.ui-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  padding: 0.6rem 1.1rem;
  font-size: 13px;
  font-weight: 550;
  color: var(--foreground);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ui-btn-secondary:hover {
  background: #f4f5f7;
  border-color: var(--border-strong);
}

.ui-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  padding: 0.65rem 1rem;
  font-size: 13px;
  color: var(--foreground);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ui-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ui-input::placeholder {
  color: var(--muted-soft);
}

.ui-tag {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  padding: 0.25rem 0.7rem;
  font-size: 11px;
  font-weight: 600;
}

.ui-tag-accent {
  background: var(--accent-soft);
  color: var(--accent);
}

.ui-tag-muted {
  background: #f3f4f6;
  color: var(--muted);
}

.ui-tag-success {
  background: #ecfdf3;
  color: #027a48;
}

.ui-tag-danger {
  background: #fef2f2;
  color: #b91c1c;
}

.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  padding: 0.45rem 0.8rem;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}

* {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.social-rail {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.social-rail::-webkit-scrollbar {
  display: none;
}

.app-demo-canvas {
  background-color: #121316;
  background-image: radial-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px);
  background-size: 20px 20px;
}

.app-demo-canvas-light {
  background-color: #d5d5dc;
  background-image: radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}

.app-demo-player [style*="background-size: auto 145px"] {
  background-image: none !important;
}

.studio-shell {
  --studio-bg: #f7f7f8;
  --studio-panel: #ffffff;
  --studio-elevated: #f9fafb;
  --studio-line: #ebebef;
  --studio-text: #111827;
  --studio-muted: #6b7280;
  --studio-faint: #9ca3af;
  background: var(--studio-bg);
  color: var(--studio-text);
}

.studio-page {
  margin: 0 auto;
  max-width: 72rem;
  padding: 1.25rem;
}

.studio-page-narrow {
  max-width: 44rem;
}

@media (min-width: 640px) {
  .studio-page {
    padding: 1.5rem;
  }
}

.studio-kicker {
  margin: 0 0 0.45rem;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.studio-title {
  margin: 0;
  font-size: 1.65rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--studio-text);
}

.studio-lead {
  margin: 0.4rem 0 0;
  max-width: 36rem;
  font-size: 14px;
  line-height: 1.55;
  color: var(--studio-muted);
}

.studio-page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.studio-card {
  border: 1px solid var(--studio-line);
  border-radius: 1.25rem;
  background: var(--studio-panel);
  padding: 1.25rem;
}

.studio-empty {
  border: 1px dashed var(--studio-line);
  border-radius: 1.375rem;
  background: transparent;
  padding: 2rem;
  text-align: center;
  color: var(--studio-muted);
}

```
