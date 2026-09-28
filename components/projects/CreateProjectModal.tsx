"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProject,
  fetchRemoteSupabaseProjects,
} from "@/app/actions/projects";
import type { SupabaseRemoteProject } from "@/lib/types";
import { CloseIcon } from "@/components/dashboard/icons";
import { loadRemotesCache, saveRemotesCache } from "@/lib/client-cache";

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  userKey: string;
  onNeedConnect: () => void;
};

export function CreateProjectModal({
  open,
  onClose,
  connected,
  userKey,
  onNeedConnect,
}: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supabaseRef, setSupabaseRef] = useState("");
  const [remotes, setRemotes] = useState<SupabaseRemoteProject[]>([]);
  const [error, setError] = useState("");
  const [loadingRemotes, setLoadingRemotes] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setSupabaseRef("");
    setError("");
    setNotConnected(!connected);
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);

    if (!connected) {
      setRemotes([]);
      setLoadingRemotes(false);
      return () => window.clearTimeout(t);
    }

    const cached = loadRemotesCache(userKey);
    if (cached) {
      setRemotes(cached.data);
      setLoadingRemotes(false);
    } else {
      setLoadingRemotes(true);
    }

    fetchRemoteSupabaseProjects()
      .then((list) => {
        saveRemotesCache(list, userKey);
        setRemotes(list);
        setNotConnected(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "NOT_CONNECTED") {
          setNotConnected(true);
          setRemotes([]);
        } else if (!cached) {
          setRemotes([]);
        }
      })
      .finally(() => setLoadingRemotes(false));

    return () => window.clearTimeout(t);
  }, [open, connected, userKey]);

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
    setError("");
    startTransition(async () => {
      try {
        const project = await createProject({
          name,
          description,
          supabase_project_ref: supabaseRef || null,
        });
        onClose();
        router.push(`/projects/${project.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create project");
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
                Nuevo proyecto
              </h2>
              <p className="mt-1 text-[12px] text-white/70">
                Tools y clients propios.
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
              placeholder="Moun, Invoice…"
              required
              className="ui-input !text-[14px]"
            />
          </label>

          <label className="block rounded-xl bg-[var(--surface-alt)] p-4">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Nota
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              className="ui-input !text-[14px]"
            />
          </label>

          <div className="rounded-xl bg-[var(--surface-alt)] p-4">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Supabase
            </span>
            {notConnected ? (
              <div className="rounded-[18px] bg-[var(--surface-alt)] p-4">
                <p className="text-[13px] text-[var(--foreground-soft)]">
                  Conecta para elegir un proyecto.
                </p>
                <button
                  type="button"
                  onClick={onNeedConnect}
                  className="mt-2 text-[13px] font-semibold text-[var(--accent)]"
                >
                  Conectar
                </button>
              </div>
            ) : (
              <select
                value={supabaseRef}
                onChange={(e) => setSupabaseRef(e.target.value)}
                className="ui-input !text-[14px]"
              >
                <option value="">
                  {loadingRemotes ? "…" : "Sin vincular"}
                </option>
                {remotes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error ? (
            <p className="rounded-full bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[#cd3d64]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
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
              {pending ? "…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
