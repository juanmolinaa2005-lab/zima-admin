# Layouts

## RootLayout
- File: `app/layout.tsx`
- Description: Geist fonts, ThemeProvider, html/body.

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zima Admin",
  description: "Panel de administración Zima",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

```

## LoginPage
- File: `app/login/page.tsx`
- Description: Centered 400px white card on #f7f7f8.

```tsx
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] p-5">
      <div className="w-full max-w-[400px] rounded-[28px] bg-white p-8 shadow-[0_16px_48px_rgba(22,24,29,0.08)] animate-scale-in">
        <LoginForm />
      </div>
    </div>
  );
}

```

## LoginForm
- File: `components/auth/LoginForm.tsx`
- Description: Z mark, Entrar, email, password, Docs.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.3 3.3M9.9 5.6A10.4 10.4 0 0 1 12 5.3c5 0 9.3 3.4 10.5 6.7a11.4 11.4 0 0 1-4.1 4.8M6.1 6.2A11.5 11.5 0 0 0 1.5 12C2.7 15.3 7 18.7 12 18.7c1.4 0 2.7-.2 3.9-.7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : signInError.message
        );
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 rounded-[22px] bg-[#f4f5f7] p-4">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
          Z
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#16181d]">
          Entrar
        </h1>
        <p className="mt-1 text-[13px] text-[#6b7285]">Zima Admin</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block rounded-[22px] bg-[#f4f5f7] p-4">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7285]">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="ui-input !text-[14px]"
          />
        </label>

        <label className="block rounded-[22px] bg-[#f4f5f7] p-4">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7285]">
            Password
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="ui-input !pr-11 !text-[14px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#9ca3af] transition hover:bg-white hover:text-[#4b5563]"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </label>

        {error ? (
          <p className="rounded-full bg-[#fef3f2] px-4 py-2 text-[13px] text-[#b42318]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="ui-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "…" : "Entrar"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-[#6b7285]">
        <Link href="/docs" className="font-medium text-[#16181d] hover:underline">
          Docs
        </Link>
      </p>
    </div>
  );
}

```

