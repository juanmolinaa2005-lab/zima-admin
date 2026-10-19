"use client";

import { useEffect, useState } from "react";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { StudioPage } from "./studio-ui";
import {
  loadViralResult,
  saveViralResult,
  type EstudioViralHit,
} from "@/lib/creator/estudio-v1";
import {
  detectViralPlatform,
  formatViralDate,
  socialEmbed,
  type ViralHit,
  type ViralPlatform,
} from "@/lib/creator/viral-content";

const PLATFORM_LABEL: Record<ViralPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  other: "Link",
};

function toHit(item: EstudioViralHit): ViralHit {
  const media = item.videoUrl || item.sourceUrl || "";
  const platform = detectViralPlatform(media);
  return {
    name: item.name || "Formato",
    structure: item.structure || "",
    why: item.why || "",
    hooks: Array.isArray(item.hooks) ? item.hooks : [],
    sourceUrl: item.sourceUrl || null,
    videoUrl: item.videoUrl || null,
    videoNote: item.videoNote || "",
    videoDescription: item.videoDescription || "",
    howToUse: item.howToUse || "",
    platform:
      item.platform === "tiktok" ||
      item.platform === "instagram" ||
      item.platform === "youtube" ||
      item.platform === "x" ||
      item.platform === "other"
        ? item.platform
        : platform,
  };
}

function ViralEmbed({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <div className="flex aspect-[9/16] items-center justify-center bg-[var(--accent)] px-4 text-center text-[12px] font-medium text-white/70">
        {label || "Sin video exacto"}
      </div>
    );
  }
  const embed = socialEmbed(url);
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-[9/16] items-center justify-center bg-[var(--accent)] px-4 text-center text-[12px] font-medium text-white/80"
      >
        Abrir video
      </a>
    );
  }
  return (
    <div
      className={
        embed.aspect === "9/16" ? "aspect-[9/16] bg-black" : "aspect-video bg-black"
      }
    >
      <iframe
        src={embed.embedUrl}
        title="Video"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export function ViralContentHome({ projectId }: { projectId: string }) {
  const [report, setReport] = useState("");
  const [hits, setHits] = useState<ViralHit[]>([]);
  const [today, setToday] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [fal, setFal] = useState<{ connected: boolean } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setToday(formatViralDate());
    const saved = loadViralResult(projectId);
    if (saved) {
      setReport(saved.report);
      setHits(saved.items.map(toHit));
    }
    void fetch("/api/fal/settings")
      .then((res) => res.json())
      .then((data) => setFal({ connected: Boolean(data.connected) }))
      .catch(() => setFal({ connected: false }));
  }, [projectId]);

  async function generate() {
    const date = formatViralDate();
    setToday(date);
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/creator/viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "No se pudo buscar");
      }
      const next = (data.items ?? []) as ViralHit[];
      const nextReport = typeof data.report === "string" ? data.report : "";
      setHits(next);
      setReport(nextReport);
      setReportOpen(false);
      saveViralResult(projectId, {
        report: nextReport,
        items: next,
        generatedAt:
          typeof data.generatedAt === "string"
            ? data.generatedAt
            : new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <StudioPage
      kicker="Preparar"
      title="Ideas virales"
      description="Formatos que ya funcionan en TikTok para apps. Elige uno y úsalo como referencia, no como receta rígida."
      actions={
        <>
          <button
            type="button"
            disabled={generating}
            onClick={() => void generate()}
            className="ui-btn-primary"
          >
            {generating ? "Buscando…" : "Buscar formatos"}
          </button>
          <span className="text-[12px] text-zinc-500">{today || "—"}</span>
        </>
      }
    >
      {fal && !fal.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="fal.ai"
            message="Conecta fal.ai en Supabase → Secrets para que Grok busque contenido viral."
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {generating && !report && hits.length === 0 ? (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-16 text-center text-[14px] text-[var(--muted-soft)]">
          Grok está investigando formatos en X…
        </div>
      ) : null}

      {!generating && !report && hits.length === 0 && !error ? (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-16 text-center">
          <h3 className="text-[18px] font-semibold text-[var(--foreground)]">
            10 formatos que convierten
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[var(--muted-soft)]">
            Pulsa Generate. Grok busca en X formatos de TikTok con views +
            descargas para apps, con fecha de corte de hoy.
          </p>
        </div>
      ) : null}

      {report ? (
        <article className="mt-7 rounded-xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
              Respuesta de Grok
            </p>
            <button
              type="button"
              onClick={() => setReportOpen((v) => !v)}
              className="shrink-0 text-[12px] font-semibold text-[var(--accent)] hover:text-[#c2410c]"
            >
              {reportOpen ? "Ver menos" : "Ver más"}
            </button>
          </div>
          {reportOpen ? (
            <div className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--foreground-soft)]">
              {report}
            </div>
          ) : null}
        </article>
      ) : null}

      {hits.length > 0 ? (
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {hits.map((hit, index) => (
            <li
              key={`${hit.videoUrl || hit.sourceUrl || hit.name}-${index}`}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]"
            >
              <ViralEmbed
                url={hit.videoUrl || hit.sourceUrl}
                label={hit.videoNote || "Sin video exacto"}
              />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                    {PLATFORM_LABEL[hit.platform]}
                  </span>
                  {hit.videoUrl || hit.sourceUrl ? (
                    <a
                      href={(hit.videoUrl || hit.sourceUrl) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Abrir original
                    </a>
                  ) : null}
                </div>
                <p className="text-[15px] font-semibold leading-snug text-[var(--foreground)]">
                  {hit.name}
                </p>
                {hit.videoDescription || hit.videoNote ? (
                  <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                    {hit.videoDescription || hit.videoNote}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </StudioPage>
  );
}
