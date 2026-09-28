"use client";

import { CloseIcon } from "../icons";
import {
  mediaFromCall,
  promptFromCall,
  type ApiCallTrace,
  type InfluencerApiTrace,
} from "@/lib/creator/influencer-api-trace";

function formatCreatedAt(iso?: string | null) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t) || t <= 0) return "";
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

export function InfluencerApiTraceModal({
  open,
  onClose,
  trace,
  createdAt,
}: {
  open: boolean;
  onClose: () => void;
  trace: InfluencerApiTrace | null;
  createdAt?: string | null;
}) {
  if (!open || !trace) return null;
  const exact = Boolean(trace.frame?.recorded || trace.video?.recorded);
  const created = formatCreatedAt(createdAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-trace-title"
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3
              id="api-trace-title"
              className="text-[16px] font-semibold text-[var(--foreground)]"
            >
              Enviado a la API
            </h3>
            {created ? (
              <p className="mt-0.5 text-[13px] font-medium text-[var(--foreground)]">
                Creado el {created}
              </p>
            ) : null}
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              {exact
                ? "Payload exacto de cada llamada: texto e imágenes."
                : "Reconstruido con lo guardado. Los videos nuevos guardan el envío exacto."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {trace.frame ? (
            <CallComposer title="1. Fotograma inicial" call={trace.frame} />
          ) : null}
          {trace.video ? (
            <CallComposer title="2. Video" call={trace.video} />
          ) : null}
          {!trace.frame && !trace.video ? (
            <p className="text-[13px] text-[var(--muted-soft)]">
              Todavía no hay un envío guardado para este video.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CallComposer({ title, call }: { title: string; call: ApiCallTrace }) {
  const prompt = promptFromCall(call);
  const media = mediaFromCall(call);
  const output = (call.outputUrl || "").trim();
  const json = JSON.stringify(call.body, null, 2);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
          {call.method} {call.endpoint}
        </p>
        <p className="font-mono text-[11px] text-[var(--muted-soft)]">
          {call.provider} · {call.model}
          {call.recorded ? "" : " · reconstruido"}
        </p>
      </div>
      {media.length ? (
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
            Imágenes enviadas
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {media.map((item) => (
              <figure
                key={`${item.key}:${item.url}`}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]"
              >
                <img
                  src={item.url}
                  alt=""
                  className="aspect-[9/16] w-full object-cover"
                />
                <figcaption className="truncate px-2 py-1.5 font-mono text-[10px] text-[var(--muted)]">
                  {item.key}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      {output ? (
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
            Imagen generada
          </p>
          <figure className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
            <img
              src={output}
              alt=""
              className="aspect-[9/16] w-full max-h-[360px] object-cover"
            />
            <figcaption className="truncate px-2 py-1.5 font-mono text-[10px] text-[var(--muted)]">
              output
            </figcaption>
          </figure>
        </div>
      ) : null}
      {prompt ? (
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
            prompt
          </span>
          <textarea
            readOnly
            value={prompt}
            className="ui-input min-h-[160px] resize-y font-mono text-[12px] leading-relaxed"
          />
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
          JSON del body
        </span>
        <textarea
          readOnly
          value={json}
          className="ui-input min-h-[180px] resize-y font-mono text-[11px] leading-relaxed"
        />
      </label>
    </section>
  );
}
