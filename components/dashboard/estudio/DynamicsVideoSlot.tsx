"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CloseIcon, PlusIcon, ScissorsIcon, TrashIcon } from "../icons";
import { VideoClipTrimmer } from "./VideoClipTrimmer";
import {
  MOTION_CLONE_MAX_SEC,
  MOTION_CLONE_TRIM_MIN_SEC,
} from "@/lib/creator/motion-control";
import type { DynamicSlot } from "@/lib/creator/dynamics";
import { galleryStoragePathFromPublicUrl } from "@/lib/gallery/asset";

type SlotVideo = {
  id: string;
  name: string;
  publicUrl: string;
};

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "video"
  );
}

async function registerAssets(
  projectId: string,
  folderId: string,
  files: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    publicUrl: string;
  }[]
) {
  const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId, files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo guardar en Galería");
}

export function DynamicsVideoSlot({
  projectId,
  slot,
  confirmRemove,
}: {
  projectId: string;
  slot: DynamicSlot;
  confirmRemove: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<SlotVideo[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [trimming, setTrimming] = useState<SlotVideo | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(MOTION_CLONE_MAX_SEC);
  const [savingTrim, setSavingTrim] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!slot.folderId) {
      setVideos([]);
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/gallery?folderId=${encodeURIComponent(slot.folderId)}&kind=video`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los videos");
    const assets = (data.assets ?? []) as {
      id: string;
      name: string;
      kind: string;
      publicUrl: string;
    }[];
    setVideos(
      assets
        .filter((a) => a.kind === "video")
        .map((a) => ({ id: a.id, name: a.name, publicUrl: a.publicUrl }))
    );
  }, [projectId, slot.folderId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los videos");
    });
  }, [load]);

  useEffect(() => {
    setSelectedIds((cur) => cur.filter((id) => videos.some((video) => video.id === id)));
  }, [videos]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!slot.folderId || uploading) return;
    const files = Array.from(fileList).filter((file) =>
      (file.type || "").toLowerCase().startsWith("video/")
    );
    if (!files.length) {
      setError("Only videos can be uploaded.");
      return;
    }
    setUploading(true);
    setError("");
    const supabase = createClient();
    const registered: {
      name: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      publicUrl: string;
    }[] = [];
    try {
      for (const file of files) {
        if (file.size <= 0 || file.size > 200 * 1024 * 1024) {
          throw new Error(`${file.name}: max 200 MB`);
        }
        const mime = (file.type || "video/mp4").toLowerCase();
        const safe = sanitizeFileName(file.name);
        const storagePath = `${projectId}/dynamics/${slot.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, file, { contentType: mime, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage
          .from("gallery")
          .getPublicUrl(storagePath);
        registered.push({
          name: safe,
          mimeType: mime,
          sizeBytes: file.size,
          storagePath,
          publicUrl: pub.publicUrl,
        });
      }
      await registerAssets(projectId, slot.folderId, registered);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeVideo(id: string) {
    if (uploading || savingTrim) return;
    if (!confirm(confirmRemove)) return;
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/gallery/assets/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete");
      if (playingId === id) setPlayingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id]
    );
  }

  function toggleAll() {
    setSelectedIds((cur) =>
      cur.length === videos.length ? [] : videos.map((video) => video.id)
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function removeSelected() {
    const ids = selectedIds.filter((id) => videos.some((video) => video.id === id));
    if (!ids.length || uploading || savingTrim || deleting) return;
    const label = ids.length === 1 ? "1 video" : `${ids.length} videos`;
    if (!confirm(`¿Eliminar ${label}?`)) return;
    setDeleting(true);
    setError("");
    try {
      for (const id of ids) {
        const res = await fetch(
          `/api/projects/${projectId}/gallery/assets/${id}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not delete");
      }
      if (playingId && ids.includes(playingId)) setPlayingId(null);
      exitSelectMode();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      await load().catch(() => undefined);
    } finally {
      setDeleting(false);
    }
  }

  async function saveTrim() {
    if (!trimming || !slot.folderId || savingTrim) return;
    if (clipEnd - clipStart < MOTION_CLONE_TRIM_MIN_SEC - 0.02) {
      setError("That trim is too short.");
      return;
    }
    setSavingTrim(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/dynamics/clip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: trimming.publicUrl,
            startSec: clipStart,
            endSec: clipEnd,
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        videoUrl?: string;
        storagePath?: string;
        sizeBytes?: number;
        mimeType?: string;
      };
      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error || "Could not trim the video");
      }
      const storagePath =
        data.storagePath ||
        galleryStoragePathFromPublicUrl(data.videoUrl, projectId);
      if (!storagePath) throw new Error("Could not save the trimmed clip");
      await registerAssets(projectId, slot.folderId, [
        {
          name: sanitizeFileName(
            trimming.name.replace(/(\.[^.]+)?$/, "-clip$1") || "clip.mp4"
          ),
          mimeType: data.mimeType || "video/mp4",
          sizeBytes: data.sizeBytes || 0,
          storagePath,
          publicUrl: data.videoUrl,
        },
      ]);
      await fetch(`/api/projects/${projectId}/gallery/assets/${trimming.id}`, {
        method: "DELETE",
      });
      setTrimming(null);
      if (playingId === trimming.id) setPlayingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trim the video");
    } finally {
      setSavingTrim(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--foreground)]">{slot.name}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
            {slot.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {videos.length > 0 ? (
            <button
              type="button"
              aria-pressed={selectMode}
              className={`inline-flex h-9 items-center rounded-lg border px-3 text-[13px] font-medium ${
                selectMode
                  ? "border-[var(--accent)] bg-[#111827] text-white"
                  : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background)]"
              }`}
              onClick={() => {
                if (selectMode) exitSelectMode();
                else setSelectMode(true);
              }}
            >
              {selectMode ? "Listo" : "Seleccionar"}
            </button>
          ) : null}
          <button
            type="button"
            className="ui-btn-secondary shrink-0"
            disabled={uploading || !slot.folderId}
            onClick={() => inputRef.current?.click()}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
          }}
        />
      </div>

      {selectMode ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            onClick={toggleAll}
          >
            {selectedIds.length === videos.length && videos.length > 0
              ? "Quitar todo"
              : "Seleccionar todos"}
          </button>
          <button
            type="button"
            aria-label="Eliminar seleccionados"
            title="Eliminar seleccionados"
            disabled={selectedIds.length === 0 || deleting}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#fecaca] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[#fee2e2] disabled:opacity-40"
            onClick={() => void removeSelected()}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          {selectedIds.length > 0 ? (
            <span className="text-[12px] tabular-nums text-[var(--muted)]">
              {selectedIds.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div
        className="mt-4 min-h-[220px] flex-1 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-3"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
      >
        {videos.length === 0 ? (
          <button
            type="button"
            className="flex h-full min-h-[196px] w-full flex-col items-center justify-center gap-2 text-center"
            disabled={uploading || !slot.folderId}
            onClick={() => inputRef.current?.click()}
          >
            <span className="text-[14px] font-medium text-[var(--foreground)]">
              Drop videos here
            </span>
            <span className="text-[13px] text-[var(--muted-soft)]">
              MP4, MOV or WebM. Max 200 MB
              {slot.allowTrim ? ". Trim after upload if you want." : "."}
            </span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {videos.map((video) => {
              const active = playingId === video.id;
              return (
                <li key={video.id} className="min-w-0">
                  <div
                    className={`overflow-hidden rounded-2xl bg-[#111827] ${
                      selectedIds.includes(video.id)
                        ? "ring-2 ring-[#dc2626] ring-offset-2"
                        : ""
                    }`}
                  >
                    <div className="relative aspect-[9/16] w-full">
                      <video
                        src={video.publicUrl}
                        className="h-full w-full object-cover"
                        muted={!active || selectMode}
                        playsInline
                        controls={active && !selectMode}
                        autoPlay={active && !selectMode}
                        preload="metadata"
                      />
                      {selectMode ? (
                        <button
                          type="button"
                          className="absolute inset-0 z-10"
                          aria-pressed={selectedIds.includes(video.id)}
                          aria-label={
                            selectedIds.includes(video.id)
                              ? "Quitar de la selección"
                              : "Seleccionar"
                          }
                          onClick={() => toggleSelected(video.id)}
                        />
                      ) : active ? null : (
                        <button
                          type="button"
                          className="absolute inset-0"
                          aria-label={`Play ${video.name}`}
                          onClick={() => setPlayingId(video.id)}
                        />
                      )}
                      {selectMode ? (
                        <span
                          className={`pointer-events-none absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md ${
                            selectedIds.includes(video.id)
                              ? "bg-[#dc2626] text-white"
                              : "border border-white/80 bg-black/45 text-transparent"
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M5 12.5 9.2 17 19 7"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">
                        {video.name}
                      </p>
                      {slot.allowTrim ? (
                        <button
                          type="button"
                          className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
                          aria-label="Trim"
                          title="Trim"
                          onClick={() => {
                            setClipStart(0);
                            setClipEnd(MOTION_CLONE_MAX_SEC);
                            setTrimming(video);
                          }}
                        >
                          <ScissorsIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label={`Delete ${video.name}`}
                        onClick={() => void removeVideo(video.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {trimming ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[16px] font-semibold text-[var(--foreground)]">Trim clip</p>
                <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
                  Optional. Saves a new clip in this folder and replaces the original.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                aria-label="Close"
                disabled={savingTrim}
                onClick={() => setTrimming(null)}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <VideoClipTrimmer
                src={trimming.publicUrl}
                start={clipStart}
                end={clipEnd}
                disabled={savingTrim}
                onChange={(start, end) => {
                  setClipStart(start);
                  setClipEnd(end);
                }}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={savingTrim}
                onClick={() => setTrimming(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                disabled={savingTrim}
                onClick={() => void saveTrim()}
              >
                {savingTrim ? "Saving…" : "Save trim"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
