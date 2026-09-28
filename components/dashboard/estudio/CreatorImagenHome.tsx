"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_PRESETS, getImagePreset } from "@/lib/higgsfield/presets";
import {
  describeImageJob,
  imageQueueActiveCount,
  loadImageQueues,
  saveImageQueues,
  splitImagePrompts,
  type EstudioImageQueue,
} from "@/lib/creator/estudio-v1";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { StudioPage } from "./studio-ui";

type GalleryFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

function folderPath(folders: GalleryFolder[], id: string): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return parts.join(" / ") || "Carpeta";
}

function isFailed(status: string, error?: string | null) {
  const s = status.trim().toLowerCase();
  return (
    s === "failed" ||
    s === "nsfw" ||
    s === "canceled" ||
    s === "cancelled" ||
    Boolean(error)
  );
}

function isQueued(status: string, error?: string | null) {
  if (isFailed(status, error)) return false;
  const s = status.trim().toLowerCase();
  return s === "pending" || s === "queued";
}

function queueJobs(queue: EstudioImageQueue) {
  return Array.isArray(queue.jobs) ? queue.jobs : [];
}

function migrateFlag(projectId: string) {
  return `zima:estudio-v1:image-queues-migrated:${projectId}`;
}

export function useImageQueueWorker(projectId: string) {
  const [queues, setQueues] = useState<EstudioImageQueue[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const migrated = useRef(false);

  const apply = useCallback(
    (data: { queues?: EstudioImageQueue[]; activeCount?: number }) => {
      const next = Array.isArray(data.queues) ? data.queues : [];
      setQueues(next);
      setActiveCount(
        typeof data.activeCount === "number"
          ? data.activeCount
          : imageQueueActiveCount(next)
      );
    },
    []
  );

  const reload = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/creator/image-queues`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar las colas");
    apply(data);
    return data as { queues: EstudioImageQueue[]; activeCount: number };
  }, [apply, projectId]);

  useEffect(() => {
    let cancelled = false;
    migrated.current = false;

    const boot = async () => {
      try {
        const data = await reload();
        if (cancelled || migrated.current) return;
        migrated.current = true;
        const flag = migrateFlag(projectId);
        if (typeof window === "undefined") return;
        if (localStorage.getItem(flag)) return;
        const local = loadImageQueues(projectId);
        if (data.queues.length > 0 || local.length === 0) {
          localStorage.setItem(flag, "1");
          if (local.length) saveImageQueues(projectId, []);
          return;
        }
        const res = await fetch(
          `/api/projects/${projectId}/creator/image-queues`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ importQueues: local }),
          }
        );
        const imported = await res.json();
        if (!res.ok) return;
        localStorage.setItem(flag, "1");
        saveImageQueues(projectId, []);
        if (!cancelled) apply(imported);
      } catch {
        /* keep polling */
      }
    };

    void boot();
    const id = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apply, projectId, reload]);

  return {
    queues,
    activeCount,
    reload,
  };
}

export function CreatorImagenHome({
  projectId,
  queues,
  reload,
}: {
  projectId: string;
  queues: EstudioImageQueue[];
  reload: () => Promise<unknown>;
}) {
  const [prompts, setPrompts] = useState("");
  const [presetId, setPresetId] = useState(IMAGE_PRESETS[0]?.id ?? "soul-2");
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [higgs, setHiggs] = useState<{ connected: boolean } | null>(null);
  const [openai, setOpenai] = useState<{ connected: boolean } | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const list = splitImagePrompts(prompts);
  const preset = getImagePreset(presetId) ?? IMAGE_PRESETS[0];
  const folderValue = folders.some((f) => f.id === folderId)
    ? folderId
    : (folders[0]?.id ?? "");
  const waitingPlace = new Map(
    queues
      .flatMap((q) => queueJobs(q))
      .filter((j) => !isFailed(j.status, j.error) && j.status !== "saved")
      .sort(
        (a, b) =>
          (Date.parse(a.createdAt || "") || 0) -
          (Date.parse(b.createdAt || "") || 0)
      )
      .map(
        (j, i, all) =>
          [j.id, { place: i + 1, waiting: all.length }] as const
      )
  );
  const providerReady =
    preset?.provider === "openai"
      ? Boolean(openai?.connected)
      : Boolean(higgs?.connected);
  const ready =
    list.length > 0 && Boolean(folderValue) && Boolean(preset) && providerReady;

  const loadMeta = useCallback(async () => {
    try {
      const [hfRes, oaRes, galRes] = await Promise.all([
        fetch("/api/higgsfield/settings"),
        fetch("/api/openai/api-settings"),
        fetch(`/api/projects/${projectId}/gallery`),
      ]);
      const hf = await hfRes.json();
      const oa = await oaRes.json();
      const gal = await galRes.json();
      if (hfRes.ok) setHiggs({ connected: Boolean(hf.connected) });
      if (oaRes.ok) setOpenai({ connected: Boolean(oa.connected) });
      if (galRes.ok) {
        const next = (gal.allFolders ?? []) as GalleryFolder[];
        setFolders(next);
        setFolderId((prev) =>
          next.some((f) => f.id === prev) ? prev : next[0]?.id || ""
        );
      }
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    setCreatingFolder(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/gallery/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la carpeta");
      const folder = data.folder as GalleryFolder;
      setFolders((prev) => [...prev, folder]);
      setFolderId(folder.id);
      setNewFolder("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la carpeta");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function startQueue() {
    if (!ready || !preset) return;
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/image-queues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: preset.id,
            folderId: folderValue,
            prompts: list,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo encolar");
      setPrompts("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo encolar");
    }
  }

  async function retryJobs(ids: Set<string>) {
    if (!ids.size) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/image-queues/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", jobIds: [...ids] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo reintentar");
      setSelected(new Set());
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reintentar");
    }
  }

  async function deleteJobs(ids: Set<string>) {
    if (!ids.size) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/image-queues/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", jobIds: [...ids] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      setSelected(new Set());
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  function toggleJob(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleQueue(queue: EstudioImageQueue) {
    const ids = queueJobs(queue).map((j) => j.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function selectBy(
    kind: "all" | "queued" | "failed" | "saved" | "none",
    scope?: EstudioImageQueue
  ) {
    const source = scope ? [scope] : queues;
    const ids = source.flatMap((q) =>
      queueJobs(q)
        .filter((j) => {
          if (kind === "all") return true;
          if (kind === "queued") return isQueued(j.status, j.error);
          if (kind === "failed") return isFailed(j.status, j.error);
          if (kind === "saved") return j.status === "saved";
          return false;
        })
        .map((j) => j.id)
    );
    setSelected(kind === "none" ? new Set() : new Set(ids));
  }

  async function archiveJobs(ids: Set<string>) {
    const savedIds = [...ids].filter((id) =>
      queues.some((q) =>
        queueJobs(q).some((j) => j.id === id && j.status === "saved")
      )
    );
    if (!savedIds.length) {
      setError("Archivar solo oculta las que ya están en Library.");
      return;
    }
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/image-queues/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", jobIds: savedIds }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo archivar");
      setSelected(new Set());
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo archivar");
    }
  }

  return (
    <StudioPage
      narrow
      kicker="Hacer"
      title="Imágenes"
      description="Pega prompts separados por punto y coma. La cola sigue en el servidor y guarda sola en Galería."
    >
      {preset?.provider === "openai" && openai && !openai.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="OpenAI API"
            message="Conecta la OpenAI API key (no la Admin) para generar con GPT Image."
          />
        </div>
      ) : null}
      {preset?.provider !== "openai" && higgs && !higgs.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="Higgsfield"
            message="Conecta Higgsfield para generar imágenes en cola."
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--foreground-soft)]">Prompts</span>
          <textarea
            value={prompts}
            onChange={(e) => setPrompts(e.target.value)}
            rows={5}
            placeholder="producto en mesa de mármol, luz suave; close-up del pack, fondo beige; hero 9:16 con el logo a un lado"
            className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)] focus:bg-white"
          />
          <span className="mt-1 block text-[11px] text-[var(--muted-soft)]">
            {list.length} imagen{list.length === 1 ? "" : "es"} en esta cola
          </span>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--foreground-soft)]">
            Modelo de generación
          </span>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--foreground)] outline-none"
          >
            {IMAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.description}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-[12px] font-semibold text-[var(--foreground-soft)]">
            Carpeta de destino
          </span>
          {folders.length ? (
            <select
              value={folderValue}
              onChange={(e) => setFolderId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--foreground)] outline-none"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {folderPath(folders, f.id)}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1.5 text-[12px] text-[var(--muted-soft)]">
              Crea una carpeta en Library o aquí abajo.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Nueva carpeta"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="button"
              disabled={!newFolder.trim() || creatingFolder}
              onClick={() => void createFolder()}
              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--foreground-soft)] disabled:opacity-40"
            >
              {creatingFolder ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => void startQueue()}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          Encolar {list.length || ""} imagen{list.length === 1 ? "" : "es"}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {queues.length > 0 ? (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <SelectMenu
              label="Seleccionar"
              queuedCount={queues.reduce(
                (n, q) =>
                  n +
                  queueJobs(q).filter((j) => isQueued(j.status, j.error)).length,
                0
              )}
              failedCount={queues.reduce(
                (n, q) =>
                  n +
                  queueJobs(q).filter((j) => isFailed(j.status, j.error)).length,
                0
              )}
              savedCount={queues.reduce(
                (n, q) =>
                  n + queueJobs(q).filter((j) => j.status === "saved").length,
                0
              )}
              onPick={(kind) => selectBy(kind)}
            />
            {selected.size > 0 ? (
              <>
                <span className="text-[12px] font-semibold text-[#1d4ed8]">
                  {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => void retryJobs(selected)}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)]"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => void archiveJobs(selected)}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)]"
                >
                  Archivar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteJobs(selected)}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--danger)]"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto text-[11px] font-medium text-[var(--muted)]"
                >
                  Quitar selección
                </button>
              </>
            ) : (
              <span className="text-[11px] text-[var(--muted-soft)]">
                Marca una imagen o usa Seleccionar
              </span>
            )}
          </div>
        ) : null}
        {queues.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-soft)]">
            Todavía no hay colas. Cuando lances una, puedes cerrar el ordenador
            — el servidor sigue generando y las guarda en Library.
          </p>
        ) : (
          queues.map((queue) => {
            const jobs = queueJobs(queue);
            const done = jobs.filter((j) => j.status === "saved").length;
            const failed = jobs.filter((j) =>
              isFailed(j.status, j.error)
            ).length;
            const queuedN = jobs.filter((j) =>
              isQueued(j.status, j.error)
            ).length;
            const allOn =
              jobs.length > 0 && jobs.every((j) => selected.has(j.id));
            const mixed =
              jobs.some((j) => selected.has(j.id)) && !allOn;
            return (
              <article
                key={queue.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      className="mt-0.5"
                      onClick={() => toggleQueue(queue)}
                      aria-label="Seleccionar todas de esta cola"
                    >
                      <SelectBox checked={allOn} mixed={mixed} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--foreground)]">
                        {queue.modelName}
                      </p>
                      <p className="text-[12px] text-[var(--muted-soft)]">
                        {queue.folderName} · {done}/{jobs.length} guardadas
                        {failed ? ` · ${failed} con error` : ""}
                      </p>
                    </div>
                    <SelectMenu
                      label="Todo"
                      queuedCount={queuedN}
                      failedCount={failed}
                      savedCount={done}
                      onPick={(kind) => selectBy(kind, queue)}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--muted-soft)]">
                    {queue.createdAt
                      ? new Date(queue.createdAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {jobs.map((job, i) => {
                    const on = selected.has(job.id);
                    const wait = waitingPlace.get(job.id);
                    const info = describeImageJob(job, {
                      modelName: queue.modelName,
                      place: wait?.place ?? 1,
                      waiting: wait?.waiting ?? 1,
                    });
                    return (
                    <li key={job.id || `job-${i}`}>
                      <button
                        type="button"
                        onClick={() => toggleJob(job.id)}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left ${
                          on ? "bg-[#eff6ff] ring-1 ring-[#bfdbfe]" : "bg-[var(--background)]"
                        }`}
                      >
                        <span className="mt-3">
                          <SelectBox checked={on} />
                        </span>
                        {job.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.imageUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg bg-[#ececec] object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ececec] text-[11px] text-[var(--muted-soft)]">
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[12px] text-[var(--foreground-soft)]">
                            {job.prompt}
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] font-medium ${
                              info.tone === "ok"
                                ? "text-[#16a34a]"
                                : info.tone === "err"
                                  ? "text-[var(--danger)]"
                                  : "text-[#2563eb]"
                            }`}
                          >
                            {info.line}
                          </p>
                        </div>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </article>
            );
          })
        )}
      </div>
    </StudioPage>
  );
}

function SelectMenu({
  label,
  queuedCount,
  failedCount,
  savedCount,
  onPick,
}: {
  label: string;
  queuedCount: number;
  failedCount: number;
  savedCount: number;
  onPick: (kind: "all" | "queued" | "failed" | "saved" | "none") => void;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[var(--foreground-soft)] marker:content-none [&::-webkit-details-marker]:hidden">
        {label}
        <span className="ml-1 text-[10px] text-[var(--muted-soft)]">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg">
        {(
          [
            ["queued", `Pendientes (${queuedCount})`, queuedCount > 0],
            ["failed", `Con error (${failedCount})`, failedCount > 0],
            ["saved", `En Library (${savedCount})`, savedCount > 0],
            ["all", "Todas", true],
            ["none", "Ninguna", true],
          ] as const
        ).map(([kind, text, enabled]) => (
          <button
            key={kind}
            type="button"
            disabled={!enabled}
            className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--surface-alt)] disabled:text-[#d1d5db]"
            onClick={(e) => {
              onPick(kind);
              const details = (e.currentTarget as HTMLElement).closest(
                "details"
              );
              if (details) details.removeAttribute("open");
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </details>
  );
}

function SelectBox({
  checked,
  mixed,
}: {
  checked: boolean;
  mixed?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${
        checked || mixed
          ? "border-[#2563eb] bg-[#2563eb] text-white"
          : "border-[var(--border-strong)] bg-white"
      }`}
    >
      {checked ? (
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : mixed ? (
        <span className="block h-0.5 w-2 rounded-full bg-white" />
      ) : null}
    </span>
  );
}
