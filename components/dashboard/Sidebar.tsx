"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { LogoutIcon, PanelCollapseIcon, SettingsIcon } from "./icons";
import { MobileFabMenu } from "./MobileFabMenu";
import { NAV, VIEW_META, viewLabel, type BuildKind, type IconComp, type ViewId } from "./nav";

type SidebarProps = {
  active: ViewId;
  userEmail: string | null;
  projectName: string;
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (view: ViewId) => void;
  kind: BuildKind;
};

function NavButton({
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
  href,
}: {
  label: string;
  icon: IconComp;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `ui-press group flex w-full font-medium transition-colors duration-200 ${
    collapsed
      ? "min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] px-0.5 py-1.5 text-[10px] leading-tight"
      : "h-9 flex-row items-center gap-2.5 rounded-[10px] px-2.5 text-[13px]"
  } ${
    active
      ? "bg-white text-[var(--foreground)] shadow-[0_0_0_1px_var(--border),var(--shadow-sm)]"
      : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--foreground)]"
  }`;
  const inner = (
    <>
      <Icon
        className={`h-[17px] w-[17px] shrink-0 ${
          active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"
        }`}
      />
      <span className={collapsed ? "line-clamp-2 w-full text-center" : "min-w-0 flex-1 truncate text-left"}>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} title={collapsed ? label : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function Sidebar({ active, userEmail, projectName, projectId, collapsed, onToggleCollapsed, onSelect, kind }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userInitial = (userEmail?.trim()[0] || "U").toUpperCase();

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
            items: NAV.map((id) => ({
              id,
              label: viewLabel(id, kind),
              icon: VIEW_META[id].icon,
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
        className={`ui-shell-rail hidden h-full shrink-0 flex-col border-r border-[var(--border)] transition-[width] duration-300 ease-[var(--ease)] md:flex ${
          collapsed ? "w-[76px]" : "w-[232px]"
        }`}
      >
        <div className={`flex shrink-0 items-center pb-2 pt-3 ${collapsed ? "px-2" : "px-3"}`}>
          <Link
            href="/"
            title="Cambiar de proyecto"
            className={`ui-press flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white hover:shadow-[0_0_0_1px_var(--border),var(--shadow-sm)] ${
              collapsed ? "flex-col justify-center gap-1" : ""
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[image:var(--accent-metal)] text-[13px] font-bold text-white">
              {(projectName.trim()[0] || "V").toUpperCase()}
            </span>
            <span
              className={
                collapsed
                  ? "w-full truncate text-center text-[10px] font-medium leading-tight text-[var(--foreground-soft)]"
                  : "min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--foreground)]"
              }
            >
              {projectName}
            </span>
          </Link>
        </div>

        <nav className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2 ${collapsed ? "px-2" : "px-3"}`}>
          {NAV.map((id) => (
            <NavButton
              key={id}
              label={viewLabel(id, kind)}
              icon={VIEW_META[id].icon}
              active={active === id}
              collapsed={collapsed}
              onClick={() => onSelect(id)}
            />
          ))}
        </nav>

        <div className={`shrink-0 space-y-0.5 border-t border-[var(--border)] py-2 ${collapsed ? "px-2" : "px-3"}`}>
          <NavButton label="Ajustes" icon={SettingsIcon} collapsed={collapsed} href={`/projects/${projectId}/settings`} />
          <div className={`flex items-center gap-1 pt-1.5 ${collapsed ? "flex-col" : ""}`}>
            <form action={signOut} className={collapsed ? "" : "min-w-0 flex-1"}>
              <button
                type="submit"
                title={`${userEmail ?? "Cuenta"} · Cerrar sesión`}
                className={`ui-press group flex w-full items-center gap-2 rounded-[10px] p-1.5 text-left transition hover:bg-black/[0.035] ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-semibold text-white">
                  {userInitial}
                </span>
                {collapsed ? null : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--foreground-soft)]">{userEmail ?? "Cuenta"}</span>
                    <LogoutIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-soft)] opacity-0 transition group-hover:opacity-100" />
                  </>
                )}
              </button>
            </form>
            <button
              type="button"
              onClick={onToggleCollapsed}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
              aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
              className="ui-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--muted-soft)] transition hover:bg-black/[0.035] hover:text-[var(--foreground)]"
            >
              <PanelCollapseIcon className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
