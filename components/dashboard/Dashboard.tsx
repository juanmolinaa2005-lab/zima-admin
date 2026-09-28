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
import { LaAppHome } from "./estudio/LaAppHome";
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
      tool.kind === "redes" ||
      tool.kind === "miapp"
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
      toolId === "estudio" ||
      toolId === "miapp"
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
      activeTab?.kind === "miapp" ||
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
              : activeTab?.kind === "miapp"
              ? "Screenshots de tienda"
              : activeTab?.kind === "marketing" || activeTab?.kind === "estudio"
              ? "Influencers y demos"
              : activeTab?.kind === "gallery"
              ? "Fotos y videos"
              : activeTab?.kind === "redes"
              ? "Cuentas sociales"
              : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
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
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-white py-1 pl-1 pr-2.5 text-[13px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-xs)] sm:inline-flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-ink)]">
                  {(project.name.trim()[0] || "P").toUpperCase()}
                </span>
                <span className="max-w-[160px] truncate">{project.name}</span>
              </span>
              <span aria-hidden className="hidden text-[var(--border-strong)] sm:inline">/</span>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                  {headerTitle}
                </h1>
                {headerSub ? (
                  <p className="truncate text-[11px] text-[var(--muted-soft)]">{headerSub}</p>
                ) : null}
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/"
                className="ui-btn-secondary h-8 px-3 text-[12px]"
              >
                ← My Business
              </Link>
              {pending ? (
                <span className="ui-tag ui-tag-muted" aria-live="polite">
                  Saving…
                </span>
              ) : null}
            </div>
            {pending ? (
              <span className="ui-tag ui-tag-muted sm:hidden" aria-live="polite">
                Saving…
              </span>
            ) : null}
          </header>
        ) : null}

        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
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
            if (tab.kind === "miapp") {
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  aria-hidden={!active}
                >
                  <LaAppHome projectId={project.id} />
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
