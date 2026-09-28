"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CloseIcon } from "../icons";
import { DynamicsEditor } from "./DynamicsEditor";
import { DynamicsVideoSlot } from "./DynamicsVideoSlot";
import {
  DEFAULT_CLIP_SEC,
  DYNAMIC_PART_KIND_LABELS,
  DYNAMIC_PART_KINDS,
  EMPTY_DYNAMIC_EXTRAS,
  extrasFromPartial,
  nextCoverId,
  withVideoPartIds,
  type DynamicPart,
  type DynamicPartKind,
  type DynamicTemplateExtras,
  type StudioDynamic,
} from "@/lib/creator/dynamics";
import {
  deleteTemplateExtras,
  isDynamicDeleted,
  markDynamicDeleted,
  mergeStudioDynamics,
  mergeStudioParts,
  pushDynamicExtras,
  purgeDeletedDynamics,
  pushLocalDynamicsToServer,
  pushPartMeta,
  saveTemplateExtras,
} from "@/lib/creator/dynamics-workspace";
import { HOOK_APP_DEMO_ID } from "@/lib/gallery/dynamics-folder";

type MusicTrack = { id: string; name: string; publicUrl: string };

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
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Name
          </span>
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

export function DynamicsEditorApp({
  projectId,
  dynamicId,
}: {
  projectId: string;
  dynamicId: string;
}) {
  const router = useRouter();
  const isNew = dynamicId === "new";
  const [dynamics, setDynamics] = useState<StudioDynamic[]>([]);
  const [parts, setParts] = useState<DynamicPart[]>([]);
  const [musicFolderId, setMusicFolderId] = useState("");
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [partModal, setPartModal] = useState(false);
  const [partName, setPartName] = useState("");
  const [partKind, setPartKind] = useState<DynamicPartKind>("video");
  const [draft, setDraft] = useState<DynamicTemplateExtras>(EMPTY_DYNAMIC_EXTRAS);
  const [draftName, setDraftName] = useState("New dynamic");
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const nameRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const draftNameRef = useRef(draftName);
  const persistIdRef = useRef(dynamicId);
  const hydratedRef = useRef(false);
  const creatingRef = useRef(false);
  const queuedRef = useRef(false);
  const skipLoadRef = useRef(false);
  const persistEnabledRef = useRef(true);
  draftRef.current = draft;
  draftNameRef.current = draftName;

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
        const synced = mergeStudioDynamics(
          Array.isArray(fresh.dynamics) ? fresh.dynamics : [],
          projectId
        );
        const syncedParts = mergeStudioParts(
          Array.isArray(fresh.parts) ? fresh.parts : [],
          projectId
        );
        setDynamics(synced);
        setParts(syncedParts);
        return { dynamics: synced, parts: syncedParts };
      }
    }
    return { dynamics: nextDynamics, parts: nextParts };
  }, [projectId]);

  const loadMusic = useCallback(async () => {
    if (!musicFolderId) {
      setMusicTracks([]);
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/gallery?folderId=${encodeURIComponent(musicFolderId)}&kind=audio`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load music");
    const assets = (data.assets ?? []) as {
      id: string;
      name: string;
      kind: string;
      publicUrl: string;
    }[];
    setMusicTracks(
      assets
        .filter((a) => a.kind === "audio" && a.publicUrl)
        .map((a) => ({ id: a.id, name: a.name, publicUrl: a.publicUrl }))
    );
  }, [projectId, musicFolderId]);

  useEffect(() => {
    if (skipLoadRef.current) {
      skipLoadRef.current = false;
      return;
    }
    hydratedRef.current = false;
    persistIdRef.current = dynamicId;
    setLoading(true);
    setError("");
    void load()
      .then(({ dynamics: items }) => {
        if (isNew) {
          setDraftName("New dynamic");
          setDraft({
            ...EMPTY_DYNAMIC_EXTRAS,
            coverId: nextCoverId(items.map((d) => d.coverId)),
          });
          setReady(true);
          return;
        }
        const item = items.find((d) => d.id === dynamicId);
        if (!item) {
          setError("This dynamic was not found.");
          setReady(false);
          return;
        }
        setDraftName(item.name);
        setDraft(extrasFromPartial(item));
        setReady(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load dynamics");
        setReady(false);
      })
      .finally(() => setLoading(false));
  }, [load, dynamicId, isNew]);

  useEffect(() => {
    void loadMusic().catch(() => setMusicTracks([]));
  }, [loadMusic]);

  useEffect(() => {
    if (!partModal) return;
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [partModal]);

  const current = dynamics.find((d) => d.id === dynamicId) ?? null;
  const builtin = Boolean(current?.builtin || dynamicId === HOOK_APP_DEMO_ID);

  function closeEditor() {
    void persistNow().finally(() => {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      window.location.assign(`/projects/${projectId}`);
    });
  }

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
      if (!created?.id) return;
      setDraft((cur) => {
        if (partKind === "music") {
          return {
            ...cur,
            musicEnabled: true,
            musicName: created.name,
            musicUrl: created.audioUrl,
          };
        }
        if (partKind === "overlay") {
          return {
            ...cur,
            overlayEnabled: true,
            overlayText: cur.overlayText || created.name,
            overlayStyle: "snapchat",
            overlayPosition: "upper",
          };
        }
        if (partKind === "mimic") {
          return {
            ...cur,
            ...withVideoPartIds(
              [created.id, ...cur.videoPartIds],
              [null, ...(cur.videoAssetIds || [])],
              [0, ...(cur.videoTrimStarts || [])],
              [DEFAULT_CLIP_SEC, ...(cur.videoDurations || [])]
            ),
          };
        }
        return {
          ...cur,
          ...withVideoPartIds(
            [...cur.videoPartIds, created.id],
            [...(cur.videoAssetIds || []), null],
            [...(cur.videoTrimStarts || []), 0],
            [...(cur.videoDurations || []), DEFAULT_CLIP_SEC]
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create part");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDynamic() {
    if (saving || builtin) return;
    if (!confirm(`Delete “${draftName.trim() || "New dynamic"}”?`)) return;
    setSaving(true);
    setError("");
    try {
      const id = persistIdRef.current;
      persistEnabledRef.current = false;
      hydratedRef.current = false;
      if (id !== "new") {
        markDynamicDeleted(projectId, id);
        const res = await fetch(
          `/api/projects/${projectId}/creator/dynamics/${id}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404) {
          throw new Error(data.error || "Could not delete dynamic");
        }
        deleteTemplateExtras(projectId, id);
      }
      closeEditor();
    } catch (err) {
      persistEnabledRef.current = true;
      hydratedRef.current = true;
      setError(err instanceof Error ? err.message : "Could not delete dynamic");
      setSaving(false);
    }
  }

  const persistNow = useCallback(async () => {
    if (!hydratedRef.current || !persistEnabledRef.current) return;
    if (isDynamicDeleted(projectId, persistIdRef.current)) return;
    const extras = extrasFromPartial({
      ...draftRef.current,
      name: draftNameRef.current.trim() || "New dynamic",
    });
    setSaveStatus("saving");
    setError("");
    try {
      let id = persistIdRef.current;
      if (id === "new") {
        if (creatingRef.current) {
          queuedRef.current = true;
          return;
        }
        creatingRef.current = true;
        try {
          const res = await fetch(`/api/projects/${projectId}/creator/dynamics`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...extras,
              name: extras.name || `Template ${Date.now().toString(36)}`,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not save dynamic");
          const created = data.dynamic as StudioDynamic | undefined;
          if (!created?.id) throw new Error("Could not save dynamic");
          id = created.id;
          persistIdRef.current = id;
          skipLoadRef.current = true;
          router.replace(`/projects/${projectId}/dynamics/${encodeURIComponent(id)}`);
        } finally {
          creatingRef.current = false;
        }
      }
      const next = extrasFromPartial({
        ...draftRef.current,
        name: draftNameRef.current.trim() || "New dynamic",
      });
      await pushDynamicExtras(projectId, id, next);
      setSaveStatus("saved");
      if (queuedRef.current) {
        queuedRef.current = false;
        await persistNow();
      }
    } catch (err) {
      setSaveStatus("unsaved");
      setError(err instanceof Error ? err.message : "Could not save dynamic");
    }
  }, [projectId, router]);

  useEffect(() => {
    if (!ready || loading) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      persistIdRef.current = persistIdRef.current === "new" ? dynamicId : persistIdRef.current;
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      void persistNow();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, draftName, ready, loading, persistNow]);

  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current || !persistEnabledRef.current) return;
      void persistNow();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      void persistNow();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("keydown", onKey);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("keydown", onKey);
    };
  }, [persistNow, projectId]);

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
      await loadMusic();
      const last = registered[registered.length - 1];
      if (last) {
        setDraft((cur) => ({
          ...cur,
          musicEnabled: true,
          musicName: last.name,
          musicUrl: last.publicUrl,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload music");
    } finally {
      setSaving(false);
      if (musicRef.current) musicRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white text-[13px] text-[var(--muted)]">
        Loading editor…
      </div>
    );
  }

  if (builtin && current) {
    return (
      <div className="h-dvh overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
          <button type="button" className="studio-kicker" onClick={closeEditor}>
            ← Close
          </button>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            {current.name}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] text-[var(--muted-soft)]">
            {current.description}
          </p>
          {error ? (
            <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {current.slots.map((slot) => (
              <DynamicsVideoSlot
                key={slot.id}
                projectId={projectId}
                slot={slot}
                confirmRemove={`Remove this video from ${slot.name}?`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-[14px] text-[var(--muted)]">{error || "This dynamic was not found."}</p>
        <button type="button" className="ui-btn-secondary" onClick={closeEditor}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-white">
      <DynamicsEditor
        projectId={projectId}
        name={draftName}
        onNameChange={setDraftName}
        draft={draft}
        onDraftChange={setDraft}
        parts={parts}
        musicTracks={musicTracks}
        saving={saving}
        saveStatus={saveStatus}
        error={error}
        onBack={closeEditor}
        onSave={() => void persistNow()}
        onDelete={() => void deleteDynamic()}
        onNewPart={(kind) => {
          setPartKind(kind);
          setPartName(
            kind === "overlay" ? "Texto" : kind === "mimic" ? "Mimic Motion" : ""
          );
          setPartModal(true);
        }}
        onUploadMusic={() => musicRef.current?.click()}
      />
      <input
        ref={musicRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadMusic(e.target.files);
        }}
      />
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
