"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  fillPromptTemplate,
  VIDEO_PRESETS,
  type VideoPreset,
} from "@/lib/higgsfield/presets";
import { ApiMissingBanner } from "./ApiMissingBanner";

type SettingsStatus = {
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
};

type StudioJob = {
  requestId: string;
  presetId: string | null;
  modelId: string;
  prompt: string;
  imageUrl: string | null;
  status: string;
  videoUrl: string | null;
  createdAt: string;
  error?: string;
};

type MarketingStudioViewProps = {
  projectId: string;
};

function jobsKey(projectId: string) {
  return `zima:marketing-jobs:${projectId}`;
}

function loadJobs(projectId: string): StudioJob[] {
  try {
    const raw = localStorage.getItem(jobsKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJobs(projectId: string, jobs: StudioJob[]) {
  try {
    localStorage.setItem(jobsKey(projectId), JSON.stringify(jobs.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

function statusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "queued":
      return { label: "Queued", className: "ui-tag ui-tag-muted" };
    case "in_progress":
      return { label: "Generating", className: "ui-tag ui-tag-accent" };
    case "completed":
      return { label: "Ready", className: "ui-tag ui-tag-success" };
    case "failed":
    case "nsfw":
      return { label: "Error", className: "ui-tag ui-tag-danger" };
    case "cancelled":
      return { label: "Cancelled", className: "ui-tag ui-tag-muted" };
    default:
      return { label: status, className: "ui-tag ui-tag-muted" };
  }
}

const ASPECT_OPTIONS = [
  { value: "9:16", label: "Vertical", hint: "Reels / TikTok" },
  { value: "16:9", label: "Horizontal", hint: "YouTube / ads" },
  { value: "1:1", label: "Square", hint: "Feed" },
  { value: "4:3", label: "Classic", hint: "4:3" },
  { value: "3:4", label: "Portrait", hint: "3:4" },
] as const;

function AspectShape({
  ratio,
  active = false,
  size = "md",
}: {
  ratio: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims: Record<string, { w: number; h: number }> = {
    "9:16": { w: 18, h: 32 },
    "16:9": { w: 32, h: 18 },
    "1:1": { w: 24, h: 24 },
    "4:3": { w: 28, h: 21 },
    "3:4": { w: 21, h: 28 },
  };
  const base = dims[ratio] ?? { w: 24, h: 24 };
  const scale = size === "lg" ? 1.35 : size === "sm" ? 0.75 : 1;
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);

  return (
    <span
      className={`inline-block rounded-[5px] border-2 transition ${
        active
          ? "border-[var(--accent)] bg-[var(--surface-alt)]"
          : "border-[#c5c9d4] bg-[#eef0f4]"
      }`}
      style={{ width: w, height: h }}
      aria-hidden
    />
  );
}

function DurationSlider({
  value,
  onChange,
  min = 1,
  max = 15,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--foreground-soft)]">Duration</span>
        <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--accent)]">
          {value}s
        </span>
      </div>
      <div className="relative flex h-9 items-center">
        <div className="absolute inset-x-0 h-2 rounded-full bg-[#e6e8ef]" />
        <div
          className="absolute left-0 h-2 rounded-full bg-[var(--accent)]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-10 h-9 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--accent)] [&::-moz-range-thumb]:shadow-md [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:shadow-md"
          aria-label="Duration in seconds"
        />
      </div>
      <div className="flex justify-between text-[10px] font-medium text-[var(--muted-soft)]">
        <span>{min}s</span>
        <span>{max}s</span>
      </div>
    </div>
  );
}

export function MarketingStudioView({ projectId }: MarketingStudioViewProps) {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [presetId, setPresetId] = useState(VIDEO_PRESETS[0]?.id ?? "");
  const [product, setProduct] = useState("");
  const [motion, setMotion] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [promptOverride, setPromptOverride] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const preset: VideoPreset | undefined = useMemo(
    () => VIDEO_PRESETS.find((p) => p.id === presetId),
    [presetId]
  );

  const previewPrompt = useMemo(() => {
    if (promptOverride.trim()) return promptOverride.trim();
    if (!preset) return "";
    return fillPromptTemplate(preset.promptTemplate, {
      product,
      hook: motion,
      style: "",
    });
  }, [preset, product, motion, promptOverride]);

  const selectedJob =
    jobs.find((j) => j.requestId === selectedJobId) ?? jobs[0] ?? null;

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/higgsfield/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      setStatus(data);
      if (!data.connected) setShowSetup(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection error");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const stored = loadJobs(projectId);
    setJobs(stored);
    if (stored[0]) setSelectedJobId(stored[0].requestId);
  }, [loadStatus, projectId]);

  useEffect(() => {
    if (preset) {
      setDuration(preset.defaultDuration);
      setAspectRatio(preset.aspectRatio);
    }
  }, [preset]);

  useEffect(() => {
    if (!status?.connected) return;
    const active = jobs.filter(
      (j) => j.status === "queued" || j.status === "in_progress"
    );
    if (active.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      for (const job of active) {
        try {
          const res = await fetch(`/api/higgsfield/jobs/${job.requestId}`);
          const data = await res.json();
          if (!res.ok || cancelled) continue;
          const st = data.status as {
            status?: string;
            video?: { url?: string };
            error?: string;
          };
          setJobs((prev) => {
            const next = prev.map((j) =>
              j.requestId === job.requestId
                ? {
                    ...j,
                    status: st.status ?? j.status,
                    videoUrl: st.video?.url ?? j.videoUrl,
                    error: typeof st.error === "string" ? st.error : j.error,
                  }
                : j
            );
            saveJobs(projectId, next);
            return next;
          });
        } catch {
          /* ignore */
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobs, status?.connected, projectId]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/higgsfield/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, keySecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not connect");
      setKeyId("");
      setKeySecret("");
      setStatus(data);
      setShowSetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Higgsfield?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/higgsfield/settings", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus({ connected: false, connectedAt: null, keyHint: null });
      setShowSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!status?.connected) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/higgsfield/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          prompt: promptOverride.trim() || undefined,
          product,
          hook: motion,
          style: "",
          imageUrl: imageUrl.trim() || undefined,
          duration,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Could not generate");
      }
      const job: StudioJob = {
        requestId: data.job.request_id,
        presetId: data.meta.presetId,
        modelId: data.meta.modelId,
        prompt: data.meta.prompt,
        imageUrl: data.meta.imageUrl,
        status: data.job.status || "queued",
        videoUrl: null,
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => {
        const next = [job, ...prev];
        saveJobs(projectId, next);
        return next;
      });
      setSelectedJobId(job.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating");
    } finally {
      setGenerating(false);
    }
  }

  async function cancelJob(requestId: string) {
    try {
      await fetch(`/api/higgsfield/jobs/${requestId}`, { method: "DELETE" });
      setJobs((prev) => {
        const next = prev.map((j) =>
          j.requestId === requestId ? { ...j, status: "cancelled" } : j
        );
        saveJobs(projectId, next);
        return next;
      });
    } catch {
      /* ignore */
    }
  }

  function clearImage() {
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageUrl("");
    setImageName("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleImagePick(file: File | null) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("JPG, PNG, or WEBP images only.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Max 12 MB.");
      return;
    }

    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setImageName(file.name);
    setImageUrl("");
    setUploadingImage(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/higgsfield/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not upload");
      setImageUrl(data.url as string);
    } catch (err) {
      URL.revokeObjectURL(localUrl);
      setImagePreview(null);
      setImageUrl("");
      setImageName("");
      if (imageInputRef.current) imageInputRef.current.value = "";
      setError(err instanceof Error ? err.message : "Error uploading image");
    } finally {
      setUploadingImage(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--surface-alt)] text-[13px] text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
          Opening studio…
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--surface-alt)] text-[var(--foreground)]">
      {!status?.connected ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="Higgsfield"
          message="Higgsfield API is not connected — required for Marketing Studio."
        />
      ) : null}

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight">
              Marketing Studio
            </h1>
            {status?.connected ? (
              <span className="ui-tag ui-tag-success">
                {status.keyHint ?? "Connected"}
              </span>
            ) : (
              <span className="ui-tag ui-tag-muted">Not connected</span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-[var(--muted)]">
            Automated videos with Higgsfield
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="mx-5 mt-4 rounded-2xl border border-[#fecdca] bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-[var(--danger)] sm:mx-6">
            {error}
          </div>
        ) : null}

        {!status?.connected ? (
          <div className="mx-5 mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center sm:mx-6">
            <p className="text-[14px] font-medium text-[var(--foreground)]">
              Connect Higgsfield
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
              Add Key ID + Secret in Settings → API.
            </p>
            <a
              href={`/projects/${projectId}/settings/api`}
              className="ui-btn-primary mt-5 inline-flex"
            >
              Open API settings
            </a>
          </div>
        ) : null}

        {status?.connected ? (
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-end justify-between px-0.5">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                    Style
                  </h2>
                  <span className="text-[12px] font-medium text-[var(--muted)]">
                    {preset?.label}
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {VIDEO_PRESETS.map((p) => {
                    const active = p.id === presetId;
                    const vertical =
                      p.aspectRatio === "9:16" || p.aspectRatio === "3:4";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPresetId(p.id)}
                        className={`group min-w-[168px] max-w-[180px] shrink-0 overflow-hidden rounded-xl border bg-white text-left transition ${
                          active
                            ? "border-[var(--accent)] shadow-[0_8px_24px_rgba(249,115,22,0.18)] ring-2 ring-[var(--accent-soft)]"
                            : "border-[var(--border)] hover:border-[var(--accent-border)] hover:shadow-[0_4px_16px_rgba(22,24,29,0.06)]"
                        }`}
                      >
                        <div
                          className={`relative overflow-hidden bg-[var(--surface-alt)] ${
                            vertical ? "aspect-[3/4]" : "aspect-[16/10]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.coverImage}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                          <span
                            className="absolute left-2.5 top-2.5 flex items-center justify-center rounded-lg bg-black/35 p-1.5 text-white backdrop-blur-sm"
                            title={p.aspectRatio}
                          >
                            <AspectShape
                              ratio={p.aspectRatio}
                              active
                              size="sm"
                            />
                          </span>
                          <span className="absolute bottom-2.5 left-2.5 right-2.5 text-[11px] font-semibold text-white/95">
                            {p.label}
                          </span>
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[14px] font-semibold text-[var(--foreground)]">
                              {p.name}
                            </p>
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: p.accent }}
                            />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
                            {p.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <form
                onSubmit={handleGenerate}
                className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(22,24,29,0.04)] sm:p-6"
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">
                      What do you want to show?
                    </span>
                    <input
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      placeholder="Product, brand, scene…"
                      className="ui-input !rounded-2xl !text-[14px]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">
                      Motion / vibe
                    </span>
                    <input
                      value={motion}
                      onChange={(e) => setMotion(e.target.value)}
                      placeholder="Slow zoom, handheld camera, golden light…"
                      className="ui-input !rounded-2xl !text-[14px]"
                    />
                  </label>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-[var(--foreground-soft)]">
                      <span>Starting image</span>
                      {preset?.needsImage ? (
                        <span className="ui-tag ui-tag-accent text-[10px]">
                          Required
                        </span>
                      ) : null}
                    </div>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) =>
                        void handleImagePick(e.target.files?.[0] ?? null)
                      }
                    />

                    {imagePreview ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                            {imageName || "Image"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {uploadingImage
                              ? "Uploading…"
                              : imageUrl
                                ? "Ready to generate"
                                : "Not uploaded"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="ui-btn-secondary !px-3 !py-1.5 text-[11px]"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={clearImage}
                            disabled={uploadingImage}
                            className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--surface-alt)]"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--accent)] shadow-sm">
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="M12 16V8m0 0l-3 3m3-3l3 3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M20 16.5V18a2 2 0 01-2 2H6a2 2 0 01-2-2v-1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <span className="text-[13px] font-semibold text-[var(--foreground)]">
                          Upload image
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          JPG, PNG, or WEBP · max 12 MB
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 rounded-2xl bg-[var(--surface-alt)] p-4">
                    <DurationSlider
                      value={duration}
                      onChange={setDuration}
                      min={1}
                      max={15}
                    />

                    <div>
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[var(--foreground-soft)]">
                          Aspect
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums text-[var(--accent)]">
                          {aspectRatio}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {ASPECT_OPTIONS.map((opt) => {
                          const active = aspectRatio === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAspectRatio(opt.value)}
                              title={`${opt.label} · ${opt.hint}`}
                              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 transition ${
                                active
                                  ? "border-[var(--accent)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]"
                                  : "border-transparent bg-white/60 text-[var(--muted)] hover:bg-white"
                              }`}
                            >
                              <span
                                className={
                                  active ? "text-[var(--accent)]" : "text-[var(--muted-soft)]"
                                }
                              >
                                <AspectShape
                                  ratio={opt.value}
                                  active={active}
                                  size="md"
                                />
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  active ? "text-[var(--accent)]" : "text-[var(--muted)]"
                                }`}
                              >
                                {opt.value}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-center text-[11px] text-[var(--muted-soft)]">
                        {
                          ASPECT_OPTIONS.find((o) => o.value === aspectRatio)
                            ?.hint
                        }{" "}
                        · actual video shape
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-[12px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {showAdvanced ? "− Hide prompt" : "+ Edit prompt"}
                  </button>

                  {showAdvanced ? (
                    <div className="rounded-2xl bg-[var(--surface-alt)] p-4">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
                          Prompt (optional)
                        </span>
                        <textarea
                          value={promptOverride}
                          onChange={(e) => setPromptOverride(e.target.value)}
                          rows={3}
                          placeholder={previewPrompt}
                          className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[12px] leading-relaxed outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-soft)]"
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                      Prompt to send
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--foreground-soft)]">
                      {previewPrompt || "Fill in product or motion…"}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      generating ||
                      uploadingImage ||
                      !previewPrompt ||
                      (Boolean(preset?.needsImage) && !imageUrl.trim())
                    }
                    className="ui-btn-primary w-full !py-3.5 disabled:opacity-40"
                  >
                    {generating ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5.5v13l11-6.5L8 5.5Z" />
                        </svg>
                        Generate video
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)] lg:sticky lg:top-0 lg:max-h-[calc(100dvh-8rem)] lg:min-h-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
                <div>
                  <p className="text-[14px] font-semibold">Results</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {jobs.length} video{jobs.length === 1 ? "" : "s"}
                  </p>
                </div>
                {jobs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setJobs([]);
                      setSelectedJobId(null);
                      saveJobs(projectId, []);
                    }}
                    className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--danger)]"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {selectedJob ? (
                <div className="border-b border-[var(--border)] p-3">
                  <div className="relative overflow-hidden rounded-2xl bg-[var(--surface-alt)]">
                    {selectedJob.videoUrl ? (
                      <video
                        key={selectedJob.videoUrl}
                        src={selectedJob.videoUrl}
                        controls
                        autoPlay
                        className="aspect-[9/16] max-h-[320px] w-full object-contain sm:aspect-video sm:max-h-[240px]"
                      />
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center gap-3">
                        {(selectedJob.status === "queued" ||
                          selectedJob.status === "in_progress") && (
                          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                        )}
                        <p className="text-[13px] text-[var(--muted)]">
                          {statusMeta(selectedJob.status).label}
                        </p>
                      </div>
                    )}
                    <span
                      className={`absolute left-2.5 top-2.5 ${statusMeta(selectedJob.status).className}`}
                    >
                      {statusMeta(selectedJob.status).label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 px-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
                    {selectedJob.prompt}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedJob.videoUrl ? (
                      <a
                        href={selectedJob.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-btn-primary !py-1.5 !px-3 text-[11px]"
                      >
                        Open video
                      </a>
                    ) : null}
                    {selectedJob.status === "queued" ? (
                      <button
                        type="button"
                        onClick={() => void cancelJob(selectedJob.requestId)}
                        className="ui-btn-secondary !py-1.5 !px-3 text-[11px]"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-xl text-[var(--accent)]">
                    ▷
                  </div>
                  <p className="text-[14px] font-semibold text-[var(--foreground)]">
                    Your video will appear here
                  </p>
                  <p className="max-w-[200px] text-[12px] text-[var(--muted)]">
                    Pick a style, add an image, and generate.
                  </p>
                </div>
              )}

              {jobs.length > 0 ? (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                  {jobs.map((job) => {
                    const meta = statusMeta(job.status);
                    const active = job.requestId === selectedJob?.requestId;
                    const presetJob = VIDEO_PRESETS.find(
                      (p) => p.id === job.presetId
                    );
                    return (
                      <li key={job.requestId}>
                        <button
                          type="button"
                          onClick={() => setSelectedJobId(job.requestId)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${
                            active
                              ? "bg-[var(--surface-alt)]"
                              : "hover:bg-[var(--surface-alt)]"
                          }`}
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                            style={{
                              background: presetJob?.accentSoft ?? "#f3f4f8",
                            }}
                          >
                            {job.videoUrl || job.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={job.imageUrl || job.videoUrl || ""}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: presetJob?.accent }}
                              >
                                {presetJob?.name?.slice(0, 3) ?? "VID"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-[var(--foreground)]">
                              {job.prompt}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted-soft)]">
                              {new Date(job.createdAt).toLocaleTimeString("en", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className={`shrink-0 ${meta.className}`}>
                            {meta.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
