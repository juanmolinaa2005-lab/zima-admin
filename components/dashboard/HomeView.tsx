"use client";

import { useEffect, useState } from "react";
import type { WorkspaceTool } from "@/lib/types";
import {
  ArrowRightIcon,
  CheckIcon,
  GridIcon,
  MailIcon,
  PlusIcon,
  UseIcon,
  UsersIcon,
} from "./icons";
import { NAV_GROUPS, findTool, hostOf, toolMeta, type IconComp } from "./nav";
import { ToolAvatar } from "./Sidebar";
import { currentStage, nextTasks, visibleTasks, type LaunchState } from "@/lib/launch/playbook";

function NextStepsCard({ projectId, onOpen }: { projectId: string; onOpen?: () => void }) {
  const [state, setState] = useState<Pick<LaunchState, "profile" | "tasks"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/launch`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setState(data as LaunchState);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!state) return <div className="ui-skeleton mt-4 h-[148px] rounded-2xl" />;

  const tasks = visibleTasks(state.profile.product_type);
  const done = tasks.filter((t) => state.tasks[t.id]).length;
  const stage = currentStage(state);
  const upcoming = nextTasks(state, 3);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <section className="ui-card ui-enter mt-4 overflow-hidden [animation-delay:60ms]">
      <div className="grid gap-0 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] bg-[linear-gradient(135deg,#eef0ff,#fff_75%)] px-5 py-5 md:border-b-0 md:border-r">
          <div>
            <p className="text-[12px] font-semibold text-[#4338ca]">¿Qué sigue?</p>
            <p className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
              {state.profile.product_type ? `Etapa: ${stage.label}` : "Ya creaste tu producto"}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
              {state.profile.product_type ? stage.goal : "Te guiamos desde el lanzamiento hasta los primeros clientes de pago."}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>{done} de {tasks.length} pasos</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#6366f1] transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Próximos pasos</p>
            {onOpen ? (
              <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4338ca] hover:underline">
                {state.profile.product_type ? "Ver ruta completa" : "Empezar"}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {upcoming.map((task, i) => (
              <li key={task.id}>
                <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 py-2.5 text-left">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[11px] font-semibold text-[var(--muted)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[var(--foreground)]">{task.title}</span>
                    <span className="block truncate text-[12px] text-[var(--muted)]">{task.why}</span>
                  </span>
                </button>
              </li>
            ))}
            {upcoming.length === 0 ? (
              <li className="flex items-center gap-2 py-3 text-[13px] text-[var(--foreground-soft)]">
                <CheckIcon className="h-4 w-4 text-[var(--success)]" />
                Ruta completada. Sigue registrando tus métricas cada semana.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}

type HomeViewProps = {
  tools: WorkspaceTool[];
  projectId: string;
  projectName: string;
  linkedRef: string | null;
  onCreateClick: () => void;
  onOpenTool: (tool: WorkspaceTool) => void;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ---------- Spend chart (real OpenAI usage) ---------- */

function SpendChart({ days }: { days: { date: string; costUsd: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 200;
  const padX = 8;
  const padY = 16;
  const max = Math.max(...days.map((d) => d.costUsd), 1e-9);
  const coords = days.map((d, i) => {
    const x =
      days.length === 1 ? w / 2 : padX + (i / (days.length - 1)) * (w - padX * 2);
    const y = h - padY - (d.costUsd / max) * (h - padY * 2);
    return { x, y, ...d };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `M${padX},${h - padY} L${line.replace(/ /g, " L")} L${w - padX},${h - padY} Z`;
  const active = hover != null ? coords[hover] : null;
  const total = days.reduce((sum, d) => sum + d.costUsd, 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[32px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-[var(--foreground)]">
            {formatUsd(active ? active.costUsd : total)}
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--muted-soft)]">
            {active
              ? new Date(active.date + "T12:00:00").toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
              : "Total de los últimos 7 días"}
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="ui-reveal mt-4 h-[200px] w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Gasto diario de OpenAI"
      >
        <defs>
          <linearGradient id="homeSpendFill2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="homeSpendStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={w}
            y1={padY + f * (h - padY * 2)}
            y2={padY + f * (h - padY * 2)}
            stroke="#ececf0"
            strokeDasharray="3 4"
          />
        ))}
        <path d={area} fill="url(#homeSpendFill2)" />
        <polyline
          fill="none"
          stroke="url(#homeSpendStroke)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
          vectorEffect="non-scaling-stroke"
        />
        {coords.map((c, i) => (
          <g key={c.date}>
            <rect
              x={c.x - w / Math.max(days.length, 1) / 2}
              y={0}
              width={w / Math.max(days.length, 1)}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i ? (
              <>
                <line x1={c.x} x2={c.x} y1={padY} y2={h - padY} stroke="#d4d4d8" strokeDasharray="2 3" />
                <circle cx={c.x} cy={c.y} r={4.5} fill="#fff" stroke="#a855f7" strokeWidth="2" />
              </>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--muted-soft)]">
        {days.map((d, i) =>
          i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2) ? (
            <span key={d.date}>
              {new Date(d.date + "T12:00:00").toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

/* ---------- Small building blocks ---------- */

function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-card flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12px] text-[var(--muted-soft)]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  );
}

function useCountUp(target: number | null, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  format = (n) => Math.round(n).toLocaleString("es-ES"),
  hint,
  loading,
  tint,
  onClick,
}: {
  icon: IconComp;
  label: string;
  value: number | null;
  format?: (n: number) => string;
  hint: string;
  loading?: boolean;
  tint: string;
  onClick?: () => void;
}) {
  const animated = useCountUp(loading ? null : value);
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="ui-card ui-card-hover group relative overflow-hidden p-4 text-left"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: tint }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-[var(--muted)]">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 group-hover:rotate-[-4deg]"
          style={{ background: tint }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="relative mt-3 text-[28px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-[var(--foreground)]">
        {loading ? (
          <span className="ui-skeleton inline-block h-7 w-16 rounded-md align-middle" />
        ) : value == null ? (
          "—"
        ) : (
          format(animated)
        )}
      </div>
      <div className="relative mt-2 flex items-center gap-1 text-[12px] text-[var(--muted-soft)]">
        <span className="min-w-0 flex-1 truncate">{hint}</span>
        {onClick ? (
          <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
        ) : null}
      </div>
    </Comp>
  );
}

type SetupStep = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  onClick?: () => void;
};

/* ---------- Home ---------- */

export function HomeView({
  tools,
  projectId,
  projectName,
  linkedRef,
  onCreateClick,
  onOpenTool,
}: HomeViewProps) {
  const clients = tools.find((t) => t.kind === "clients");
  const emails = tools.find((t) => t.kind === "emails");
  const useTool = tools.find((t) => t.kind === "analytics" || t.kind === "use");
  const appsTool = tools.find((t) => t.kind === "apps");
  const launchTool = tools.find((t) => t.kind === "launch");
  const customTools = tools.filter((t) => t.kind === "link");

  const [loadingStats, setLoadingStats] = useState(true);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [clientsHint, setClientsHint] = useState("Usuarios Auth");
  const [mailCount, setMailCount] = useState<number | null>(null);
  const [openaiCost, setOpenaiCost] = useState<number | null>(null);
  const [openaiConnected, setOpenaiConnected] = useState(false);
  const [spendDays, setSpendDays] = useState<
    { date: string; costUsd: number }[]
  >([]);

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
          setClientsHint("Vincula Supabase en Clients");
        } else if (clientsRes) {
          const data = await clientsRes.json();
          if (clientsRes.ok && Array.isArray(data.users)) {
            setClientsCount(data.users.length);
            setClientsHint("Usuarios Auth");
          } else if (data.error === "NOT_CONNECTED") {
            setClientsCount(null);
            setClientsHint("Conecta Supabase");
          } else {
            setClientsCount(null);
            setClientsHint(data.message || data.error || "No disponible");
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

  const toolGroups = NAV_GROUPS.filter((g) => g.label)
    .map((g) => ({
      label: g.label as string,
      tools: g.kinds.map((k) => findTool(tools, k)).filter(Boolean) as WorkspaceTool[],
    }))
    .filter((g) => g.tools.length > 0);

  const steps: SetupStep[] = [
    {
      id: "supabase",
      label: "Vincula tu proyecto de Supabase",
      hint: "Para ver tus clientes (usuarios Auth).",
      done: Boolean(linkedRef),
      onClick: clients ? () => onOpenTool(clients) : undefined,
    },
    {
      id: "email",
      label: "Conecta una cuenta de correo",
      hint: "Lee y responde desde Emails.",
      done: (mailCount ?? 0) > 0,
      onClick: emails ? () => onOpenTool(emails) : undefined,
    },
    {
      id: "openai",
      label: "Añade tu clave de OpenAI",
      hint: "Para ver el gasto y usar Studio.",
      done: openaiConnected,
      onClick: useTool ? () => onOpenTool(useTool) : undefined,
    },
    {
      id: "access",
      label: "Crea tu primer acceso directo",
      hint: "Enlaces a las herramientas que usas a diario.",
      done: customTools.length > 0,
      onClick: onCreateClick,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8 sm:py-8">
        {/* Hero */}
        <section className="ui-hero ui-enter px-6 py-7 sm:px-8 sm:py-8">
          <div className="relative z-[1] flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[12px] text-white/70 backdrop-blur first-letter:uppercase">
                <span className="ui-live-dot" />
                <span suppressHydrationWarning className="first-letter:uppercase">{todayLabel()}</span>
              </p>
              <h2 className="mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[36px]">
                <span suppressHydrationWarning>{greeting()}</span>,{" "}
                <span className="bg-[linear-gradient(90deg,#c7d2fe,#f0abfc,#fcd34d)] bg-clip-text text-transparent">
                  {projectName}
                </span>
              </h2>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/60">
                Todo tu proyecto de un vistazo. Pulsa{" "}
                <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">⌘K</span>{" "}
                para saltar a cualquier herramienta.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {appsTool ? (
                <button
                  type="button"
                  onClick={() => onOpenTool(appsTool)}
                  className="ui-press inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.07] px-3.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/[0.14]"
                >
                  <GridIcon className="h-3.5 w-3.5" />
                  Accesos
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCreateClick}
                className="ui-press inline-flex h-9 items-center gap-2 rounded-[10px] bg-white px-3.5 text-[13px] font-semibold text-[#111114] shadow-[0_6px_20px_-6px_rgba(255,255,255,0.5)] transition hover:bg-white/90"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Nuevo acceso
              </button>
            </div>
          </div>
        </section>

        <NextStepsCard projectId={projectId} onOpen={launchTool ? () => onOpenTool(launchTool) : undefined} />

        {/* KPIs */}
        <div className="ui-stagger mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={UsersIcon}
            label="Clients"
            value={clientsCount}
            hint={clientsHint}
            loading={loadingStats}
            tint="linear-gradient(135deg,#38bdf8,#6366f1)"
            onClick={clients ? () => onOpenTool(clients) : undefined}
          />
          <StatCard
            icon={MailIcon}
            label="Emails"
            value={mailCount}
            hint="Cuentas conectadas"
            loading={loadingStats}
            tint="linear-gradient(135deg,#60a5fa,#2563eb)"
            onClick={emails ? () => onOpenTool(emails) : undefined}
          />
          <StatCard
            icon={UseIcon}
            label="OpenAI · 7 días"
            value={openaiConnected ? openaiCost : null}
            format={formatUsd}
            hint={openaiConnected ? "Gasto del periodo" : "Sin conectar"}
            loading={loadingStats}
            tint="linear-gradient(135deg,#a855f7,#ec4899)"
            onClick={useTool ? () => onOpenTool(useTool) : undefined}
          />
          <StatCard
            icon={GridIcon}
            label="Accesos directos"
            value={customTools.length}
            hint="Se abren en otra pestaña"
            tint="linear-gradient(135deg,#fbbf24,#f97316)"
            onClick={appsTool ? () => onOpenTool(appsTool) : onCreateClick}
          />
        </div>

        {/* Row 1: chart */}
        <div className="ui-enter mt-4 [animation-delay:120ms]">
          <Panel
            title="Gasto en OpenAI"
            description="Uso diario de la API"
            action={
              useTool ? (
                <button
                  type="button"
                  onClick={() => onOpenTool(useTool)}
                  className="group inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                >
                  Ver Stats <ArrowRightIcon className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </button>
              ) : null
            }
          >
            {loadingStats ? (
              <div className="ui-skeleton h-[260px] rounded-xl" />
            ) : spendDays.length > 0 ? (
              <SpendChart days={spendDays} />
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.07),transparent_60%)] px-6 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#a855f7,#ec4899)] text-white shadow-[0_8px_20px_-6px_rgba(168,85,247,0.6)]">
                  <UseIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">
                  {openaiConnected ? "Sin gasto en los últimos 7 días" : "Aún no hay datos de gasto"}
                </p>
                <p className="mt-1 max-w-sm text-[13px] text-[var(--muted)]">
                  {openaiConnected
                    ? "Cuando uses la API, verás aquí la evolución diaria."
                    : "Conecta tu clave de OpenAI en Stats para ver el gasto diario aquí."}
                </p>
                {!openaiConnected && useTool ? (
                  <button type="button" onClick={() => onOpenTool(useTool)} className="ui-btn-primary mt-4">
                    Conectar OpenAI
                  </button>
                ) : null}
              </div>
            )}
          </Panel>
        </div>

        {/* Row 2: setup + shortcuts */}
        <div className="ui-stagger mt-4 grid gap-4 lg:grid-cols-3">
          {!allDone && !loadingStats ? (
            <Panel
              className="lg:col-span-2"
              title="Primeros pasos"
              description={`${doneCount} de ${steps.length} completados`}
              action={
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#ec4899)] transition-all duration-700 ease-[var(--ease)]"
                    style={{ width: `${(doneCount / steps.length) * 100}%` }}
                  />
                </div>
              }
            >
              <ol className="grid gap-2 sm:grid-cols-2">
                {steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={step.done ? undefined : step.onClick}
                      disabled={step.done}
                      className={`ui-press flex w-full items-start gap-3 rounded-xl border p-3 text-left transition duration-300 ${
                        step.done
                          ? "border-transparent bg-[var(--background)]"
                          : "border-[var(--border)] bg-white hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          step.done
                            ? "bg-[var(--success)] text-white"
                            : "border-[1.5px] border-[var(--border-strong)] bg-white"
                        }`}
                      >
                        {step.done ? <CheckIcon className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-semibold ${
                            step.done ? "text-[var(--muted-soft)] line-through" : "text-[var(--foreground)]"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[var(--muted-soft)]">{step.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}

          <Panel
            className={!allDone && !loadingStats ? "" : "lg:col-span-3"}
            title="Accesos directos"
            description="Tus herramientas externas"
            action={
              <button
                type="button"
                onClick={onCreateClick}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--accent)]"
                aria-label="Nuevo acceso"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            }
          >
            {customTools.length === 0 ? (
              <button
                type="button"
                onClick={onCreateClick}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-8 text-center text-[13px] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <PlusIcon className="mb-2 h-5 w-5" />
                Añade tu primer acceso
              </button>
            ) : (
              <ul className={`ui-stagger grid gap-1 ${!allDone && !loadingStats ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                {customTools.slice(0, 8).map((tool) => (
                  <li key={tool.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTool(tool)}
                      className="ui-press group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--surface-alt)]"
                    >
                      <ToolAvatar tool={tool} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
                          {tool.name}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                          {hostOf(tool.url)}
                        </span>
                      </span>
                      <span className="-translate-x-1 text-[12px] text-[var(--muted-soft)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                        ↗
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {customTools.length > 8 && appsTool ? (
              <button
                type="button"
                onClick={() => onOpenTool(appsTool)}
                className="mt-2 text-[12px] font-semibold text-[var(--accent)]"
              >
                Ver los {customTools.length} accesos →
              </button>
            ) : null}
          </Panel>
        </div>

        {/* Row 3: tools by group */}
        <div className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">Herramientas</h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            {toolGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                  {group.label}
                </p>
                <div className="ui-stagger grid gap-2.5 sm:grid-cols-2">
                  {group.tools.map((tool) => {
                    const meta = toolMeta(tool.kind);
                    const Icon = meta.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => onOpenTool(tool)}
                        className="ui-card ui-card-hover group flex items-center gap-3 p-3.5 text-left"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_14px_-6px_rgba(17,17,20,0.4)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 group-hover:rotate-[-5deg]"
                          style={{ background: meta.color }}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-[var(--foreground)]">
                            {meta.label}
                          </span>
                          <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                            {meta.description}
                          </span>
                        </span>
                        <ArrowRightIcon className="h-4 w-4 shrink-0 text-[var(--muted-soft)] transition duration-300 group-hover:translate-x-1 group-hover:text-[var(--foreground)]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
