"use client";

import { useEffect, useState } from "react";
import { planFor } from "@/lib/launch/playbook";
import { has, NO_APP, questionsFor, type Answers, type BuildType, type Question } from "@/lib/onboarding/questions";

type Initial = { type: BuildType | null; pitch: string | null; answers: Answers };

function preparedFor(type: BuildType, answers: Answers): string[] {
  const accounts = typeof answers.accounts === "string" ? answers.accounts.split(/\s+/).filter((l) => l.includes(".")).length : 0;
  const tracking = accounts ? [`Midiendo ${accounts} ${accounts === 1 ? "cuenta" : "cuentas"}: sus videos aparecerán en unos minutos`] : [];
  return [...preparedCore(type, answers), ...tracking];
}

function preparedCore(type: BuildType, answers: Answers): string[] {
  const platforms = Array.isArray(answers.platforms) ? answers.platforms.length : 0;
  const tasks = planFor(type, answers).length;
  if (type === "app") {
    const appName = typeof answers.appName === "string" && answers.appId !== NO_APP ? answers.appName : null;
    return [
      ...(appName ? [`Hemos leído la ficha de ${appName} en la App Store`] : []),
      has(answers, "face", "creators") ? "Creadores pagados por vista para tus videos" : "Videos con IA listos para publicar cada día",
      `Publicación automática en ${platforms > 1 ? `${platforms} plataformas` : "tus cuentas"}`,
      "Ideas de videos virales y onboardings de apps como la tuya",
      `Un plan de ${tasks} pasos para tu app`,
    ];
  }
  const founder = has(answers, "platforms", "linkedin") || has(answers, "platforms", "x");
  return [
    founder ? "Contenido del fundador para LinkedIn y X" : "Videos cortos de tu producto para redes",
    "Afiliados y creadores que venden por ti",
    "Páginas de comparación para aparecer en Google y ChatGPT",
    `Un plan de ${tasks} pasos para tu producto web`,
  ];
}

type FoundApp = { id: string; name: string; seller: string; icon: string | null; genre: string; country: string; ratingCount: number };

