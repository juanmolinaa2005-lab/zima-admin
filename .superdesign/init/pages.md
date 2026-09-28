# Pages

## /login
Entry: `app/login/page.tsx`
Dependencies:
- `components/auth/LoginForm.tsx`
- `app/globals.css` (ui-input, ui-btn-primary)
- `lib/supabase/client.ts`

## / (Projects)
Entry: `app/page.tsx`
Dependencies:
- `components/projects/ProjectsPage.tsx`
  - `components/projects/CreateProjectModal.tsx`
  - `components/projects/ConnectSupabaseModal.tsx`
  - `components/dashboard/icons.tsx`
- `app/actions/projects.ts`
- `app/actions/supabase-account.ts`

## /projects/[id] (Dashboard)
Entry: `app/projects/[id]/page.tsx`
Dependencies:
- `components/dashboard/Dashboard.tsx`
  - `components/dashboard/Sidebar.tsx`
    - `components/dashboard/MobileFabMenu.tsx`
    - `components/dashboard/icons.tsx`
  - `components/dashboard/HomeView.tsx`
  - `components/dashboard/AppsView.tsx`
  - `components/dashboard/EmailsView.tsx`
  - `components/dashboard/AnalyticsView.tsx`
  - `components/dashboard/ViewTrackerView.tsx`
  - `components/dashboard/CreatorEstudioV1View.tsx`
  - `components/dashboard/GalleryView.tsx`
  - `components/dashboard/RedesView.tsx`
  - `components/dashboard/ClientsView.tsx`
  - `components/dashboard/CreateToolModal.tsx`
  - `components/dashboard/ConfigureIconModal.tsx`
  - `components/dashboard/TabBar.tsx`
  - `components/dashboard/ToolFrame.tsx`

## /projects/[id] Home panel
Entry: `components/dashboard/HomeView.tsx`
Dependencies:
- `components/dashboard/icons.tsx`

## /docs
Entry: `app/docs/page.tsx`
Dependencies:
- `app/docs/layout.tsx`
  - `components/docs/DocsShell.tsx`
    - `components/docs/DocsNav.tsx`

## /projects/[id]/settings
Entry: `app/projects/[id]/settings/page.tsx`
Dependencies:
- `components/settings/SettingsHome.tsx`
  - `components/settings/SettingsShell.tsx`
    - `components/dashboard/icons.tsx`
