"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { normalizeUrl } from "@/lib/types";

type CreateToolModalProps = {
  open: boolean;
  mode?: "app" | "social";
  onClose: () => void;
  onCreate: (name: string, url: string) => void;
};

export function CreateToolModal({
  open,
  mode = "app",
  onClose,
  onCreate,
}: CreateToolModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isSocial = mode === "social";

  useEffect(() => {
    if (!open) return;
    setName("");
    setUrl("");
    setError("");
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const normalized = normalizeUrl(url);

    if (!trimmedName) {
      setError(
        isSocial
          ? "Enter a name (e.g. Instagram, TikTok…)."
          : "Enter a name for the tool."
      );
      return;
    }
    if (!normalized) {
      setError("Paste a valid link (e.g. https://instagram.com/…).");
      return;
    }

    try {
      new URL(normalized);
    } catch {
      setError("That link is not valid.");
      return;
    }

    onCreate(trimmedName, normalized);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px] animate-fade-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)] animate-scale-in"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--accent)] p-4 text-white">
            <div>
              <h2 id={titleId} className="text-[15px] font-semibold">
                {isSocial ? "Nueva red" : "Nuevo acceso directo"}
              </h2>
              <p className="mt-1 text-[12px] text-white/70">
                Se abre en otra pestaña.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
              aria-label="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 pb-5">
          <label className="block rounded-xl bg-[var(--surface-alt)] p-4">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Nombre
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isSocial ? "Instagram, TikTok…" : "Notion, Linear, Stripe…"
              }
              className="ui-input !text-[14px]"
            />
          </label>

          <label className="block rounded-xl bg-[var(--surface-alt)] p-4">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Link
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="ui-input !text-[14px]"
            />
          </label>

          {error ? (
            <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="ui-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="ui-btn-primary">
              {isSocial ? "Add" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
