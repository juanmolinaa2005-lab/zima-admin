"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Project } from "@/lib/types";
import type { EstudioSectionId } from "@/lib/creator/estudio-v1";
import { MarketingPage } from "./MarketingPages";
import { CreatorEstudioV1View } from "./CreatorEstudioV1View";
import { GalleryView } from "./GalleryView";
import { Sidebar } from "./Sidebar";
import { viewFrom, type ViewId } from "./nav";

type DashboardProps = {
  project: Project;
  userEmail: string | null;
};

export function Dashboard({ project, userEmail }: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view");
  const view = viewFrom(rawView, searchParams.get("vt"));

  const [studioSection, setStudioSection] = useState<EstudioSectionId | undefined>(
    rawView === "redes" ? "redes" : undefined
  );
  const [opened, setOpened] = useState<ViewId[]>([view]);
  if (!opened.includes(view)) setOpened([...opened, view]);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  function select(next: ViewId) {
    router.replace(next === "overview" ? pathname : `${pathname}?view=${next}`, { scroll: false });
  }

  function renderView(id: ViewId): ReactNode {
    switch (id) {
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
      default:
        return <MarketingPage id={id} projectId={project.id} />;
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        active={view === "gallery" ? "studio" : view}
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
