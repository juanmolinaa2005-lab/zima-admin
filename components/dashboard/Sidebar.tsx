"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { WorkspaceTool } from "@/lib/types";
import { signOut } from "@/app/auth/actions";
import {
  GalleryIcon,
  GridIcon,
  LogoutIcon,
  PanelCollapseIcon,
  PlusIcon,
  SearchIcon,
  SelectorIcon,
  SettingsIcon,
  TrashIcon,
} from "./icons";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import {
  NAV_GROUPS,
  faviconFor,
  findTool,
  hostOf,
  toolMeta,
  type IconComp,
} from "./nav";

type SidebarProps = {
  tools: WorkspaceTool[];
  activeToolId: string | null;
  userEmail: string | null;
  projectName: string;
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSearch: () => void;
  onSelectHome: () => void;
  onSelectTool: (tool: WorkspaceTool) => void;
  onCreateClick: () => void;
  onCreateSocialClick: () => void;
  onDeleteTool: (toolId: string) => void;
  onConfigureIcon: (tool: WorkspaceTool) => void;
};

type MenuState = {
  tool: WorkspaceTool;
  x: number;
  y: number;
} | null;

const SOCIAL_COLORS = [
  "#141416",
  "#e11d48",
  "#2563eb",
  "#0d9488",
  "#7c3aed",
  "#db2777",
  "#0891b2",
];

function socialAccent(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % SOCIAL_COLORS.length;
  return SOCIAL_COLORS[h]!;
}

