"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { LogoutIcon, PanelCollapseIcon, SettingsIcon } from "./icons";
import { MobileFabMenu } from "./MobileFabMenu";
import { SECTIONS, VIEW_META, type IconComp, type SectionId, type ViewId } from "./nav";

type SidebarProps = {
  activeSection: SectionId;
  activeTab: ViewId;
  userEmail: string | null;
  projectName: string;
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectSection: (section: SectionId) => void;
  onSelectTab: (view: ViewId) => void;
};

type Motion = "lift" | "tilt" | "spin" | "nudge" | "pulse";

const MOTION: Partial<Record<SectionId | ViewId, Motion>> = {
  home: "lift",
  tracking: "pulse",
  organic: "spin",
  influencers: "pulse",
  paid: "tilt",
  planner: "nudge",
  "ai-influencers": "pulse",
  studio: "tilt",
  upload: "lift",
  overview: "pulse",
  accounts: "pulse",
  videos: "nudge",
  links: "nudge",
  creators: "pulse",
  requests: "nudge",
  responses: "tilt",
  campaigns: "tilt",
  creatives: "spin",
};

function NavButton({
  label,
  icon: Icon,
  active,
  motion = "pulse",
  onClick,
  buttonRef,
}: {
  label: string;
  icon: IconComp;
  active?: boolean;
  motion?: Motion;
  onClick?: () => void;
  buttonRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`group relative z-10 flex h-9 w-full items-center gap-3 rounded-[10px] px-[11px] text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/20 ${
        active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--foreground)]"
      }`}
    >
      <span key={active ? "on" : "off"} className="nav-icon" data-motion={motion} data-active={active ? "true" : undefined}>
        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
            active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  );
}

