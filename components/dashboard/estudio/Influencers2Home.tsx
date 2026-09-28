"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { influencerCoverUrl, type EstudioInfluencer, loadProductContext, loadProductSummary } from "@/lib/creator/estudio-v1";
import { describeAutopilotRun } from "@/lib/creator/autopilot-status";

import { InfluencersHome } from "./InfluencersHome";

type Run = {
  influencerId?: string;
  id: string;
  idea: string;
  status: string;
  stage: string;
  progress: number;
  videoUrl?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};
const terminal = (run: Run) =>
  Boolean(run.videoUrl) || ["done", "failed", "cancelled"].includes(run.status);

function Arrow({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function Influencers2Home({ projectId }: { projectId: string }) {
  const [influencers, setInfluencers] = useState<EstudioInfluencer[]>([]);
  return <InfluencersHome projectId={projectId} influencers={influencers} onChange={setInfluencers} title="Influencers 2" renderStudio={(influencer, onBack, onOpenPhotos) => <AutopilotStudio key={influencer.id} projectId={projectId} influencer={influencer} onBack={onBack} onOpenPhotos={onOpenPhotos} />} />;
}

function AutopilotStudio({ projectId, influencer, onBack, onOpenPhotos }: { projectId: string; influencer: EstudioInfluencer; onBack: () => void; onOpenPhotos: () => void }) {
  const [idea, setIdea] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<{ idea: string; requestId: string } | null>(null);
  const busy = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/creator/video-autopilot`;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${endpoint}?influencerId=${encodeURIComponent(influencer.id)}`, { cache: "no-store", signal });
      const data = await response.json().catch(() => ({ error: "No pudimos conectar con el estudio. Vuelve a intentarlo en un momento." }));
      if (!response.ok) throw new Error(data.error || "No pudimos cargar tus videos.");
      if (!signal?.aborted) { setRuns(data.runs || []); setConnectionError(""); }
    } catch (cause) {
      if (!signal?.aborted) setConnectionError(cause instanceof Error ? cause.message : "No pudimos actualizar tus videos.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint, influencer.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return refresh(controller.signal); });
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(controller.signal); }, 6000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  async function createVideo() {
    const text = idea.trim();
    if (text.length < 8 || busy.current) return;
    busy.current = true;
    setSubmitting(true); setError("");
    if (!pending.current || pending.current.idea !== text) {
      let saved: { idea: string; requestId: string } | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(`video-autopilot:pending:${projectId}:${influencer.id}`) || "null"); } catch { /* Private browsing can disable storage. */ }
      pending.current = saved?.idea === text && typeof saved.requestId === "string" ? saved : { idea: text, requestId: crypto.randomUUID() };
      try { sessionStorage.setItem(`video-autopilot:pending:${projectId}:${influencer.id}`, JSON.stringify(pending.current)); } catch { /* In-memory idempotency remains available. */ }
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pending.current, influencerId: influencer.id, productContext: loadProductContext(projectId) || loadProductSummary(projectId) }),
      });
      const data = await response.json().catch(() => ({ error: "No pudimos conectar con el estudio. Vuelve a intentarlo en un momento." }));
      if (!response.ok) { if (response.status >= 400 && response.status < 500) pending.current = null; throw new Error(data.error || "No pudimos empezar el video."); }
      if (!data.run?.id) throw new Error("No recibimos la confirmación. Inténtalo de nuevo para recuperar tu solicitud.");
      setRuns(previous => [data.run, ...previous.filter(run => run.id !== data.run.id)]);
      pending.current = null; setIdea("");
      try { sessionStorage.removeItem(`video-autopilot:pending:${projectId}:${influencer.id}`); } catch { /* Storage is optional. */ }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos confirmar tu solicitud. Inténtalo de nuevo."); }
    finally { busy.current = false; setSubmitting(false); }
  }

  const active = runs.filter(run => !terminal(run));
  const finished = runs.filter(terminal);

  useEffect(() => {
    if (!active.length) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [active.length]);
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-9 lg:py-14">
      <button type="button" onClick={onBack} className="mb-6 text-sm text-slate-500 hover:text-slate-900">← Influencers 2</button>
      <div className="mb-10 flex items-center gap-4">
        {influencerCoverUrl(influencer) && <Image unoptimized width={56} height={56} src={influencerCoverUrl(influencer)!} alt="" className="h-14 w-14 rounded-2xl object-cover" />}
        <div className="flex-1"><h2 className="text-xl font-semibold text-slate-900">{influencer.name}</h2><p className="mt-1 text-sm text-slate-500">Videos en {influencer.language === "en" ? "inglés" : "español"}</p></div>
        <button type="button" onClick={onOpenPhotos} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Perfil y fotos</button>
      </div>
      <section className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">De la idea al video</p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Tú tienes la idea.<br /><span className="text-slate-400">Nosotros hacemos el video.</span></h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">Cuéntala en una frase. La historia, las tomas y el producto se trabajan detrás de escena.</p>
        <form className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_40px_-18px_rgba(15,23,42,0.2)] transition focus-within:border-[var(--accent-border)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]" onSubmit={event => { event.preventDefault(); void createVideo(); }}>
          <label htmlFor="video-idea" className="sr-only">Tu idea para el video</label>
          <textarea ref={textarea} id="video-idea" value={idea} onChange={event => setIdea(event.target.value)} placeholder={`${influencer.name} descubre esta app y la usa durante su día…`} maxLength={500} rows={4} disabled={submitting} className="block w-full resize-none border-0 bg-transparent px-6 pt-6 text-lg leading-8 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60" />
          <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-3">
            <span className="text-xs text-slate-400">Duración automática · voz incluida</span>
            <button type="submit" disabled={idea.trim().length < 8 || submitting} className="inline-flex min-h-12 items-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35">
              {submitting ? "Preparando…" : "Crear video"}<Arrow />
            </button>
          </div>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-slate-400">Prueba una idea</span>
          {["Una situación cotidiana que esta app resuelve", "Un día conmigo usando esta app", "Ojalá hubiera descubierto esto antes"].map(example => <button type="button" key={example} disabled={submitting} onClick={() => { setIdea(example); textarea.current?.focus(); }} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-500 transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]">{example}</button>)}
        </div>
      </section>
      <section className="mt-16 border-t border-slate-100 pt-7" aria-label="Tus videos">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-semibold tracking-tight text-slate-900">Tus videos</h2><span className="text-xs text-slate-400">{runs.filter(run => run.videoUrl).length} terminados</span></div>
        {connectionError && <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{connectionError}</span><button className="shrink-0 underline" onClick={() => void refresh()}>Actualizar</button></div>}
        <div className="space-y-3" aria-live="polite">
          {active.map(run => {
            const view = describeAutopilotRun(run, now);
            return (
              <article key={run.id} className="flex items-center gap-5 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5" aria-label={`${view.title}. ${view.detail}`}>
                <div className="relative flex h-14 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--accent)]">
                  {view.live ? (
                    <svg className="h-5 w-5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="2"/><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]/80" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{run.idea}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{view.title}</p>
                  <p className="mt-1 text-xs tabular-nums text-slate-400">{view.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {finished.map(run => {
            const view = describeAutopilotRun(run, now);
            return (
              <article key={run.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {run.videoUrl ? <div className="aspect-[9/16] bg-slate-950"><video controls playsInline preload="metadata" src={run.videoUrl} className="h-full w-full object-contain" aria-label={run.idea} /></div> : <div className="flex min-h-40 items-center bg-slate-50 p-5"><p className="text-sm leading-6 text-slate-600">{view.detail}</p></div>}
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-800">{run.idea}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span className="tabular-nums">
                      <time dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}</time>
                      {view.ready && view.elapsed ? ` · Tardó ${view.elapsed}` : null}
                    </span>
                    {run.videoUrl ? <a href={run.videoUrl} target="_blank" rel="noreferrer" download className="font-medium text-slate-800 hover:text-[var(--accent)]">Descargar ↗</a> : <button onClick={() => { setIdea(run.idea); textarea.current?.focus(); textarea.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="font-medium text-slate-800 hover:text-[var(--accent)]">Volver a intentarlo</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!runs.length && !connectionError && <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center"><p className="text-sm text-slate-400">{loading ? "Cargando tus videos…" : "Tu próxima idea empieza arriba. Tu video aparecerá aquí."}</p></div>}
      </section>
    </div>
  );
}
