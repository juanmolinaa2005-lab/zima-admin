"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CHANNELS,
  CHANNEL_STATUS_LABEL,
  appliesTo,
  nextTasks,
  visibleTasks,
  type ChannelState,
  type ChannelStatus,
  type LaunchPageId,
  type LaunchProfile,
  type LaunchState,
  type LaunchTask,
  type MetricWeek,
  type ProductType,
  type TaskLink,
} from "@/lib/launch/playbook";
import type { ToolKind } from "@/lib/types";
import { Svg, type IconComp } from "./market/shared";

const ACCENT = "#6366f1";

const PAGES = new Set<LaunchPageId>(["roadmap", "channels", "metrics", "pricing"]);

function pageFrom(raw: string | null): LaunchPageId {
  return raw && PAGES.has(raw as LaunchPageId) ? (raw as LaunchPageId) : "roadmap";
}

export type OpenTarget = { kind: ToolKind; section?: string };

const IconCheck: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
const IconChevron: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const IconExternal: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-soft)] focus:border-black/25";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function money(n: number | null | undefined, digits = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

function num(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES").format(n);
}

function mondayOf(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function shortDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/* ---------------- ruta ---------------- */

const TYPES: { value: ProductType; label: string }[] = [
  { value: "app", label: "App" },
  { value: "web", label: "Web" },
  { value: "both", label: "Ambos" },
];

function TypePicker({ value, onChange }: { value: ProductType | null; onChange: (v: ProductType) => void }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-white p-0.5">
      {TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          aria-pressed={value === t.value}
          className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
            value === t.value ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TaskRow({ task, done, onToggle, onLink }: { task: LaunchTask; done: boolean; onToggle: () => void; onLink: (link: TaskLink) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Marcar “${task.title}” como pendiente` : `Marcar “${task.title}” como hecha`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            done ? "border-transparent text-white" : "border-[var(--border-strong)] bg-white hover:border-[var(--foreground)]"
          }`}
          style={done ? { background: ACCENT } : undefined}
        >
          {done ? <IconCheck className="h-3 w-3" /> : null}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`min-w-0 flex-1 truncate text-[14px] ${done ? "text-[var(--muted-soft)] line-through" : "text-[var(--foreground)]"}`}>{task.title}</span>
          <IconChevron className={`h-4 w-4 shrink-0 text-[var(--muted-soft)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div className="pb-4 pl-8">
          <p className="text-[13px] text-[var(--muted)]">{task.why}</p>
          <ul className="mt-2 space-y-1">
            {task.how.map((line) => (
              <li key={line} className="flex gap-2 text-[13px] text-[var(--foreground-soft)]">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--muted-soft)]" />
                {line}
              </li>
            ))}
          </ul>
          {task.link ? (
            <button type="button" onClick={() => onLink(task.link!)} className="mt-3 text-[13px] font-medium underline-offset-4 hover:underline" style={{ color: ACCENT }}>
              {task.link.label} →
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function RoadmapPage({
  state,
  onSaveProfile,
  onToggleTask,
  onLink,
}: {
  state: LaunchState;
  onSaveProfile: (p: LaunchProfile) => Promise<void>;
  onToggleTask: (id: string, done: boolean) => void;
  onLink: (link: TaskLink) => void;
}) {
  const tasks = visibleTasks(state.profile.product_type);
  const done = tasks.filter((t) => state.tasks[t.id]).length;
  const next = nextTasks(state, 1)[0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] tabular-nums text-[var(--muted)]">
          {done} de {tasks.length}
        </p>
        <TypePicker value={state.profile.product_type} onChange={(v) => onSaveProfile({ ...state.profile, product_type: v })} />
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`, background: ACCENT }} />
      </div>

      {next ? (
        <div className="mt-8">
          <p className="text-[12px] font-medium text-[var(--muted)]">Siguiente</p>
          <p className="mt-1 text-[22px] font-semibold leading-snug tracking-tight text-[var(--foreground)]">{next.title}</p>
          <p className="mt-1 text-[14px] text-[var(--muted)]">{next.why}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {next.link ? (
              <button type="button" className="ui-btn-primary" onClick={() => onLink(next.link!)}>
                {next.link.label}
              </button>
            ) : null}
            <button type="button" className="ui-btn-secondary" onClick={() => onToggleTask(next.id, true)}>
              Hecho
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">Todo listo. Repite lo que funciona.</p>
      )}

      <ul className="mt-10 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} done={Boolean(state.tasks[task.id])} onToggle={() => onToggleTask(task.id, !state.tasks[task.id])} onLink={onLink} />
        ))}
      </ul>
    </div>
  );
}

/* ---------------- canales ---------------- */

