"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import type { WorkspaceTool } from "@/lib/types";
import {
  GalleryIcon,
  GridIcon,
  MailIcon,
  MarketingIcon,
  MiAppIcon,
  PlusIcon,
  RedesIcon,
  UseIcon,
  UsersIcon,
  ViewTrackerIcon,
} from "./icons";

type HomeViewProps = {
  tools: WorkspaceTool[];
  projectId: string;
  projectName: string;
  linkedRef: string | null;
  onCreateClick: () => void;
  onOpenTool: (tool: WorkspaceTool) => void;
};

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

function Sparkline({
  points,
  tone = "accent",
}: {
  points: number[];
  tone?: "accent" | "green" | "orange";
}) {
  const stroke =
    tone === "green" ? "#0e9f6e" : tone === "orange" ? "#e5850b" : "#635bff";
  const w = 120;
  const h = 36;
  const pad = 2;

  if (points.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-9 w-full" aria-hidden>
        <path
          d={`M${pad} ${h - pad} H${w - pad}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const max = Math.max(...points, 1e-9);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const coords = points.map((v, i) => {
    const x =
      points.length === 1
        ? w / 2
        : pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `M${pad},${h - pad} L${line.replace(/ /g, " L")} L${w - pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-9 w-full" aria-hidden>
      <path d={area} fill={stroke} opacity="0.1" />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "accent",
  points = [],
  loading,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: IconComp;
  tone?: "accent" | "green" | "orange";
  points?: number[];
  loading?: boolean;
  onClick?: () => void;
}) {
  const iconBg =
    tone === "green"
      ? "bg-[var(--success-soft)] text-[var(--success)]"
      : tone === "orange"
        ? "bg-[#fff4e5] text-[#c26a00]"
        : "bg-[var(--accent-soft)] text-[var(--accent)]";

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`ui-card flex flex-col p-5 text-left ${
        onClick ? "ui-card-hover cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--foreground)]">
            {loading ? "…" : value}
          </p>
          <p className="mt-2 text-[12px] text-[var(--muted-soft)]">{hint}</p>
        </div>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <Sparkline points={points} tone={tone} />
    </Comp>
  );
}

const TOOL_COLORS: Partial<Record<WorkspaceTool["kind"], string>> = {
  miapp: "#635bff",
  clients: "#0ea5e9",
  emails: "#2563eb",
  use: "#475569",
  analytics: "#475569",
  viewtracker: "#0d9488",
  marketing: "#db2777",
  gallery: "#ea580c",
  redes: "#7c3aed",
};

function toolColor(kind: WorkspaceTool["kind"]): string {
  return TOOL_COLORS[kind] ?? "#635bff";
}

function formatUsdShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n < 1 ? 2 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function OverviewSpendChart({
  days,
}: {
  days: { date: string; costUsd: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (days.length === 0) return null;

  const w = 560;
  const h = 140;
  const pad = 8;
  const max = Math.max(...days.map((d) => d.costUsd), 1e-9);
  const coords = days.map((d, i) => {
    const x =
      days.length === 1
        ? w / 2
        : pad + (i / (days.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.costUsd / max) * (h - pad * 2);
    return { x, y, ...d };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `M${pad},${h - pad} L${line.replace(/ /g, " L")} L${w - pad},${h - pad} Z`;
  const active = hover != null ? coords[hover] : null;
  const total = days.reduce((s, d) => s + d.costUsd, 0);

  return (
    <section className="ui-card mt-5 p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
            OpenAI spend
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">Last 7 days</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-semibold tabular-nums text-[var(--accent)]">
            {active
              ? formatUsdShort(active.costUsd)
              : formatUsdShort(total)}
          </p>
          <p className="text-[11px] text-[var(--muted-soft)]">
            {active
              ? new Date(active.date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "Period total · hover for day"}
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[140px] w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="homeSpendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#homeSpendFill)" />
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
        {coords.map((c, i) => (
          <circle
            key={c.date}
            cx={c.x}
            cy={c.y}
            r={hover === i ? 5 : 3}
            fill={hover === i ? "var(--accent)" : "#fff"}
            stroke="var(--accent)"
            strokeWidth="2"
            className="cursor-pointer"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </section>
  );
}

export function HomeView({
  tools,
  projectId,
  projectName,
  linkedRef,
  onCreateClick,
  onOpenTool,
}: HomeViewProps) {
  const miapp = tools.find((t) => t.kind === "miapp");
  const clients = tools.find((t) => t.kind === "clients");
  const emails = tools.find((t) => t.kind === "emails");
  const useTool = tools.find((t) => t.kind === "analytics" || t.kind === "use");
  const viewTracker = tools.find((t) => t.kind === "viewtracker");
  const marketing = tools.find((t) => t.kind === "marketing");
  const gallery = tools.find((t) => t.kind === "gallery");
  const redes = tools.find((t) => t.kind === "redes");
  const appsTool = tools.find((t) => t.kind === "apps");
  const customTools = tools.filter((t) => t.kind === "link");

  const [loadingStats, setLoadingStats] = useState(true);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [clientsHint, setClientsHint] = useState("Auth users");
  const [mailCount, setMailCount] = useState<number | null>(null);
  const [openaiCost, setOpenaiCost] = useState<number | null>(null);
  const [openaiConnected, setOpenaiConnected] = useState(false);
  const [spendDays, setSpendDays] = useState<
    { date: string; costUsd: number }[]
  >([]);

  const quickTools = [
    miapp,
    clients,
    emails,
    useTool,
    viewTracker,
    marketing,
    gallery,
    redes,
  ].filter(Boolean) as WorkspaceTool[];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingStats(true);
      try {
        const [mailRes, openaiSettingsRes, clientsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/mail/accounts`),
          fetch("/api/openai/settings"),
          linkedRef
            ? fetch(`/api/projects/${projectId}/clients`)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (mailRes.ok) {
          const mailData = await mailRes.json();
          const list = (mailData.accounts ?? []) as unknown[];
          setMailCount(list.length);
        } else {
          setMailCount(0);
        }

        if (openaiSettingsRes.ok) {
          const st = await openaiSettingsRes.json();
          setOpenaiConnected(Boolean(st.connected));
          if (st.connected) {
            const usageRes = await fetch("/api/openai/usage?days=7");
            if (usageRes.ok) {
              const usage = await usageRes.json();
              const report = usage.report as {
                totals?: { costUsd?: number };
                byDay?: { date: string; costUsd: number }[];
              };
              setOpenaiCost(report.totals?.costUsd ?? 0);
              setSpendDays(report.byDay ?? []);
            } else {
              setOpenaiCost(null);
              setSpendDays([]);
            }
          } else {
            setOpenaiCost(null);
            setSpendDays([]);
          }
        }

        if (!linkedRef) {
          setClientsCount(null);
          setClientsHint("Link Supabase in Clients");
        } else if (clientsRes) {
          const data = await clientsRes.json();
          if (clientsRes.ok && Array.isArray(data.users)) {
            setClientsCount(data.users.length);
            setClientsHint("Auth users");
          } else if (data.error === "NOT_CONNECTED") {
            setClientsCount(null);
            setClientsHint("Connect Supabase");
          } else {
            setClientsCount(null);
            setClientsHint(data.message || data.error || "Unavailable");
          }
        }
      } catch {
        if (!cancelled) {
          setMailCount(null);
          setOpenaiCost(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, linkedRef]);

  function toolIcon(kind: WorkspaceTool["kind"]): IconComp {
    if (kind === "miapp") return MiAppIcon;
    if (kind === "clients") return UsersIcon;
    if (kind === "emails") return MailIcon;
    if (kind === "use" || kind === "analytics") return UseIcon;
    if (kind === "viewtracker") return ViewTrackerIcon;
    if (kind === "marketing") return MarketingIcon;
    if (kind === "gallery") return GalleryIcon;
    if (kind === "redes") return RedesIcon;
    return GridIcon;
  }

  const spendPoints = spendDays.map((d) => d.costUsd);
  const mailPoints =
    mailCount != null && mailCount > 0
      ? Array.from({ length: 7 }, (_, i) =>
          i < mailCount ? Math.min(i + 1, mailCount) : mailCount
        )
      : [];
  const clientsPoints =
    clientsCount != null && clientsCount > 0
      ? Array.from({ length: 7 }, (_, i) =>
          Math.round((clientsCount * (i + 1)) / 7)
        )
      : [];
  const appsPoints =
    customTools.length > 0
      ? Array.from({ length: Math.min(7, customTools.length + 2) }, (_, i) =>
          Math.min(i + 1, customTools.length)
        )
      : [];

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-7">
        {/* Page head */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="ui-kicker">Overview</p>
            <h2 className="ui-title mt-1.5 truncate">{projectName}</h2>
            <p className="ui-lead mt-1">
              {customTools.length} accesos · todo tu proyecto de un vistazo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {appsTool ? (
              <button
                type="button"
                onClick={() => onOpenTool(appsTool)}
                className="ui-btn-secondary"
              >
                <GridIcon className="h-3.5 w-3.5" />
                Accesos
              </button>
            ) : null}
            {clients ? (
              <button
                type="button"
                onClick={() => onOpenTool(clients)}
                className="ui-btn-secondary"
              >
                <UsersIcon className="h-3.5 w-3.5" />
                Clients
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCreateClick}
              className="ui-btn-primary"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Nuevo acceso
            </button>
          </div>
        </div>

        {/* Quick tools */}
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
          {quickTools.map((tool) => {
            const Icon = toolIcon(tool.kind);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onOpenTool(tool)}
                className="ui-card ui-card-hover group flex items-center gap-3 p-3 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  style={{ background: toolColor(tool.kind) }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
                    {tool.name}
                  </span>
                  <span className="block whitespace-nowrap text-[11px] text-[var(--muted-soft)] transition group-hover:text-[var(--accent)]">
                    Abrir →
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-left text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)]">
              <PlusIcon className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold">Nuevo acceso</span>
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Clients"
            value={
              clientsCount != null ? clientsCount.toLocaleString("en-US") : "—"
            }
            hint={clientsHint}
            icon={UsersIcon}
            points={clientsPoints}
            loading={loadingStats}
            onClick={clients ? () => onOpenTool(clients) : undefined}
          />
          <MetricCard
            title="Emails"
            value={mailCount != null ? String(mailCount) : "—"}
            hint="Connected accounts"
            icon={MailIcon}
            tone="orange"
            points={mailPoints}
            loading={loadingStats}
            onClick={emails ? () => onOpenTool(emails) : undefined}
          />
          <MetricCard
            title="Analytics"
            value={
              openaiConnected && openaiCost != null
                ? formatUsdShort(openaiCost)
                : openaiConnected
                  ? "—"
                  : "—"
            }
            hint={
              openaiConnected
                ? "OpenAI · last 7 days"
                : "Connect key in Analytics"
            }
            icon={UseIcon}
            tone="green"
            points={spendPoints}
            loading={loadingStats}
            onClick={useTool ? () => onOpenTool(useTool) : undefined}
          />
          <MetricCard
            title="Accesos directos"
            value={String(customTools.length)}
            hint="Se abren en otra pestaña"
            icon={GridIcon}
            points={appsPoints}
            onClick={appsTool ? () => onOpenTool(appsTool) : onCreateClick}
          />
        </div>

        {spendDays.length > 0 ? (
          <OverviewSpendChart days={spendDays} />
        ) : null}
      </div>
    </div>
  );
}
