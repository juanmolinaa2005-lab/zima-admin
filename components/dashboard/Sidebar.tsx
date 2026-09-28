"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import type { WorkspaceTool } from "@/lib/types";
import { signOut } from "@/app/auth/actions";
import {
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  MarketingIcon,
  MiAppIcon,
  GalleryIcon,
  PlusIcon,
  RedesIcon,
  SettingsIcon,
  TrashIcon,
  UseIcon,
  UsersIcon,
  ViewTrackerIcon,
} from "./icons";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";

type SidebarProps = {
  tools: WorkspaceTool[];
  activeToolId: string | null;
  userEmail: string | null;
  projectName: string;
  projectId: string;
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

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

const RAIL_ITEM =
  "relative mb-0.5 flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-center transition-colors duration-200";
const RAIL_IDLE =
  "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]";
const RAIL_ACTIVE = "bg-[var(--accent-soft)] text-[var(--accent-ink)]";

function socialAccent(seed: string) {
  const colors = [
    "#635bff",
    "#e11d48",
    "#2563eb",
    "#0d9488",
    "#7c3aed",
    "#db2777",
    "#0891b2",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % colors.length;
  return colors[h]!;
}

function SocialAvatar({ tool }: { tool: WorkspaceTool }) {
  const [broken, setBroken] = useState(false);
  let host = "";
  try {
    host = tool.url ? new URL(tool.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  const favicon = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;
  const letter = (tool.name.trim()[0] || host[0] || "?").toUpperCase();

  if (tool.iconUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tool.iconUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  if (favicon && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={favicon}
        alt=""
        className="h-full w-full object-contain p-1.5"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white"
      style={{ background: socialAccent(tool.name || host) }}
    >
      {letter}
    </span>
  );
}

function RailItem({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: IconComp;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`${RAIL_ITEM} ${active ? RAIL_ACTIVE : RAIL_IDLE}`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute -left-1.5 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--accent)]"
        />
      ) : null}
      <Icon className="h-[18px] w-[18px]" />
      <span className="w-full px-0.5 text-[10px] font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}

export function Sidebar({
  tools,
  activeToolId,
  userEmail,
  projectName,
  projectId,
  onSelectHome,
  onSelectTool,
  onCreateClick,
  onCreateSocialClick,
  onDeleteTool,
  onConfigureIcon,
}: SidebarProps) {
  const home = tools.find((t) => t.kind === "home");
  const miapp = tools.find((t) => t.kind === "miapp");
  const apps = tools.find((t) => t.kind === "apps");
  const clients = tools.find((t) => t.kind === "clients");
  const emails = tools.find((t) => t.kind === "emails");
  const useTool = tools.find((t) => t.kind === "analytics" || t.kind === "use");
  const viewTracker = tools.find((t) => t.kind === "viewtracker");
  const marketing = tools.find((t) => t.kind === "marketing");
  const gallery = tools.find((t) => t.kind === "gallery");
  const redes = tools.find((t) => t.kind === "redes");
  const socialTools = tools.filter((t) => t.kind === "social");

  const [menu, setMenu] = useState<MenuState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const mobileSections: MobileNavSection[] = [
    {
      label: "Main",
      items: [
        ...(miapp
          ? [
              {
                id: "miapp",
                label: "Mi app",
                icon: MiAppIcon,
                active: activeToolId === miapp.id,
                onClick: () => onSelectTool(miapp),
              },
            ]
          : []),
        ...(home
          ? [
              {
                id: "home",
                label: "Overview",
                icon: HomeIcon,
                active: activeToolId === home.id,
                onClick: onSelectHome,
              },
            ]
          : []),
        ...(clients
          ? [
              {
                id: "clients",
                label: "Clients",
                icon: UsersIcon,
                active: activeToolId === clients.id,
                onClick: () => onSelectTool(clients),
              },
            ]
          : []),
      ],
    },
    {
      label: "Tools",
      items: [
        ...(emails
          ? [
              {
                id: "emails",
                label: "Emails",
                icon: MailIcon,
                active: activeToolId === emails.id,
                onClick: () => onSelectTool(emails),
              },
            ]
          : []),
        ...(useTool
          ? [
              {
                id: "analytics",
                label: "Analytics",
                icon: UseIcon,
                active: activeToolId === useTool.id || activeToolId === "analytics",
                onClick: () => onSelectTool(useTool),
              },
            ]
          : []),
        ...(viewTracker
          ? [
              {
                id: "viewtracker",
                label: "ViewTracker",
                icon: ViewTrackerIcon,
                active: activeToolId === viewTracker.id,
                onClick: () => onSelectTool(viewTracker),
              },
            ]
          : []),
        ...(marketing
          ? [
              {
                id: "marketing",
                label: "Creator Studio",
                icon: MarketingIcon,
                active: activeToolId === marketing.id,
                onClick: () => onSelectTool(marketing),
              },
            ]
          : []),
        ...(redes
          ? [
              {
                id: "redes",
                label: "Redes",
                icon: RedesIcon,
                active: activeToolId === redes.id,
                onClick: () => onSelectTool(redes),
              },
            ]
          : []),
      ],
    },
    {
      label: "Manage",
      items: [
        ...(apps
          ? [
              {
                id: "apps",
                label: "Accesos directos",
                icon: GridIcon,
                active: activeToolId === apps.id,
                onClick: () => onSelectTool(apps),
              },
            ]
          : []),
      ],
    },
  ];

  const mobileMenu = (
    <MobileFabMenu
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      title="Zima Admin"
      subtitle={projectName}
      fabLabel="Open menu"
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium hover:bg-[var(--surface-alt)] ${
                activeToolId === gallery.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--foreground-soft)]"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  activeToolId === gallery.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-alt)] text-[var(--muted)]"
                }`}
              >
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
            Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
                <LogoutIcon className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </form>
        </div>
      }
    />
  );

  const collapsedNav = (
    <>
      {miapp ? (
        <RailItem
          label="Mi app"
          active={activeToolId === miapp.id}
          icon={MiAppIcon}
          onClick={() => onSelectTool(miapp)}
        />
      ) : null}
      {home ? (
        <RailItem
          label="Home"
          active={activeToolId === home.id}
          icon={HomeIcon}
          onClick={onSelectHome}
        />
      ) : null}
      {clients ? (
        <RailItem
          label="Clients"
          active={activeToolId === clients.id}
          icon={UsersIcon}
          onClick={() => onSelectTool(clients)}
        />
      ) : null}
      {emails ? (
        <RailItem
          label="Emails"
          active={activeToolId === emails.id}
          icon={MailIcon}
          onClick={() => onSelectTool(emails)}
        />
      ) : null}
      {useTool ? (
        <RailItem
          label="Stats"
          active={activeToolId === useTool.id || activeToolId === "analytics"}
          icon={UseIcon}
          onClick={() => onSelectTool(useTool)}
        />
      ) : null}
      {viewTracker ? (
        <RailItem
          label="Tracker"
          active={activeToolId === viewTracker.id}
          icon={ViewTrackerIcon}
          onClick={() => onSelectTool(viewTracker)}
        />
      ) : null}
      {marketing ? (
        <RailItem
          label="Studio"
          active={activeToolId === marketing.id}
          icon={MarketingIcon}
          onClick={() => onSelectTool(marketing)}
        />
      ) : null}
      {redes ? (
        <RailItem
          label="Redes"
          active={activeToolId === redes.id}
          icon={RedesIcon}
          onClick={() => onSelectTool(redes)}
        />
      ) : null}
      {apps ? (
        <RailItem
          label="Accesos"
          active={activeToolId === apps.id}
          icon={GridIcon}
          onClick={() => onSelectTool(apps)}
        />
      ) : null}
    </>
  );

  return (
    <>
      {mobileMenu}
    <aside className="hidden h-full w-[76px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] md:flex">
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[var(--border)]">
        <Link
          href="/"
          title="Zima Admin"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white shadow-[0_2px_6px_rgba(99,91,255,0.35)]"
        >
          Z
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-1.5">
        <nav aria-label="Herramientas" className="min-h-0 flex-1 overflow-y-auto pb-2 pt-2">{collapsedNav}</nav>
        <div className="shrink-0 space-y-0.5 border-t border-[var(--border)] pb-2 pt-1.5">
          {socialTools.length > 0 ? (
            <div className="flex max-h-[88px] flex-col items-center gap-1 overflow-y-auto px-1 pb-1">
              {socialTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.name}
                  aria-label={tool.name}
                  onClick={() => onSelectTool(tool)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ tool, x: e.clientX, y: e.clientY });
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] transition hover:ring-2 hover:ring-[var(--accent-border)]"
                >
                  <SocialAvatar tool={tool} />
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onCreateSocialClick}
              title="Añadir cuenta"
              className={`${RAIL_ITEM} ${RAIL_IDLE}`}
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium leading-tight">Social</span>
            </button>
          )}
          <Link
            href="/"
            className={`${RAIL_ITEM} ${RAIL_IDLE}`}
          >
            <span aria-hidden className="flex h-[18px] items-center text-[15px] leading-none">←</span>
            <span className="text-[10px] font-medium leading-tight">Inicio</span>
          </Link>
          {gallery ? (
            <RailItem
              label="Galería"
              active={activeToolId === gallery.id}
              icon={GalleryIcon}
              onClick={() => onSelectTool(gallery)}
            />
          ) : null}
          <Link
            href={`/projects/${projectId}/settings`}
            className={`${RAIL_ITEM} ${RAIL_IDLE}`}
          >
            <SettingsIcon className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium leading-tight">Ajustes</span>
          </Link>
          <Link
            href="/"
            className={`${RAIL_ITEM} ${RAIL_IDLE}`}
          >
            <GridIcon className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium leading-tight">My Business</span>
          </Link>
        </div>
      </div>
    </aside>

      {menu ? (
        <div
          role="menu"
          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-lg)]"
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
            Configure icon
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
            {menu.tool.kind === "social" ? "Delete social" : "Eliminar acceso"}
          </button>
        </div>
      ) : null}
    </>
  );
}
