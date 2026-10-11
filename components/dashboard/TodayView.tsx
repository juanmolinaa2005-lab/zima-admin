"use client";

import { useCallback, useEffect, useState } from "react";
import { STAGES, planFor, type LaunchTask, type TaskLink } from "@/lib/launch/playbook";
import type { BuildType } from "@/lib/onboarding/questions";
import { Onboarding } from "./Onboarding";
import type { TodayData } from "@/lib/today/types";

type OpenFn = (link: Pick<TaskLink, "view" | "params">) => void;

const nf = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function compact(n: number) {
  return nf.format(n);
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "en breve";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `en ${mins} min`;
  return d.toLocaleString("es", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-[12px] font-medium text-[var(--muted)]">{label}</span>
      <span className="mt-1 block text-[30px] font-semibold tracking-tight tabular-nums text-[var(--foreground)]">{value}</span>
      <span className="mt-0.5 block text-[12px] text-[var(--muted-soft)]">{hint}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-xl border border-[var(--border)] bg-white p-4 text-left transition hover:border-[var(--foreground)]">
      {body}
    </button>
  ) : (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">{body}</div>
  );
}

function Spark({ series }: { series: { day: string; views: number }[] }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((s) => s.views));
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden>
      {series.map((s) => (
        <span
          key={s.day}
          title={`${s.day}: ${compact(s.views)}`}
          className="w-2 rounded-sm bg-[var(--foreground)] opacity-80"
          style={{ height: `${Math.max(6, (s.views / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function LoopStep({
  n,
  title,
  status,
  tone,
  cta,
  onClick,
}: {
  n: number;
  title: string;
  status: string;
  tone: "ok" | "todo" | "error";
  cta: string;
  onClick: () => void;
}) {
  const dot = tone === "ok" ? "bg-emerald-500" : tone === "error" ? "bg-red-500" : "bg-amber-400";
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted)]">
        <span className="tabular-nums">{n}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </div>
      <p className="mt-2 text-[16px] font-semibold text-[var(--foreground)]">{title}</p>
      <p className={`mt-1 flex-1 text-[13px] leading-snug ${tone === "error" ? "text-red-600" : "text-[var(--muted)]"}`}>{status}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 self-start rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-[13px] font-medium text-white transition hover:opacity-85"
      >
        {cta}
      </button>
    </div>
  );
}

function PlanTask({
  task,
  done,
  onToggle,
  onOpen,
}: {
  task: LaunchTask;
  done: boolean;
  onToggle: () => void;
  onOpen: OpenFn;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? "Marcar como pendiente" : "Marcar como hecho"}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${
            done ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : "border-[var(--border-strong,#d1d5db)] hover:border-[var(--foreground)]"
          }`}
        >
          {done ? (
            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`min-w-0 flex-1 text-left text-[14px] ${done ? "text-[var(--muted-soft)] line-through" : "text-[var(--foreground)]"}`}
        >
          {task.title}
        </button>
        {task.link && !done ? (
          <button type="button" onClick={() => onOpen(task.link!)} className="shrink-0 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
            {task.link.label} →
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="pb-3 pl-[30px] text-[13px] leading-relaxed text-[var(--muted)]">
          <p>{task.why}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4">
            {task.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function TodayView({
  projectId,
  projectName,
  onOpen,
  onConfigured,
}: {
  projectId: string;
  projectName: string;
  onOpen: OpenFn;
  onConfigured: () => void;
}) {
  const [data, setData] = useState<TodayData | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/today`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar");
      setData(json as TodayData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar");
    }
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    const id = window.setInterval(() => void load(), 5 * 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load]);

  async function patchLaunch(body: object) {
    await fetch(`/api/projects/${projectId}/launch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function toggleTask(id: string) {
    if (!data) return;
    const done = !data.plan[id];
    const plan = { ...data.plan };
    if (done) plan[id] = new Date().toISOString();
    else delete plan[id];
    setData({ ...data, plan });
    void patchLaunch({ task: { id, done } });
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-[14px] text-[var(--muted)]">
        {error ? (
          <button type="button" onClick={() => void load()} className="underline">
            {error}. Reintentar
          </button>
        ) : (
          "Cargando…"
        )}
      </div>
    );
  }

  if (!data.onboarded || editing) {
    const type: BuildType | null = data.productType === "app" || data.productType === "web" ? data.productType : null;
    return (
      <div className="h-full overflow-y-auto">
        <Onboarding
          key={editing ? "edit" : "first"}
          projectId={projectId}
          projectName={projectName}
          initial={{ type, pitch: data.pitch, answers: data.answers }}
          onCancel={editing ? () => setEditing(false) : undefined}
          onDone={() => {
            setEditing(false);
            setData(null);
            void load();
            onConfigured();
          }}
        />
      </div>
    );
  }

  const { views, videos, accounts, publishing, revenue } = data;
  const isWeb = data.productType === "web";
  const tasks = planFor(data.productType, data.answers);
  const doneCount = tasks.filter((t) => data.plan[t.id]).length;
  const next = tasks.find((t) => !data.plan[t.id]);

  const createStatus =
    publishing.toReview > 0
      ? `${publishing.toReview} videos esperan tu revisión.`
      : videos.posted7d > 0
        ? `${videos.posted7d} videos publicados esta semana. La meta es 2–3 al día por cuenta.`
        : "Aún no hay videos esta semana. El volumen es lo que trae los virales.";

  const publishTone: "ok" | "todo" | "error" = publishing.lastError ? "error" : publishing.active > 0 ? "ok" : "todo";
  const publishStatus = publishing.lastError
    ? `Error: ${publishing.lastError}`
    : publishing.active > 0
      ? `${publishing.active} ${publishing.active === 1 ? "flujo activo" : "flujos activos"} · ${publishing.queued} en cola${
          publishing.nextAt ? ` · próximo ${timeLabel(publishing.nextAt)}` : ""
        }`
      : "Sin publicación automática. Conecta tus cuentas y crea un flujo.";

  const measureStatus =
    accounts.total === 0
      ? "Añade tus cuentas para medir vistas automáticamente cada hora."
      : `${accounts.total} ${accounts.total === 1 ? "cuenta" : "cuentas"} · mediana ${compact(videos.median)} vistas por video`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-5 pb-24 pt-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-[var(--muted)]">
              {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">{projectName}</h1>
          </div>
          <Spark series={views.series} />
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Vistas · 7 días"
            value={compact(views.last7d ?? views.total)}
            hint={views.last7d == null ? "Total acumulado. El histórico diario empieza hoy." : `${compact(views.total)} en total`}
            onClick={() => onOpen({ view: "results" })}
          />
          <Stat
            label="Videos · 7 días"
            value={String(videos.posted7d)}
            hint={`${videos.tracked} medidos en total`}
            onClick={() => onOpen({ view: "results", params: { vt: "videos" } })}
          />
          <Stat
            label="Hits"
            value={String(videos.hits)}
            hint={videos.median > 0 ? `Más de ${compact(videos.median * 10)} vistas (10× tu mediana)` : "Videos que superan 10× tu mediana"}
          />
          {revenue.connected ? (
            <Stat
              label={`Ingresos · ${revenue.days} días`}
              value={revenue.net == null ? "—" : money.format(revenue.net)}
              hint={`${revenue.newUsers ?? 0} usuarios nuevos${revenue.mrr ? ` · MRR ${money.format(revenue.mrr)}` : ""}`}
            />
          ) : isWeb ? (
            <Stat
              label="Interesados"
              value={compact(data.page.subscribers)}
              hint={data.page.published ? "Emails recogidos en tu página" : "Publica tu página para recoger emails"}
              onClick={() => onOpen({ view: "page" })}
            />
          ) : (
            <Stat label="Ingresos" value="—" hint="Conecta Superwall en Ajustes para cruzar vistas con dinero" />
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">El ciclo</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <LoopStep
              n={1}
              title="Crear"
              status={createStatus}
              tone={videos.posted7d > 0 || publishing.toReview > 0 ? "ok" : "todo"}
              cta={publishing.toReview > 0 ? "Revisar videos" : "Crear videos"}
              onClick={() => onOpen(publishing.toReview > 0 ? { view: "publish" } : { view: "create" })}
            />
            <LoopStep
              n={2}
              title="Publicar"
              status={publishStatus}
              tone={publishTone}
              cta={publishing.active > 0 ? "Ver cola" : "Activar"}
              onClick={() => onOpen({ view: "publish" })}
            />
            <LoopStep
              n={3}
              title="Medir"
              status={measureStatus}
              tone={accounts.total > 0 ? "ok" : "todo"}
              cta={accounts.total > 0 ? "Ver resultados" : "Añadir cuentas"}
              onClick={() => onOpen(accounts.total > 0 ? { view: "results" } : { view: "results", params: { vt: "accounts" } })}
            />
          </div>
        </section>

        {videos.top.length ? (
          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">Lo que funciona · 30 días</h2>
              <button type="button" onClick={() => onOpen({ view: "results", params: { vt: "videos" } })} className="text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]">
                Todos →
              </button>
            </div>
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
              {videos.top.map((v) => {
                const ratio = videos.median > 0 ? v.views / videos.median : 0;
                return (
                  <li key={v.id} className="flex items-center gap-3 p-3">
                    <a href={v.url} target="_blank" rel="noreferrer" className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[#111827]">
                      {v.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </a>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[14px] font-medium text-[var(--foreground)]">{v.title || v.author || v.url}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {compact(v.views)} vistas{ratio >= 2 ? ` · ${ratio.toFixed(ratio >= 10 ? 0 : 1)}× tu mediana` : ""}
                        {v.author ? ` · ${v.author}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpen({ view: "create" })}
                      className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]"
                    >
                      Hacer variantes
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">Plan de crecimiento</h2>
            <span className="flex items-baseline gap-4 text-[13px] text-[var(--muted)]">
              <button type="button" onClick={() => setEditing(true)} className="hover:text-[var(--foreground)]">
                Ajustar respuestas
              </button>
              <span className="tabular-nums">
                {doneCount}/{tasks.length}
              </span>
            </span>
          </div>

          {next ? (
            <div className="mt-3 rounded-xl bg-[var(--foreground)] p-5 text-white">
              <p className="text-[12px] font-medium uppercase tracking-wide text-white/60">Siguiente</p>
              <p className="mt-1 text-[18px] font-semibold">{next.title}</p>
              <p className="mt-1 max-w-[640px] text-[14px] leading-relaxed text-white/75">{next.why}</p>
              <div className="mt-4 flex gap-2">
                {next.link ? (
                  <button
                    type="button"
                    onClick={() => onOpen(next.link!)}
                    className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] hover:opacity-90"
                  >
                    {next.link.label}
                  </button>
                ) : null}
                <button type="button" onClick={() => toggleTask(next.id)} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/80 hover:text-white">
                  Marcar como hecho
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {STAGES.map((stage) => {
              const items = tasks.filter((t) => t.stage === stage.id);
              if (!items.length) return null;
              return (
                <div key={stage.id}>
                  <p className="text-[12px] font-medium text-[var(--muted-soft)]">{stage.label}</p>
                  <ul className="mt-1">
                    {items.map((task) => (
                      <PlanTask key={task.id} task={task} done={Boolean(data.plan[task.id])} onToggle={() => toggleTask(task.id)} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
