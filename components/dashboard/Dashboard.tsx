"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import type { Project } from "@/lib/types";
import type { EstudioSectionId } from "@/lib/creator/estudio-v1";
import { MarketingPage } from "./MarketingPages";
import { CreatorEstudioV1View } from "./CreatorEstudioV1View";
import { GalleryView } from "./GalleryView";
import { Sidebar } from "./Sidebar";
import { HomePage } from "./marketing/HomePage";
import { ContentPlannerPage } from "./marketing/ContentPlannerPage";
import { AdsCampaignsPage } from "./marketing/AdsCampaignsPage";
import { AdsCreativesPage } from "./marketing/AdsCreativesPage";
import { LinksPage } from "./marketing/LinksPage";
import { viewFrom, type ViewId } from "./nav";

type DashboardProps = {
  project: Project;
  userEmail: string | null;
};

export function Dashboard({ project, userEmail }: DashboardProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view");
  const requested = viewFrom(rawView, searchParams.get("vt"));
  // "Influencers IA" is the influencers section of Studio, shown as its own menu entry.
  const view: ViewId = requested === "ai-influencers" ? "studio" : requested;

  const [studioSection, setStudioSection] = useState<EstudioSectionId | undefined>(
    rawView === "redes" ? "redes" : requested === "ai-influencers" ? "influencers" : requested === "studio" ? "creator-imagen" : undefined
  );
  const [opened, setOpened] = useState<ViewId[]>([view]);
  if (!opened.includes(view)) setOpened([...opened, view]);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const activeNav: ViewId =
    view === "studio"
      ? studioSection === "influencers" || studioSection === undefined
        ? "ai-influencers"
        : "studio"
      : view === "gallery"
        ? "studio"
        : view;

  function select(next: ViewId) {
    if (next === "ai-influencers") setStudioSection("influencers");
    else if (next === "studio" && (studioSection === undefined || studioSection === "influencers")) setStudioSection("creator-imagen");
    window.history.replaceState(null, "", next === "home" ? pathname : `${pathname}?view=${next}`);
  }

  function renderView(id: ViewId): ReactNode {
    switch (id) {
      case "home":
        return <HomePage projectId={project.id} projectName={project.name} active={view === "home"} onNavigate={select} />;
      case "planner":
        return <ContentPlannerPage projectId={project.id} onNavigate={select} />;
      case "campaigns":
        return <AdsCampaignsPage projectId={project.id} active={view === "campaigns"} onOpenCreatives={() => select("creatives")} />;
      case "creatives":
        return <AdsCreativesPage projectId={project.id} active={view === "creatives"} />;
      case "links":
        return <LinksPage projectId={project.id} />;
      case "studio":
        return (
          <CreatorEstudioV1View
            projectId={project.id}
            initialSection={studioSection}
            onSectionChange={setStudioSection}
            onOpenGallery={() => select("gallery")}
          />
        );
      case "gallery":
        return <GalleryView projectId={project.id} />;
      case "ai-influencers":
        return null;
      default:
        return <MarketingPage id={id} projectId={project.id} />;
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        active={activeNav}
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
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
