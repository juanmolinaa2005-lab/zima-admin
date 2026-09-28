"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { loadAppDemo } from "@/lib/creator/app-demo";
import {
  initialRuntime,
  type AppCursor,
  type AppDemoSpec,
  type AppRuntimeState,
} from "@/lib/creator/app-demo";
import { loadProductContext, loadProductSummary } from "@/lib/creator/estudio-v1";
import {
  DEFAULT_APP_DEMO_2,
  deleteDemo,
  duplicateDemo,
  loadAppDemo2,
  saveAppDemo2,
  upsertDemo,
  type AppDemo2Workspace,
  type DemoBundle,
  type DemoStyle,
  type ProductSchema,
  type SavedDemoRecord,
} from "@/lib/creator/app-demo-2";
import { listProducts, resolveProduct } from "@/lib/creator/app-demo-2/catalog";
import { InternalStateExecutor } from "@/lib/creator/app-demo-2/controller";
import { serializeDemoBundle } from "@/lib/creator/app-demo-2/compile";
import { playDemoSpec } from "@/lib/creator/app-demo-2/play";
import { StudioPage } from "./studio-ui";
import { AppDemo2PhonePreview } from "./app-demo-2/AppDemo2PhonePreview";

type InspectorTab =
  | "schema"
  | "demo"
  | "ui"
  | "timeline"
  | "gestures"
  | "raw";

const STYLES: { id: DemoStyle; label: string }[] = [
  { id: "fast", label: "Fast" },
  { id: "normal", label: "Normal" },
  { id: "detailed", label: "Detailed" },
];

const VARIATION_COUNTS = [3, 5, 10, 20] as const;

function formatMs(t: number) {
  return `${(t / 1000).toFixed(1)}s`;
}

function activeBundle(ws: AppDemo2Workspace): DemoBundle | null {
  return ws.demos.find((d) => d.id === ws.activeId)?.bundle || ws.demos[0]?.bundle || null;
}

