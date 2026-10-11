"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  STUDIO_FLOWS,
  buildCharacterScenePrompt,
  splitScenePrompts,
  type StudioFlowId,
} from "@/lib/creator/catalog";
import {
  clampDurationSeconds,
  VIDEO_PRESETS,
} from "@/lib/higgsfield/presets";
import { ApiMissingBanner } from "./ApiMissingBanner";
import {
  AspectFormatPicker,
  type AspectRatio,
} from "./AspectFormatPicker";
import { LayersFlow } from "./LayersFlow";

type GalleryFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

type RunItem = {
  index: number;
  scene: string;
  musicName: string | null;
  requestId: string;
  status: string;
  videoUrl: string | null;
  error: string | null;
  saved: boolean;
};

type FlowRun = {
  id: string;
  flowId: StudioFlowId;
  createdAt: string;
  folderId: string;
  folderName: string;
  topText: string;
  characterName?: string;
  items: RunItem[];
};

type HiggsStatus = {
  connected: boolean;
  keyHint: string | null;
};

function runsKey(projectId: string) {
  return `zima:creator-runs:${projectId}`;
}

function loadRuns(projectId: string): FlowRun[] {
  try {
    const raw = localStorage.getItem(runsKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlowRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRuns(projectId: string, runs: FlowRun[]) {
  try {
    localStorage.setItem(runsKey(projectId), JSON.stringify(runs.slice(0, 30)));
  } catch {
    /* ignore */
  }
}

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
  return parts.join(" / ") || "Folder";
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "audio"
  );
}

function isFailedStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "failed" || s === "nsfw" || s === "canceled" || s === "cancelled";
}

function needsStatusPoll(item: RunItem): boolean {
  if (!item.requestId || item.saved) return false;
  if (isFailedStatus(item.status)) return false;
  if (item.status === "completed" && item.videoUrl) return false;
  return true;
}

function statusClass(item: RunItem): string {
  if (item.saved) return "ui-tag ui-tag-success";
  if (item.error || isFailedStatus(item.status)) return "ui-tag ui-tag-danger";
  if (item.status === "completed" && item.videoUrl) return "ui-tag ui-tag-accent";
  if (item.status === "in_progress" || item.status === "queued") {
    return "ui-tag ui-tag-accent";
  }
  return "ui-tag ui-tag-muted";
}

function statusLabel(item: RunItem): string {
  if (item.saved) return "Saved";
  if (item.error) return "Error";
  if (item.status === "completed" && item.videoUrl) return "Saving";
  if (item.status === "in_progress") return "Generating";
  return item.status;
}

