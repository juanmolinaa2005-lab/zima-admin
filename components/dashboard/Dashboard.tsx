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
import { Segmented } from "./marketing/ui";
import { sectionOf, sectionTabs, tabOf, TAB_LABEL, viewFrom, VIEW_META, type SectionId, type ViewId } from "./nav";

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

  const currentTab: ViewId =
    view === "studio" && (studioSection === undefined || studioSection === "influencers") ? "ai-influencers" : tabOf(view);
  const section = sectionOf(currentTab);
  const [lastTab, setLastTab] = useState<Partial<Record<SectionId, ViewId>>>({});

  function select(next: ViewId) {
    if (next === "ai-influencers") setStudioSection("influencers");
    else if (next === "studio" && (studioSection === undefined || studioSection === "influencers")) setStudioSection("creator-imagen");
    setLastTab((prev) => ({ ...prev, [sectionOf(next)]: tabOf(next) }));
    window.history.replaceState(null, "", next === "home" ? pathname : `${pathname}?view=${next}`);
  }

  function selectSection(id: SectionId) {
    if (id === section) return;
    select(lastTab[id] ?? sectionTabs(id)[0]);
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
        active={section}
        userEmail={userEmail}
        projectName={project.name}
        projectId={project.id}
        collapsed={!sidebarExpanded}
        onToggleCollapsed={() => setSidebarExpanded((v) => !v)}
        onSelect={selectSection}
      />

      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        <div className="shrink-0 overflow-x-auto whitespace-nowrap px-4 pt-4 sm:px-6">
          <Segmented
            label="Opciones de la sección"
            value={currentTab}
            onChange={select}
            options={sectionTabs(section).map((tab) => ({ id: tab, label: TAB_LABEL[tab] ?? VIEW_META[tab].label }))}
          />
        </div>
        <div className="relative min-h-0 flex-1">
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
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
