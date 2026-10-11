"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CHANNELS,
  CHANNEL_KIND_LABEL,
  CHANNEL_STATUS_LABEL,
  FEEDBACK_SOURCES,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  STAGES,
  appliesTo,
  currentStage,
  nextTasks,
  visibleTasks,
  type ChannelKind,
  type ChannelState,
  type ChannelStatus,
  type FeedbackItem,
  type FeedbackStatus,
  type LaunchPageId,
  type LaunchProfile,
  type LaunchState,
  type LaunchTask,
  type MetricWeek,
  type ProductType,
  type TaskLink,
} from "@/lib/launch/playbook";
import type { ToolKind } from "@/lib/types";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { LaunchIcon } from "./icons";
import { Svg, type IconComp } from "./market/shared";

const ACCENT = "#6366f1";
const ACCENT_SOFT = "#eef0ff";
const ACCENT_INK = "#4338ca";

const PAGES = new Set<LaunchPageId>(["roadmap", "channels", "feedback", "metrics", "pricing"]);

function pageFrom(raw: string | null): LaunchPageId {
  return raw && PAGES.has(raw as LaunchPageId) ? (raw as LaunchPageId) : "roadmap";
}

export type OpenTarget = { kind: ToolKind; section?: string };

/* ---------------- icons ---------------- */

const IconRoadmap: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 6h7.5a3.5 3.5 0 0 1 0 7h-7a3.5 3.5 0 0 0 0 7H16" />
  </Svg>
);
const IconChannels: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
  </Svg>
);
const IconFeedback: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
);
const IconMetrics: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M4 19.5h16" />
    <path d="M7 16v-4M12 16V8M17 16v-6" />
  </Svg>
);
const IconPricing: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M3.75 12.6V5.25a1.5 1.5 0 0 1 1.5-1.5h7.35l7.65 7.65a1.5 1.5 0 0 1 0 2.12l-6.23 6.23a1.5 1.5 0 0 1-2.12 0Z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </Svg>
);
const IconCheck: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
const IconArrow: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
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
const IconTrash: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5" />
  </Svg>
);
const IconUp: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m6 14 6-6 6 6" />
  </Svg>
);

/* ---------------- shared ui ---------------- */