/** Favicon / custom icon with a letter fallback. */
export function ToolAvatar({
  tool,
  size = "sm",
}: {
  tool: WorkspaceTool;
  size?: "sm" | "md";
}) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const favicon = faviconFor(tool.url);

  // The image can fail before React hydrates (onError never fires) — check on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  const letter = (tool.name.trim()[0] || hostOf(tool.url)[0] || "?").toUpperCase();
  const box =
    size === "md"
      ? "h-9 w-9 rounded-[10px] text-[13px]"
      : "h-5 w-5 rounded-[6px] text-[10px]";
  const src = !broken ? tool.iconUrl || favicon : null;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-white font-bold text-white shadow-[var(--shadow-xs)] ring-1 ring-black/[0.06] ${box}`}
      style={src ? undefined : { background: socialAccent(tool.name || tool.url || "") }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          className={tool.iconUrl ? "h-full w-full object-cover" : "h-[70%] w-[70%] object-contain"}
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
  href,
  trailing,
  standalone,
}: {
  label: string;
  icon?: IconComp;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  href?: string;
  trailing?: React.ReactNode;
  /** Outside the sliding indicator: paints its own active surface. */
  standalone?: boolean;
}) {
  const cls = `ui-press group relative z-[1] flex w-full font-medium transition-colors duration-200 ${
    collapsed
      ? "min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] px-0.5 py-1.5 text-[10px] leading-tight"
      : "h-9 flex-row items-center gap-2.5 rounded-[10px] px-2.5 text-[13px]"
  } ${
    active
      ? `text-[var(--foreground)] ${standalone ? "bg-white shadow-[0_0_0_1px_var(--border),var(--shadow-sm)]" : ""}`
      : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--foreground)]"
  }`;
  const inner = (
    <>
      {Icon ? (
        <Icon
          className={`h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 ${
            active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"
          }`}
        />
      ) : null}
      <span className={collapsed ? "line-clamp-2 w-full text-center" : "min-w-0 flex-1 truncate text-left"}>
        {label}
      </span>
      {collapsed ? null : trailing}
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
    <button
      type="button"
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      data-nav-active={active && !standalone ? "true" : undefined}
      onClick={onClick}
      className={cls}
    >
      {inner}
    </button>
  );
}

function GroupLabel({
  children,
  collapsed,
  action,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  action?: React.ReactNode;
}) {
  if (collapsed) {
    return <div className="mx-auto my-2.5 h-px w-7 bg-[var(--border-strong)]/70" aria-hidden />;
  }
  return (
    <div className="flex items-center justify-between px-2.5 pb-1.5 pt-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
        {children}
      </p>
      {action}
    </div>
  );
}

export function Sidebar({
  tools,
  activeToolId,
  userEmail,
  projectName,
  projectId,
  collapsed,
  onToggleCollapsed,
  onSearch,
  onSelectHome,
  onSelectTool,
  onCreateClick,
  onCreateSocialClick,
  onDeleteTool,
  onConfigureIcon,
}: SidebarProps) {
  const apps = tools.find((t) => t.kind === "apps");
  const gallery = tools.find((t) => t.kind === "gallery");
  const linkTools = tools.filter((t) => t.kind === "link");
  const socialTools = tools.filter((t) => t.kind === "social");

  const [menu, setMenu] = useState<MenuState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navInnerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const root = navInnerRef.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[data-nav-active="true"]');
      setIndicator(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [activeToolId, collapsed, tools.length]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function isActive(tool: WorkspaceTool | undefined) {
    if (!tool) return false;
    if (tool.kind === "home") return activeToolId === "home";
    if (tool.kind === "analytics" || tool.kind === "use") {
      return activeToolId === tool.id || activeToolId === "analytics";
    }
    return activeToolId === tool.id;
  }

  function select(tool: WorkspaceTool) {
    if (tool.kind === "home") onSelectHome();
    else onSelectTool(tool);
  }

  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    tools: group.kinds
      .map((kind) => findTool(tools, kind))
      .filter((tool): tool is WorkspaceTool => Boolean(tool && tool.kind !== "gallery")),
  })).filter((g) => g.tools.length > 0);

  // ---------- Mobile (bottom sheet) ----------
  const mobileSections: MobileNavSection[] = [
    ...groups.map((group) => ({
      label: group.label ?? "Principal",
      items: group.tools.map((tool) => {
        const meta = toolMeta(tool.kind);
        return {
          id: tool.id,
          label: meta.label,
          icon: meta.icon,
          active: isActive(tool),
          onClick: () => select(tool),
        };
      }),
    })),
    ...(apps
      ? [
          {
            label: "Accesos",
            items: [
              {
                id: "apps",
                label: "Accesos directos",
                icon: GridIcon,
                active: isActive(apps),
                onClick: () => onSelectTool(apps),
              },
            ],
          },
        ]
      : []),
  ];

  const mobileMenu = (
    <MobileFabMenu
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      title="Zima Admin"
      subtitle={projectName}
      fabLabel="Abrir menú"
      fabClassName="bottom-5 right-4"
      sections={mobileSections}
      footer={
        <div className="space-y-0.5 px-1 pb-1">
          <button
            type="button"
            onClick={() => {
              onCreateClick();
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <PlusIcon className="h-4 w-4" />
            </span>
            Nuevo acceso
          </button>
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--muted)]">
              ←
            </span>
            My Business
          </Link>
          {gallery ? (
            <button
              type="button"
              onClick={() => {
                onSelectTool(gallery);
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--muted)]">
                <GalleryIcon className="h-4 w-4" />
              </span>
              Galería
            </button>
          ) : null}
          <Link
            href={`/projects/${projectId}/settings`}
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--muted)]">
              <SettingsIcon className="h-4 w-4" />
            </span>
            Ajustes
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
                <LogoutIcon className="h-4 w-4" />
              </span>
              Cerrar sesión
            </button>
          </form>
        </div>
      }
    />
  );

  // ---------- Desktop ----------
  const userInitial = (userEmail?.trim()[0] || "U").toUpperCase();
  return (
    <>
      {mobileMenu}
      <aside
        aria-label="Navegación del proyecto"
        className={`ui-shell-rail hidden h-full shrink-0 flex-col border-r border-[var(--border)] transition-[width] duration-300 ease-[var(--ease)] md:flex ${
          collapsed ? "w-[76px]" : "w-[252px]"
        }`}
      >
        {/* Project switcher */}
        <div className={`flex shrink-0 items-center pb-1 pt-3 ${collapsed ? "px-2" : "px-3"}`}>
          <Link
            href="/"
            title="Cambiar de proyecto"
            className={`ui-press group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white hover:shadow-[0_0_0_1px_var(--border),var(--shadow-sm)] ${
              collapsed ? "flex-col justify-center gap-1" : ""
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[image:var(--accent-metal)] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_-2px_rgba(17,17,20,0.4)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-[-6deg] group-hover:scale-105">
              {(projectName.trim()[0] || "Z").toUpperCase()}
            </span>
            {collapsed ? (
              <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-[var(--foreground-soft)]">
                {projectName}
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--foreground)]">
                    {projectName}
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-[var(--muted-soft)]">
                    Zima Admin
                  </span>
                </span>
                <SelectorIcon className="h-4 w-4 shrink-0 text-[var(--muted-soft)] transition group-hover:text-[var(--foreground)]" />
              </>
            )}
          </Link>
        </div>

        {/* Search */}
        <div className={`shrink-0 pb-1 pt-2 ${collapsed ? "px-2" : "px-3"}`}>
          <button
            type="button"
            onClick={onSearch}
            title={collapsed ? "Buscar (⌘K)" : undefined}
            className={`ui-press group flex h-9 w-full items-center rounded-[10px] border border-[var(--border)] bg-white text-[var(--muted-soft)] shadow-[var(--shadow-xs)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)] ${
              collapsed ? "justify-center" : "gap-2 px-2.5 text-[13px]"
            }`}
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            {collapsed ? null : (
              <>
                <span className="flex-1 text-left">Buscar…</span>
                <span className="ui-kbd">⌘K</span>
              </>
            )}
          </button>
        </div>

        {/* Main nav */}
        <nav className={`min-h-0 flex-1 overflow-y-auto pb-3 pt-1 ${collapsed ? "px-2" : "px-3"}`}>
          <div ref={navInnerRef} className="relative">
            <div
              aria-hidden
              className="ui-nav-indicator"
              style={{
                transform: `translateY(${indicator?.top ?? 0}px)`,
                height: indicator?.height ?? 0,
                opacity: indicator ? 1 : 0,
              }}
            />
            {groups.map((group, i) => (
              <div key={group.label ?? `g${i}`} className="space-y-0.5">
                {group.label ? (
                  <GroupLabel collapsed={collapsed}>{group.label}</GroupLabel>
                ) : null}
                {group.tools.map((tool) => {
                  const meta = toolMeta(tool.kind);
                  return (
                    <NavButton
                      key={tool.id}
                      label={meta.label}
                      icon={meta.icon}
                      active={isActive(tool)}
                      collapsed={collapsed}
                      onClick={() => select(tool)}
                    />
                  );
                })}
              </div>
            ))}

            {/* Accesos directos */}
            <div className="space-y-0.5">
              <GroupLabel
                collapsed={collapsed}
                action={
                  <button
                    type="button"
                    onClick={onCreateClick}
                    title="Nuevo acceso"
                    className="rounded-md p-0.5 text-[var(--muted-soft)] transition duration-300 hover:rotate-90 hover:bg-white hover:text-[var(--foreground)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                }
              >
                Accesos
              </GroupLabel>
              {apps ? (
                <NavButton
                  label="Todos los accesos"
                  icon={GridIcon}
                  active={isActive(apps)}
                  collapsed={collapsed}
                  onClick={() => onSelectTool(apps)}
                  trailing={
                    linkTools.length > 0 ? (
                      <span className="rounded-full bg-black/[0.05] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                        {linkTools.length}
                      </span>
                    ) : null
                  }
                />
              ) : null}
              {collapsed
                ? null
                : linkTools.slice(0, 5).map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onSelectTool(tool)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu({ tool, x: e.clientX, y: e.clientY });
                      }}
                      title={hostOf(tool.url) || tool.name}
                      className="ui-press group flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-[var(--muted)] transition hover:bg-black/[0.035] hover:text-[var(--foreground)]"
                    >
                      <ToolAvatar tool={tool} />
                      <span className="min-w-0 flex-1 truncate text-left">{tool.name}</span>
                      <span className="-translate-x-1 text-[11px] text-[var(--muted-soft)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                        ↗
                      </span>
                    </button>
                  ))}
            </div>

            {/* Redes sociales */}
            <div className="space-y-0.5">
              <GroupLabel
                collapsed={collapsed}
                action={
                  <button
                    type="button"
                    onClick={onCreateSocialClick}
                    title="Añadir cuenta social"
                    className="rounded-md p-0.5 text-[var(--muted-soft)] transition duration-300 hover:rotate-90 hover:bg-white hover:text-[var(--foreground)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                }
              >
                Cuentas sociales
              </GroupLabel>
              {socialTools.length === 0 ? (
                collapsed ? (
                  <NavButton
                    label="Añadir cuenta social"
                    icon={PlusIcon}
                    collapsed
                    onClick={onCreateSocialClick}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={onCreateSocialClick}
                    className="ui-press flex h-9 w-full items-center gap-2.5 rounded-[10px] border border-dashed border-[var(--border-strong)] px-2.5 text-[12px] font-medium text-[var(--muted)] transition hover:border-[var(--foreground)] hover:bg-white hover:text-[var(--foreground)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Añadir cuenta
                  </button>
                )
              ) : (
                socialTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    title={collapsed ? tool.name : undefined}
                    onClick={() => onSelectTool(tool)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ tool, x: e.clientX, y: e.clientY });
                    }}
                    className={`ui-press flex w-full items-center font-medium text-[var(--muted)] transition hover:bg-black/[0.035] hover:text-[var(--foreground)] ${
                      collapsed
                        ? "min-h-[52px] flex-col justify-center gap-1 rounded-[10px] px-0.5 py-1.5 text-[10px] leading-tight"
                        : "h-9 flex-row gap-2.5 rounded-[10px] px-2.5 text-[13px]"
                    }`}
                  >
                    <ToolAvatar tool={tool} />
                    <span className={collapsed ? "w-full truncate text-center" : "min-w-0 flex-1 truncate text-left"}>
                      {tool.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className={`shrink-0 space-y-0.5 border-t border-[var(--border)] py-2 ${collapsed ? "px-2" : "px-3"}`}>
          {gallery ? (
            <NavButton
              label="Galería"
              icon={GalleryIcon}
              active={isActive(gallery)}
              collapsed={collapsed}
              standalone
              onClick={() => onSelectTool(gallery)}
            />
          ) : null}
          <NavButton
            label="Ajustes"
            icon={SettingsIcon}
            collapsed={collapsed}
            standalone
            href={`/projects/${projectId}/settings`}
          />
          <div className={`flex items-center gap-1 pt-1.5 ${collapsed ? "flex-col" : ""}`}>
            <form action={signOut} className={collapsed ? "" : "min-w-0 flex-1"}>
              <button
                type="submit"
                title={`${userEmail ?? "Cuenta"} · Cerrar sesión`}
                className={`ui-press group flex w-full items-center gap-2 rounded-[10px] p-1.5 text-left transition hover:bg-black/[0.035] ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6366f1,#ec4899)] text-[11px] font-semibold text-white">
                  {userInitial}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f6f6f8] bg-[var(--success)]" />
                </span>
                {collapsed ? null : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--foreground-soft)]">
                      {userEmail ?? "Cuenta"}
                    </span>
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

      {menu ? (
        <div
          role="menu"
          className="animate-scale-in fixed z-[100] min-w-[200px] origin-top-left overflow-hidden rounded-xl border border-[var(--border)] bg-white/95 p-1 shadow-[var(--shadow-lg)] backdrop-blur-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
            onClick={() => {
              onConfigureIcon(menu.tool);
              setMenu(null);
            }}
          >
            <GridIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Configurar icono
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            onClick={() => {
              onDeleteTool(menu.tool.id);
              setMenu(null);
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {menu.tool.kind === "social" ? "Eliminar cuenta social" : "Eliminar acceso"}
          </button>
        </div>
      ) : null}
    </>
  );
}
