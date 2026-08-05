"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { normalizeUrl } from "@/lib/tools";

type CreateToolModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, url: string) => void;
};

export function CreateToolModal({ open, onClose, onCreate }: CreateToolModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setName("");
    setUrl("");
    setError("");
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

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
      setError("Escribe un nombre para la herramienta.");
      return;
    }
    if (!normalized) {
      setError("Pega un link válido (ej. https://ejemplo.com).");
      return;
    }

    try {
      new URL(normalized);
    } catch {
      setError("El link no es válido.");
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
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border border-[#e3e8ee] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] animate-scale-in"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e3e8ee] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-[#0a2540]">
              Nueva herramienta
            </h2>
            <p className="mt-0.5 text-[13px] text-[#697386]">
              Se abrirá como pestaña dentro del dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#697386] transition hover:bg-[#f6f9fc] hover:text-[#0a2540]"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0a2540]">
              Nombre
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Analytics, CRM, Docs…"
              className="w-full rounded-lg border border-[#e3e8ee] bg-white px-3 py-2.5 text-[14px] text-[#0a2540] outline-none transition placeholder:text-[#a3acb9] focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0a2540]">
              Link
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-[#e3e8ee] bg-white px-3 py-2.5 text-[14px] text-[#0a2540] outline-none transition placeholder:text-[#a3acb9] focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-[#fff5f5] px-3 py-2 text-[13px] text-[#cd3d64]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[#425466] transition hover:bg-[#f6f9fc]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#635bff] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(50,50,93,0.12)] transition hover:bg-[#5851ea]"
            >
              Crear y abrir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
