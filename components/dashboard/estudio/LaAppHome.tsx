"use client";

import { AppLegalCenter } from "./AppLegalCenter";
import { ProductHome } from "./ProductHome";
import { TopTabs } from "../TopTabs";
import type { BuildKind } from "../nav";

export type AppSection = "product" | "screenshots" | "legal";

const SECTIONS: { id: AppSection; label: string }[] = [
  { id: "product", label: "Producto" },
  { id: "screenshots", label: "Screenshots" },
  { id: "legal", label: "Legal" },
];

export function appSectionFrom(raw: string | null): AppSection {
  return SECTIONS.some((s) => s.id === raw) ? (raw as AppSection) : "product";
}

export function LaAppHome({
  projectId,
  section: requested,
  onSection,
  kind,
}: {
  projectId: string;
  kind: BuildKind;
  section: AppSection;
  onSection: (section: AppSection) => void;
}) {
  const items = kind === "web" ? SECTIONS.filter((s) => s.id !== "screenshots") : SECTIONS;
  const section = items.some((s) => s.id === requested) ? requested : "product";
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <TopTabs label="Producto" items={items} active={section} onSelect={onSection} />
      {section === "product" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProductHome projectId={projectId} />
        </div>
      ) : null}
      {section === "legal" ? <AppLegalCenter projectId={projectId} /> : null}
      {section === "screenshots" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <a
            href={`/projects/${projectId}/app-screenshots`}
            target="_blank"
            rel="noreferrer"
            className="text-center transition hover:opacity-70"
          >
            <span className="block text-[28px] font-semibold tracking-tight text-[var(--foreground)]">Abrir editor →</span>
            <span className="mt-2 block text-[14px] text-[var(--muted)]">Se abre en una pestaña nueva</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
