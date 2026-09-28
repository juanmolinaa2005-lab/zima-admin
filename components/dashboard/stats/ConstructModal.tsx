"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "../icons";
import type { ConstructPreview, GuideScope } from "@/lib/stats/types";
import type { ConstructedSpec } from "@/lib/stats/construct";
import { kindLabel } from "./ui";

type Step = "url" | "analyzing" | "connect" | "saving";

function ScopePills({ scopes }: { scopes: GuideScope[] }) {
  const on = scopes.filter((s) => s.required);
  const off = scopes.filter((s) => !s.required);
  if (on.length === 0 && off.length === 0) return null;
  return (
    <div className="space-y-3 rounded-xl bg-[var(--surface-alt)] p-3.5">
      {on.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Marca
          </p>
          <div className="flex flex-wrap gap-1.5">
            {on.map((s) => (
              <span
                key={s.name}
                className="inline-flex max-w-full flex-col rounded-full bg-[var(--accent)] px-3 py-1.5 text-white"
              >
                <span className="text-[12px] font-semibold leading-none">{s.name}</span>
                {s.note ? (
                  <span className="mt-1 text-[10px] font-medium leading-none text-white/65">
                    {s.note}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {off.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            No marques
          </p>
          <div className="flex flex-wrap gap-1.5">
            {off.map((s) => (
              <span
                key={s.name}
                className="inline-flex max-w-full flex-col rounded-full border border-[#d6d9e1] bg-white px-3 py-1.5"
              >
                <span className="text-[12px] font-semibold leading-none text-[var(--foreground)]">
                  {s.name}
                </span>
                {s.note ? (
                  <span className="mt-1 text-[10px] font-medium leading-none text-[var(--muted)]">
                    {s.note}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConstructModal({
  open,
  projectId,
  onClose,
  onAdded,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onAdded: (sourceId: string) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ConstructPreview | null>(null);
  const [constructed, setConstructed] = useState<ConstructedSpec | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setStep("url");
    setUrl("");
    setError("");
    setPreview(null);
    setConstructed(null);
    setFields({});
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "analyzing" && step !== "saving") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open) return null;

  const busy = step === "analyzing" || step === "saving";

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) {
      setError("Pega una web.");
      return;
    }
    setStep("analyzing");
    try {
      const res = await fetch("/api/stats/construct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo analizar esa web");
      const next = data as ConstructPreview & { constructed?: ConstructedSpec };
      if (next.alreadyAdded) {
        throw new Error(`${next.connector.name} ya está aquí.`);
      }
      setPreview(next);
      setConstructed(next.constructed ?? null);
      const initial: Record<string, string> = {};
      for (const field of next.connector.credentials) initial[field.id] = "";
      setFields(initial);
      setStep("connect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStep("url");
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setError("");
    const needsKey = !preview.alreadyConnected;
    if (needsKey) {
      const missing = preview.connector.credentials.find(
        (c) => c.required !== false && !fields[c.id]?.trim()
      );
      if (missing) {
        setError(`Falta ${missing.label}.`);
        return;
      }
    }
    setStep("saving");
    try {
      const res = await fetch("/api/stats/construct/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          slug: preview.cached ? preview.connector.slug : undefined,
          websiteUrl: preview.connector.websiteUrl || url,
          constructed,
          credentials: needsKey ? fields : {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo conectar");
      onAdded(data.sourceId as string);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStep("connect");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/50 backdrop-blur-[3px] animate-fade-in"
        aria-label="Cerrar"
        onClick={() => {
          if (busy) return;
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-[440px] overflow-hidden rounded-xl bg-white shadow-[0_20px_60px_rgba(22,24,29,0.22)] animate-scale-in"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--accent)] p-4 text-white">
            <div>
              <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                Nueva conexión
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25 disabled:opacity-40"
              aria-label="Cerrar"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {step === "url" || step === "analyzing" ? (
          <form onSubmit={analyze} className="space-y-3 px-5 pb-5">
            <label className="block rounded-xl bg-[var(--surface-alt)] p-3.5">
              <span className="mb-2 block text-[13px] font-medium text-[var(--muted)]">
                Introduce la web que quieres las estadísticas
              </span>
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="openai.com"
                className="h-11 w-full rounded-full border-0 bg-white px-4 text-[14px] text-[var(--foreground)] outline-none ring-1 ring-[#e6e8ef] placeholder:text-[var(--muted-soft)] focus:ring-2 focus:ring-[var(--accent)]"
                disabled={step === "analyzing"}
              />
            </label>
            {step === "analyzing" ? (
              <div className="rounded-xl bg-[var(--surface-alt)] p-4 text-[13px] font-medium text-[var(--accent-ink)]">
                Leyendo la API…
              </div>
            ) : null}
            {error ? (
              <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-full bg-[var(--surface-alt)] px-4 text-[13px] font-semibold text-[var(--foreground)]"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={step === "analyzing"}
                className="h-10 rounded-full bg-[var(--accent)] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {step === "analyzing" ? "Armando…" : "Armar"}
              </button>
            </div>
          </form>
        ) : preview ? (
          <form
            onSubmit={confirm}
            className="max-h-[calc(90vh-88px)] space-y-3 overflow-y-auto px-5 pb-5"
          >
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-alt)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">
                  {preview.connector.name}
                </p>
                {preview.connector.keyType ? (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                    {preview.connector.keyType}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]">
                {kindLabel(preview.connector.kind)}
              </span>
            </div>

            {preview.alreadyConnected ? (
              <p className="rounded-xl bg-[var(--success-soft)] px-4 py-3 text-[13px] font-medium text-[var(--success)]">
                Key lista. Solo se añade.
              </p>
            ) : (
              <>
                {(preview.connector.setupSteps?.length ?? 0) > 0 ? (
                  <div className="rounded-xl bg-[var(--surface-alt)] p-3.5">
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Pasos
                    </p>
                    <ol className="space-y-2">
                      {(preview.connector.setupSteps ?? []).map((item, i) => (
                        <li
                          key={`${i}-${item}`}
                          className="flex gap-2.5 text-[13px] leading-snug text-[var(--foreground)]"
                        >
                          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <ScopePills scopes={preview.connector.scopes ?? []} />

                {preview.connector.portalUrl ? (
                  <a
                    href={preview.connector.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-semibold text-white"
                  >
                    {preview.connector.portalLabel || "Abrir key"}
                  </a>
                ) : null}

                {preview.connector.credentials.map((field) => (
                  <label key={field.id} className="block rounded-xl bg-[var(--surface-alt)] p-3.5">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {field.label}
                    </span>
                    <input
                      type={field.type === "secret" ? "password" : "text"}
                      value={fields[field.id] ?? ""}
                      onChange={(e) =>
                        setFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={field.hint || ""}
                      className="h-11 w-full rounded-full border-0 bg-white px-4 text-[14px] text-[var(--foreground)] outline-none ring-1 ring-[#e6e8ef] placeholder:text-[var(--muted-soft)] focus:ring-2 focus:ring-[var(--accent)]"
                      autoComplete="off"
                      disabled={step === "saving"}
                    />
                  </label>
                ))}
              </>
            )}

            {error ? (
              <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={step === "saving"}
                className="h-10 rounded-full bg-[var(--surface-alt)] px-4 text-[13px] font-semibold text-[var(--foreground)] disabled:opacity-40"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={step === "saving"}
                className="h-10 rounded-full bg-[var(--accent)] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {step === "saving" ? "Conectando…" : "Conectar"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