const STATUS_ORDER: ChannelStatus[] = ["todo", "planned", "launched", "skipped"];

function ChannelsPage({ state, onSave }: { state: LaunchState; onSave: (id: string, s: ChannelState) => Promise<void> }) {
  const list = CHANNELS.filter((c) => appliesTo(c.applies, state.profile.product_type));

  return (
    <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
      {list.map((channel) => {
        const current: ChannelState = state.channels[channel.id] ?? { status: "todo", planned_for: null, url: null, result: null };
        return (
          <li key={channel.id} className="flex items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <a href={channel.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--foreground)] hover:underline">
                {channel.name}
                <IconExternal className="h-3 w-3 text-[var(--muted-soft)]" />
              </a>
              <p className="mt-0.5 text-[13px] text-[var(--muted)]">{channel.tip}</p>
            </div>
            <select
              value={current.status}
              onChange={(e) => onSave(channel.id, { ...current, status: e.target.value as ChannelStatus })}
              aria-label={`Estado de ${channel.name}`}
              className={`h-8 shrink-0 rounded-full border border-[var(--border)] bg-white px-3 text-[12px] font-medium outline-none ${
                current.status === "launched" ? "text-[#0e7a55]" : current.status === "skipped" ? "text-[var(--muted-soft)]" : "text-[var(--foreground)]"
              }`}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{CHANNEL_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- métricas ---------------- */

type MetricKey = "mrr" | "paying" | "active_users" | "signups" | "visitors";
const METRIC_LABEL: Record<MetricKey, string> = {
  mrr: "MRR",
  paying: "Clientes",
  active_users: "Activos",
  signups: "Registros",
  visitors: "Visitas",
};
const METRIC_KEYS = Object.keys(METRIC_LABEL) as MetricKey[];

function LineChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) {
    return <div className="flex h-[180px] items-center justify-center text-[13px] text-[var(--muted-soft)]">Registra dos semanas para ver la tendencia.</div>;
  }
  const w = 640;
  const h = 180;
  const pad = 12;
  const max = Math.max(...points.map((p) => p.value), 1);
  const line = points
    .map((p, i) => `${pad + (i / (points.length - 1)) * (w - pad * 2)},${h - pad - (p.value / max) * (h - pad * 2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[180px] w-full" aria-hidden>
      <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricsPage({ state, onSave }: { state: LaunchState; onSave: (m: MetricWeek) => Promise<void> }) {
  const metrics = state.metrics;
  const thisWeek = mondayOf();
  const empty: MetricWeek = { week_start: thisWeek, visitors: null, signups: null, active_users: null, paying: null, mrr: null };
  const [draft, setDraft] = useState<MetricWeek>(metrics.find((m) => m.week_start === thisWeek) ?? empty);
  const [key, setKey] = useState<MetricKey>("mrr");
  const [saving, setSaving] = useState(false);
  const last = metrics[metrics.length - 1];

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const points = metrics.filter((m) => m[key] != null).map((m) => ({ label: shortDay(m.week_start), value: Number(m[key]) }));

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
        {METRIC_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setKey(k)} className="text-left">
            <p className={`text-[12px] font-medium ${key === k ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{METRIC_LABEL[k]}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{k === "mrr" ? money(last?.mrr) : num(last?.[k])}</p>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <LineChart points={points} />
      </div>

      <div className="mt-8 border-t border-[var(--border)] pt-6">
        <p className="text-[13px] font-medium text-[var(--foreground)]">Semana del {shortDay(draft.week_start)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {METRIC_KEYS.map((k) => (
            <Field key={k} label={METRIC_LABEL[k]}>
              <input
                type="number"
                min={0}
                step={k === "mrr" ? "0.01" : "1"}
                className={inputCls}
                value={draft[k] ?? ""}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>
        <button type="button" className="ui-btn-primary mt-4" disabled={saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- precios ---------------- */

const FEE_PRESETS = [
  { id: "store-small", label: "App Store / Play · 15%", pct: 15, fixed: 0 },
  { id: "store", label: "App Store / Play · 30%", pct: 30, fixed: 0 },
  { id: "stripe", label: "Stripe · 2,9% + $0,30", pct: 2.9, fixed: 0.3 },
  { id: "mor", label: "Lemon Squeezy / Paddle · 5% + $0,50", pct: 5, fixed: 0.5 },
];

function PricingPage({ goalMrr, productType }: { goalMrr: number | null; productType: ProductType | null }) {
  const [price, setPrice] = useState(9.99);
  const [fee, setFee] = useState(productType === "web" ? "stripe" : "store-small");
  const [fixedCosts, setFixedCosts] = useState(50);
  const [goal, setGoal] = useState(goalMrr ?? 1000);

  const preset = FEE_PRESETS.find((f) => f.id === fee) ?? FEE_PRESETS[0];
  const net = price * (1 - preset.pct / 100) - preset.fixed;
  const breakEven = net > 0 ? Math.ceil(fixedCosts / net) : null;
  const forGoal = net > 0 ? Math.ceil(goal / net) : null;

  const numInput = (value: number, set: (n: number) => void, step = "1") => (
    <input type="number" min={0} step={step} className={inputCls} value={Number.isFinite(value) ? value : ""} onChange={(e) => set(Number(e.target.value))} />
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Precio al mes (USD)">{numInput(price, setPrice, "0.01")}</Field>
        <Field label="Comisión">
          <select className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)}>
            {FEE_PRESETS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Costes fijos al mes">{numInput(fixedCosts, setFixedCosts)}</Field>
        <Field label="Meta de ingresos al mes">{numInput(goal, setGoal)}</Field>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[
          { label: "Te queda por cliente", value: money(net, 2) },
          { label: "Clientes para cubrir costes", value: breakEven == null ? "∞" : num(breakEven) },
          { label: `Clientes para ${money(goal)}`, value: forGoal == null ? "∞" : num(forGoal) },
        ].map((m) => (
          <div key={m.label}>
            <p className="text-[12px] font-medium text-[var(--muted)]">{m.label}</p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */

const NAV: { id: LaunchPageId; label: string }[] = [
  { id: "roadmap", label: "Ruta" },
  { id: "channels", label: "Canales" },
  { id: "metrics", label: "Métricas" },
  { id: "pricing", label: "Precios" },
];

const EMPTY_STATE: LaunchState = {
  profile: { product_type: null, launch_date: null, goal_mrr: null, pitch: null },
  tasks: {},
  channels: {},
  feedback: [],
  metrics: [],
};

export function LaunchView({ projectId, onOpen }: { projectId: string; onOpen: (target: OpenTarget) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("ln"));
  const [state, setState] = useState<LaunchState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/projects/${projectId}/launch`;

  const fetchState = useCallback(async (): Promise<LaunchState> => {
    const res = await fetch(base);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar");
    return data as LaunchState;
  }, [base]);

  const load = useCallback(async () => {
    try {
      setState(await fetchState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar");
    }
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchState]);

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo guardar");
      throw new Error(data.error);
    }
    setError(null);
    return data;
  }

  function go(next: LaunchPageId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "launch");
    if (next === "roadmap") params.delete("ln");
    else params.set("ln", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleLink(link: TaskLink) {
    if ("page" in link) go(link.page);
    else onOpen({ kind: link.kind, section: link.section });
  }

  async function saveProfile(profile: LaunchProfile) {
    setState((s) => ({ ...s, profile }));
    await send(base, "PATCH", { profile }).catch(() => null);
    await load();
  }

  function toggleTask(id: string, done: boolean) {
    setState((s) => {
      const tasks = { ...s.tasks };
      if (done) tasks[id] = new Date().toISOString();
      else delete tasks[id];
      return { ...s, tasks };
    });
    send(base, "PATCH", { task: { id, done } }).catch(() => load());
  }

  async function saveChannel(id: string, channel: ChannelState) {
    setState((s) => ({ ...s, channels: { ...s.channels, [id]: channel } }));
    await send(base, "PATCH", { channel: { id, ...channel } }).catch(() => load());
  }

  async function saveMetric(m: MetricWeek) {
    await send(`${base}/metrics`, "POST", m).catch(() => null);
    await load();
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-[720px] px-5 pb-28 pt-8 sm:px-8 md:pb-12 md:pt-12">
        <nav className="flex gap-5 border-b border-[var(--border)]" aria-label="Lanzamiento">
          {NAV.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
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

        <div className="pt-8">
          {error ? <p className="mb-4 text-[13px] text-[var(--danger)]">{error}</p> : null}
          {loading ? (
            <div className="space-y-3">
              <div className="ui-skeleton h-6 w-48 rounded-lg" />
              <div className="ui-skeleton h-40 rounded-xl" />
            </div>
          ) : page === "channels" ? (
            <ChannelsPage state={state} onSave={saveChannel} />
          ) : page === "metrics" ? (
            <MetricsPage key={state.metrics.length} state={state} onSave={saveMetric} />
          ) : page === "pricing" ? (
            <PricingPage goalMrr={state.profile.goal_mrr} productType={state.profile.product_type} />
          ) : (
            <RoadmapPage state={state} onSaveProfile={saveProfile} onToggleTask={toggleTask} onLink={handleLink} />
          )}
        </div>
      </div>
    </div>
  );
}
