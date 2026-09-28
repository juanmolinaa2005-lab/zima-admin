"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import { CloseIcon, PlusIcon, TrashIcon } from "../icons";
import { DynamicsVideoSlot } from "./DynamicsVideoSlot";
import {
  DYNAMIC_PART_KIND_LABELS,
  DYNAMIC_PART_KINDS,
  dynamicsEditorPath,
  type DynamicPart,
  type DynamicPartKind,
  type DynamicPartPrompt,
  type StudioDynamic,
} from "@/lib/creator/dynamics";
import { normalizeOverlayLanguage } from "@/lib/creator/overlay-language";
import { OverlayTextEditor } from "./OverlayTextEditor";
import { SnapCaption } from "./StudioVideoPlayer";
import {
  DEFAULT_OVERLAY_PREVIEW,
  OVERLAY_PREVIEW_PHOTO,
  normalizeCaptionStyle,
  normalizeOverlayPosition,
} from "@/lib/creator/overlay-styles";
import {
  deletePartPrompts,
  markDynamicDeleted,
  mergeStudioDynamics,
  mergeStudioParts,
  purgeDeletedDynamics,
  pushLocalDynamicsToServer,
  pushPartMeta,
  savePartPrompts,
} from "@/lib/creator/dynamics-workspace";
import { HOOK_APP_DEMO_ID } from "@/lib/gallery/dynamics-folder";

type View = { kind: "home" } | { kind: "part"; id: string };

function partMetaLabel(part: DynamicPart) {
  if (part.kind === "music") {
    return `${part.audioCount} audio${part.audioCount === 1 ? "" : "s"} · Music`;
  }
  if (part.kind === "overlay") {
    return "Texto arriba del video";
  }
  if (part.kind === "mimic") {
    return `${part.videoCount} video${part.videoCount === 1 ? "" : "s"} · Mimic Motion`;
  }
  return `${part.videoCount} video${part.videoCount === 1 ? "" : "s"} · ${part.prompts.length} prompt${part.prompts.length === 1 ? "" : "s"}`;
}

