"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon } from "../../icons";
import { APP_DEMO_FOLDER_KEY } from "@/lib/gallery/app-demo-folder";

type DemoVideo = {
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

export function AppDemoVideosPanel({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("");
  const [videos, setVideos] = useState<DemoVideo[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/gallery?all=1&kind=video`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los videos");
    const folders = (data.allFolders ?? []) as {
      id: string;
      name: string;
      parentId: string | null;
      systemKey?: string | null;
    }[];
    const folder =
      folders.find((f) => f.systemKey === APP_DEMO_FOLDER_KEY) ??
      folders.find((f) => f.name === "App Demo" && !f.parentId);
    if (!folder) {
      setFolderId("");
      setVideos([]);
      return;
    }
    setFolderId(folder.id);
    const assets = (data.assets ?? []) as {
      id: string;
      name: string;
      kind: string;
      folderId: string | null;
      publicUrl: string;
    }[];
    setVideos(
      assets
        .filter((a) => a.kind === "video" && a.folderId === folder.id)
        .map((a) => ({ id: a.id, name: a.name, publicUrl: a.publicUrl }))
    );
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los videos");
    });
  }, [load]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!folderId || uploading) return;
    const files = Array.from(fileList).filter((file) =>
      (file.type || "").toLowerCase().startsWith("video/")
    );
    if (!files.length) {
      setError("Solo se pueden subir videos.");
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
          throw new Error(`${file.name}: máx 200 MB`);
        }
        const mime = (file.type || "video/mp4").toLowerCase();
        const safe = sanitizeFileName(file.name);
        const storagePath = `${projectId}/${crypto.randomUUID()}-${safe}`;
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
      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, files: registered }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar en Galería");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeVideo(id: string) {
    if (uploading) return;
    if (!confirm("¿Quitar este video de App Demo?")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/gallery/assets/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      if (playingId === id) setPlayingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#111827]">Video demos</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#9ca3af]">
            Sube videos de la app. Quedan aquí y en Galería › App Demo.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn-secondary shrink-0"
          disabled={uploading || !folderId}
          onClick={() => inputRef.current?.click()}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {uploading ? "Subiendo…" : "Subir"}
        </button>
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

      {error ? (
        <p className="mt-3 rounded-xl bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}

      <div
        className="mt-4 min-h-[220px] flex-1 rounded-2xl border border-dashed border-[var(--border)] bg-[#fafafa] p-3"
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
            disabled={uploading || !folderId}
            onClick={() => inputRef.current?.click()}
          >
            <span className="text-[14px] font-medium text-[#111827]">
              Arrastra videos aquí
            </span>
            <span className="text-[13px] text-[#9ca3af]">
              MP4, MOV o WebM. Máx. 200 MB.
            </span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {videos.map((video) => {
              const active = playingId === video.id;
              return (
                <li key={video.id} className="min-w-0">
                  <div className="overflow-hidden rounded-2xl bg-[#111827]">
                    <div className="relative aspect-[9/16] w-full">
                      <video
                        src={video.publicUrl}
                        className="h-full w-full object-cover"
                        muted={!active}
                        playsInline
                        controls={active}
                        autoPlay={active}
                        preload="metadata"
                      />
                      {active ? null : (
                        <button
                          type="button"
                          className="absolute inset-0"
                          aria-label={`Reproducir ${video.name}`}
                          onClick={() => setPlayingId(video.id)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">
                        {video.name}
                      </p>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label={`Eliminar ${video.name}`}
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
    </div>
  );
}
