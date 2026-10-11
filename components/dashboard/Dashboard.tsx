"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { MarketView } from "./MarketView";
import { MonetizationView } from "./MonetizationView";
import { LaunchView, type OpenTarget } from "./LaunchView";
import { EmailsView } from "./EmailsView";
import { HomeView } from "./HomeView";
import { CreatorEstudioV1View } from "./CreatorEstudioV1View";
import type { EstudioSectionId } from "@/lib/creator/estudio-v1";
import { LaAppHome, type AppSection } from "./estudio/LaAppHome";
import { GalleryView } from "./GalleryView";
import { RedesView } from "./RedesView";
import { Sidebar } from "./Sidebar";
import { ToolFrame } from "./ToolFrame";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { BookIcon, GridIcon, PlusIcon, RedesIcon, SettingsIcon } from "./icons";
import { NAV_GROUPS, findTool, hostOf, toolMeta } from "./nav";

type DashboardProps = {
  project: Project;
  initialTools: ProjectTool[];
  userEmail: string | null;
};

function appSectionFrom(view: string, app: string | null): AppSection {
  if (view === "clients" || app === "clients") return "clients";
  if (app === "screenshots" || app === "legal" || app === "product") return app;
  return "overview";
}

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
  const [appSection, setAppSection] = useState<AppSection>(() =>
    appSectionFrom(searchParams.get("view") || "home", searchParams.get("app"))
  );
  const [studioSection, setStudioSection] = useState<EstudioSectionId | undefined>(
    () => (searchParams.get("view") === "redes" ? "redes" : undefined)
  );
  const [tabs, setTabs] = useState<OpenTab[]>(() => {
    const view = searchParams.get("view") || "home";
    if (view !== "home" && view !== "miapp" && view !== "clients") return [];
    return [{ id: "tab-miapp", toolId: "miapp", title: "Mi app", kind: "miapp" }];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const view = searchParams.get("view") || "home";
    return view === "home" || view === "miapp" || view === "clients" ? "tab-miapp" : null;
  });
  const [panel, setPanel] = useState<"home" | "clients" | "tabs">(() => {
    const view = searchParams.get("view") || "home";
    return view === "home" || view === "miapp" || view === "clients" ? "tabs" : "home";
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"app" | "social">("app");
  const [iconTool, setIconTool] = useState<WorkspaceTool | null>(null);
  const [, startTransition] = useTransition();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tools: WorkspaceTool[] = toWorkspaceTools(dbTools);

  useEffect(() => {
    setDbTools(initialTools);
  }, [initialTools]);

  function showMiApp(section?: AppSection) {
    if (section) setAppSection(section);
    setTabs((prev) =>
      prev.some((t) => t.kind === "miapp")
        ? prev
        : [...prev, { id: "tab-miapp", toolId: "miapp", title: "Mi app", kind: "miapp" }]
    );
    setActiveTabId("tab-miapp");
    setPanel("tabs");
  }

  function openTool(tool: WorkspaceTool) {
    if (tool.kind === "home") {
      showMiApp("overview");
      return;
    }
    if (tool.kind === "clients" || tool.kind === "miapp") {
      showMiApp(tool.kind === "clients" ? "clients" : undefined);
      return;
    }

    if (tool.kind === "social") {
      if (tool.url) window.open(tool.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (tool.kind === "redes") {
      setStudioSection("redes");
      const studio =
        tools.find((t) => t.kind === "marketing") ||
        tools.find((t) => t.kind === "estudio");
      if (studio) openTool(studio);
      return;
    }

    if (
      tool.kind === "apps" ||
      tool.kind === "launch" ||
      tool.kind === "emails" ||
      tool.kind === "use" ||
      tool.kind === "analytics" ||
      tool.kind === "viewtracker" ||
      tool.kind === "market" ||
      tool.kind === "monetization" ||
      tool.kind === "marketing" ||
      tool.kind === "estudio" ||
      tool.kind === "gallery"
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
    if (view === "home" || view === "miapp" || view === "clients") {
      showMiApp(appSectionFrom(view, searchParams.get("app")));
    } else {
      if (view.startsWith("app:")) {
        const apps = tools.find((t) => t.kind === "apps");
        if (apps) openTool(apps);
      } else {
        const kind =
          view === "claude" || view === "use"
            ? "analytics"
            : view === "estudio" || view === "redes"
              ? "marketing"
              : view;
        if (view === "redes") setStudioSection("redes");
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
    const shown =
      (view === "marketing" || view === "estudio") && studioSection === "redes"
        ? "redes"
        : view;
    const currentVt = searchParams.get("vt");

    let nextUrl = pathname;
    if (shown !== "home") {
      const params = new URLSearchParams();
      params.set("view", shown);
      if (shown === "miapp") params.set("app", appSection);
      if (shown === "viewtracker" && currentVt) {
        params.set("vt", currentVt);
      }
      if (shown === "monetization") {
        const value = searchParams.get("mn");
        if (value) params.set("mn", value);
      }
      if (shown === "launch") {
        const value = searchParams.get("ln");
        if (value) params.set("ln", value);
      }
      if (shown === "market") {
        for (const key of ["mk", "mapp", "mc"]) {
          const value = searchParams.get(key);
          if (value) params.set(key, value);
        }
      }
      const oauthError = searchParams.get("oauth_error");
      const oauthPlatform = searchParams.get("oauth_platform");
      if (shown === "redes" && oauthError) params.set("oauth_error", oauthError);
      if (shown === "redes" && oauthPlatform) params.set("oauth_platform", oauthPlatform);
      nextUrl = `${pathname}?${params.toString()}`;
    }

    const currentUrl =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    if (currentUrl === nextUrl) return;
    router.replace(nextUrl, { scroll: false });
  }, [navReady, panel, activeTabId, tabs, pathname, router, searchParams, appSection, studioSection]);

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
      toolId === "market" ||
      toolId === "monetization" ||
      toolId === "launch" ||
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
  const sidebarCollapsed = !sidebarExpanded;

  const viewKey = `${panel}:${activeTabId}`;
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setSidebarExpanded(false);
  }

  function toggleSidebar() {
    setSidebarExpanded((v) => !v);
  }

  function openTarget({ kind, section }: OpenTarget) {
    if (kind === "miapp") {
      showMiApp((section as AppSection | undefined) ?? "overview");
      return;
    }
    const tool = kind === "redes" ? tools.find((t) => t.kind === "redes") : findTool(tools, kind);
    if (tool) openTool(tool);
  }
  const activeToolId =
    panel === "home"
      ? "home"
      : activeTab?.toolId ?? null;

  const openCreate = useCallback((mode: "app" | "social") => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const paletteActions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [];
    const overview = findTool(tools, "home");
    const clientsTool = findTool(tools, "clients");
    if (overview) {
      const meta = toolMeta("home");
      list.push({
        id: "nav-overview",
        label: meta.label,
        hint: meta.description,
        group: "Ir a",
        icon: meta.icon,
        run: () => openTool(overview),
      });
    }
    if (clientsTool) {
      const meta = toolMeta("clients");
      list.push({
        id: "nav-clients",
        label: meta.label,
        hint: meta.description,
        group: "Ir a",
        icon: meta.icon,
        run: () => openTool(clientsTool),
      });
    }
    NAV_GROUPS.forEach((group) => {
      group.kinds.forEach((kind) => {
        const tool = findTool(tools, kind);
        if (!tool) return;
        const meta = toolMeta(kind);
        list.push({
          id: `nav-${tool.id}`,
          label: meta.label,
          hint: meta.description,
          group: "Ir a",
          icon: meta.icon,
          run: () => openTool(tool),
        });
      });
    });
    const studio = findTool(tools, "marketing") || findTool(tools, "estudio");
    if (studio) {
      list.push({
        id: "nav-redes",
        label: "Redes",
        hint: "Dentro de Studio",
        group: "Ir a",
        icon: RedesIcon,
        run: () => {
          setStudioSection("redes");
          openTool(studio);
        },
      });
    }
    const apps = tools.find((t) => t.kind === "apps");
    if (apps) {
      list.push({
        id: "nav-apps",
        label: "Accesos directos",
        hint: "Todos los accesos",
        group: "Ir a",
        icon: GridIcon,
        run: () => openTool(apps),
      });
    }
    tools
      .filter((t) => t.kind === "link" || t.kind === "social")
      .forEach((tool) => {
        list.push({
          id: `link-${tool.id}`,
          label: tool.name,
          hint: hostOf(tool.url),
          group: tool.kind === "social" ? "Cuentas sociales" : "Accesos",
          tool,
          run: () => openTool(tool),
        });
      });
    list.push(
      {
        id: "act-new",
        label: "Nuevo acceso",
        group: "Acciones",
        icon: PlusIcon,
        run: () => openCreate("app"),
      },
      {
        id: "act-social",
        label: "Añadir cuenta social",
        group: "Acciones",
        icon: RedesIcon,
        run: () => openCreate("social"),
      },
      {
        id: "act-settings",
        label: "Ajustes del proyecto",
        group: "Acciones",
        icon: SettingsIcon,
        run: () => router.push(`/projects/${project.id}/settings`),
      },
      {
        id: "act-business",
        label: "Cambiar de proyecto",
        hint: "My Business",
        group: "Acciones",
        icon: GridIcon,
        run: () => router.push("/"),
      },
      {
        id: "act-docs",
        label: "Documentación",
        group: "Acciones",
        icon: BookIcon,
        run: () => router.push("/docs"),
      }
    );
    return list;
    // openTool is recreated each render; tools/tabs cover its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, tabs, project.id, router, openCreate]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        tools={tools}
        activeToolId={activeToolId}
        userEmail={userEmail}
        projectName={project.name}
        projectId={project.id}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        onSearch={() => setSearchOpen(true)}
        onSelectHome={() => {
          const overview = tools.find((t) => t.kind === "home");
          if (overview) openTool(overview);
        }}
        onSelectTool={openTool}
        onCreateClick={() => openCreate("app")}
        onCreateSocialClick={() => openCreate("social")}
        onDeleteTool={handleDelete}
        onConfigureIcon={setIconTool}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
          {panel === "home" ? (
            <div className="ui-view h-full" data-active="true">
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
            </div>
          ) : null}

          {tabs.map((tab) => {
            const active = panel === "tabs" && tab.id === activeTabId;
            if (tab.kind === "apps") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <ViewTrackerView
                    projectId={project.id}
                    projectName={project.name}
                  />
                </div>
              );
            }
            if (tab.kind === "market") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <MarketView projectId={project.id} projectName={project.name} />
                </div>
              );
            }
            if (tab.kind === "monetization") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <MonetizationView projectName={project.name} />
                </div>
              );
            }
            if (tab.kind === "launch") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <LaunchView projectId={project.id} projectName={project.name} onOpen={openTarget} />
                </div>
              );
            }
            if (tab.kind === "miapp") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <LaAppHome
                    projectId={project.id}
                    section={appSection}
                    onSection={setAppSection}
                    overview={
                      <HomeView
                        tools={tools}
                        projectId={project.id}
                        projectName={project.name}
                        linkedRef={linkedRef}
                        onCreateClick={() => openCreate("app")}
                        onOpenTool={openTool}
                      />
                    }
                    clients={
                      <ClientsView
                        projectId={project.id}
                        linkedRef={linkedRef}
                        userEmail={userEmail}
                        onLinked={setLinkedRef}
                      />
                    }
                  />
                </div>
              );
            }
            if (tab.kind === "marketing" || tab.kind === "estudio") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
                  aria-hidden={!active}
                >
                  <CreatorEstudioV1View
                    projectId={project.id}
                    initialSection={studioSection}
                    onSectionChange={setStudioSection}
                    onOpenGallery={() => {
                      const gallery = tools.find((t) => t.kind === "gallery");
                      if (gallery) openTool(gallery);
                    }}
                  />
                </div>
              );
            }
            if (tab.kind === "gallery") {
              return (
                <div
                  key={tab.id}
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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
                  className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
                  data-active={active ? "true" : undefined}
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

      {searchOpen ? (
        <CommandPalette
          open
          onClose={() => setSearchOpen(false)}
          actions={paletteActions}
        />
      ) : null}

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
