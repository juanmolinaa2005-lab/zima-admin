# Theme

## Part 1 — Compact token summary

Framework: Next.js 16 + React 19 + Tailwind CSS v4 (`@import "tailwindcss"`). No shadcn. Custom CSS utilities in `app/globals.css`. Fonts: Geist / Geist Mono via `next/font`.

### Colors (`:root`)
| Token | Value |
|-------|--------|
| --background | #f7f7f8 |
| --foreground | #111827 |
| --accent | #111827 |
| --accent-soft | #f3f4f6 |
| --accent-hover | #030712 |
| --accent-border | #d1d5db |
| --accent-rgb | 17, 24, 39 |
| --surface | #ffffff |
| --muted | #6b7280 |
| --muted-soft | #9ca3af |
| --border | #ebebef |
| --border-strong | #e0e0e6 |
| --success | #16a34a |
| --danger | #dc2626 |

Hardcoded UI hex still common: `#f4f5f7` blocks, `#16181d` titles, `#6b7285` secondary, `#fef2f2` / `#b42318` errors, Studio orange `#f97316` / `orange-500` in EstudioSidebar.

No `.dark` theme. Accent is forced to black via `lib/theme.ts` `BLACK_THEME`.

### Type
- Family: Geist (`--font-geist-sans`), Geist Mono
- Page title: 24–28px, weight 600, tracking-tight
- Body: 13–14px
- Label/kicker: 11px, uppercase, tracking 0.08–0.14em
- KPI: 26px semibold
- Rail labels: 10px

### Radius
--radius-sm 10px · md 14px · lg 16px · xl 18px · pill 9999px  
Cards often `rounded-[22px]` / `1.375rem`. Login card `rounded-[28px]`.

### Shadow
--shadow-sm: `0 1px 2px rgba(17,24,39,0.04)`  
--shadow-md: `0 4px 16px rgba(17,24,39,0.06)`  
Login: `0 16px 48px rgba(22,24,29,0.08)`

### Spacing / layout
Page padding 20px. Dashboard: rail 76px, header 56px, full viewport `h-dvh`. Content max-width 72rem (studio) / 5xl (projects) / 3xl (settings).

### Motion
`.animate-fade-in` 180ms · `.animate-scale-in` 200ms (modals/login)

## Part 2 — Raw source

See `app/globals.css` (304 lines) and `lib/theme.ts` (full BLACK_THEME applicator). No `tailwind.config` — Tailwind v4 via PostCSS.