export function CreatorStudioView({ projectId }: { projectId: string }) {
  const [openId, setOpenId] = useState<StudioFlowId | null>(null);
  const [higgs, setHiggs] = useState<HiggsStatus | null>(null);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [characterName, setCharacterName] = useState("");
  const ingestLock = useRef(new Set<string>());
  const runsRef = useRef(runs);
  runsRef.current = runs;

  const flow = STUDIO_FLOWS.find((f) => f.id === openId) ?? null;
  const needsPoll = runs.some((r) => r.items.some(needsStatusPoll));

  const loadMeta = useCallback(async () => {
    setError("");
    try {
      const [hfRes, galRes] = await Promise.all([
        fetch("/api/higgsfield/settings"),
        fetch(`/api/projects/${projectId}/gallery`),
      ]);
      const hf = await hfRes.json();
      const gal = await galRes.json();
      if (hfRes.ok) {
        setHiggs({
          connected: Boolean(hf.connected),
          keyHint: hf.keyHint ?? null,
        });
      }
      if (galRes.ok) {
        setFolders((gal.allFolders ?? []) as GalleryFolder[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [projectId]);

  useEffect(() => {
    void loadMeta();
    setRuns(loadRuns(projectId));
  }, [loadMeta, projectId]);

  const patchRuns = useCallback(
    (updater: (prev: FlowRun[]) => FlowRun[]) => {
      setRuns((prev) => {
        const next = updater(prev);
        persistRuns(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  useEffect(() => {
    if (!needsPoll) return;

    let cancelled = false;
    const tick = async () => {
      const active = runsRef.current.flatMap((r) =>
        r.items.filter(needsStatusPoll)
      );
      for (const item of active) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/higgsfield/jobs/${item.requestId}`, {
            cache: "no-store",
          });
          const data = await res.json();
          if (!res.ok || cancelled) continue;
          const st = data.status as {
            status?: string;
            video?: { url?: string } | string | null;
            error?: string;
          };
          const nextStatus = (st.status || item.status).toLowerCase();
          const nextUrl =
            (typeof data.videoUrl === "string" && data.videoUrl) ||
            (typeof st.video === "string" ? st.video : st.video?.url) ||
            item.videoUrl;
          const nextError =
            typeof st.error === "string" ? st.error : item.error;
          patchRuns((prev) => {
            let changed = false;
            const next = prev.map((run) => ({
              ...run,
              items: run.items.map((it) => {
                if (it.requestId !== item.requestId) return it;
                if (
                  it.status === nextStatus &&
                  it.videoUrl === nextUrl &&
                  it.error === nextError
                ) {
                  return it;
                }
                changed = true;
                return {
                  ...it,
                  status: nextStatus,
                  videoUrl: nextUrl,
                  error: nextError,
                };
              }),
            }));
            return changed ? next : prev;
          });
        } catch {
          /* keep polling */
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [needsPoll, patchRuns]);

  useEffect(() => {
    const pending = runs.flatMap((run) =>
      run.items
        .filter(
          (i) =>
            i.status === "completed" && i.videoUrl && !i.saved && !i.error
        )
        .map((item) => ({ run, item }))
    );
    for (const { run, item } of pending) {
      const key = item.requestId;
      if (ingestLock.current.has(key)) continue;
      ingestLock.current.add(key);
      void (async () => {
        try {
          const res = await fetch(
            `/api/projects/${projectId}/creator/ingest`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videoUrl: item.videoUrl,
                folderId: run.folderId,
                name: `scene-${item.index + 1}.mp4`,
                topText: run.topText,
                hashtag: item.scene,
              }),
            }
          );
          const raw = await res.text();
          let data: { error?: string; asset?: { id: string } } = {};
          try {
            data = raw ? (JSON.parse(raw) as typeof data) : {};
          } catch {
            throw new Error(
              raw.slice(0, 180) || `Could not save video (${res.status})`
            );
          }
          if (!res.ok) throw new Error(data.error || `Could not save video (${res.status})`);
          patchRuns((prev) =>
            prev.map((r) => ({
              ...r,
              items: r.items.map((it) =>
                it.requestId === key ? { ...it, saved: true } : it
              ),
            }))
          );
        } catch (e) {
          ingestLock.current.delete(key);
          patchRuns((prev) =>
            prev.map((r) => ({
              ...r,
              items: r.items.map((it) =>
                it.requestId === key
                  ? {
                      ...it,
                      error:
                        e instanceof Error
                          ? e.message
                          : "Could not save to gallery",
                    }
                  : it
              ),
            }))
          );
        }
      })();
    }
  }, [runs, projectId, patchRuns]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#f4f2ef]">
      {higgs && !higgs.connected && flow?.id !== "layers" ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="Higgsfield"
          message="Higgsfield API is not connected — required for Creator Studio."
        />
      ) : null}

      <header className="shrink-0 border-b border-[#ebe6df] bg-[#faf8f5]/90 px-5 py-4 backdrop-blur sm:px-7">
        <div className="min-w-0">
          {flow ? (
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                setCharacterName("");
              }}
              className="text-[12px] font-semibold text-[var(--accent)]"
            >
              ← All flows
            </button>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b45309]">
              Studio
            </p>
          )}
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-[#1c1917]">
            {flow ? flow.name : "Creator Studio"}
            {flow && characterName.trim() ? (
              <span className="font-medium text-[#a8a29e]">
                {" "}
                · {characterName.trim()}
              </span>
            ) : null}
          </h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="mx-5 mt-4 rounded-2xl border border-[#fecaca] bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-[var(--danger)] sm:mx-7">
            {error}
          </div>
        ) : null}

        {flow?.id === "character-scene" ? (
          <CharacterSceneForm
            projectId={projectId}
            folders={folders}
            higgsConnected={Boolean(higgs?.connected)}
            characterName={characterName}
            onCharacterNameChange={setCharacterName}
            runs={runs.filter((r) => r.flowId === "character-scene")}
            onError={setError}
            onRun={(run) => patchRuns((prev) => [run, ...prev])}
            onRetrySave={(requestId) => {
              ingestLock.current.delete(requestId);
              patchRuns((prev) =>
                prev.map((r) => ({
                  ...r,
                  items: r.items.map((it) =>
                    it.requestId === requestId ? { ...it, error: null } : it
                  ),
                }))
              );
            }}
          />
        ) : flow?.id === "layers" ? (
          <LayersFlow
            projectId={projectId}
            folders={folders}
            onError={setError}
          />
        ) : (
          <div className="mx-auto max-w-5xl px-5 py-6 sm:px-7 sm:py-8">
            <p className="mb-5 max-w-lg text-[14px] leading-relaxed text-[#78716c]">
              Ready-made flows. Open one and run it as many times as you want —
              even several runs at once.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STUDIO_FLOWS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOpenId(f.id)}
                  className="flex min-h-[176px] flex-col items-start justify-between rounded-xl border border-[#ebe6df] bg-white p-5 text-left shadow-[0_1px_0_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-[0_12px_28px_rgba(28,25,23,0.08)]"
                >
                  <div className="flex items-center gap-1.5" aria-hidden>
                    {f.steps.map((step, i) => (
                      <span key={step} className="flex items-center gap-1.5">
                        {i > 0 ? (
                          <span className="h-px w-3 bg-[var(--accent-border)]" />
                        ) : null}
                        <span className="h-2 w-2 rounded-full bg-[#8b85ff]" />
                      </span>
                    ))}
                  </div>
                  <span className="w-full">
                    <span className="block text-[16px] font-semibold text-[#1c1917]">
                      {f.name}
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-[#a8a29e]">
                      {f.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterSceneForm({
  projectId,
  folders,
  higgsConnected,
  characterName,
  onCharacterNameChange,
  runs,
  onError,
  onRun,
  onRetrySave,
}: {
  projectId: string;
  folders: GalleryFolder[];
  higgsConnected: boolean;
  characterName: string;
  onCharacterNameChange: (name: string) => void;
  runs: FlowRun[];
  onError: (msg: string) => void;
  onRun: (run: FlowRun) => void;
  onRetrySave: (requestId: string) => void;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [characterUrl, setCharacterUrl] = useState("");
  const [characterFileName, setCharacterFileName] = useState("");
  const [uploadingChar, setUploadingChar] = useState(false);
  const [scenes, setScenes] = useState("");
  const [topText, setTopText] = useState("");
  const [musicFiles, setMusicFiles] = useState<File[]>([]);
  const [folderId, setFolderId] = useState("");
  const [presetId, setPresetId] = useState("social-story");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [durationSec, setDurationSec] = useState(5);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);

  const sceneList = splitScenePrompts(scenes);
  const videoModels = VIDEO_PRESETS.filter((p) => p.needsImage);
  const selectedPreset =
    videoModels.find((p) => p.id === presetId) ?? videoModels[0];
  const durationSpec = selectedPreset?.duration;
  const durationMin =
    durationSpec?.kind === "range" ? durationSpec.min : undefined;
  const durationMax =
    durationSpec?.kind === "range" ? durationSpec.max : undefined;
  const durationChoices =
    durationSpec?.kind === "enum" ? durationSpec.values : null;

  useEffect(() => {
    const spec = selectedPreset?.duration;
    if (!spec) return;
    setDurationSec((prev) => clampDurationSeconds(prev, spec));
  }, [selectedPreset]);

  useEffect(() => {
    const next = selectedPreset?.aspectRatio;
    if (next === "9:16" || next === "16:9" || next === "1:1" || next === "4:3" || next === "3:4") {
      setAspectRatio(next);
    }
  }, [selectedPreset?.id, selectedPreset?.aspectRatio]);
  const ready =
    Boolean(characterUrl) &&
    Boolean(characterName.trim()) &&
    sceneList.length > 0 &&
    Boolean(folderId) &&
    !uploadingChar;

  async function onCharacter(file: File | undefined) {
    if (!file) return;
    onError("");
    if (!file.type.startsWith("image/")) {
      onError("Character must be a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      onError("Character image max 20 MB.");
      return;
    }
    if (characterPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(characterPreview);
    }
    const local = URL.createObjectURL(file);
    setCharacterPreview(local);
    setCharacterFileName(file.name);
    setCharacterUrl("");
    setUploadingChar(true);
    try {
      const supabase = createClient();
      const mime = (file.type || "image/jpeg").toLowerCase();
      const safe = sanitizeFileName(file.name);
      const storagePath = `${projectId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, file, { contentType: mime, upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      const publicUrl = pub.publicUrl;

      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              name: safe,
              mimeType: mime,
              sizeBytes: file.size,
              storagePath,
              publicUrl,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save image");
      setCharacterUrl(publicUrl);
    } catch (e) {
      URL.revokeObjectURL(local);
      setCharacterPreview(null);
      setCharacterFileName("");
      setCharacterUrl("");
      onError(e instanceof Error ? e.message : "Could not upload character");
    } finally {
      setUploadingChar(false);
    }
  }

  async function uploadMusicToFolder(files: File[], destFolderId: string) {
    if (!files.length) return [] as string[];
    const supabase = createClient();
    const names: string[] = [];
    for (const file of files) {
      const mime = (file.type || "audio/mpeg").toLowerCase();
      const safe = sanitizeFileName(file.name);
      const storagePath = `${projectId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, file, { contentType: mime, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: destFolderId,
          files: [
            {
              name: safe,
              mimeType: mime,
              sizeBytes: file.size,
              storagePath,
              publicUrl: pub.publicUrl,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save music");
      names.push(file.name);
    }
    return names;
  }

  async function startJobs(scenesToRun: string[]) {
    if (!higgsConnected) {
      onError("Connect Higgsfield in Settings → API first.");
      return;
    }
    if (!characterUrl) {
      onError("Upload a character image first.");
      return;
    }
    if (!characterName.trim()) {
      onError("Name your character.");
      return;
    }
    if (!scenesToRun.length) {
      onError("Add at least one scene prompt. Separate several with ;");
      return;
    }
    if (!folderId) {
      onError("Pick an existing gallery folder as destination.");
      return;
    }

    const musicNames = await uploadMusicToFolder(musicFiles, folderId);
    const items: RunItem[] = [];
    const preset = selectedPreset?.id || "social-story";
    for (let i = 0; i < scenesToRun.length; i++) {
      const scene = scenesToRun[i]!;
      const prompt = buildCharacterScenePrompt(
        scene,
        characterName,
        aspectRatio
      );
      const res = await fetch("/api/higgsfield/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: preset,
          prompt,
          imageUrl: characterUrl,
          duration: durationSec,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Could not start video");
      }
      items.push({
        index: i,
        scene,
        musicName: musicNames.length
          ? musicNames[i % musicNames.length]!
          : null,
        requestId: data.job.request_id as string,
        status: (data.job.status as string) || "queued",
        videoUrl: null,
        error: null,
        saved: false,
      });
    }

    onRun({
      id: crypto.randomUUID(),
      flowId: "character-scene",
      createdAt: new Date().toISOString(),
      folderId,
      folderName: folderPath(folders, folderId),
      topText: topText.trim(),
      characterName: characterName.trim(),
      items,
    });
  }

  async function runFlow(e: FormEvent) {
    e.preventDefault();
    onError("");
    setRunning(true);
    try {
      await startJobs(sceneList);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not run flow");
    } finally {
      setRunning(false);
    }
  }

  async function createOne() {
    onError("");
    setCreating(true);
    try {
      await startJobs(sceneList.slice(0, 1));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create video");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={runFlow} className="space-y-4">
        <p className="text-[13px] leading-relaxed text-[#78716c]">
          One character, then as many scenes as you want (split with{" "}
          <code className="rounded bg-white px-1">;</code>). Each scene is a
          video. Music rotates in the same order. You can run this again while
          another run is still going.
        </p>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            1 · Character
          </p>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onCharacter(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploadingChar}
            onClick={() => imageRef.current?.click()}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#d6d3d1] px-3 py-3 text-left hover:border-[#8b85ff]"
          >
            {characterPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={characterPreview}
                alt=""
                className="h-14 w-14 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[18px] text-[var(--accent)]">
                +
              </span>
            )}
            <span>
              <span className="block text-[13px] font-semibold text-[#1c1917]">
                {uploadingChar
                  ? "Uploading…"
                  : characterFileName || "Upload character"}
              </span>
              <span className="text-[12px] text-[#a8a29e]">
                Saved to Gallery · JPG, PNG or WEBP
              </span>
            </span>
          </button>
          {characterUrl ? (
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#1c1917]">
                Name your character
              </span>
              <input
                value={characterName}
                onChange={(e) => onCharacterNameChange(e.target.value)}
                placeholder="e.g. Luna"
                className="ui-input"
              />
            </label>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            Video model
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            How the clip is generated. Pick one look.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {videoModels.map((p) => {
              const active = selectedPreset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-[#8b85ff] bg-[var(--surface-alt)]"
                      : "border-[#ebe6df] bg-white hover:border-[var(--accent-border)]"
                  }`}
                >
                  <span className="block text-[13px] font-semibold text-[#1c1917]">
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[#78716c]">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            Format
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            Shape of the video. The icon is the frame.
          </p>
          <div className="mt-3">
            <AspectFormatPicker value={aspectRatio} onChange={setAspectRatio} />
          </div>
          {durationSpec ? (
          <label className="mt-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[#1c1917]">
              Duration (seconds)
            </span>
            {durationChoices ? (
              <div className="flex flex-wrap gap-2">
                {durationChoices.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDurationSec(sec)}
                    className={
                      durationSec === sec
                        ? "ui-btn-primary !py-1.5 !px-3 text-[13px]"
                        : "ui-btn-secondary !py-1.5 !px-3 text-[13px]"
                    }
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                min={durationMin ?? 1}
                max={durationMax ?? 30}
                step={1}
                value={durationSec}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!durationSpec || !Number.isFinite(n)) return;
                  setDurationSec(clampDurationSeconds(n, durationSpec));
                }}
                className="ui-input"
              />
            )}
            <span className="mt-1.5 block text-[12px] text-[#a8a29e]">
              {durationChoices
                ? `This model accepts ${durationChoices.join(" or ")} seconds.`
                : `${durationMin ?? 1}–${durationMax ?? 30} seconds.`}
            </span>
          </label>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            2 · Scene prompts
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            What the character does. One or more, separated by ;
          </p>
          <textarea
            value={scenes}
            onChange={(e) => setScenes(e.target.value)}
            rows={4}
            placeholder="walks through a neon city; sits at a cafe looking at the camera"
            className="ui-input mt-3 resize-y"
          />
          {sceneList.length ? (
            <p className="mt-2 text-[12px] text-[#78716c]">
              {sceneList.length} video{sceneList.length === 1 ? "" : "s"} will
              generate
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            3 · Top text
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            Added at the top of the finished video by the editor — the AI does
            not draw this text.
          </p>
          <input
            value={topText}
            onChange={(e) => setTopText(e.target.value)}
            placeholder="Your headline"
            className="ui-input mt-3"
          />
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            4 · Music
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            One or more tracks. Video 1 uses track 1, video 2 uses track 2, then
            it loops.
          </p>
          <input
            ref={musicRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              setMusicFiles(Array.from(e.target.files ?? []));
            }}
          />
          <button
            type="button"
            onClick={() => musicRef.current?.click()}
            className="ui-btn-secondary mt-3 !py-2 text-[12px]"
          >
            {musicFiles.length
              ? `${musicFiles.length} track${musicFiles.length === 1 ? "" : "s"} selected`
              : "Add music"}
          </button>
          {musicFiles.length ? (
            <ul className="mt-2 space-y-1 text-[12px] text-[#78716c]">
              {musicFiles.map((f) => (
                <li key={f.name + f.size} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            5 · Destination
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            Choose a folder that already exists in Gallery
          </p>
          {folders.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-[12px] text-[var(--accent-ink)]">
              Create a folder in Gallery first, then come back.
            </p>
          ) : (
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="ui-input mt-3"
            >
              <option value="">Select folder…</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {folderPath(folders, f.id)}
                </option>
              ))}
            </select>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready || running || creating}
            onClick={() => void createOne()}
            className="ui-btn-primary !py-2.5 text-[13px]"
          >
            {creating ? "Creating…" : "Crear"}
          </button>
          <button
            type="submit"
            disabled={!ready || running || creating}
            className="ui-btn-secondary !py-2.5 text-[13px]"
          >
            {running ? "Running…" : "Run flow"}
          </button>
        </div>
      </form>

      <aside className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
          Runs
        </p>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d6d3d1] bg-white/60 px-4 py-8 text-center text-[12px] text-[#a8a29e]">
            No runs yet. You can start more than one at the same time.
          </p>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="rounded-2xl border border-[#ebe6df] bg-white p-3.5"
            >
              <p className="text-[12px] font-semibold text-[#1c1917]">
                {run.characterName ? `${run.characterName} · ` : ""}
                {run.items.length} video{run.items.length === 1 ? "" : "s"} →{" "}
                {run.folderName}
              </p>
              <p className="mt-0.5 text-[11px] text-[#a8a29e]">
                {new Date(run.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 space-y-2">
                {run.items.map((item) => (
                  <li
                    key={item.requestId || String(item.index)}
                    className="text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#57534e]">
                        {item.index + 1}. {item.scene}
                      </span>
                      <span className={statusClass(item)}>{statusLabel(item)}</span>
                    </div>
                    {item.error ? (
                      <div className="mt-1.5 rounded-xl bg-[var(--danger-soft)] px-2.5 py-2 text-[11px] leading-snug text-[var(--danger)]">
                        <p className="break-words">{item.error}</p>
                        {item.videoUrl ? (
                          <button
                            type="button"
                            onClick={() => onRetrySave(item.requestId)}
                            className="mt-1.5 font-semibold text-[var(--accent-ink)] underline"
                          >
                            Retry save
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </aside>
    </div>
  );
}
