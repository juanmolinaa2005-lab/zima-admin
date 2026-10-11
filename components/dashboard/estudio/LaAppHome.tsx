"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { HomeIcon, UsersIcon } from "../icons";
import { AppLegalCenter } from "./AppLegalCenter";
import { ProductHome } from "./ProductHome";

export type AppSection = "overview" | "product" | "clients" | "screenshots" | "legal";

function strokeIcon(d: string) {
  return function Icon({ className }: SVGProps<SVGSVGElement>) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={d}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };
}

const ShotIcon = strokeIcon(
  "M5 7.5h14v11H5v-11Zm3 0V6.2A2.2 2.2 0 0 1 10.2 4h3.6A2.2 2.2 0 0 1 16 6.2V7.5M12 16.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z"
);
const IconMark = strokeIcon("M8 4.5h8v15H8v-15Zm4 13.2h.01M9 8h6");
const VideoMark = strokeIcon("M5 8h10v8H5V8Zm10 2 4-1.6v7.2L15 14");
const LegalMark = strokeIcon("M7 3.5h7l3 3V20.5H7v-17Zm7 0v3h3M9.5 12h5M9.5 15.5h5");
const ProductMark = strokeIcon("M4 11.5 12.5 3h5.5v5.5L10 16.5 4 11.5Zm11-5.2h.01");

function NavItem({
  label,
  active,
  icon: Icon,
  onClick,
  soon,
}: {
  label: string;
  active: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soon}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
          : soon
            ? "cursor-default font-medium text-[#c4c8d0]"
            : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {soon ? (
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
          Soon
        </span>
      ) : null}
    </button>
  );
}

export function LaAppHome({
  projectId,
  section,
  onSection,
  overview,
  clients,
}: {
  projectId: string;
  section: AppSection;
  onSection: (section: AppSection) => void;
  overview: ReactNode;
  clients: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)] md:flex">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <p className="text-[13px] font-semibold tracking-tight text-[var(--foreground)]">La app</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted-soft)]">Herramientas de tienda</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <NavItem
            label="Overview"
            active={section === "overview"}
            icon={HomeIcon}
            onClick={() => onSection("overview")}
          />
          <NavItem
            label="Producto"
            active={section === "product"}
            icon={ProductMark}
            onClick={() => onSection("product")}
          />
          <NavItem
            label="Clients"
            active={section === "clients"}
            icon={UsersIcon}
            onClick={() => onSection("clients")}
          />
          <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted-soft)]">
            General
          </p>
          <NavItem
            label="App Screenshot"
            active={section === "screenshots"}
            icon={ShotIcon}
            onClick={() => onSection("screenshots")}
          />
          <NavItem label="Preview video" active={false} icon={VideoMark} soon />
          <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted-soft)]">
            Más
          </p>
          <NavItem label="Icono de tienda" active={false} icon={IconMark} soon />
          <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted-soft)]">
            Legal
          </p>
          <NavItem
            label="Privacidad y términos"
            active={section === "legal"}
            icon={LegalMark}
            onClick={() => onSection("legal")}
          />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-3 py-2 md:hidden">
          {(
            [
              ["overview", "Overview"],
              ["product", "Producto"],
              ["clients", "Clients"],
              ["screenshots", "Screenshots"],
              ["legal", "Legal"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSection(id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                section === id ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {section === "overview" ? (
          <div className="min-h-0 flex-1 overflow-hidden">{overview}</div>
        ) : null}
        {section === "product" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProductHome projectId={projectId} />
          </div>
        ) : null}
        {section === "clients" ? (
          <div className="min-h-0 flex-1 overflow-hidden">{clients}</div>
        ) : null}
        {section === "legal" ? <AppLegalCenter projectId={projectId} /> : null}
        {section === "screenshots" ? (
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-3 md:p-4">
            <a
              href={`/projects/${projectId}/app-screenshots`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center rounded-xl border border-black/[0.06] bg-white px-10 py-12 text-center shadow-[0_10px_32px_rgba(17,24,39,0.05)] transition hover:border-black/[0.10] hover:shadow-[0_16px_40px_rgba(17,24,39,0.07)]"
            >
              <span className="text-[28px] font-semibold tracking-tight text-[#111318]">
                Open editor
              </span>
              <span className="mt-2 text-[14px] text-[var(--muted)]">
                Se abre en una pestaña nueva
              </span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
