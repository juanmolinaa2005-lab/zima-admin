"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Project } from "@/lib/types";
import type { EstudioSectionId } from "@/lib/creator/estudio-v1";
import { ViewTrackerView } from "./ViewTrackerView";
import { MarketView } from "./MarketView";
import { LaunchView, type OpenTarget } from "./LaunchView";
import { EmailsView } from "./EmailsView";
import { PageView } from "./PageView";
import { CreatorEstudioV1View } from "./CreatorEstudioV1View";
import { LaAppHome, appSectionFrom, type AppSection } from "./estudio/LaAppHome";
import { GalleryView } from "./GalleryView";
import { Sidebar } from "./Sidebar";
import { VIEW_META, viewFrom, type ViewId } from "./nav";

type DashboardProps = {
  project: Project;
  userEmail: string | null;
};

export function Dashboard({ project, userEmail }: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view");
  const view = viewFrom(rawView);
  const appSection = appSectionFrom(searchParams.get("app"));

  const [studioSection, setStudioSection] = useState<EstudioSectionId | undefined>(
    rawView === "redes" ? "redes" : undefined
  );
  const [opened, setOpened] = useState<ViewId[]>([view]);
  if (!opened.includes(view)) setOpened([...opened, view]);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    setSidebarExpanded(false);
  }

  function select(next: ViewId, extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (next !== "launch") params.set("view", next);
    for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function openTarget({ kind, section }: OpenTarget) {
    if (kind === "miapp") {
      select("miapp", section ? { app: section } : undefined);
      return;
    }
    if (kind === "redes" || kind === "estudio") {
      if (kind === "redes") setStudioSection("redes");
      select("marketing");
      return;
    }
    if (kind in VIEW_META) select(kind as ViewId);
  }

  function renderView(id: ViewId): ReactNode {
    switch (id) {
      case "launch":
        return <LaunchView projectId={project.id} onOpen={openTarget} />;
      case "page":
        return <PageView projectId={project.id} />;
      case "miapp":
        return (
          <LaAppHome
            projectId={project.id}
            section={appSection}
            onSection={(section: AppSection) => select("miapp", { app: section })}
          />
        );
      case "market":
        return <MarketView projectId={project.id} projectName={project.name} />;
      case "marketing":
        return (
          <CreatorEstudioV1View
            projectId={project.id}
            initialSection={studioSection}
            onSectionChange={setStudioSection}
            onOpenGallery={() => select("gallery")}
          />
        );
      case "viewtracker":
        return <ViewTrackerView projectId={project.id} projectName={project.name} />;
      case "emails":
        return <EmailsView projectId={project.id} />;
      case "gallery":
        return <GalleryView projectId={project.id} />;
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        active={view === "gallery" ? "marketing" : view}
        userEmail={userEmail}
        projectName={project.name}
        projectId={project.id}
        collapsed={!sidebarExpanded}
        onToggleCollapsed={() => setSidebarExpanded((v) => !v)}
        onSelect={(next) => select(next)}
      />

      <main id="main" tabIndex={-1} className="relative min-w-0 flex-1 outline-none">
        {opened.map((id) => {
          const active = id === view;
          return (
            <div
              key={id}
              className={`ui-view absolute inset-0 ${active ? "z-10" : "pointer-events-none invisible z-0"}`}
              data-active={active ? "true" : undefined}
              aria-hidden={!active}
            >
              {renderView(id)}
            </div>
          );
        })}
      </main>
    </div>
  );
}
