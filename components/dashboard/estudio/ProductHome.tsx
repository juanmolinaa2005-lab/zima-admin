"use client";

import { useEffect, useRef, useState } from "react";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { StudioPage } from "./studio-ui";
import {
  PRODUCT_SUMMARY_MAX,
  loadProductContext,
  loadProductSummary,
  saveProductContext,
  saveProductSummary,
} from "@/lib/creator/estudio-v1";

type SaveStatus = "idle" | "saving" | "saved";

export function ProductHome({ projectId }: { projectId: string }) {
  const [details, setDetails] = useState("");
  const [summary, setSummary] = useState("");
  const [detailsStatus, setDetailsStatus] = useState<SaveStatus>("idle");
  const [summaryStatus, setSummaryStatus] = useState<SaveStatus>("idle");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [openaiOk, setOpenaiOk] = useState<boolean | null>(null);
  const skipDetails = useRef(true);
  const skipSummary = useRef(true);

  useEffect(() => {
    setDetails(loadProductContext(projectId));
    setSummary(loadProductSummary(projectId));
    skipDetails.current = true;
    skipSummary.current = true;
    setDetailsStatus("idle");
    setSummaryStatus("idle");
    setError("");
    void fetch("/api/openai/api-settings")
      .then((res) => res.json())
      .then((data) => setOpenaiOk(Boolean(data.connected)))
      .catch(() => setOpenaiOk(false));
  }, [projectId]);

  useEffect(() => {
    if (skipDetails.current) {
      skipDetails.current = false;
      return;
    }
    setDetailsStatus("saving");
    const id = window.setTimeout(() => {
      saveProductContext(projectId, details);
      setDetailsStatus("saved");
    }, 400);
    return () => window.clearTimeout(id);
  }, [projectId, details]);

  useEffect(() => {
    if (skipSummary.current) {
      skipSummary.current = false;
      return;
    }
    setSummaryStatus("saving");
    const id = window.setTimeout(() => {
      saveProductSummary(projectId, summary);
      setSummaryStatus("saved");
    }, 400);
    return () => window.clearTimeout(id);
  }, [projectId, summary]);

  async function generateSummary() {
    const source = details.trim() || loadProductContext(projectId);
    if (!source) {
      setError("Pega primero los detalles del producto y luego genera el resumen.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/product/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productContext: source }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "No se pudo generar el resumen");
      }
      const next = typeof data.summary === "string" ? data.summary : "";
      if (!next.trim()) throw new Error("ChatGPT devolvió un resumen vacío");
      skipSummary.current = false;
      setSummary(next);
      saveProductSummary(projectId, next);
      setSummaryStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el resumen");
    } finally {
      setGenerating(false);
    }
  }

  const summaryLen = summary.trim().length;
  const overLimit = summaryLen > PRODUCT_SUMMARY_MAX;

  return (
    <StudioPage
      narrow
      kicker="Preparar"
      title="Producto"
      description="Esto es lo que la app vende. El detalle largo alimenta Blitz. El resumen corto entra en los videos."
    >
      {openaiOk === false ? (
        <div className="mb-5">
        <ApiMissingBanner
          projectId={projectId}
          providerName="OpenAI"
          message="Conecta OpenAI para generar el resumen corto."
        />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                Detalles
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Brief completo para Blitz: marca, audiencia, tono, oferta y
                claims. Cuanto más concreto, mejor el carrusel.
              </p>
            </div>
            <span className="text-[11px] text-[var(--muted-soft)]">
              {detailsStatus === "saving"
                ? "Guardando…"
                : detailsStatus === "saved"
                  ? "Guardado"
                  : ""}
            </span>
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={14}
            placeholder="Marca, producto, audiencia, tono, oferta…"
            className="mt-4 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
          />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                Resumen corto
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Hasta {PRODUCT_SUMMARY_MAX} caracteres: nombre, a quién va, dolor,
                promesa y CTA. Lo usa Kling en el studio del influencer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] ${
                  overLimit ? "font-semibold text-[var(--danger)]" : "text-[var(--muted-soft)]"
                }`}
              >
                {summaryLen}/{PRODUCT_SUMMARY_MAX}
                {summaryStatus === "saving"
                  ? " · Guardando…"
                  : summaryStatus === "saved"
                    ? " · Guardado"
                    : ""}
              </span>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={generating || openaiOk === false}
                onClick={() => void generateSummary()}
              >
                {generating ? "Generando…" : "Generar resumen"}
              </button>
            </div>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            maxLength={PRODUCT_SUMMARY_MAX + 40}
            placeholder="App X para gente ocupada. El dolor es olvidar Y. Promete Z en 2 minutos. CTA: descárgala."
            className="mt-4 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
          />
        </section>
      </div>
    </StudioPage>
  );
}