function AppStorePicker({
  projectId,
  answers,
  onPick,
  onClear,
  onNone,
}: {
  projectId: string;
  answers: Answers;
  onPick: (app: FoundApp) => void;
  onClear: () => void;
  onNone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundApp[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const id = window.setTimeout(async () => {
      if (q.length < 2) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/onboarding/app-search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { apps?: FoundApp[] };
        setResults(json.apps ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [query, projectId]);

  const selected = typeof answers.appId === "string" && answers.appId && answers.appId !== NO_APP;
  if (selected) {
    return (
      <div className="ui-blur-rise flex items-center gap-4 rounded-xl border border-[var(--foreground)] bg-white p-4">
        {typeof answers.appIcon === "string" && answers.appIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={answers.appIcon} alt="" className="ui-pop h-14 w-14 rounded-[14px] border border-[var(--border)]" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-[var(--foreground)]">{answers.appName}</p>
          <p className="truncate text-[13px] text-[var(--muted)]">
            {answers.appSeller} · {answers.appGenre}
          </p>
        </div>
        <button type="button" onClick={onClear} className="text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="5.75" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.5 13.5 3.25 3.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre de tu app o apps.apple.com/…"
          aria-label="Buscar tu app en la App Store"
          className="w-full rounded-xl border border-[var(--border)] bg-white py-3.5 pl-11 pr-4 text-[16px] outline-none transition focus:border-[var(--foreground)]"
        />
      </div>

      <div className="mt-2 min-h-[56px]">
        {loading && !results ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ui-skeleton h-[64px] rounded-xl" />
            ))}
          </div>
        ) : results && results.length === 0 ? (
          <p className="px-1 py-3 text-[14px] text-[var(--muted)]">No encontramos ninguna app. Prueba con el enlace de su ficha.</p>
        ) : results ? (
          <ul className={`ui-stagger space-y-1.5 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {results.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => onPick(app)}
                  className="ui-press ui-lift flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-2.5 text-left hover:border-[var(--foreground)]"
                >
                  {app.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.icon} alt="" className="h-11 w-11 shrink-0 rounded-[11px] border border-[var(--border)]" />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-[11px] bg-[var(--surface-alt)]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[var(--foreground)]">{app.name}</span>
                    <span className="block truncate text-[13px] text-[var(--muted)]">
                      {app.seller} · {app.genre}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button type="button" onClick={onNone} className="mt-3 text-[14px] font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline">
        Mi app aún no está publicada
      </button>
    </div>
  );
}

function Option({
  label,
  hint,
  selected,
  multi,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`ui-press flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-200 ${
        selected ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : "border-[var(--border)] bg-white hover:border-[var(--foreground)]"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${multi ? "rounded" : "rounded-full"} ${
          selected ? "border-white bg-white" : "border-[var(--muted-soft)]"
        }`}
      >
        {selected ? <span className={`ui-pop h-2 w-2 bg-[var(--foreground)] ${multi ? "rounded-sm" : "rounded-full"}`} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint ? <span className={`block text-[13px] ${selected ? "text-white/70" : "text-[var(--muted)]"}`}>{hint}</span> : null}
      </span>
    </button>
  );
}

export function Onboarding({
  projectId,
  projectName,
  initial,
  onDone,
  onCancel,
}: {
  projectId: string;
  projectName: string;
  initial: Initial;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(onCancel ? 0 : -1);
  const [type, setType] = useState<BuildType | null>(initial.type);
  const [pitch, setPitch] = useState(initial.pitch ?? "");
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const questions = questionsFor(type, answers);
  const total = type ? questions.length : questionsFor("app").length;
  const question: Question | undefined = questions[step];

  function valueOf(q: Question): string | string[] | undefined {
    if (q.id === "type") return type ?? undefined;
    if (q.id === "pitch") return pitch;
    return answers[q.id];
  }

  function canContinue(q: Question): boolean {
    const v = valueOf(q);
    if (q.optional) return true;
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  }

  async function save() {
    if (!type) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, pitch, answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo guardar");
      const accounts = typeof answers.accounts === "string" ? answers.accounts.trim() : "";
      if (accounts) {
        void fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: accounts }),
        });
      }
      setFinished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step >= questions.length - 1 && type) void save();
    else setStep(step + 1);
  }

  function pick(q: Question, id: string) {
    if (q.id === "type") {
      if (id !== type) setAnswers({});
      setType(id as BuildType);
      window.setTimeout(() => setStep(1), 160);
      return;
    }
    if (q.kind === "multi") {
      const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      const exclusive = id === "none";
      const nextValue = current.includes(id)
        ? current.filter((v) => v !== id)
        : exclusive
          ? [id]
          : [...current.filter((v) => v !== "none"), id];
      setAnswers({ ...answers, [q.id]: nextValue });
      return;
    }
    setAnswers({ ...answers, [q.id]: id });
    window.setTimeout(() => (step >= questions.length - 1 ? undefined : setStep(step + 1)), 160);
  }

  if (finished && type) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 py-16">
        <div className="ui-stagger-slow w-full max-w-[520px]">
          <p className="text-[13px] font-medium text-[var(--muted)]">Todo listo</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
            Vantko está preparado para {type === "app" ? "tu app" : "tu producto web"}.
          </h1>
          <ul className="mt-6 space-y-2.5">
            {preparedFor(type, answers).map((line, i) => (
              <li
                key={line}
                className="ui-blur-rise flex items-start gap-3 text-[15px] text-[var(--foreground)]"
                style={{ animationDelay: `${450 + i * 140}ms` }}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="ui-pop mt-1 h-3.5 w-3.5 shrink-0"
                  style={{ animationDelay: `${600 + i * 140}ms` }}
                  fill="none"
                  aria-hidden
                >
                  <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {line}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDone}
            className="ui-press ui-shine mt-8 rounded-xl bg-[var(--foreground)] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-85"
          >
            Ir a Hoy
          </button>
        </div>
      </div>
    );
  }

  if (step < 0 || !question) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 py-16">
        <div className="ui-stagger-slow w-full max-w-[520px]">
          <p className="text-[13px] font-medium text-[var(--muted)]">{projectName}</p>
          <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
            Es hora de preparar Vantko para ti.
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted)]">
            Unas pocas preguntas, menos de un minuto. Con tus respuestas ajustamos las herramientas, el plan y las métricas a lo que has construido.
          </p>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="ui-press ui-shine mt-8 rounded-xl bg-[var(--foreground)] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-85"
          >
            Empezar
          </button>
        </div>
      </div>
    );
  }

  const value = valueOf(question);
  const isLast = step >= questions.length - 1 && Boolean(type);

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-16">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full bg-[var(--foreground)] transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <span className="text-[12px] tabular-nums text-[var(--muted)]">
            {step + 1}/{total}
          </span>
        </div>

        <div key={`${type}-${step}`} className="ui-step-in">
        <h1 className="mt-8 text-[26px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">{question.title}</h1>
        {question.hint ? <p className="mt-2 text-[15px] text-[var(--muted)]">{question.hint}</p> : null}

        <div className="ui-stagger mt-6 space-y-2">
          {question.kind === "appstore" ? (
            <AppStorePicker
              projectId={projectId}
              answers={answers}
              onPick={(app) => {
                setAnswers({
                  ...answers,
                  appId: app.id,
                  appName: app.name,
                  appIcon: app.icon ?? "",
                  appSeller: app.seller,
                  appGenre: app.genre,
                  appCountry: app.country,
                  stores: Array.isArray(answers.stores) && answers.stores.length ? answers.stores : ["ios"],
                });
                window.setTimeout(() => setStep(step + 1), 450);
              }}
              onClear={() => {
                const rest = { ...answers };
                for (const key of ["appId", "appName", "appIcon", "appSeller", "appGenre", "appCountry"]) delete rest[key];
                setAnswers(rest);
              }}
              onNone={() => {
                setAnswers({ ...answers, appId: NO_APP, stores: ["none"] });
                setStep(step + 1);
              }}
            />
          ) : question.kind === "accounts" ? (
            <textarea
              autoFocus
              rows={4}
              value={typeof value === "string" ? value : ""}
              placeholder={question.placeholder}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 text-[15px] leading-relaxed outline-none transition focus:border-[var(--foreground)]"
            />
          ) : question.kind === "text" ? (
            <input
              autoFocus
              value={typeof value === "string" ? value : ""}
              placeholder={question.placeholder}
              maxLength={200}
              onChange={(e) => {
                if (question.id === "pitch") setPitch(e.target.value);
                else setAnswers({ ...answers, [question.id]: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canContinue(question)) next();
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 text-[16px] outline-none transition focus:border-[var(--foreground)]"
            />
          ) : (
            question.options?.map((o) => (
              <Option
                key={o.id}
                label={o.label}
                hint={o.hint}
                multi={question.kind === "multi"}
                selected={Array.isArray(value) ? value.includes(o.id) : value === o.id}
                onClick={() => pick(question, o.id)}
              />
            ))
          )}
        </div>

        </div>

        {error ? <p className="mt-4 text-[14px] text-red-600">{error}</p> : null}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? (onCancel ? onCancel() : setStep(-1)) : setStep(step - 1))}
            className="text-[14px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {step === 0 && onCancel ? "Cancelar" : "Atrás"}
          </button>
          {question.id !== "type" ? (
            <button
              type="button"
              onClick={next}
              disabled={!canContinue(question) || saving}
              className="ui-press rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-[14px] font-medium text-white transition hover:opacity-85 disabled:opacity-30"
            >
              {saving ? "Guardando…" : isLast ? "Terminar" : question.optional && !canContinueFilled(value) ? "Saltar" : "Continuar"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function canContinueFilled(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
}
