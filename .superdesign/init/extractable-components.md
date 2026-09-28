# Extractable components

## AppSidebar
- Source: `components/dashboard/Sidebar.tsx`
- Category: layout
- Description: 76px desktop rail with Z mark, tool icons, social avatars, Inicio / Galería / Ajustes / Salir
- Extractable props: activeToolId (string), projectName (string), projectId (string)
- Hardcoded: Z circle mark, rail width 76px, labels Home/Clients/Emails/Stats/Tracker/Studio/Redes/Accesos, white bg, border #ebebef

## ProjectsHeader
- Source: `components/projects/ProjectsPage.tsx`
- Category: layout
- Description: Top bar for workspace list — Z mark, email, Supabase chip, sign out
- Extractable props: userEmail (string), connected (boolean)
- Hardcoded: “Zima Admin”, chip copy, white header

## SettingsShell
- Source: `components/settings/SettingsShell.tsx`
- Category: layout
- Description: Settings chrome with Z mark, back chip, title, sign out
- Extractable props: projectName, title, subtitle, backHref, backLabel
- Hardcoded: Z circle, Settings label

## DocsShell
- Source: `components/docs/DocsShell.tsx`
- Category: layout
- Description: Public docs header + sidebar nav + white article card
- Extractable props: none
- Hardcoded: Z mark, Documentación, Iniciar sesión

## LoginCard
- Source: `app/login/page.tsx` + `components/auth/LoginForm.tsx`
- Category: basic
- Description: Centered white 400px card: Z, Entrar, email, password, CTA
- Extractable props: none
- Hardcoded: Z circle, Entrar, field labels, Docs link

## UiButton / UiChip / UiInput
- Source: `app/globals.css` (.ui-btn-primary, .ui-btn-secondary, .ui-chip, .ui-input)
- Category: basic
- Description: Shared CSS primitives (no React wrappers)
- Extractable props: n/a
- Hardcoded: pill radius, Geist, ink accent