function openInNewPage(href: string) {
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (opened) return;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function PhoneCard({
  title,
  previewUrl,
  overlay,
  dashed,
  onOpen,
  onDelete,
  onRename,
}: {
  title: string;
  previewUrl?: string | null;
  overlay?: { text: string; styleId: string; position: string };
  dashed?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(title);
  const skipRename = useRef(false);
  return (
    <div className="w-[108px] sm:w-[118px]">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="group relative block w-full overflow-hidden rounded-xl bg-[var(--surface-alt)] text-left shadow-[0_10px_28px_rgba(17,24,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(17,24,39,0.16)]"
          style={{ aspectRatio: "9 / 16" }}
        >
          <span className="pointer-events-none absolute left-1/2 top-[7px] z-10 h-[5px] w-[28px] -translate-x-1/2 rounded-full bg-black/35" />
          <span className="absolute inset-[4px] overflow-hidden rounded-[18px] bg-[var(--surface-alt)]">
            {dashed ? (
              <span className="flex h-full w-full flex-col items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--background)]">
                <PlusIcon className="h-6 w-6 text-[var(--muted-soft)] group-hover:text-[#2563eb]" />
              </span>
            ) : overlay ? (
              <span className="relative flex h-full w-full">
                <img
                  src={OVERLAY_PREVIEW_PHOTO}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <SnapCaption
                  text={overlay.text || DEFAULT_OVERLAY_PREVIEW}
                  styleId={overlay.styleId}
                  position={overlay.position}
                />
              </span>
            ) : previewUrl ? (
              <video
                src={previewUrl}
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
          </span>
        </button>
        {onDelete ? (
          <button
            type="button"
            className="absolute right-1 top-1 z-20 rounded-lg bg-black/55 p-1.5 text-white/90 shadow-sm backdrop-blur-sm hover:bg-[#b91c1c] hover:text-white"
            aria-label={`Borrar ${title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          aria-label="Nombre de la part"
          className="mt-2.5 w-full rounded-lg border border-[var(--accent)] bg-white px-2 py-1 text-center text-[13px] font-semibold text-[var(--foreground)] outline-none"
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            setEditingName(false);
            if (skipRename.current) {
              skipRename.current = false;
              setNameDraft(title);
              return;
            }
            const next = nameDraft.trim();
            if (next && next !== title) onRename?.(next);
            else setNameDraft(title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipRename.current = true;
              setNameDraft(title);
              setEditingName(false);
            }
          }}
        />
      ) : (
        <div className="mt-2.5 flex items-center justify-center gap-1">
          <button type="button" onClick={onOpen} className="min-w-0 text-center">
            <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{title}</span>
          </button>
          {onRename ? (
            <button
              type="button"
              aria-label={`Editar ${title}`}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              onClick={() => {
                setNameDraft(title);
                setEditingName(true);
              }}
            >
              <PencilIcon />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.2L19.2 9a1.8 1.8 0 0 0 0-2.5L17.5 4.8a1.8 1.8 0 0 0-2.5 0L4 15.8V20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PartName({
  name,
  onRename,
  className,
}: {
  name: string;
  onRename: (name: string) => void;
  className: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const skipRename = useRef(false);
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        aria-label="Nombre de la part"
        className={`min-w-0 rounded-lg border border-[var(--accent)] bg-white px-2 py-1 outline-none ${className}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (skipRename.current) {
            skipRename.current = false;
            setValue(name);
            return;
          }
          const next = value.trim();
          if (next && next !== name) onRename(next);
          else setValue(name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            skipRename.current = true;
            setValue(name);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h2 className={`min-w-0 truncate ${className}`}>{name}</h2>
      <button
        type="button"
        aria-label={`Editar ${name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function PartModal({
  name,
  kind,
  saving,
  nameRef,
  onName,
  onKind,
  onClose,
  onSubmit,
}: {
  name: string;
  kind: DynamicPartKind;
  saving: boolean;
  nameRef: RefObject<HTMLInputElement | null>;
  onName: (v: string) => void;
  onKind: (v: DynamicPartKind) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl bg-white p-5 border border-[var(--border)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold text-[var(--foreground)]">New part</p>
            <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
              Mimic Motion, video, música o texto.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => onName(e.target.value)}
            className="ui-input"
            maxLength={120}
            placeholder="Hook, Moments, Music…"
          />
        </label>
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[12px] font-semibold text-[var(--muted)]">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {DYNAMIC_PART_KINDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-2xl border px-2 py-2 text-[12px] font-semibold ${
                  kind === id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                }`}
                onClick={() => {
                  onKind(id);
                  if (id === "overlay" && !name.trim()) onName("Texto");
                  if (id === "mimic" && !name.trim()) onName("Mimic Motion");
                }}
              >
                {DYNAMIC_PART_KIND_LABELS[id]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="ui-btn-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ui-btn-primary" disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DynamicsHome({ projectId }: { projectId: string }) {
  const [dynamics, setDynamics] = useState<StudioDynamic[]>([]);
  const [parts, setParts] = useState<DynamicPart[]>([]);
  const [musicFolderId, setMusicFolderId] = useState("");
  const [view, setView] = useState<View>({ kind: "home" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [partModal, setPartModal] = useState(false);
  const [partName, setPartName] = useState("");
  const [partKind, setPartKind] = useState<DynamicPartKind>("video");
  const nameRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/creator/dynamics`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load dynamics");
    const rawDynamics = Array.isArray(data.dynamics) ? data.dynamics : [];
    await purgeDeletedDynamics(projectId, rawDynamics);
    const nextDynamics = mergeStudioDynamics(rawDynamics, projectId);
    const nextParts = mergeStudioParts(
      Array.isArray(data.parts) ? data.parts : [],
      projectId
    );
    setDynamics(nextDynamics);
    setParts(nextParts);
    setMusicFolderId(typeof data.musicFolderId === "string" ? data.musicFolderId : "");
    const migrated = await pushLocalDynamicsToServer(projectId, nextDynamics, nextParts);
    if (migrated.created > 0) {
      const again = await fetch(`/api/projects/${projectId}/creator/dynamics`, {
        cache: "no-store",
      });
      const fresh = await again.json().catch(() => ({}));
      if (again.ok) {
        setDynamics(
          mergeStudioDynamics(
            Array.isArray(fresh.dynamics) ? fresh.dynamics : [],
            projectId
          )
        );
        setParts(
          mergeStudioParts(Array.isArray(fresh.parts) ? fresh.parts : [], projectId)
        );
      }
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setError("");
    void load()
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load dynamics");
      })
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 12000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(poll);
    };
  }, [load]);

  useEffect(() => {
    if (!partModal) return;
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [partModal]);

  const currentPart = parts.find((p) => view.kind === "part" && p.id === view.id) ?? null;

  async function createPart(e: FormEvent) {
    e.preventDefault();
    const name = partName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/creator/dynamics/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind: partKind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create part");
      const created = data.part as DynamicPart | undefined;
      if (created?.id) {
        void pushPartMeta(projectId, created.id, {
          kind: partKind,
          ...(partKind === "overlay"
            ? {
                text: name,
                overlayStyle: "snapchat" as const,
                overlayPosition: "upper" as const,
              }
            : {}),
        });
      }
      await load();
      setPartModal(false);
      setPartName("");
      if (created?.id) setView({ kind: "part", id: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create part");
    } finally {
      setSaving(false);
    }
  }

  async function renamePart(partId: string, raw: string) {
    const name = raw.trim().slice(0, 80);
    const previous = parts.find((part) => part.id === partId)?.name || "";
    if (!name || name === previous) return;
    setParts((cur) => cur.map((part) => (part.id === partId ? { ...part, name } : part)));
    setError("");
    try {
      await pushPartMeta(projectId, partId, { name });
    } catch (err) {
      setParts((cur) =>
        cur.map((part) => (part.id === partId ? { ...part, name: previous } : part))
      );
      setError(err instanceof Error ? err.message : "No se pudo renombrar");
    }
  }

  async function deletePart(part: DynamicPart) {
    if (saving) return;
    if (!confirm(`Delete part “${part.name}” and its files?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/dynamics/parts/${part.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete part");
      deletePartPrompts(projectId, part.id);
      await load();
      if (view.kind === "part" && view.id === part.id) setView({ kind: "home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete part");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDynamic(item: { id: string; name: string; builtin?: boolean }) {
    if (saving) return;
    if (!confirm(`¿Borrar “${item.name}”?`)) return;
    setSaving(true);
    setError("");
    markDynamicDeleted(projectId, item.id);
    setDynamics((cur) => cur.filter((dynamic) => dynamic.id !== item.id));
    try {
      if (!item.builtin && item.id !== HOOK_APP_DEMO_ID) {
        const res = await fetch(`/api/projects/${projectId}/creator/dynamics/${item.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404) {
          throw new Error(data.error || "Could not delete dynamic");
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete dynamic");
    } finally {
      setSaving(false);
    }
  }

  function persistPartPrompts(partId: string, prompts: DynamicPartPrompt[]) {
    savePartPrompts(projectId, partId, prompts);
    setParts((cur) => cur.map((p) => (p.id === partId ? { ...p, prompts } : p)));
    void pushPartMeta(projectId, partId, { prompts });
  }

  async function uploadMusic(files: FileList | File[]) {
    if (!musicFolderId || saving) return;
    const list = Array.from(files).filter((file) =>
      (file.type || "").toLowerCase().startsWith("audio/")
    );
    if (!list.length) {
      setError("Only audio files can be uploaded.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    try {
      const registered: {
        name: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
        publicUrl: string;
      }[] = [];
      for (const file of list) {
        const mime = (file.type || "audio/mpeg").toLowerCase();
        const safe = file.name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180) || "audio";
        const storagePath = `${projectId}/dynamics/music/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, file, { contentType: mime, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from("gallery").getPublicUrl(storagePath);
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
        body: JSON.stringify({ folderId: musicFolderId, files: registered }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save music");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload music");
    } finally {
      setSaving(false);
      if (musicRef.current) musicRef.current.value = "";
    }
  }

  if (view.kind === "part" && currentPart) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl p-5">
          <button type="button" className="studio-kicker" onClick={() => setView({ kind: "home" })}>
            ← Parts
          </button>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PartName
                  name={currentPart.name}
                  onRename={(name) => void renamePart(currentPart.id, name)}
                  className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]"
                />
              </div>
              <p className="mt-1 max-w-2xl text-[14px] text-[var(--muted-soft)]">
                {currentPart.kind === "music"
                  ? "Audio for the music track in the editor."
                  : currentPart.kind === "overlay"
                    ? "Lista o prompt. En el editor de la dinámica eliges cuál se usa."
                    : currentPart.kind === "mimic"
                      ? "El influencer copia el movimiento de este video."
                      : "Clips or prompts of the same type. They play in sequence on the video track."}
              </p>
            </div>
            <button
              type="button"
              className="ui-btn-secondary text-[var(--danger)]"
              disabled={saving}
              onClick={() => void deletePart(currentPart)}
            >
              Delete part
            </button>
          </div>
          {error ? (
            <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {currentPart.kind === "music" ? (
              <section className="studio-card rounded-xl border border-[var(--border)] p-5">
                <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Audio</h3>
                <p className="mt-1 text-[13px] text-[var(--muted-soft)]">{partMetaLabel(currentPart)}</p>
                <input
                  ref={musicRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void uploadMusic(e.target.files);
                  }}
                />
                <button
                  type="button"
                  className="ui-btn-secondary mt-4"
                  disabled={saving}
                  onClick={() => musicRef.current?.click()}
                >
                  Upload audio
                </button>
              </section>
            ) : currentPart.kind === "overlay" ? (
              <section className="studio-card rounded-xl p-5 lg:col-span-2">
                <OverlayTextEditor
                  text={
                    currentPart.prompts.find((item) => item.text.trim())?.text ||
                    currentPart.name
                  }
                  lines={currentPart.prompts.map((item) => item.text)}
                  prompt={currentPart.overlayPrompt || ""}
                  language={normalizeOverlayLanguage(currentPart.overlayLanguage)}
                  styleId={normalizeCaptionStyle(currentPart.overlayStyle)}
                  position={normalizeOverlayPosition(currentPart.overlayPosition)}
                  onText={() => undefined}
                  onLines={(lines) => {
                    const prompts = lines.map((text, index) => ({
                      id: currentPart.prompts[index]?.id || `line-${Date.now()}-${index}`,
                      text: text.slice(0, 140),
                    }));
                    persistPartPrompts(currentPart.id, prompts);
                  }}
                  onPrompt={(overlayPrompt) => {
                    void pushPartMeta(projectId, currentPart.id, { overlayPrompt });
                    setParts((cur) =>
                      cur.map((p) =>
                        p.id === currentPart.id ? { ...p, overlayPrompt } : p
                      )
                    );
                  }}
                  onLanguage={(overlayLanguage) => {
                    void pushPartMeta(projectId, currentPart.id, { overlayLanguage });
                    setParts((cur) =>
                      cur.map((p) =>
                        p.id === currentPart.id ? { ...p, overlayLanguage } : p
                      )
                    );
                  }}
                  onStyle={(overlayStyle) => {
                    void pushPartMeta(projectId, currentPart.id, { overlayStyle });
                    setParts((cur) =>
                      cur.map((p) =>
                        p.id === currentPart.id ? { ...p, overlayStyle } : p
                      )
                    );
                  }}
                  onPosition={(overlayPosition) => {
                    void pushPartMeta(projectId, currentPart.id, { overlayPosition });
                    setParts((cur) =>
                      cur.map((p) =>
                        p.id === currentPart.id ? { ...p, overlayPosition } : p
                      )
                    );
                  }}
                />
              </section>
            ) : (
              <>
                <DynamicsVideoSlot
                  projectId={projectId}
                  slot={{
                    id: currentPart.id,
                    name: "Videos",
                    description:
                      currentPart.kind === "mimic"
                        ? "Video de referencia para copiar el movimiento."
                        : "Clips for this part.",
                    folderId: currentPart.folderId,
                    allowTrim: true,
                  }}
                  confirmRemove={`Remove this video from ${currentPart.name}?`}
                />
                <section className="studio-card rounded-xl border border-[var(--border)] p-5">
                  <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Prompts</h3>
                  <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
                    If there is no video yet, a prompt can generate one later.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {currentPart.prompts.map((prompt) => (
                      <li key={prompt.id}>
                        <textarea
                          value={prompt.text}
                          rows={3}
                          className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-3 text-[14px] outline-none"
                          onChange={(e) => {
                            const next = currentPart.prompts.map((p) =>
                              p.id === prompt.id ? { ...p, text: e.target.value } : p
                            );
                            persistPartPrompts(currentPart.id, next);
                          }}
                        />
                        <button
                          type="button"
                          className="mt-1 text-[12px] font-medium text-[var(--danger)]"
                          onClick={() =>
                            persistPartPrompts(
                              currentPart.id,
                              currentPart.prompts.filter((p) => p.id !== prompt.id)
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="ui-btn-secondary mt-4"
                    onClick={() =>
                      persistPartPrompts(currentPart.id, [
                        ...currentPart.prompts,
                        { id: `prompt-${Date.now()}`, text: "" },
                      ])
                    }
                  >
                    Add prompt
                  </button>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-6xl p-5">
        <div className="flex flex-col items-start gap-8">
          <button
            type="button"
            onClick={() => openInNewPage(dynamicsEditorPath(projectId, "new"))}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Create dynamics editor
          </button>
        </div>

        {error ? (
          <p className="mt-5 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-10 text-[13px] text-[var(--muted-soft)]">Loading…</p>
        ) : (
          <>
            <section className="mt-9">
              <h2 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">Dynamics</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Plantillas en formato teléfono.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-6">
                {dynamics.map((item) => (
                  <PhoneCard
                    key={item.id}
                    title={item.name}
                    previewUrl={
                      item.videoPartIds
                        .map((id) => parts.find((p) => p.id === id)?.previewUrl)
                        .find(Boolean) ?? null
                    }
                    onOpen={() => openInNewPage(dynamicsEditorPath(projectId, item.id))}
                    onDelete={() => void deleteDynamic(item)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-10">
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Parts</h3>
              <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
                Video, música o texto arriba.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-6">
                {parts.map((part) => (
                  <PhoneCard
                    key={part.id}
                    title={part.name}
                    previewUrl={part.previewUrl}
                    overlay={
                      part.kind === "overlay"
                        ? {
                            text: part.prompts.find((item) => item.text.trim())?.text || part.name,
                            styleId: normalizeCaptionStyle(part.overlayStyle),
                            position: normalizeOverlayPosition(part.overlayPosition),
                          }
                        : undefined
                    }
                    onOpen={() => setView({ kind: "part", id: part.id })}
                    onDelete={() => void deletePart(part)}
                    onRename={(name) => void renamePart(part.id, name)}
                  />
                ))}
                <PhoneCard
                  title="New part"
                  dashed
                  onOpen={() => {
                    setPartKind("video");
                    setPartName("");
                    setPartModal(true);
                  }}
                />
              </div>
            </section>
          </>
        )}
      </div>

      {partModal ? (
        <PartModal
          name={partName}
          kind={partKind}
          saving={saving}
          nameRef={nameRef}
          onName={setPartName}
          onKind={setPartKind}
          onClose={() => setPartModal(false)}
          onSubmit={(e) => void createPart(e)}
        />
      ) : null}
    </div>
  );
}
