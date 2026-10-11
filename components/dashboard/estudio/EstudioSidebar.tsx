"use client";

import type { ComponentType, SVGProps } from "react";
import type { EstudioSectionId } from "@/lib/creator/estudio-v1";
import { ESTUDIO_NAV } from "@/lib/creator/estudio-v1";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

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

const PersonBoxIcon = strokeIcon(
  "M8 20v-1.2A3.2 3.2 0 0 1 11.2 15.6h1.6A3.2 3.2 0 0 1 16 18.8V20M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5.5 5.5h13v13h-13v-13Z"
);
const ClapperIcon = strokeIcon(
  "M4 9.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5ZM4 9.5 8.5 4h3L7 9.5M12 9.5 16.2 4H19L15 9.5"
);
const ImageIcon = strokeIcon(
  "M5 6.5h14v11H5v-11Zm0 7.5 3.5-3 3 3 2-2 4.5 4.5M9.2 9.2h.01"
);
const ImageGenIcon = strokeIcon(
  "M5 6.5h14v11H5v-11Zm0 7.5 3.5-3 3 3 2-2 4.5 4.5M16.5 8.2h.01M15 4l.7 1.8L17.5 6.5 15.7 7.2 15 9l-.7-1.8L12.5 6.5l1.8-.7L15 4Z"
);
const PhoneIcon = strokeIcon(
  "M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm4 15.2h.01"
);
const SimulatorIcon = strokeIcon(
  "M8 3.5h7.5a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm4 15h.01M5 9v6M19 8.5v7"
);
const RedesMark = strokeIcon(
  "M8.2 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM16.4 8.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM16.8 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM9.4 9.6l5.4-2.1M9.6 11.4l5.8 3.4"
);

const VISIBLE = ESTUDIO_NAV.filter((item) => item.id !== "simulador");

const ICONS: Record<EstudioSectionId, IconComp> = {
  "creator-imagen": ImageGenIcon,
  influencers: PersonBoxIcon,
  "app-demo": PhoneIcon,
  simulador: SimulatorIcon,
  dynamics: ClapperIcon,
  redes: RedesMark,
  library: ImageIcon,
};

function NavButton({
  id,
  label,
  active,
  badge,
  onSelect,
}: {
  id: EstudioSectionId;
  label: string;
  active: boolean;
  badge: number;
  onSelect: (id: EstudioSectionId) => void;
}) {
  const Icon = ICONS[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? "page" : undefined}
      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-200 ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
          : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--muted-soft)]"}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 ? (
        <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function EstudioSidebar({
  section,
  imageQueueCount,
  onSelect,
}: {
  section: EstudioSectionId;
  imageQueueCount?: number;
  onSelect: (id: EstudioSectionId) => void;
}) {
  return (
    <aside className="hidden h-full w-[232px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {VISIBLE.map((item) => (
          <NavButton
            key={item.id}
            id={item.id}
            label={item.label}
            active={section === item.id}
            badge={item.id === "creator-imagen" ? imageQueueCount ?? 0 : 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

export function EstudioMobileNav({
  section,
  onSelect,
}: {
  section: EstudioSectionId;
  onSelect: (id: EstudioSectionId) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-white px-2 py-2 md:hidden">
      {VISIBLE.map((item) => {
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium ${
              active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]" : "text-[var(--muted)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