## ProjectsPage
- File: `components/projects/ProjectsPage.tsx`
- Description: Workspace list chrome.

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  fetchRemoteSupabaseProjects,
} from "@/app/actions/projects";
import { signOut } from "@/app/auth/actions";
import type { Project } from "@/lib/types";
import {
  loadRemoteNamesCache,
  saveRemoteNamesCache,
  saveRemotesCache,
} from "@/lib/client-cache";
import { CreateProjectModal } from "./CreateProjectModal";
import { ConnectSupabaseModal } from "./ConnectSupabaseModal";
import { LogoutIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";

type ProjectsPageProps = {
  projects: Project[];
  userEmail: string | null;
  supabaseConnected: boolean;
};

export function ProjectsPage({
  projects,
  userEmail,
  supabaseConnected: initialConnected,
}: ProjectsPageProps) {
  const router = useRouter();
  const userKey = userEmail ?? "default";
  const [modalOpen, setModalOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connected, setConnected] = useState(initialConnected);
  const [pending, startTransition] = useTransition();
  const [remoteNames, setRemoteNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setConnected(initialConnected);
  }, [initialConnected]);

  useEffect(() => {
    if (!connected) {
      setRemoteNames({});
      return;
    }

    const cached = loadRemoteNamesCache(userKey);
    if (cached) setRemoteNames(cached.data);

    fetchRemoteSupabaseProjects()
      .then((remotes) => {
        saveRemotesCache(remotes, userKey);
        const names = Object.fromEntries(remotes.map((r) => [r.id, r.name]));
        saveRemoteNamesCache(names, userKey);
        setRemoteNames(names);
      })
      .catch(() => {
        // keep cached names if any
      });
  }, [connected, userKey]);

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete project “${name}”?`)) return;
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });
  }

  function handleCreateClick() {
    if (!connected) {
      setConnectOpen(true);
      return;
    }
    setModalOpen(true);
  }

  return (
    <div className="min-h-dvh bg-[#f7f7f8]">
      <header className="border-b border-[#e6e8ef] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-bold text-white">
              Z
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#16181d]">
                Zima Admin
              </p>
              <p className="truncate text-[11px] text-[#6b7285]">
                {userEmail ?? "Workspace"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                connected
                  ? "bg-[#ecfdf3] text-[#027a48] hover:bg-[#d1fadf]"
                  : "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[#e5e7eb]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-[#12b76a]" : "bg-[var(--accent)]"
                }`}
              />
              {connected ? "Supabase connected" : "Connect Supabase"}
            </button>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[#6b7285] transition hover:bg-[#fef3f2] hover:text-[#b42318]"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        {!connected ? (
          <div className="mb-5 rounded-[22px] bg-[var(--accent-soft)] p-5">
            <p className="text-[15px] font-semibold text-[#16181d]">
              Conecta Supabase
            </p>
            <p className="mt-1 text-[13px] text-[#6b7285]">
              Cada cuenta ve solo sus proyectos.
            </p>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="ui-btn-primary mt-4"
            >
              Connect now
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="ui-tag ui-tag-accent">Workspace</span>
            <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-[#16181d]">
              Projects
            </h1>
            <p className="mt-1 text-[13px] text-[#6b7285]">
              Elige un proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateClick}
            className="ui-btn-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="mt-5 rounded-[22px] bg-white p-8 text-center">
            <p className="text-[15px] font-semibold text-[#16181d]">
              Sin proyectos
            </p>
            <p className="mt-1 text-[13px] text-[#6b7285]">
              Crea el primero.
            </p>
            <button
              type="button"
              onClick={handleCreateClick}
              className="ui-btn-primary mt-5"
            >
              <PlusIcon className="h-4 w-4" />
              Create project
            </button>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {projects.map((project) => {
              const linked = project.supabase_project_ref
                ? remoteNames[project.supabase_project_ref] ??
                  project.supabase_project_ref
                : null;
              return (
                <li key={project.id} className="group relative">
                  <Link
                    href={`/projects/${project.id}`}
                    className="block rounded-[22px] bg-white p-5 transition hover:bg-[#fff7ed]"
                  >
                    <p className="text-[15px] font-semibold text-[#16181d]">
                      {project.name}
                    </p>
                    {project.description ? (
                      <p className="mt-1 line-clamp-2 text-[13px] text-[#6b7285]">
                        {project.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] text-[#9aa1b2]">
                        No description
                      </p>
                    )}
                    <p className="mt-4 text-[12px] font-medium text-[#9aa1b2]">
                      {linked
                        ? `Clients ← ${linked}`
                        : "No Supabase project linked"}
                    </p>
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(project.id, project.name)}
                    className="absolute right-3 top-3 rounded-xl p-1.5 text-[#9aa1b2] opacity-0 transition hover:bg-[#fef3f2] hover:text-[#b42318] group-hover:opacity-100"
                    aria-label={`Delete ${project.name}`}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <CreateProjectModal
        open={modalOpen}
        userKey={userKey}
        connected={connected}
        onClose={() => setModalOpen(false)}
        onNeedConnect={() => {
          setModalOpen(false);
          setConnectOpen(true);
        }}
      />
      <ConnectSupabaseModal
        open={connectOpen}
        connected={connected}
        onClose={() => setConnectOpen(false)}
        onChanged={(value) => {
          setConnected(value);
          router.refresh();
        }}
      />
    </div>
  );
}

```

## SettingsShell
- File: `components/settings/SettingsShell.tsx`
- Description: Settings header + main.

```tsx
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { LogoutIcon } from "@/components/dashboard/icons";

type SettingsShellProps = {
  projectId: string;
  projectName: string;
  userEmail?: string | null;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: boolean;
};

export function SettingsShell({
  projectId,
  projectName,
  userEmail,
  title,
  subtitle,
  backHref,
  backLabel = "← Back",
  children,
  footer = true,
}: SettingsShellProps) {
  const resolvedBack = backHref ?? `/projects/${projectId}`;

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
              Z
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">Settings</p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {projectName}
              </p>
            </div>
          </div>
          <Link
            href={resolvedBack}
            className="ui-chip hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
          >
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-5">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
          {subtitle || userEmail ? (
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              {subtitle}
              {subtitle && userEmail ? " · " : ""}
              {userEmail}
            </p>
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={resolvedBack} className="ui-btn-secondary">
              {backLabel}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-[var(--muted)] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}

```

## DocsShell
- File: `components/docs/DocsShell.tsx`
- Description: Public docs chrome.

```tsx
import Link from "next/link";
import { DocsNav } from "./DocsNav";

export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f5f8] text-[#111827]">
      <header className="border-b border-[#ebebef] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-5">
          <Link href="/docs" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent,#ea580c)] text-[12px] font-bold text-white">
              Z
            </span>
            <span className="truncate">
              <span className="block text-[13px] font-semibold leading-tight">
                Zima Admin
              </span>
              <span className="block text-[11px] text-[#9ca3af]">
                Documentación
              </span>
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-5 p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] lg:block">
            Guías
          </p>
          <DocsNav />
        </aside>
        <article className="rounded-[22px] bg-white p-6">
          {children}
        </article>
      </div>
    </div>
  );
}

```

## Dashboard
- File: `components/dashboard/Dashboard.tsx`
- Description: App shell: Sidebar + 56px header + view stack.

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createProjectTool,
  deleteProjectTool,
} from "@/app/actions/projects";
import type { OpenTab, Project, WorkspaceTool } from "@/lib/types";
import { createTabId, toWorkspaceTools } from "@/lib/types";
import type { ProjectTool } from "@/lib/types";
import { CreateToolModal } from "./CreateToolModal";
import { ConfigureIconModal } from "./ConfigureIconModal";
import { AppsView } from "./AppsView";
import { ClientsView } from "./ClientsView";
import { AnalyticsView } from "./AnalyticsView";
import { ViewTrackerView } from "./ViewTrackerView";
import { EmailsView } from "./EmailsView";
import { HomeView } from "./HomeView";
import { CreatorEstudioV1View } from "./CreatorEstudioV1View";
import { GalleryView } from "./GalleryView";
import { RedesView } from "./RedesView";
import { Sidebar } from "./Sidebar";
import { ToolFrame } from "./ToolFrame";

type DashboardProps = {
  project: Project;
  initialTools: ProjectTool[];
  userEmail: string | null;
};

function viewFromState(
  panel: "home" | "clients" | "tabs",
  activeTab: OpenTab | null
): string {
  if (panel === "home" || !activeTab) return "home";
  if (activeTab.kind === "link") return `app:${activeTab.toolId}`;
  if (activeTab.kind === "estudio") return "marketing";
  return activeTab.kind;
}

export function Dashboard({
  project,
  initialTools,
  userEmail,
}: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);
  const [navReady, setNavReady] = useState(false);

  const [dbTools, setDbTools] = useState(initialTools);
  const [linkedRef, setLinkedRef] = useState(project.supabase_project_ref);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"home" | "clients" | "tabs">("home");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"app" | "social">("app");
  const [iconTool, setIconTool] = useState<WorkspaceTool | null>(null);
  const [pending, startTransition] = useTransition();

  const tools: WorkspaceTool[] = toWorkspaceTools(dbTools);

  useEffect(() => {
    setDbTools(initialTools);
  }, [initialTools]);

  function openTool(tool: WorkspaceTool) {
    if (tool.kind === "home") {
      setPanel("home");
      setActiveTabId(null);
      return;
    }

    if (tool.kind === "social") {
      if (tool.url) window.open(tool.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (
      tool.kind === "apps" ||
      tool.kind === "clients" ||
      tool.kind === "emails" ||
      tool.kind === "use" ||
      tool.kind === "analytics" ||
      tool.kind === "viewtracker" ||
      tool.kind === "marketing" ||
      tool.kind === "estudio" ||
      tool.kind === "gallery" ||
      tool.kind === "redes"
    ) {
      const existing = tabs.find((t) => t.toolId === tool.id);
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        const tab: OpenTab = {
          id: createTabId(),
          toolId: tool.id === "use" ? "analytics" : tool.id,
          title: tool.kind === "use" ? "Analytics" : tool.name,
          kind: tool.kind === "use" ? "analytics" : tool.kind,
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
      }
      setPanel("tabs");
      return;
    }

    if (tool.url) {
      window.open(tool.url, "_blank", "noopener,noreferrer");
    }
  }

  // Restaurar vista desde ?view= al cargar / recargar
  useEffect(() => {
    if (restoredRef.current || tools.length === 0) return;
    restoredRef.current = true;
    const view = searchParams.get("view") || "home";
    if (view !== "home") {
      if (view.startsWith("app:")) {
        const apps = tools.find((t) => t.kind === "apps");
        if (apps) openTool(apps);
      } else {
        const kind =
          view === "claude" || view === "use"
            ? "analytics"
            : view === "estudio"
              ? "marketing"
              : view;
        const tool = tools.find((t) => t.kind === kind || (kind === "analytics" && t.kind === "use"));
        if (tool) openTool(tool);
      }
    }
    setNavReady(true);
  }, [tools, searchParams]);

  // Keep URL aligned with active view. Preserve ViewTracker ?vt= on reload.
  useEffect(() => {
    if (!navReady) return;
    const active = tabs.find((t) => t.id === activeTabId) ?? null;
    const view = viewFromState(panel, active);
    const currentVt = searchParams.get("vt");

    let nextUrl = pathname;
    if (view !== "home") {
      const params = new URLSearchParams();
      params.set("view", view);
      if (view === "viewtracker" && currentVt) {
        params.set("vt", currentVt);
      }
      nextUrl = `${pathname}?${params.toString()}`;
    }

    const currentUrl =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    if (currentUrl === nextUrl) return;
    router.replace(nextUrl, { scroll: false });
  }, [navReady, panel, activeTabId, tabs, pathname, router, searchParams]);

  function handleCreate(name: string, url: string) {
    const kind = modalMode;
    startTransition(async () => {
      const created = await createProjectTool(project.id, name, url, kind);
      setDbTools((prev) => [...prev, created]);
      if (kind === "app" && created.url) {
        window.open(created.url, "_blank", "noopener,noreferrer");
      }
      setModalOpen(false);
    });
  }

  function handleDelete(toolId: string) {
    if (
      toolId === "home" ||
      toolId === "clients" ||
      toolId === "emails" ||
      toolId === "use" ||
      toolId === "analytics" ||
      toolId === "viewtracker" ||
      toolId === "marketing" ||
      toolId === "estudio"
    )
      return;
    startTransition(async () => {
      await deleteProjectTool(project.id, toolId);
      setDbTools((prev) => prev.filter((t) => t.id !== toolId));
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.toolId !== toolId);
        if (activeTabId && !remaining.some((t) => t.id === activeTabId)) {
          if (remaining.length > 0) {
            setActiveTabId(remaining[remaining.length - 1].id);
            setPanel("tabs");
          } else {
            setActiveTabId(null);
            setPanel("home");
          }
        }
        return remaining;
      });
    });
  }

  function handleIconSaved(toolId: string, iconUrl: string | null) {
    setDbTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, icon_url: iconUrl } : t))
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeToolId =
    panel === "home"
      ? "home"
      : activeTab?.toolId ?? null;

  const viewingLink =
    panel === "tabs" &&
    (activeTab?.kind === "link" ||
      activeTab?.kind === "emails" ||
      activeTab?.kind === "marketing" ||
      activeTab?.kind === "estudio" ||
      activeTab?.kind === "viewtracker" ||
      activeTab?.kind === "analytics" ||
      activeTab?.kind === "use" ||
      activeTab?.kind === "apps" ||
      activeTab?.kind === "gallery" ||
      activeTab?.kind === "redes");

  const headerTitle =
    panel === "home"
      ? "Home"
      : activeTab?.title ?? project.name;

  const headerSub =
    panel === "home"
      ? project.name
      : activeTab?.kind === "apps"
        ? "Accesos directos"
      : activeTab?.kind === "clients"
        ? "Usuarios Auth"
        : activeTab?.kind === "emails"
          ? "Cuentas de correo"
          : activeTab?.kind === "analytics" || activeTab?.kind === "use"
            ? "Ingresos y gastos"
            : activeTab?.kind === "viewtracker"
              ? "Cuentas y videos"
              : activeTab?.kind === "marketing" || activeTab?.kind === "estudio"
              ? "Influencers y demos"
              : activeTab?.kind === "gallery"
              ? "Fotos y videos"
              : activeTab?.kind === "redes"
              ? "Cuentas sociales"
              : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f7f7f8] text-[#111827]">
      <Sidebar
        tools={tools}
        activeToolId={activeToolId}
        userEmail={userEmail}
        projectName={project.name}
        projectId={project.id}
        onSelectHome={() => {
          setPanel("home");
          setActiveTabId(null);
        }}
        onSelectTool={openTool}
        onCreateClick={() => {
          setModalMode("app");
          setModalOpen(true);
        }}
        onCreateSocialClick={() => {
          setModalMode("social");
          setModalOpen(true);
        }}
        onDeleteTool={handleDelete}
        onConfigureIcon={setIconTool}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {!viewingLink ? (
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#ebebef] bg-white px-5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight text-[#111827]">
                {headerTitle}
              </p>
              {headerSub ? (
                <p className="truncate text-[11px] text-[#9ca3af]">{headerSub}</p>
              ) : null}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/"
                className="ui-chip hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
              >
                ← Projects
              </Link>
              {pending ? (
                <span className="ui-tag ui-tag-muted">Saving…</span>
              ) : null}
            </div>
            {pending ? (
              <span className="ui-tag ui-tag-muted sm:hidden">Saving…</span>
            ) : null}
          </header>
        ) : null}

        <main className="relative min-h-0 flex-1">
          {panel === "home" ? (
            <HomeView
              tools={tools}
              projectId={project.id}
              projectName={project.name}
              linkedRef={linkedRef}
              onCreateClick={() => {
                setModalMode("app");
                setModalOpen(true);
              }}
              onOpenTool={openTool}
            />
          ) : null}

          {tabs.map((tab) => {
            const active = panel === "tabs" && tab.id === activeTabId;
            if (tab.kind === "apps") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <AppsView
                    tools={tools}
                    projectName={project.name}
                    onCreateClick={() => {
                      setModalMode("app");
                      setModalOpen(true);
                    }}
                    onOpenTool={openTool}
                    onDeleteTool={handleDelete}
                    onConfigureIcon={setIconTool}
                  />
                </div>
              );
            }
            if (tab.kind === "clients") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <ClientsView
                    projectId={project.id}
                    linkedRef={linkedRef}
                    userEmail={userEmail}
                    onLinked={setLinkedRef}
                  />
                </div>
              );
            }
            if (tab.kind === "emails") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <EmailsView projectId={project.id} />
                </div>
              );
            }
            if (tab.kind === "analytics" || tab.kind === "use") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <AnalyticsView
                    linkedRef={linkedRef}
                    projectId={project.id}
                  />
                </div>
              );
            }
            if (tab.kind === "viewtracker") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <ViewTrackerView
                    projectId={project.id}
                    projectName={project.name}
                  />
                </div>
              );
            }
            if (tab.kind === "marketing" || tab.kind === "estudio") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <CreatorEstudioV1View projectId={project.id} />
                </div>
              );
            }
            if (tab.kind === "gallery") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <GalleryView projectId={project.id} />
                </div>
              );
            }
            if (tab.kind === "redes") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <RedesView
                    projectId={project.id}
                    onOpenGallery={() => {
                      const gallery = tools.find((t) => t.kind === "gallery");
                      if (gallery) openTool(gallery);
                    }}
                  />
                </div>
              );
            }
            if (!tab.url) return null;
            return (
              <ToolFrame key={tab.id} tab={tab} active={active} />
            );
          })}
        </main>
      </div>

      <CreateToolModal
        open={modalOpen}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
      <ConfigureIconModal
        open={Boolean(iconTool)}
        projectId={project.id}
        tool={iconTool}
        onClose={() => setIconTool(null)}
        onSaved={handleIconSaved}
      />
    </div>
  );
}

```

## Sidebar
- File: `components/dashboard/Sidebar.tsx`
- Description: 76px rail + mobile FAB.

```tsx
"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import type { WorkspaceTool } from "@/lib/types";
import { signOut } from "@/app/auth/actions";
import {
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  MarketingIcon,
  GalleryIcon,
  PlusIcon,
  RedesIcon,
  SettingsIcon,
  TrashIcon,
  UseIcon,
  UsersIcon,
  ViewTrackerIcon,
} from "./icons";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";

type SidebarProps = {
  tools: WorkspaceTool[];
  activeToolId: string | null;
  userEmail: string | null;
  projectName: string;
  projectId: string;
  onSelectHome: () => void;
  onSelectTool: (tool: WorkspaceTool) => void;
  onCreateClick: () => void;
  onCreateSocialClick: () => void;
  onDeleteTool: (toolId: string) => void;
  onConfigureIcon: (tool: WorkspaceTool) => void;
};

type MenuState = {
  tool: WorkspaceTool;
  x: number;
  y: number;
} | null;

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

function socialAccent(seed: string) {
  const colors = [
    "#f97316",
    "#e11d48",
    "#2563eb",
    "#0d9488",
    "#7c3aed",
    "#db2777",
    "#0891b2",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % colors.length;
  return colors[h]!;
}

function SocialAvatar({ tool }: { tool: WorkspaceTool }) {
  const [broken, setBroken] = useState(false);
  let host = "";
  try {
    host = tool.url ? new URL(tool.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  const favicon = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;
  const letter = (tool.name.trim()[0] || host[0] || "?").toUpperCase();

  if (tool.iconUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tool.iconUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  if (favicon && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={favicon}
        alt=""
        className="h-full w-full object-contain p-1.5"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white"
      style={{ background: socialAccent(tool.name || host) }}
    >
      {letter}
    </span>
  );
}

function RailItem({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: IconComp;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`mb-0.5 flex w-full flex-col items-center gap-1 rounded-[14px] p-2 text-center transition ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "opacity-100" : "opacity-60"}`} />
      <span className="w-full px-0.5 text-[10px] font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}

export function Sidebar({
  tools,
  activeToolId,
  userEmail,
  projectName,
  projectId,
  onSelectHome,
  onSelectTool,
  onCreateClick,
  onCreateSocialClick,
  onDeleteTool,
  onConfigureIcon,
}: SidebarProps) {
  const home = tools.find((t) => t.kind === "home");
  const apps = tools.find((t) => t.kind === "apps");
  const clients = tools.find((t) => t.kind === "clients");
  const emails = tools.find((t) => t.kind === "emails");
  const useTool = tools.find((t) => t.kind === "analytics" || t.kind === "use");
  const viewTracker = tools.find((t) => t.kind === "viewtracker");
  const marketing = tools.find((t) => t.kind === "marketing");
  const gallery = tools.find((t) => t.kind === "gallery");
  const redes = tools.find((t) => t.kind === "redes");
  const socialTools = tools.filter((t) => t.kind === "social");

  const [menu, setMenu] = useState<MenuState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const mobileSections: MobileNavSection[] = [
    {
      label: "Main",
      items: [
        ...(home
          ? [
              {
                id: "home",
                label: "Overview",
                icon: HomeIcon,
                active: activeToolId === home.id,
                onClick: onSelectHome,
              },
            ]
          : []),
        ...(clients
          ? [
              {
                id: "clients",
                label: "Clients",
                icon: UsersIcon,
                active: activeToolId === clients.id,
                onClick: () => onSelectTool(clients),
              },
            ]
          : []),
      ],
    },
    {
      label: "Tools",
      items: [
        ...(emails
          ? [
              {
                id: "emails",
                label: "Emails",
                icon: MailIcon,
                active: activeToolId === emails.id,
                onClick: () => onSelectTool(emails),
              },
            ]
          : []),
        ...(useTool
          ? [
              {
                id: "analytics",
                label: "Analytics",
                icon: UseIcon,
                active: activeToolId === useTool.id || activeToolId === "analytics",
                onClick: () => onSelectTool(useTool),
              },
            ]
          : []),
        ...(viewTracker
          ? [
              {
                id: "viewtracker",
                label: "ViewTracker",
                icon: ViewTrackerIcon,
                active: activeToolId === viewTracker.id,
                onClick: () => onSelectTool(viewTracker),
              },
            ]
          : []),
        ...(marketing
          ? [
              {
                id: "marketing",
                label: "Creator Studio",
                icon: MarketingIcon,
                active: activeToolId === marketing.id,
                onClick: () => onSelectTool(marketing),
              },
            ]
          : []),
        ...(redes
          ? [
              {
                id: "redes",
                label: "Redes",
                icon: RedesIcon,
                active: activeToolId === redes.id,
                onClick: () => onSelectTool(redes),
              },
            ]
          : []),
      ],
    },
    {
      label: "Manage",
      items: [
        ...(apps
          ? [
              {
                id: "apps",
                label: "Accesos directos",
                icon: GridIcon,
                active: activeToolId === apps.id,
                onClick: () => onSelectTool(apps),
              },
            ]
          : []),
      ],
    },
  ];

  const mobileMenu = (
    <MobileFabMenu
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      title="Zima Admin"
      subtitle={projectName}
      fabLabel="Open menu"
      fabClassName="bottom-5 right-4"
      sections={mobileSections}
      footer={
        <div className="space-y-0.5 px-1 pb-1">
          <button
            type="button"
            onClick={() => {
              onCreateClick();
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[#374151] hover:bg-[#f3f4f6]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <PlusIcon className="h-4 w-4" />
            </span>
            Nuevo acceso
          </button>
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[#374151] hover:bg-[#f3f4f6]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f4f6] text-[#6b7280]">
              ←
            </span>
            Projects
          </Link>
          {gallery ? (
            <button
              type="button"
              onClick={() => {
                onSelectTool(gallery);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium hover:bg-[#f3f4f6] ${
                activeToolId === gallery.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[#374151]"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  activeToolId === gallery.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                <GalleryIcon className="h-4 w-4" />
              </span>
              Galería
            </button>
          ) : null}
          <Link
            href={`/projects/${projectId}/settings`}
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[#374151] hover:bg-[#f3f4f6]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f4f6] text-[#6b7280]">
              <SettingsIcon className="h-4 w-4" />
            </span>
            Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fef2f2] text-[#dc2626]">
                <LogoutIcon className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </form>
        </div>
      }
    />
  );

  const collapsedNav = (
    <>
      {home ? (
        <RailItem
          label="Home"
          active={activeToolId === home.id}
          icon={HomeIcon}
          onClick={onSelectHome}
        />
      ) : null}
      {clients ? (
        <RailItem
          label="Clients"
          active={activeToolId === clients.id}
          icon={UsersIcon}
          onClick={() => onSelectTool(clients)}
        />
      ) : null}
      {emails ? (
        <RailItem
          label="Emails"
          active={activeToolId === emails.id}
          icon={MailIcon}
          onClick={() => onSelectTool(emails)}
        />
      ) : null}
      {useTool ? (
        <RailItem
          label="Stats"
          active={activeToolId === useTool.id || activeToolId === "analytics"}
          icon={UseIcon}
          onClick={() => onSelectTool(useTool)}
        />
      ) : null}
      {viewTracker ? (
        <RailItem
          label="Tracker"
          active={activeToolId === viewTracker.id}
          icon={ViewTrackerIcon}
          onClick={() => onSelectTool(viewTracker)}
        />
      ) : null}
      {marketing ? (
        <RailItem
          label="Studio"
          active={activeToolId === marketing.id}
          icon={MarketingIcon}
          onClick={() => onSelectTool(marketing)}
        />
      ) : null}
      {redes ? (
        <RailItem
          label="Redes"
          active={activeToolId === redes.id}
          icon={RedesIcon}
          onClick={() => onSelectTool(redes)}
        />
      ) : null}
      {apps ? (
        <RailItem
          label="Accesos"
          active={activeToolId === apps.id}
          icon={GridIcon}
          onClick={() => onSelectTool(apps)}
        />
      ) : null}
    </>
  );

  return (
    <>
      {mobileMenu}
    <aside className="hidden h-full w-[76px] shrink-0 flex-col overflow-hidden border-r border-[#ebebef] bg-white md:flex">
      <div className="flex shrink-0 flex-col items-center p-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
          Z
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-1.5">
        <nav className="min-h-0 flex-1 overflow-y-auto pb-2">{collapsedNav}</nav>
        <div className="shrink-0 space-y-0.5 border-t border-[#ebebef] pb-2 pt-1.5">
          {socialTools.length > 0 ? (
            <div className="flex max-h-[88px] flex-col items-center gap-1 overflow-y-auto px-1 pb-1">
              {socialTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.name}
                  onClick={() => onSelectTool(tool)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ tool, x: e.clientX, y: e.clientY });
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ebebef] bg-white shadow-sm"
                >
                  <SocialAvatar tool={tool} />
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onCreateSocialClick}
              title="Añadir cuenta"
              className="flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827]"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="text-[10px] font-medium leading-tight">Social</span>
            </button>
          )}
          <Link
            href="/"
            className="flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]"
          >
            <span className="text-[14px] leading-none">←</span>
            <span className="text-[10px] font-medium leading-tight">Inicio</span>
          </Link>
          {gallery ? (
            <RailItem
              label="Galería"
              active={activeToolId === gallery.id}
              icon={GalleryIcon}
              onClick={() => onSelectTool(gallery)}
            />
          ) : null}
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]"
          >
            <SettingsIcon className="h-5 w-5 opacity-60" />
            <span className="text-[10px] font-medium leading-tight">Ajustes</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[#6b7280] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"
            >
              <LogoutIcon className="h-5 w-5 opacity-60" />
              <span className="text-[10px] font-medium leading-tight">Salir</span>
            </button>
          </form>
        </div>
      </div>
    </aside>

      {menu ? (
        <div
          role="menu"
          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-xl border border-[#ebebef] bg-white py-1 shadow-[0_12px_32px_rgba(17,24,39,0.12)]"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[#111827] hover:bg-[#f3f4f6]"
            onClick={() => {
              onConfigureIcon(menu.tool);
              setMenu(null);
            }}
          >
            <GridIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Configure icon
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
            onClick={() => {
              onDeleteTool(menu.tool.id);
              setMenu(null);
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {menu.tool.kind === "social" ? "Delete social" : "Eliminar acceso"}
          </button>
        </div>
      ) : null}
    </>
  );
}

```

