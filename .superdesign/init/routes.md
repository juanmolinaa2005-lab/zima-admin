# Routes

Next.js App Router. Auth via Supabase. Middleware/proxy in `proxy.ts`.

| Path | File | Layout | Renders |
|------|------|--------|---------|
| `/` | `app/page.tsx` | `app/layout.tsx` | `ProjectsPage` — workspace list |
| `/login` | `app/login/page.tsx` | root | Centered `LoginForm` card |
| `/projects/[id]` | `app/projects/[id]/page.tsx` | root | `Dashboard` — rail + header + tool views |
| `/projects/[id]/settings` | `app/projects/[id]/settings/page.tsx` | `SettingsShell` | Settings home |
| `/projects/[id]/settings/api` | `.../api/page.tsx` | `SettingsShell` | API keys |
| `/projects/[id]/settings/password` | `.../password/page.tsx` | `SettingsShell` | Password |
| `/projects/[id]/settings/color` | `.../color/page.tsx` | `SettingsShell` | Color (legacy) |
| `/projects/[id]/dynamics/[dynamicId]` | `.../dynamics/[dynamicId]/page.tsx` | root | Dynamics editor (new tab) |
| `/projects/[id]/app-demo` | `.../app-demo/page.tsx` | root | App demo studio |
| `/docs` | `app/docs/page.tsx` | `app/docs/layout.tsx` → `DocsShell` | Docs home |
| `/docs/app-demo` | `app/docs/app-demo/page.tsx` | DocsShell | App demo docs |
| `/privacy` `/terms` `/data-deletion` | matching pages | root | Legal |

Dashboard internal views (query `?view=`): Home, Accesos, Clients, Emails, Analytics, ViewTracker, Studio, Gallery, Redes.