export function AppDemo2Home({ projectId }: { projectId: string }) {
  const [ws, setWs] = useState<AppDemo2Workspace>(DEFAULT_APP_DEMO_2);
  const [loaded, setLoaded] = useState(false);
  const [openaiOk, setOpenaiOk] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [varying, setVarying] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("demo");
  const abortRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<{
    spec: AppDemoSpec;
    state: AppRuntimeState;
    cursor: AppCursor | null;
  } | null>(null);

  const savedAppSpec = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const draft = loadAppDemo(projectId);
      return draft.spec && draft.spec.screens.length > 0 ? draft.spec : null;
    } catch {
      return null;
    }
  }, [projectId, loaded]);

  const adapter = useMemo(
    () =>
      resolveProduct({
        productId: ws.productId,
        appSpec: ws.productId === "from-app-demo" ? savedAppSpec : null,
      }),
    [ws.productId, savedAppSpec]
  );

  const bundle = activeBundle(ws);
  const schema: ProductSchema = adapter.schema;

  useEffect(() => {
    setWs(loadAppDemo2(projectId));
    setLoaded(true);
    void fetch("/api/openai/api-settings")
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => setOpenaiOk(Boolean(d.connected)))
      .catch(() => setOpenaiOk(false));
  }, [projectId]);

  useEffect(() => {
    if (!loaded) return;
    saveAppDemo2(projectId, ws);
  }, [loaded, projectId, ws]);

  useEffect(() => {
    const exec = new InternalStateExecutor(adapter);
    const snap = exec.snapshot();
    setPreview({ spec: snap.spec, state: snap.state, cursor: snap.cursor });
    setStepIndex(-1);
  }, [adapter, ws.activeId]);

  function patch(partial: Partial<AppDemo2Workspace>) {
    setWs((cur) => ({ ...cur, ...partial }));
  }

  async function generateDemo() {
    setError("");
    setGenerating(true);
    abortRef.current?.abort();
    setPlaying(false);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/app-demo-2/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: ws.prompt,
            durationTarget: ws.durationTarget,
            style: ws.style,
            productId: adapter.id,
            productNotes:
              loadProductSummary(projectId) || loadProductContext(projectId),
            appSpec: adapter.id === "from-app-demo" ? savedAppSpec : undefined,
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        bundle?: DemoBundle;
      };
      if (!res.ok || !data.bundle) {
        throw new Error(data.message || data.error || "No se pudo generar el demo");
      }
      const record: SavedDemoRecord = {
        id: data.bundle.demo.id,
        name: data.bundle.demo.title,
        createdAt: data.bundle.metadata.createdAt,
        bundle: data.bundle,
      };
      setWs((cur) => upsertDemo(cur, record));
      const exec = new InternalStateExecutor(adapter);
      const snap = exec.snapshot();
      setPreview({ spec: snap.spec, state: snap.state, cursor: snap.cursor });
      setStepIndex(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el demo");
    } finally {
      setGenerating(false);
    }
  }

  async function generateVariations() {
    if (!bundle) return;
    setError("");
    setVarying(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/app-demo-2/variations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: ws.variationCount,
            demo: bundle.demo,
            productId: adapter.id,
            appSpec: adapter.id === "from-app-demo" ? savedAppSpec : undefined,
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        bundles?: DemoBundle[];
      };
      if (!res.ok || !data.bundles?.length) {
        throw new Error(
          data.message || data.error || "No se pudieron generar variaciones"
        );
      }
      setWs((cur) => {
        let next = cur;
        for (const b of data.bundles || []) {
          next = upsertDemo(next, {
            id: b.demo.id,
            name: b.demo.title,
            createdAt: b.metadata.createdAt,
            bundle: b,
          });
        }
        return { ...next, activeId: cur.activeId };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron generar variaciones"
      );
    } finally {
      setVarying(false);
    }
  }

  function resetPreview() {
    abortRef.current?.abort();
    setPlaying(false);
    const exec = new InternalStateExecutor(adapter);
    const snap = exec.snapshot();
    setPreview({ spec: snap.spec, state: snap.state, cursor: snap.cursor });
    setStepIndex(-1);
  }

  function stopDemo() {
    abortRef.current?.abort();
    setPlaying(false);
  }

  async function runDemo() {
    if (!bundle) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);
    setError("");
    try {
      await playDemoSpec(
        adapter,
        bundle.demo,
        (snap, index, status) => {
          setPreview({
            spec: snap.spec,
            state: snap.state,
            cursor: snap.cursor,
          });
          setStepIndex(index);
          if (status === "done") setPlaying(false);
        },
        ac.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "No se pudo ejecutar el demo");
      setPlaying(false);
    }
  }

  function exportJson() {
    if (!bundle) return;
    const blob = new Blob([serializeDemoBundle(bundle)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.demo.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const variations = ws.demos.filter(
    (d) => d.bundle.metadata.variationOf === bundle?.demo.id
  );
  const spec = preview?.spec || adapter.buildSpec();
  const state = preview?.state || initialRuntime(spec);
  const inspectorPayload = {
    schema,
    demo: bundle?.demo ?? null,
    ui: preview
      ? { screen: preview.state.screen, values: preview.state.values }
      : null,
    timeline: bundle?.timeline ?? null,
    gestures: bundle?.gestures ?? null,
    raw: bundle?.rawAi ?? null,
  };

  return (
    <StudioPage
      kicker="Piezas"
      title="App Demo 2"
      description="Prompt → plan semántico → estados de la app y gestos. Listo para video."
      actions={
        bundle ? (
          <button type="button" className="ui-btn-secondary" onClick={exportJson}>
            Export JSON
          </button>
        ) : null
      }
    >
      {openaiOk === false ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="OpenAI"
            message="Conecta OpenAI para generar demos con IA."
          />
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Demo Prompt</h3>
            <textarea
              value={ws.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              rows={5}
              placeholder='Create a short demo showing a student creating a reminder to submit an assignment tomorrow at 8 AM.'
              className="mt-3 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
            />
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-[12px] font-medium text-[var(--muted)]">
                Target duration
                <select
                  className="ui-input mt-1"
                  value={ws.durationTarget}
                  onChange={(e) =>
                    patch({ durationTarget: Number(e.target.value) || 6 })
                  }
                >
                  {[5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} sec
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-[var(--muted)]">
                Style
                <select
                  className="ui-input mt-1"
                  value={ws.style}
                  onChange={(e) => patch({ style: e.target.value as DemoStyle })}
                >
                  {STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-[var(--muted)]">
                Product
                <select
                  className="ui-input mt-1"
                  value={ws.productId}
                  onChange={(e) => patch({ productId: e.target.value })}
                >
                  {listProducts().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {savedAppSpec ? (
                    <option value="from-app-demo">Desde App Demo</option>
                  ) : null}
                </select>
              </label>
              <button
                type="button"
                className="ui-btn-primary"
                disabled={generating || openaiOk === false || !ws.prompt.trim()}
                onClick={() => void generateDemo()}
              >
                {generating ? "Generando…" : "Generate Demo"}
              </button>
            </div>
          </section>

          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Demo Steps</h3>
            {bundle ? (
              <>
                <ol className="mt-3 space-y-2">
                  {bundle.steps.map((step, i) => {
                    const status =
                      playing && i === stepIndex
                        ? "running"
                        : stepIndex > i || (!playing && stepIndex >= bundle.steps.length)
                          ? "done"
                          : "idle";
                    return (
                      <li
                        key={step.id}
                        className={`flex gap-3 rounded-2xl border px-3 py-2.5 text-[13px] ${
                          status === "running"
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--background)]"
                        }`}
                      >
                        <span className="w-5 shrink-0 font-semibold text-[var(--muted)]">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium capitalize text-[var(--foreground)]">
                            {step.action}
                            {step.target ? ` · ${step.target}` : ""}
                          </p>
                          {step.value ? (
                            <p className="truncate text-[var(--muted)]">“{step.value}”</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] text-[var(--muted-soft)]">
                          {step.duration}ms
                          {status === "running" ? " · run" : status === "done" ? " · ok" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ui-btn-primary"
                    disabled={playing}
                    onClick={() => void runDemo()}
                  >
                    Run Demo
                  </button>
                  <button
                    type="button"
                    className="ui-btn-secondary"
                    disabled={!playing}
                    onClick={stopDemo}
                  >
                    Stop
                  </button>
                  <button type="button" className="ui-btn-secondary" onClick={resetPreview}>
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--muted-soft)]">
                Genera un demo para ver los pasos y ejecutarlos en el preview.
              </p>
            )}
          </section>

          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Variations</h3>
              <div className="flex items-center gap-2">
                <select
                  className="ui-input w-auto"
                  value={ws.variationCount}
                  onChange={(e) =>
                    patch({
                      variationCount: Number(e.target.value) as 3 | 5 | 10 | 20,
                    })
                  }
                >
                  {VARIATION_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ui-btn-secondary"
                  disabled={!bundle || varying || openaiOk === false}
                  onClick={() => void generateVariations()}
                >
                  {varying ? "Variando…" : "Generate Variations"}
                </button>
              </div>
            </div>
            {variations.length ? (
              <ol className="mt-3 space-y-2">
                {variations.map((v, i) => {
                  const typed = v.bundle.steps.find((s) => s.action === "type")?.value;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-left text-[13px] hover:border-[#93c5fd]"
                        onClick={() => patch({ activeId: v.id })}
                      >
                        <span className="font-medium text-[var(--foreground)]">
                          {i + 1}. {v.name}
                        </span>
                        {typed ? (
                          <span className="mt-0.5 block text-[var(--muted)]">“{typed}”</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--muted-soft)]">
                Mismo flujo, distinto copy y datos para muchos videos.
              </p>
            )}
          </section>

          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Timeline</h3>
            {bundle ? (
              <ol className="mt-3 max-h-64 space-y-1 overflow-auto text-[12px]">
                {bundle.timeline.map((ev, i) => (
                  <li key={`${ev.t}-${i}`} className="flex gap-3 font-mono text-[var(--foreground-soft)]">
                    <span className="w-12 shrink-0 text-[var(--muted-soft)]">{formatMs(ev.t)}</span>
                    <span>{ev.label}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--muted-soft)]">
                Estados de UI y gestos alineados en milisegundos.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="studio-card rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-3 px-1 text-[15px] font-semibold text-[var(--foreground)]">
              App Preview
            </h3>
            <AppDemo2PhonePreview
              spec={spec}
              state={state}
              cursor={preview?.cursor}
            />
            <p className="mt-3 px-1 text-center text-[12px] text-[var(--muted-soft)]">
              {preview?.state.screen || schema.startScreen}
              {playing ? " · ejecutando" : ""}
            </p>
          </section>

          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Product Model</h3>
            <p className="mt-1 text-[12px] text-[var(--muted-soft)]">
              {schema.name} · {schema.features.length} features ·{" "}
              {schema.elements.length} targets
            </p>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {schema.features.map((f) => (
                <div key={f.id} className="rounded-2xl bg-[var(--background)] px-3 py-2">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{f.name}</p>
                  <p className="text-[12px] text-[var(--muted)]">{f.description}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted-soft)]">
                    {f.availableActions.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="studio-card rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Guardados</h3>
            {ws.demos.length ? (
              <ul className="mt-3 space-y-2">
                {ws.demos.map((d) => (
                  <li
                    key={d.id}
                    className={`rounded-2xl border px-3 py-2 ${
                      d.id === ws.activeId
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left text-[13px] font-medium text-[var(--foreground)]"
                      onClick={() => patch({ activeId: d.id })}
                    >
                      {d.name}
                    </button>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[var(--muted)]"
                        onClick={() => setWs((cur) => duplicateDemo(cur, d.id))}
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[var(--danger)]"
                        onClick={() => setWs((cur) => deleteDemo(cur, d.id))}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--muted-soft)]">Aún no hay demos.</p>
            )}
          </section>
        </div>
      </div>

      <section className="studio-card mt-5 rounded-xl border border-[var(--border)] p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => patch({ inspectorOpen: !ws.inspectorOpen })}
        >
          <span className="text-[15px] font-semibold text-[var(--foreground)]">Inspector</span>
          <span className="text-[12px] text-[var(--muted-soft)]">
            {ws.inspectorOpen ? "Ocultar" : "Mostrar"}
          </span>
        </button>
        {ws.inspectorOpen ? (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["schema", "Product Schema"],
                  ["demo", "Demo Spec"],
                  ["ui", "UI State"],
                  ["timeline", "Timeline"],
                  ["gestures", "Gestures"],
                  ["raw", "Raw AI"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInspectorTab(id)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                    inspectorTab === id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-alt)] text-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-[#111827] p-4 text-[11px] leading-relaxed text-[#e5e7eb]">
              {JSON.stringify(inspectorPayload[inspectorTab], null, 2)}
            </pre>
          </>
        ) : null}
      </section>
    </StudioPage>
  );
}
