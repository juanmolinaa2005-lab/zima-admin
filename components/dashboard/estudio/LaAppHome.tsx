"use client";

import { AppLegalCenter } from "./AppLegalCenter";
import { ProductHome } from "./ProductHome";

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
  section,
  onSection,
}: {
  projectId: string;
  section: AppSection;
  onSection: (section: AppSection) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <nav className="flex shrink-0 gap-5 border-b border-[var(--border)] px-5 pt-5 sm:px-8" aria-label="Mi app">
        {SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSection(item.id)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 pb-2.5 text-[14px] font-medium transition ${
                active ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
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