function Header({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)] ${className}`}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-soft)] focus:border-black/25";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--foreground-soft)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-[var(--muted-soft)]">{hint}</span> : null}
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
            value === o.value ? "bg-white text-[var(--foreground)] shadow-[0_1px_2px_rgba(22,24,29,0.08)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ value, size = 64 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth="6" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={ACCENT}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
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

function daysUntil(date: string | null) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
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

/* ---------------- roadmap ---------------- */

function ProfileCard({ profile, onSave }: { profile: LaunchProfile; onSave: (p: LaunchProfile) => Promise<void> }) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!profile.product_type);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setOpen(false);
  }

  const typeLabel = profile.product_type === "app" ? "App móvil" : profile.product_type === "web" ? "Producto web" : profile.product_type === "both" ? "App + web" : null;

  if (!open && profile.product_type) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 text-[13px]">
          <span className="font-semibold text-[var(--foreground)]">{typeLabel}</span>
          {profile.pitch ? <span className="min-w-0 flex-1 truncate text-[var(--muted)]">“{profile.pitch}”</span> : <span className="flex-1" />}
          {profile.goal_mrr ? <span className="text-[var(--muted)]">Meta: <b className="text-[var(--foreground)]">{money(profile.goal_mrr)}/mes</b></span> : null}
          <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-semibold" style={{ color: ACCENT_INK }}>
            Editar
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="¿Qué construiste?" subtitle="Adaptamos la ruta a tu tipo de producto. Puedes cambiarlo cuando quieras.">
      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Segmented<ProductType>
            value={draft.product_type}
            onChange={(v) => setDraft({ ...draft, product_type: v })}
            options={[
              { value: "app", label: "App móvil" },
              { value: "web", label: "Producto web / SaaS" },
              { value: "both", label: "Ambos" },
            ]}
          />
        </div>
        <div className="md:col-span-2">
          <Field label="Tu promesa en una frase" hint="Qué resultado obtiene tu cliente. Lo usarás en la landing, la tienda y cada lanzamiento.">
            <input
              className={inputCls}
              maxLength={280}
              value={draft.pitch ?? ""}
              onChange={(e) => setDraft({ ...draft, pitch: e.target.value })}
              placeholder="Ej.: Aprende inglés hablando 10 minutos al día con una IA"
            />
          </Field>
        </div>
        <Field label="Fecha de lanzamiento" hint="Ponerle fecha es la mejor forma de lanzar.">
          <input type="date" className={inputCls} value={draft.launch_date ?? ""} onChange={(e) => setDraft({ ...draft, launch_date: e.target.value || null })} />
        </Field>
        <Field label="Meta de ingresos mensuales (USD)" hint="Para calcular cuántos clientes necesitas.">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={draft.goal_mrr ?? ""}
            onChange={(e) => setDraft({ ...draft, goal_mrr: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="1000"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
        {profile.product_type ? (
          <button type="button" className="ui-btn-ghost" onClick={() => { setDraft(profile); setOpen(false); }}>
            Cancelar
          </button>
        ) : null}
        <button type="button" className="ui-btn-primary" disabled={saving || !draft.product_type || (!dirty && Boolean(profile.product_type))} onClick={save}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Card>
  );
}

function TaskRow({ task, done, onToggle, onLink }: { task: LaunchTask; done: boolean; onToggle: () => void; onLink: (link: TaskLink) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="group">
      <div className="flex items-start gap-3 px-5 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Marcar “${task.title}” como pendiente` : `Marcar “${task.title}” como hecha`}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            done ? "border-transparent text-white" : "border-[var(--border-strong)] bg-white hover:border-[var(--foreground)]"
          }`}
          style={done ? { background: ACCENT } : undefined}
        >
          {done ? <IconCheck className="h-3.5 w-3.5" /> : null}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className={`block text-[13.5px] font-medium ${done ? "text-[var(--muted-soft)] line-through" : "text-[var(--foreground)]"}`}>{task.title}</span>
          <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{task.why}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {task.link ? (
            <button
              type="button"
              onClick={() => onLink(task.link!)}
              className="hidden items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition hover:bg-[var(--surface-alt)] sm:inline-flex"
              style={{ color: ACCENT_INK }}
            >
              {task.link.label}
              <IconArrow className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Ver cómo hacerlo" className="rounded-md p-1 text-[var(--muted-soft)] hover:bg-[var(--surface-alt)]">
            <IconChevron className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="pb-4 pl-[52px] pr-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Cómo hacerlo</p>
          <ul className="mt-1.5 space-y-1">
            {task.how.map((line) => (
              <li key={line} className="flex gap-2 text-[12.5px] text-[var(--foreground-soft)]">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--muted-soft)]" />
                {line}
              </li>
            ))}
          </ul>
          {task.link ? (
            <button type="button" onClick={() => onLink(task.link!)} className="ui-btn-secondary mt-3 sm:hidden">
              {task.link.label}
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
  const progress = tasks.length ? done / tasks.length : 0;
  const stage = currentStage(state);
  const next = nextTasks(state, 1)[0];
  const countdown = daysUntil(state.profile.launch_date);
  const [picked, setFocus] = useState<string | null>(null);
  const focus = picked ?? stage.id;

  return (
    <div className="space-y-5">
      <Header title="Ruta de lanzamiento" subtitle="Ya creaste tu producto. Esto es lo que sigue, paso a paso." />

      <ProfileCard key={JSON.stringify(state.profile)} profile={state.profile} onSave={onSaveProfile} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-5 px-5 py-5">
            <div className="relative">
              <ProgressRing value={progress} size={76} />
              <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--muted)]">Etapa actual</p>
              <p className="mt-0.5 text-[20px] font-semibold tracking-tight" style={{ color: stage.color }}>{stage.label}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{stage.goal}</p>
              <p className="mt-1.5 text-[12px] text-[var(--muted-soft)]">{done} de {tasks.length} pasos completados</p>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden">
          {next ? (
            <div className="flex h-full flex-col justify-between gap-3 px-5 py-5" style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}, #fff 70%)` }}>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: ACCENT_INK }}>Siguiente paso</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug text-[var(--foreground)]">{next.title}</p>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">{next.why}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {next.link ? (
                  <button type="button" className="ui-btn-primary" onClick={() => onLink(next.link!)}>
                    {next.link.label}
                  </button>
                ) : null}
                <button type="button" className="ui-btn-secondary" onClick={() => onToggleTask(next.id, true)}>
                  Ya lo hice
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center px-5 py-5">
              <p className="text-[16px] font-semibold text-[var(--foreground)]">Ruta completada</p>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">Ahora toca repetir lo que funciona. Registra tus métricas cada semana.</p>
            </div>
          )}
        </Card>
      </div>

      {countdown != null ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-[13px] shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
          <LaunchIcon className="h-4 w-4 shrink-0" />
          {countdown > 0 ? (
            <span>
              Faltan <b className="tabular-nums">{countdown}</b> {countdown === 1 ? "día" : "días"} para tu lanzamiento ({shortDay(state.profile.launch_date!)}).
            </span>
          ) : countdown === 0 ? (
            <span><b>Hoy es tu lanzamiento.</b> Publica en tus canales y responde a todos.</span>
          ) : (
            <span>Lanzaste hace <b className="tabular-nums">{-countdown}</b> {countdown === -1 ? "día" : "días"}. Mide, aprende y repite.</span>
          )}
        </div>
      ) : null}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STAGES.map((s, index) => {
          const stageTasks = tasks.filter((t) => t.stage === s.id);
          const stageDone = stageTasks.filter((t) => state.tasks[t.id]).length;
          const complete = stageTasks.length > 0 && stageDone === stageTasks.length;
          const active = focus === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFocus(s.id)}
              aria-pressed={active}
              className={`flex min-w-[130px] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                active ? "border-transparent bg-white shadow-[0_0_0_1.5px_var(--foreground),0_4px_14px_-6px_rgba(22,24,29,0.2)]" : "border-[var(--border)] bg-white/60 hover:bg-white"
              }`}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: complete ? "var(--success)" : s.color }}
              >
                {complete ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--foreground)]">{s.label}</span>
                <span className="block text-[11px] tabular-nums text-[var(--muted)]">{stageDone}/{stageTasks.length}</span>
              </span>
            </button>
          );
        })}
      </div>

      {STAGES.filter((s) => s.id === focus).map((s) => (
        <Card key={s.id} title={s.label} subtitle={s.goal}>
          <ul className="divide-y divide-[var(--border)]">
            {tasks
              .filter((t) => t.stage === s.id)
              .map((task) => (
                <TaskRow key={task.id} task={task} done={Boolean(state.tasks[task.id])} onToggle={() => onToggleTask(task.id, !state.tasks[task.id])} onLink={onLink} />
              ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- channels ---------------- */

const STATUS_TONE: Record<ChannelStatus, string> = {
  todo: "bg-[var(--surface-alt)] text-[var(--muted)]",
  planned: "bg-[#fff7e6] text-[#b45309]",
  launched: "bg-[#e7f7ef] text-[#0e7a55]",
  skipped: "bg-[var(--surface-alt)] text-[var(--muted-soft)] line-through",
};

function ChannelCard({ channel, state, onSave }: { channel: (typeof CHANNELS)[number]; state: ChannelState | undefined; onSave: (s: ChannelState) => Promise<void> }) {
  const current: ChannelState = state ?? { status: "todo", planned_for: null, url: null, result: null };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);

  return (
    <li className="rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={channel.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--foreground)] hover:underline">
              {channel.name}
              <IconExternal className="h-3 w-3 text-[var(--muted-soft)]" />
            </a>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[current.status]}`}>{CHANNEL_STATUS_LABEL[current.status]}</span>
            {current.planned_for ? <span className="text-[11px] text-[var(--muted)]">{shortDay(current.planned_for)}</span> : null}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">{channel.tip}</p>
          <p className="mt-1.5 text-[11px] text-[var(--muted-soft)]">
            {CHANNEL_KIND_LABEL[channel.kind]} · Esfuerzo {channel.effort}
            {current.url ? (
              <>
                {" · "}
                <a href={current.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: ACCENT_INK }}>Ver publicación</a>
              </>
            ) : null}
          </p>
          {current.result ? <p className="mt-1.5 rounded-lg bg-[var(--surface-alt)] px-2.5 py-1.5 text-[12px] text-[var(--foreground-soft)]">{current.result}</p> : null}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ui-btn-ghost h-8 shrink-0 px-2.5 text-[12px]">
          {open ? "Cerrar" : "Actualizar"}
        </button>
      </div>
      {open ? (
        <div className="grid gap-3 border-t border-[var(--border)] px-4 py-3.5 sm:grid-cols-2">
          <Field label="Estado">
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ChannelStatus })}>
              {(Object.keys(CHANNEL_STATUS_LABEL) as ChannelStatus[]).map((s) => (
                <option key={s} value={s}>{CHANNEL_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" className={inputCls} value={draft.planned_for ?? ""} onChange={(e) => setDraft({ ...draft, planned_for: e.target.value || null })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Enlace a la publicación">
              <input className={inputCls} value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Resultado" hint="Visitas, registros, votos… para saber qué canal repetir.">
              <input className={inputCls} value={draft.result ?? ""} onChange={(e) => setDraft({ ...draft, result: e.target.value })} placeholder="Ej.: #4 del día, 320 visitas, 41 registros" />
            </Field>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button
              type="button"
              className="ui-btn-primary"
              onClick={async () => {
                await onSave(draft);
                setOpen(false);
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ChannelsPage({ state, onSave }: { state: LaunchState; onSave: (id: string, s: ChannelState) => Promise<void> }) {
  const [kind, setKind] = useState<ChannelKind | "all">("all");
  const list = CHANNELS.filter((c) => appliesTo(c.applies, state.profile.product_type)).filter((c) => kind === "all" || c.kind === kind);
  const all = CHANNELS.filter((c) => appliesTo(c.applies, state.profile.product_type));
  const launched = all.filter((c) => state.channels[c.id]?.status === "launched").length;
  const planned = all.filter((c) => state.channels[c.id]?.status === "planned").length;
  const kinds = Array.from(new Set(all.map((c) => c.kind)));

  return (
    <div className="space-y-5">
      <Header title="Canales de lanzamiento" subtitle="Dónde anunciar tu producto, con consejos de cada sitio. Elige 5 y repártelos en 2 semanas." />
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)]">
        {[
          { label: "Canales disponibles", value: all.length },
          { label: "Programados", value: planned },
          { label: "Lanzados", value: launched },
        ].map((m) => (
          <div key={m.label} className="bg-white px-5 py-4">
            <p className="text-[12px] font-medium text-[var(--muted)]">{m.label}</p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--foreground)]">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...kinds] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              kind === k ? "bg-[var(--foreground)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {k === "all" ? "Todos" : CHANNEL_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 xl:grid-cols-2">
        {list.map((c) => (
          <ChannelCard key={`${c.id}:${JSON.stringify(state.channels[c.id] ?? null)}`} channel={c} state={state.channels[c.id]} onSave={(s) => onSave(c.id, s)} />
        ))}
      </ul>
    </div>
  );
}

/* ---------------- feedback ---------------- */

function FeedbackPage({
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: FeedbackItem[];
  onAdd: (input: { title: string; detail: string; source: string }) => Promise<void>;
  onUpdate: (id: string, patch: { votes?: number; status?: FeedbackStatus }) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [source, setSource] = useState<string>(FEEDBACK_SOURCES[0]);
  const [filter, setFilter] = useState<FeedbackStatus | "open">("open");
  const [saving, setSaving] = useState(false);

  const shown = items.filter((i) => (filter === "open" ? i.status !== "done" && i.status !== "declined" : i.status === filter));

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({ title, detail, source });
    setTitle("");
    setDetail("");
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <Header title="Feedback y roadmap" subtitle="Todo lo que te piden tus usuarios en un solo sitio. Vota, prioriza y construye lo que importa." />
      <Card title="Nueva petición o problema" subtitle="Si alguien pide algo que ya está en la lista, súmale un voto en lugar de duplicarlo.">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px]">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Exportar a PDF" maxLength={200} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Origen">
            {FEEDBACK_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <textarea
            className={`${inputCls} h-20 resize-none py-2 md:col-span-2`}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Contexto: qué intentaba hacer el usuario, frase literal, plan que paga…"
            maxLength={4000}
          />
          <div className="flex justify-end md:col-span-2">
            <button type="button" className="ui-btn-primary" disabled={saving || !title.trim()} onClick={add}>
              {saving ? "Añadiendo…" : "Añadir"}
            </button>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {(["open", ...FEEDBACK_STATUSES] as const).map((s) => {
          const count = s === "open" ? items.filter((i) => i.status !== "done" && i.status !== "declined").length : items.filter((i) => i.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                filter === s ? "bg-[var(--foreground)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s === "open" ? "Abiertos" : FEEDBACK_STATUS_LABEL[s]} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <Card>
        {shown.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT_INK }}>
              <IconFeedback className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">Nada por aquí</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted)]">Apunta cada cosa que te digan en emails, reseñas o entrevistas. En unas semanas verás claro qué construir.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {shown.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { votes: item.votes + 1 })}
                  aria-label={`Sumar voto a ${item.title}`}
                  className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-[var(--border)] py-1 text-[var(--muted)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                >
                  <IconUp className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">{item.votes}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-[var(--foreground)]">{item.title}</p>
                  {item.detail ? <p className="mt-0.5 whitespace-pre-line text-[12px] text-[var(--muted)]">{item.detail}</p> : null}
                  <p className="mt-1 text-[11px] text-[var(--muted-soft)]">
                    {item.source ?? "—"} · {new Date(item.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <select
                  value={item.status}
                  onChange={(e) => onUpdate(item.id, { status: e.target.value as FeedbackStatus })}
                  aria-label="Estado"
                  className="h-8 rounded-lg border border-[var(--border)] bg-white px-2 text-[12px] font-medium text-[var(--foreground)] outline-none"
                >
                  {FEEDBACK_STATUSES.map((s) => (
                    <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <button type="button" onClick={() => onDelete(item.id)} aria-label="Eliminar" className="rounded-md p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- metrics ---------------- */

type MetricKey = "mrr" | "paying" | "active_users" | "signups" | "visitors";
const METRIC_LABEL: Record<MetricKey, string> = {
  mrr: "MRR",
  paying: "Clientes de pago",
  active_users: "Usuarios activos",
  signups: "Registros",
  visitors: "Visitas",
};

function LineChart({ points, format }: { points: { label: string; value: number }[]; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-[12px] text-[var(--muted)]">Registra tu primera semana para ver la tendencia.</div>;
  }
  const w = 640;
  const h = 220;
  const pad = 24;
  const max = Math.max(...points.map((p) => p.value), 1);
  const coords = points.map((p, i) => ({
    ...p,
    x: points.length === 1 ? w / 2 : pad + (i / (points.length - 1)) * (w - pad * 2),
    y: h - pad - (p.value / max) * (h - pad * 2),
  }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const active = hover != null ? coords[hover] : coords[coords.length - 1];
  return (
    <div className="px-5 pb-4 pt-3">
      <p className="text-[24px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{format(active.value)}</p>
      <p className="text-[11px] text-[var(--muted)]">Semana del {active.label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[200px] w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="launch-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={pad} x2={w - pad} y1={pad + (i * (h - pad * 2)) / 3} y2={pad + (i * (h - pad * 2)) / 3} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        {coords.length > 1 ? <path d={`M${coords[0].x},${h - pad} L${line.replace(/ /g, " L")} L${coords[coords.length - 1].x},${h - pad} Z`} fill="url(#launch-area)" /> : null}
        <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <g key={c.label}>
            <rect x={c.x - (w / coords.length) / 2} y={0} width={w / coords.length} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
            <circle cx={c.x} cy={c.y} r={hover === i ? 5 : 3.5} fill="#fff" stroke={ACCENT} strokeWidth="2" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function MetricsPage({ state, onSave, onDelete }: { state: LaunchState; onSave: (m: MetricWeek) => Promise<void>; onDelete: (week: string) => void }) {
  const metrics = state.metrics;
  const thisWeek = mondayOf();
  const existing = metrics.find((m) => m.week_start === thisWeek);
  const empty: MetricWeek = { week_start: thisWeek, visitors: null, signups: null, active_users: null, paying: null, mrr: null };
  const [draft, setDraft] = useState<MetricWeek>(existing ?? empty);
  const [key, setKey] = useState<MetricKey>("mrr");
  const [saving, setSaving] = useState(false);

  const last = metrics[metrics.length - 1];
  const prev = metrics[metrics.length - 2];
  const goal = state.profile.goal_mrr;

  function growth(k: MetricKey) {
    const a = prev?.[k];
    const b = last?.[k];
    if (a == null || b == null || a === 0) return null;
    return (b - a) / a;
  }

  function setField(k: MetricKey, v: string) {
    setDraft({ ...draft, [k]: v === "" ? null : Number(v) });
  }

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const points = metrics.filter((m) => m[key] != null).map((m) => ({ label: shortDay(m.week_start), value: Number(m[key]) }));
  const fmt = key === "mrr" ? (n: number) => money(n) : num;

  return (
    <div className="space-y-5">
      <Header title="Métricas semanales" subtitle="Cinco números, una vez por semana. Es todo lo que necesitas para saber si vas bien." />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-5">
        {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => {
          const g = growth(k);
          return (
            <button key={k} type="button" onClick={() => setKey(k)} className={`bg-white px-5 py-4 text-left transition ${key === k ? "shadow-[inset_0_-2px_0_var(--foreground)]" : "hover:bg-[var(--surface-alt)]"}`}>
              <p className="text-[12px] font-medium text-[var(--muted)]">{METRIC_LABEL[k]}</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{k === "mrr" ? money(last?.mrr) : num(last?.[k])}</p>
              <p className={`mt-0.5 text-[11px] font-medium tabular-nums ${g == null ? "text-[var(--muted-soft)]" : g >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {g == null ? "Sin semana anterior" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}% vs. semana anterior`}
              </p>
            </button>
          );
        })}
      </div>

      {goal ? (
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-[var(--foreground)]">Meta de ingresos</span>
            <span className="tabular-nums text-[var(--muted)]">{money(last?.mrr ?? 0)} de {money(goal)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-alt)]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, ((last?.mrr ?? 0) / goal) * 100)}%`, background: ACCENT }} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title={METRIC_LABEL[key]} subtitle="Evolución semanal">
          <LineChart points={points} format={fmt} />
        </Card>
        <Card title="Registrar semana" subtitle="Si la semana ya existe, se actualiza.">
          <div className="grid grid-cols-2 gap-3 px-5 py-4">
            <div className="col-span-2">
              <Field label="Semana que empieza el">
                <input
                  type="date"
                  className={inputCls}
                  value={draft.week_start}
                  onChange={(e) => {
                    const week = e.target.value ? mondayOf(new Date(`${e.target.value}T00:00:00`)) : thisWeek;
                    setDraft(metrics.find((m) => m.week_start === week) ?? { ...empty, week_start: week });
                  }}
                />
              </Field>
            </div>
            {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => (
              <Field key={k} label={k === "mrr" ? "MRR (USD)" : METRIC_LABEL[k]}>
                <input type="number" min={0} step={k === "mrr" ? "0.01" : "1"} className={inputCls} value={draft[k] ?? ""} onChange={(e) => setField(k, e.target.value)} />
              </Field>
            ))}
            <div className="flex items-end justify-end">
              <button type="button" className="ui-btn-primary w-full" disabled={saving} onClick={save}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {metrics.length > 0 ? (
        <Card title="Historial">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-2.5">Semana</th>
                  {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => (
                    <th key={k} className="px-5 py-2.5 text-right">{METRIC_LABEL[k]}</th>
                  ))}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[...metrics].reverse().map((m) => (
                  <tr key={m.week_start} className="tabular-nums">
                    <td className="px-5 py-2.5 font-medium text-[var(--foreground)]">{shortDay(m.week_start)}</td>
                    {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => (
                      <td key={k} className="px-5 py-2.5 text-right text-[var(--foreground-soft)]">{k === "mrr" ? money(m.mrr) : num(m[k])}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => onDelete(m.week_start)} aria-label="Eliminar semana" className="rounded-md p-1 text-[var(--muted-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/* ---------------- pricing ---------------- */

const FEE_PRESETS = [
  { id: "store-small", label: "App Store / Play (programa pequeñas empresas · 15%)", pct: 15, fixed: 0 },
  { id: "store", label: "App Store / Play (30%)", pct: 30, fixed: 0 },
  { id: "stripe", label: "Stripe (2,9% + $0,30)", pct: 2.9, fixed: 0.3 },
  { id: "mor", label: "Lemon Squeezy / Paddle (5% + $0,50)", pct: 5, fixed: 0.5 },
];

function PricingPage({ goalMrr, productType }: { goalMrr: number | null; productType: ProductType | null }) {
  const [price, setPrice] = useState(9.99);
  const [fee, setFee] = useState(productType === "web" ? "stripe" : "store-small");
  const [fixedCosts, setFixedCosts] = useState(50);
  const [costPerUser, setCostPerUser] = useState(0.1);
  const [conversion, setConversion] = useState(3);
  const [goal, setGoal] = useState(goalMrr ?? 1000);

  const preset = FEE_PRESETS.find((f) => f.id === fee) ?? FEE_PRESETS[0];
  const netPerSub = price * (1 - preset.pct / 100) - preset.fixed;
  const costPerPaying = conversion > 0 ? costPerUser * (100 / conversion) : costPerUser;
  const marginPerSub = netPerSub - costPerPaying;
  const breakEven = marginPerSub > 0 ? Math.ceil(fixedCosts / marginPerSub) : null;
  const forGoal = netPerSub > 0 ? Math.ceil(goal / netPerSub) : null;
  const freeUsersNeeded = forGoal != null && conversion > 0 ? Math.ceil(forGoal / (conversion / 100)) : null;
  const marginPct = price > 0 ? marginPerSub / price : 0;
  const annual = Math.max(0.99, Math.round(price * 12 * 0.6) - 0.01);
  const tiers = [
    { name: "Básico", price: Math.max(0.99, Math.round(price * 0.5) - 0.01), note: "Para probar sin fricción" },
    { name: "Pro", price, note: "El plan que quieres vender", featured: true },
    { name: "Equipo / Max", price: Math.round(price * 2.5) - 0.01, note: "Ancla: hace que Pro parezca barato" },
  ];

  const numInput = (value: number, set: (n: number) => void, step = "1") => (
    <input type="number" min={0} step={step} className={inputCls} value={Number.isFinite(value) ? value : ""} onChange={(e) => set(Number(e.target.value))} />
  );

  return (
    <div className="space-y-5">
      <Header title="Calculadora de precios" subtitle="Cuánto cobrar, cuánto te queda y cuántos clientes necesitas. Sin hojas de cálculo." />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Tus números">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <Field label="Precio mensual (USD)">{numInput(price, setPrice, "0.01")}</Field>
            <Field label="Meta de MRR (USD)">{numInput(goal, setGoal)}</Field>
            <div className="sm:col-span-2">
              <Field label="Comisión de cobro">
                <select className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)}>
                  {FEE_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Costes fijos al mes" hint="Hosting, dominio, herramientas.">{numInput(fixedCosts, setFixedCosts)}</Field>
            <Field label="Coste por usuario activo al mes" hint="Gratis o de pago: APIs de IA, almacenamiento, emails.">{numInput(costPerUser, setCostPerUser, "0.01")}</Field>
            <div className="sm:col-span-2">
              <Field label={`Conversión de gratis a pago: ${conversion}%`} hint="Freemium suele estar entre 2–5%; con prueba gratuita, 20–60% de las pruebas.">
                <input type="range" min={0.5} max={60} step={0.5} value={conversion} onChange={(e) => setConversion(Number(e.target.value))} className="w-full accent-[#6366f1]" />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)]">
            {[
              { label: "Te queda por suscriptor", value: money(netPerSub, 2), hint: `Tras la comisión de ${preset.pct}%` },
              { label: "Margen real por suscriptor", value: money(marginPerSub, 2), hint: `${(marginPct * 100).toFixed(0)}% del precio`, bad: marginPerSub <= 0 },
              { label: "Suscriptores para no perder dinero", value: breakEven == null ? "∞" : num(breakEven), hint: "Cubre costes fijos", bad: breakEven == null },
              { label: `Suscriptores para ${money(goal)}/mes`, value: forGoal == null ? "∞" : num(forGoal), hint: freeUsersNeeded ? `≈ ${num(freeUsersNeeded)} usuarios gratis` : "" },
            ].map((m) => (
              <div key={m.label} className="bg-white px-5 py-4">
                <p className="text-[12px] font-medium text-[var(--muted)]">{m.label}</p>
                <p className={`mt-1 text-[24px] font-semibold tabular-nums tracking-tight ${m.bad ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{m.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted-soft)]">{m.hint}</p>
              </div>
            ))}
          </div>

          <Card title="Estructura sugerida" subtitle="Tres planes y un anual con descuento: el patrón que mejor convierte.">
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {tiers.map((t) => (
                <div
                  key={t.name}
                  className={`rounded-xl border px-4 py-3.5 ${t.featured ? "border-transparent shadow-[0_0_0_1.5px_#6366f1]" : "border-[var(--border)]"}`}
                  style={t.featured ? { background: ACCENT_SOFT } : undefined}
                >
                  <p className="text-[12px] font-semibold text-[var(--muted)]">{t.name}</p>
                  <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">{money(t.price, 2)}<span className="text-[12px] font-medium text-[var(--muted)]">/mes</span></p>
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">{t.note}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--border)] px-5 py-3.5 text-[12.5px] text-[var(--foreground-soft)]">
              Plan anual sugerido: <b className="tabular-nums">{money(annual, 2)}/año</b> ({money(annual / 12, 2)}/mes, un 40% menos). Ponlo preseleccionado en tu paywall.
            </div>
          </Card>

          {marginPerSub <= 0 ? (
            <p className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-[12.5px] text-[var(--danger)]">
              Con estos números pierdes dinero con cada cliente. Sube el precio, mejora la conversión o reduce el coste por usuario.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */

const NAV: { id: LaunchPageId; label: string; icon: IconComp }[] = [
  { id: "roadmap", label: "Ruta", icon: IconRoadmap },
  { id: "channels", label: "Canales", icon: IconChannels },
  { id: "feedback", label: "Feedback", icon: IconFeedback },
  { id: "metrics", label: "Métricas", icon: IconMetrics },
  { id: "pricing", label: "Precios", icon: IconPricing },
];

const EMPTY_STATE: LaunchState = {
  profile: { product_type: null, launch_date: null, goal_mrr: null, pitch: null },
  tasks: {},
  channels: {},
  feedback: [],
  metrics: [],
};

export function LaunchView({ projectId, projectName, onOpen }: { projectId: string; projectName?: string; onOpen: (target: OpenTarget) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("ln"));
  const [mobileOpen, setMobileOpen] = useState(false);
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

  async function addFeedback(input: { title: string; detail: string; source: string }) {
    const data = await send(`${base}/feedback`, "POST", input).catch(() => null);
    if (data?.item) setState((s) => ({ ...s, feedback: [data.item as FeedbackItem, ...s.feedback] }));
  }

  function updateFeedback(id: string, patch: { votes?: number; status?: FeedbackStatus }) {
    setState((s) => ({
      ...s,
      feedback: s.feedback.map((f) => (f.id === id ? { ...f, ...patch } : f)).sort((a, b) => b.votes - a.votes),
    }));
    send(`${base}/feedback`, "PATCH", { id, ...patch }).catch(() => load());
  }

  function deleteFeedback(id: string) {
    setState((s) => ({ ...s, feedback: s.feedback.filter((f) => f.id !== id) }));
    send(`${base}/feedback?item=${encodeURIComponent(id)}`, "DELETE").catch(() => load());
  }

  async function saveMetric(m: MetricWeek) {
    await send(`${base}/metrics`, "POST", m).catch(() => null);
    await load();
  }

  function deleteMetric(week: string) {
    setState((s) => ({ ...s, metrics: s.metrics.filter((m) => m.week_start !== week) }));
    send(`${base}/metrics?week=${week}`, "DELETE").catch(() => load());
  }

  const tasks = useMemo(() => visibleTasks(state.profile.product_type), [state.profile.product_type]);
  const doneCount = tasks.filter((t) => state.tasks[t.id]).length;

  const mobileSections: MobileNavSection[] = [
    {
      items: NAV.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        active: page === item.id,
        onClick: () => {
          go(item.id);
          setMobileOpen(false);
        },
      })),
    },
  ];

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: ACCENT }}>
            <LaunchIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{projectName || "Proyecto"}</p>
            <p className="text-[11px] text-[var(--muted)]">Lanzamiento</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {NAV.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition ${
                  active ? "" : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                }`}
                style={active ? { background: ACCENT_SOFT, color: ACCENT_INK } : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span>Progreso</span>
            <span className="tabular-nums">{doneCount}/{tasks.length}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%`, background: ACCENT }} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
        <div className="mx-auto max-w-[1200px]">
          {error ? (
            <p className="mb-4 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>
          ) : null}
          {loading ? (
            <div className="space-y-4">
              <div className="ui-skeleton h-8 w-64 rounded-lg" />
              <div className="ui-skeleton h-28 rounded-xl" />
              <div className="ui-skeleton h-64 rounded-xl" />
            </div>
          ) : page === "channels" ? (
            <ChannelsPage state={state} onSave={saveChannel} />
          ) : page === "feedback" ? (
            <FeedbackPage items={state.feedback} onAdd={addFeedback} onUpdate={updateFeedback} onDelete={deleteFeedback} />
          ) : page === "metrics" ? (
            <MetricsPage key={state.metrics.length} state={state} onSave={saveMetric} onDelete={deleteMetric} />
          ) : page === "pricing" ? (
            <PricingPage goalMrr={state.profile.goal_mrr} productType={state.profile.product_type} />
          ) : (
            <RoadmapPage state={state} onSaveProfile={saveProfile} onToggleTask={toggleTask} onLink={handleLink} />
          )}
        </div>
      </div>

      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Lanzamiento"
        subtitle={projectName || "Workspace"}
        fabLabel="Menú de Lanzamiento"
        fabClassName="bottom-[5.25rem] right-4"
        accent="dark"
        fabIcon={<LaunchIcon className="h-5 w-5" />}
        sections={mobileSections}
      />
    </div>
  );
}
