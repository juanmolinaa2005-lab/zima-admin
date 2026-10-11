# Zima Admin — Design system

## Product
Zima Admin (vantko) is a project workspace: pick a project, then use a 248px labeled sidebar (collapsible to a 64px rail, auto-collapsed in tools that have their own nav) to open Home, Accesos, Emails, Stats, Tracker, Studio, Redes, Gallery, Settings. A global top bar holds the breadcrumb, Docs, "Nuevo acceso" and the account menu; ⌘K opens a command palette. Spanish product chrome. Mark is a filled ink circle with a white **Z** (no logo file).

## JTBD
Open the right tool fast. Cards and rails stay quiet so media and data can be loud.

## Current visual language (ground truth) — Stripe / TypingMind inspired
Tokens live in `app/globals.css` (`:root`) and `lib/theme.ts` (accent). Use `var(--token)` in classes instead of hex.
- Canvas `--background #f6f8fb`, surfaces `--surface #fff`, `--surface-alt #f3f5f9`
- Ink `--foreground #1a1f36`, `--foreground-soft #3c4257`, `--muted #596171`, `--muted-soft #8792a2`
- Hairlines `--border #e3e8ee`, `--border-strong #d5dbe3`
- Accent indigo `--accent #635bff` (hover `#5046e5`, soft `#f0efff`, ink `#4338ca`) — CTAs, active nav, charts, focus ring
- Status: `--success #0e9f6e`, `--danger #df1b41`, `--warning #b45309` (+ `-soft` fills)
- Geist + Geist Mono
- Radius: controls 8px, cards 12px, chips/pills full
- Shadows: `--shadow-xs/sm/md/lg` (soft, navy-tinted); cards use `--shadow-sm`, hover `--shadow-md`
- Primary CTA: accent fill, white text, subtle accent glow (`.ui-btn-primary`)
- Active nav: `--accent-soft` fill + `--accent-ink` text (+ 3px accent bar on the rail)
- Page head: `.ui-kicker` (accent, uppercase) → `.ui-title` (26px/650) → `.ui-lead`
- Top bar 56px white with 1px `--border` hairline; sidebar 248px (groups: principal, Clientes y datos, Contenido, Accesos, Cuentas sociales) or 64px rail
- Nav metadata (labels, descriptions, icons, colors) lives in `components/dashboard/nav.ts`
- Lists use Stripe-style table cards: one `.ui-card` with hairline-divided rows
- Tool tiles use a per-tool color chip (see `TOOL_COLORS` in HomeView)
- Motion: 200ms `cubic-bezier(0.25,1,0.5,1)` for hovers; 180–200ms fade/scale on login and modals

## Real information architecture (do not invent)
1. `/login` — Entrar, email, password, Docs link
2. `/` — Projects list, New project, Supabase connected, Sign out
3. Dashboard rail: Home, Clients, Emails, Analytics, Tracker, Studio, Redes, Accesos, Galería, Ajustes
4. Home: project chips, quick tool tiles, KPI cards (Clients, Emails, Analytics OpenAI, Accesos), optional spend chart
5. Accesos: Nuevo acceso first, equal tiles, favicon or custom icon
6. Estudio: Producto, Viral Content, Blitz, Creator Imagen, Influencers, App Demo, Dynamics, Library
7. Settings: API and Password only
8. Docs: Inicio and App Demo

## Constraints
- Keep the Z circle mark (do not invent a logo)
- Do not invent payments, customers, billing, balances, or any tool not listed above
- Do not cover Dynamics/Parts phone previews with decorative color