function RailButton({
  label,
  icon: Icon,
  active,
  motion = "pulse",
  onClick,
}: {
  label: string;
  icon: IconComp;
  active: boolean;
  motion?: Motion;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className="group relative flex w-full flex-col items-center gap-1 py-1 outline-none"
    >
      <span
        aria-hidden
        className={`absolute left-0 top-[22px] w-1 -translate-y-1/2 rounded-r-full bg-[var(--foreground)] transition-[height,opacity] duration-300 ease-[var(--ease)] ${
          active ? "h-8 opacity-100" : "h-0 opacity-0 group-hover:h-4 group-hover:opacity-100"
        }`}
      />
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-300 ease-[var(--ease)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--foreground)]/20 ${
          active
            ? "bg-[var(--foreground)] text-white shadow-[0_1px_2px_rgba(17,24,39,0.2),0_6px_14px_-6px_rgba(17,24,39,0.35)]"
            : "bg-white text-[var(--muted)] shadow-[0_0_0_1px_var(--border)] group-hover:text-[var(--foreground)] group-hover:shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(17,24,39,0.12)]"
        }`}
      >
        <span key={active ? "on" : "off"} className="nav-icon" data-motion={motion} data-active={active ? "true" : undefined}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </span>
      <span
        className={`max-w-full truncate px-1 text-[10px] font-medium leading-tight transition-colors duration-200 ${
          active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function Sidebar({
  activeSection,
  activeTab,
  userEmail,
  projectName,
  projectId,
  collapsed,
  onToggleCollapsed,
  onSelectSection,
  onSelectTab,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userInitial = (userEmail?.trim()[0] || "U").toUpperCase();
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<ViewId, HTMLElement>());

  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];
  const panelOpen = !collapsed && section.tabs.length > 1;

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const list = listRef.current;
    if (!indicator || !list) return;
    const place = () => {
      const el = itemRefs.current.get(activeTab);
      if (!el) {
        indicator.style.opacity = "0";
        return;
      }
      indicator.style.transform = `translateY(${el.offsetTop}px)`;
      indicator.style.height = `${el.offsetHeight}px`;
      indicator.style.opacity = "1";
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTab, activeSection]);

  function selectSection(id: SectionId) {
    if (collapsed && id !== "home") onToggleCollapsed();
    onSelectSection(id);
  }

  return (
    <>
      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title={projectName}
        subtitle="Vantko"
        fabLabel="Abrir menú"
        fabClassName="bottom-5 right-4"
        sections={SECTIONS.map((s) => ({
          label: s.tabs.length > 1 ? s.label : undefined,
          items: s.tabs.map((tab) => ({
            id: tab,
            label: s.tabs.length > 1 ? VIEW_META[tab].label : s.label,
            icon: s.tabs.length > 1 ? VIEW_META[tab].icon : s.icon,
            active: activeTab === tab,
            onClick: () => {
              onSelectTab(tab);
              setMobileOpen(false);
            },
          })),
        }))}
        footer={
          <div className="space-y-0.5 px-1 pb-1">
            <Link
              href={`/projects/${projectId}/settings`}
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
            >
              <SettingsIcon className="h-4 w-4 text-[var(--muted)]" />
              Ajustes
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                <LogoutIcon className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        }
      />

      <div className="hidden h-full shrink-0 md:flex">
        <aside
          aria-label="Secciones"
          className="flex h-full w-[76px] shrink-0 flex-col items-center border-r border-[var(--border)] bg-[#efeff2] py-3"
        >
          <Link
            href="/"
            title={`${projectName} · Cambiar de proyecto`}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[image:var(--accent-metal)] text-[14px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(17,24,39,0.2)] transition-transform duration-300 ease-[var(--ease-spring)] hover:scale-105 active:scale-95"
          >
            {(projectName.trim()[0] || "V").toUpperCase()}
          </Link>
          <span aria-hidden className="my-3 h-px w-8 shrink-0 bg-[var(--border)]" />

          <nav className="ui-stagger flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto">
            {SECTIONS.map((s) => (
              <RailButton
                key={s.id}
                label={s.label}
                icon={s.icon}
                motion={MOTION[s.id]}
                active={activeSection === s.id}
                onClick={() => selectSection(s.id)}
              />
            ))}
          </nav>

          <div className="flex shrink-0 flex-col items-center gap-2 pt-3">
            <Link
              href={`/projects/${projectId}/settings`}
              title="Ajustes"
              className="group flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--muted)] transition-colors duration-200 hover:bg-black/[0.05] hover:text-[var(--foreground)]"
            >
              <span className="nav-icon" data-motion="spin">
                <SettingsIcon className="h-[18px] w-[18px]" />
              </span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                title={`${userEmail ?? "Cuenta"} · Cerrar sesión`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-semibold text-white transition-transform duration-300 ease-[var(--ease-spring)] hover:scale-105"
              >
                {userInitial}
              </button>
            </form>
          </div>
        </aside>

        <div
          className={`ui-shell-rail h-full overflow-hidden transition-[width,border-color] duration-300 ease-[var(--ease)] ${
            panelOpen ? "w-[228px] border-r border-[var(--border)]" : "w-0 border-r border-transparent"
          }`}
          aria-hidden={!panelOpen}
        >
          <div className="flex h-full w-[228px] flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Link href="/" title="Cambiar de proyecto" tabIndex={panelOpen ? undefined : -1} className="group min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[13px] font-semibold text-[var(--foreground)]">{projectName}</span>
                  <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--muted-soft)] transition-transform duration-200 group-hover:translate-y-px" fill="none">
                    <path d="m5 6.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="block truncate text-[11px] text-[var(--muted-soft)]">Cambiar de proyecto</span>
              </Link>
              <button
                type="button"
                onClick={onToggleCollapsed}
                tabIndex={panelOpen ? undefined : -1}
                title="Ocultar panel"
                aria-label="Ocultar panel"
                className="ui-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--muted-soft)] transition-colors duration-200 hover:bg-black/[0.035] hover:text-[var(--foreground)]"
              >
                <PanelCollapseIcon className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label={section.label} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <p className="px-[11px] pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-soft)]">{section.label}</p>
              <div key={section.id} ref={listRef} className="ui-stagger relative space-y-0.5">
                <div
                  ref={indicatorRef}
                  aria-hidden
                  className="nav-indicator pointer-events-none absolute inset-x-0 top-0 z-0 rounded-[10px] bg-white opacity-0 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(17,24,39,0.06),0_4px_12px_-6px_rgba(17,24,39,0.12)]"
                />
                {section.tabs.map((tab) => (
                  <NavButton
                    key={tab}
                    label={VIEW_META[tab].label}
                    icon={VIEW_META[tab].icon}
                    motion={MOTION[tab]}
                    active={activeTab === tab}
                    onClick={() => onSelectTab(tab)}
                    buttonRef={(el) => {
                      if (el) itemRefs.current.set(tab, el);
                      else itemRefs.current.delete(tab);
                    }}
                  />
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
