"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { LogoutIcon, PanelCollapseIcon, SettingsIcon } from "./icons";
import { MobileFabMenu } from "./MobileFabMenu";
import { SECTIONS, type IconComp, type SectionId } from "./nav";

type SidebarProps = {
  active: SectionId;
  userEmail: string | null;
  projectName: string;
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (section: SectionId) => void;
};

type Motion = "lift" | "tilt" | "spin" | "nudge" | "pulse";

const MOTION: Record<SectionId, Motion> = {
  organic: "spin",
  paid: "tilt",
  tracking: "pulse",
};

function NavButton({
  label,
  icon: Icon,
  active,
  collapsed,
  motion = "pulse",
  onClick,
  href,
  buttonRef,
}: {
  label: string;
  icon: IconComp;
  active?: boolean;
  collapsed: boolean;
  motion?: Motion;
  onClick?: () => void;
  href?: string;
  buttonRef?: (el: HTMLElement | null) => void;
}) {
  const cls = `group relative z-10 flex h-9 w-full items-center gap-3 rounded-[10px] px-[11px] text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/20 ${
    active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--foreground)]"
  }`;
  const inner = (
    <>
      <span
        key={active ? "on" : "off"}
        className="nav-icon"
        data-motion={motion}
        data-active={active ? "true" : undefined}
      >
        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
            active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"
          }`}
        />
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-left transition-[opacity,transform] duration-200 ease-[var(--ease)] ${
          collapsed ? "pointer-events-none -translate-x-1.5 opacity-0" : "translate-x-0 opacity-100 delay-75"
        }`}
      >
        {label}
      </span>
    </>
  );
  if (href) {
    return (
      <Link ref={buttonRef} href={href} title={collapsed ? label : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cls}
    >
      {inner}
    </button>
  );
}

export function Sidebar({ active, userEmail, projectName, projectId, collapsed, onToggleCollapsed, onSelect }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userInitial = (userEmail?.trim()[0] || "U").toUpperCase();
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<SectionId, HTMLElement>());

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const list = listRef.current;
    if (!indicator || !list) return;
    const place = () => {
      const el = itemRefs.current.get(active);
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
  }, [active, collapsed]);

  return (
    <>
      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title={projectName}
        subtitle="Vantko"
        fabLabel="Abrir menú"
        fabClassName="bottom-5 right-4"
        sections={[
          {
            items: SECTIONS.map(({ id, label, icon }) => ({
              id,
              label,
              icon,
              active: active === id,
              onClick: () => {
                onSelect(id);
                setMobileOpen(false);
              },
            })),
          },
        ]}
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

      <aside
        aria-label="Navegación del proyecto"
        className={`ui-shell-rail hidden h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] transition-[width] duration-300 ease-[var(--ease)] md:flex ${
          collapsed ? "w-[64px]" : "w-[236px]"
        }`}
      >
        <div className="flex shrink-0 items-center px-3 pb-2 pt-3">
          <Link
            href="/"
            title="Cambiar de proyecto"
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 transition-colors duration-200 hover:bg-black/[0.035]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[image:var(--accent-metal)] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(17,24,39,0.2)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105 group-active:scale-95">
              {(projectName.trim()[0] || "V").toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 transition-[opacity,transform] duration-200 ${collapsed ? "-translate-x-1.5 opacity-0" : "opacity-100 delay-75"}`}>
              <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--foreground)]">{projectName}</span>
              <span className="block truncate text-[11px] leading-tight text-[var(--muted-soft)]">Cambiar de proyecto</span>
            </span>
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className={`h-3.5 w-3.5 shrink-0 text-[var(--muted-soft)] transition-[opacity,transform] duration-200 group-hover:translate-y-px ${collapsed ? "opacity-0" : "opacity-100"}`}
              fill="none"
            >
              <path d="m5 6.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          <div ref={listRef} className="ui-stagger relative">
            <div
              ref={indicatorRef}
              aria-hidden
              className="nav-indicator pointer-events-none absolute inset-x-0 top-0 z-0 rounded-[10px] bg-white opacity-0 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(17,24,39,0.06),0_4px_12px_-6px_rgba(17,24,39,0.12)]"
            >
              <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-x-[5px] -translate-y-1/2 rounded-full bg-[var(--foreground)]" />
            </div>
            <div className="space-y-0.5">
              {SECTIONS.map(({ id, label, icon }) => (
                <NavButton
                  key={id}
                  label={label}
                  icon={icon}
                  motion={MOTION[id]}
                  active={active === id}
                  collapsed={collapsed}
                  onClick={() => onSelect(id)}
                  buttonRef={(el) => {
                    if (el) itemRefs.current.set(id, el);
                    else itemRefs.current.delete(id);
                  }}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-[var(--border)] px-3 py-2">
          <NavButton label="Ajustes" icon={SettingsIcon} motion="spin" collapsed={collapsed} href={`/projects/${projectId}/settings`} />
          <div className={`flex gap-1 pt-1 ${collapsed ? "flex-col items-center" : "items-center"}`}>
            <form action={signOut} className={collapsed ? "" : "min-w-0 flex-1"}>
              <button
                type="submit"
                title={`${userEmail ?? "Cuenta"} · Cerrar sesión`}
                className="group flex w-full items-center gap-2 rounded-[10px] p-1.5 text-left transition-colors duration-200 hover:bg-black/[0.035]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-semibold text-white transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105">
                  {userInitial}
                </span>
                {collapsed ? null : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--foreground-soft)]">{userEmail ?? "Cuenta"}</span>
                    <LogoutIcon className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--muted-soft)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </>
                )}
              </button>
            </form>
            <button
              type="button"
              onClick={onToggleCollapsed}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
              aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
              className="ui-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--muted-soft)] transition-colors duration-200 hover:bg-black/[0.035] hover:text-[var(--foreground)]"
            >
              <PanelCollapseIcon className={`h-4 w-4 transition-transform duration-300 ease-[var(--ease)] ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
