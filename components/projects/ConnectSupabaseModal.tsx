"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  connectSupabaseAccount,
  disconnectSupabaseAccount,
} from "@/app/actions/supabase-account";
import { CloseIcon } from "@/components/dashboard/icons";

type ConnectSupabaseModalProps = {
  open: boolean;
  connected: boolean;
  onClose: () => void;
  onChanged: (connected: boolean) => void;
};

export function ConnectSupabaseModal({
  open,
  connected,
  onClose,
  onChanged,
}: ConnectSupabaseModalProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setToken("");
    setError("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
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

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await connectSupabaseAccount(token);
        onChanged(true);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not connect");
      }
    });
  }

  function handleDisconnect() {
    setError("");
    startTransition(async () => {
      try {
        await disconnectSupabaseAccount();
        onChanged(false);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not disconnect");
      }
    });
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
        className="relative w-full max-w-md rounded-xl bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] animate-scale-in"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--accent)] p-4 text-white">
            <div>
              <h2 id={titleId} className="text-[15px] font-semibold">
                {connected ? "Supabase" : "Conectar Supabase"}
              </h2>
              <p className="mt-1 text-[12px] text-white/70">
                Solo ves tus proyectos.
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

        <div className="space-y-3 px-5 pb-5">
          {connected ? (
            <>
              <p className="rounded-xl bg-[#e6ffed] p-4 text-[13px] text-[#0d7a3e]">
                Conectado. Elige proyectos al crear o en Clients.
              </p>
              {error ? (
                <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[#cd3d64]">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn-secondary"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDisconnect}
                  className="ui-btn-secondary !bg-[#fff0f3] !text-[#cd3d64]"
                >
                  {pending ? "…" : "Desconectar"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleConnect} className="space-y-3">
              <ol className="space-y-2 rounded-xl bg-[var(--surface-alt)] p-4 text-[13px] text-[var(--foreground-soft)]">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    1
                  </span>
                  <span>
                    <a
                      href="https://supabase.com/dashboard/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--accent)]"
                    >
                      Access Tokens
                    </a>
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    2
                  </span>
                  <span>Crea un token.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    3
                  </span>
                  <span>Pégalo abajo.</span>
                </li>
              </ol>

              <label className="block rounded-xl bg-[var(--surface-alt)] p-4">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Token
                </span>
                <input
                  ref={inputRef}
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="sbp_…"
                  required
                  className="ui-input font-mono !text-[13px]"
                />
              </label>

              {error ? (
                <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[#cd3d64]">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn-secondary"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="ui-btn-primary disabled:opacity-60"
                >
                  {pending ? "…" : "Conectar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
