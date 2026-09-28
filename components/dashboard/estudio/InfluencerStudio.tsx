"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { SnapCaption, StudioVideoPlayer, CaptionStyleSwatch } from "./StudioVideoPlayer";
import { CloseIcon, PlusIcon, RetryIcon, SettingsIcon, TrashIcon } from "../icons";
import { VideoClipTrimmer } from "./VideoClipTrimmer";
import { InfluencerApiTraceModal } from "./InfluencerApiTraceModal";
import {
  influencerCoverUrl,
  influencerProgress,
  loadVideoGenSettings,
  newId,
  productBriefFor,
  saveVideoGenSettings,
  type EstudioInfluencer,
  type EstudioInfluencerVideo,
  type EstudioVideoFormat,
  type EstudioVideoLanguage,
  type EstudioVideoTemplate,
  type EstudioDynamicPickMode,
} from "@/lib/creator/estudio-v1";
import { influencerStartFramePrompt, influencerVideoRefUrls, isKlingPromptError, canDeleteInfluencerVideo, parseInfluencerScript, splitInfluencerScripts } from "@/lib/creator/influencer-video";
import {
  CAPTION_STYLES,
  DEFAULT_OVERLAY_PREVIEW,
  OVERLAY_PREVIEW_PHOTO,
  nextOverlayPosition,
  normalizeCaptionStyleMode,
  normalizeOverlayPosition,
  type CaptionStyleMode,
  type OverlayPosition,
} from "@/lib/creator/overlay-styles";
import {
  displayFalError,
  isFalBalanceLockError,
  isFalRequestMissingError,
} from "@/lib/fal/errors";
import {
  loadAppDemo,
  type AppDemoVariable,
} from "@/lib/creator/app-demo";
import { DEFAULT_APP_DEMO_CODE } from "@/lib/creator/app-demo-code";
import {
  estimateInfluencerVideoCost,
  formatVideoCostUsd,
  videoCostTitle,
} from "@/lib/creator/influencer-video-cost";
import {
  DEFAULT_FAL_KLING_DURATION,
  DEFAULT_FAL_VIDEO_MODEL,
  FAL_KLING_DURATIONS,
  FAL_VIDEO_MODELS,
  FAVORITE_MODEL_LIMIT,
  falVideoModelMeta,
  getFalKlingDuration,
  getFalVideoDuration,
  getFalVideoModel,
  normalizeFavoriteModelIds,
} from "@/lib/creator/fal-video-models";
import {
  combineApiTrace,
  reconstructApiTrace,
  type InfluencerApiTrace,
} from "@/lib/creator/influencer-api-trace";
import { MOTION_CLONE_MAX_SEC, MOTION_CLONE_TRIM_MIN_SEC } from "@/lib/creator/motion-control";
import type { StudioDynamic } from "@/lib/creator/dynamics";
import { mergeStudioDynamics } from "@/lib/creator/dynamics-workspace";
import { HOOK_APP_DEMO_ID } from "@/lib/gallery/dynamics-folder";

type GalleryVideo = {
  id: string;
  name: string;
  publicUrl: string;
  createdAt: string;
};

type DynamicSlotClip = {
  id: string;
  name: string;
  publicUrl: string;
};

function DynamicClipGrid({
  clips,
  selectedId,
  emptyLabel,
  disabled,
  onSelect,
}: {
  clips: DynamicSlotClip[];
  selectedId: string | null;
  emptyLabel: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  if (!clips.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-3 py-8 text-center text-[12px] leading-relaxed text-[var(--muted-soft)]">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2">
      {clips.map((clip) => {
        const active = clip.id === selectedId;
        return (
          <li key={clip.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(clip.id)}
              className={`overflow-hidden rounded-xl border text-left ${
                active
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
                  : "border-transparent"
              }`}
            >
              <span className="relative block aspect-[9/16] bg-[#111827]">
                <video
                  src={clip.publicUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              </span>
              <span className="mt-1 block truncate px-0.5 text-[11px] font-medium text-[var(--foreground-soft)]">
                {clip.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type StudioDeleteTarget =
  | { kind: "job"; job: EstudioInfluencerVideo }
  | { kind: "asset"; asset: GalleryVideo };

function ModeSwitch({
  manual,
  disabled,
  onChange,
}: {
  manual: boolean;
  disabled?: boolean;
  onChange: (manual: boolean) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Modo de generación"
      className="relative mt-4 grid h-9 w-full max-w-sm grid-cols-2 rounded-lg bg-[var(--surface-alt)] p-0.5 disabled:opacity-60"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md border border-[var(--border)] bg-white transition-transform duration-150 ${
          manual ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <button
        type="button"
        role="radio"
        aria-checked={!manual}
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`relative z-10 rounded-md text-[13px] font-medium transition-colors duration-150 ${
          manual ? "text-[var(--muted-soft)]" : "text-[var(--foreground)]"
        }`}
      >
        Automático
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={manual}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`relative z-10 rounded-md text-[13px] font-medium transition-colors duration-150 ${
          manual ? "text-[var(--foreground)]" : "text-[var(--muted-soft)]"
        }`}
      >
        Manual
      </button>
    </div>
  );
}

function isActive(status: string) {
  const s = (status || "").toLowerCase();
  return (
    s === "draft" ||
    s === "queued" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "saving" ||
    s === "demo_pending" ||
    s === "composing"
  );
}

function newestFirst<T extends { id: string; createdAt?: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    if (tb !== ta) return tb - ta;
    return items.indexOf(b) - items.indexOf(a);
  });
}

function isGeneratingJob(job: EstudioInfluencerVideo) {
  if (job.assetId) return false;
  return isActive(job.status);
}

function canRetryQueued(job: EstudioInfluencerVideo) {
  const s = (job.status || "").toLowerCase();
  if (s === "demo_pending" && job.error) return true;
  if (job.videoUrl || job.assetId) return false;
  if ((job.providerStatus || "").toUpperCase() === "GENERATING_FRAME") return false;
  if (isFalRequestMissingError(job.error) || isFalBalanceLockError(job.error)) {
    return true;
  }
  if (job.requestId) return false;
  return s === "failed" || isKlingPromptError(job.error);
}

function VideoPickButton({
  selected,
  onToggle,
}: {
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? "Quitar de la selección" : "Seleccionar"}
      title={selected ? "Quitar de la selección" : "Seleccionar"}
      className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-sm ${
        selected
          ? "bg-white text-[var(--foreground)]"
          : "bg-black/55 text-white/85 hover:bg-black/75 hover:text-white"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {selected ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12.5 9.2 17 19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="h-3.5 w-3.5 rounded-[4px] border border-white/80" />
      )}
    </button>
  );
}

function SelectionModeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 12.2 10.8 15 16 9.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      {off ? (
        <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function VideoCaptionButton({
  hidden,
  onClick,
}: {
  hidden: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-lg bg-black/55 p-1.5 text-white/85 backdrop-blur-sm hover:bg-black/75 hover:text-white"
      aria-label={hidden ? "Mostrar texto" : "Quitar texto"}
      title={hidden ? "Mostrar texto" : "Quitar texto"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <EyeIcon off={hidden} />
    </button>
  );
}

function VideoDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-lg bg-black/55 p-1.5 text-white/85 backdrop-blur-sm hover:bg-black/75 hover:text-white"
      aria-label="Eliminar"
      title="Eliminar"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function shortModelName(id: string) {
  const model = getFalVideoModel(id);
  return model.name.split(" · ")[0] || model.name;
}

function modelMetaLine(id: string) {
  return falVideoModelMeta(getFalVideoModel(id));
}

function formatElapsed(iso?: string | null) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 20) return "ahora";
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

function jobProgress(job: EstudioInfluencerVideo): {
  title: string;
  detail: string;
  live: boolean;
} {
  const s = (job.status || "").toLowerCase();
  const fal = (job.providerStatus || "").toUpperCase();
  const isClone = Boolean(job.referenceVideoUrl);
  if (s === "draft") {
    return {
      title: "En cola",
      detail: isClone
        ? "Primero se crea un fotograma nuevo adaptado al video de referencia."
        : "Aún no enviado. Primero se crea un fotograma nuevo del personaje.",
      live: false,
    };
  }
  if (
    !job.requestId &&
    ((job.providerStatus || "").toUpperCase() === "GENERATING_FRAME" ||
      ((s === "queued" || s === "pending") && !job.startImageUrl))
  ) {
    return {
      title: "Fotograma…",
      detail: isClone
        ? "Creando un fotograma nuevo adaptado al video de referencia"
        : "Creando un fotograma nuevo con GPT Image 2",
      live: true,
    };
  }
  if ((s === "queued" || s === "pending") && !job.requestId) {
    return {
      title: "Enviando…",
      detail: isClone
        ? "Mandando el fotograma nuevo a Kling Motion Control"
        : "Mandando el fotograma a Kling",
      live: false,
    };
  }
  if (s === "cancelled" || s === "canceled") {
    return {
      title: "Detenido",
      detail: "Generación detenida",
      live: false,
    };
  }
  if (s === "failed" || isKlingPromptError(job.error) || isFalBalanceLockError(job.error)) {
    return {
      title: "Falló",
      detail:
        isKlingPromptError(job.error)
          ? "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres)."
          : displayFalError(job.error) || "fal.ai no pudo generar el video",
      live: false,
    };
  }
  if (s === "saving") {
    return {
      title: "Guardando…",
      detail: "Video listo · copiando a Galería",
      live: true,
    };
  }
  if (s === "demo_pending") {
    return {
      title: "Demo de la app…",
      detail: job.error
        ? job.error
        : "Renderizando la demo con las variables del producto",
      live: !job.error,
    };
  }
  if (s === "composing") {
    return {
      title: "Uniendo…",
      detail: job.demoVideoUrl
        ? "Juntando los videos en el servidor."
        : "Falta la demo de la app. Se reanuda en esta pestaña.",
      live: true,
    };
  }
  const providerName =
    job.videoProvider === "replicate"
      ? "Replicate"
      : job.videoProvider === "kling"
        ? "Kling"
        : job.videoProvider === "fal"
          ? "fal.ai"
          : "el proveedor";
  if (fal === "IN_QUEUE") {
    const pos =
      typeof job.queuePosition === "number"
        ? ` · puesto ${job.queuePosition}`
        : "";
    return {
      title: `En cola de ${providerName}`,
      detail: `Job real en ${providerName}${pos}`,
      live: true,
    };
  }
  if (fal === "IN_PROGRESS") {
    return {
      title: `Generando en ${providerName}`,
      detail: `${providerName} lo está procesando ahora`,
      live: true,
    };
  }
  if (job.requestId) {
    return {
      title: job.error ? `Sin estado de ${providerName}` : `En ${providerName}`,
      detail: displayFalError(job.error) || `Enviado · esperando estado de ${providerName}`,
      live: !job.error,
    };
  }
  return {
    title: "Generando…",
    detail: "Sin confirmación del proveedor todavía",
    live: false,
  };
}

function displayJobCost(
  job: EstudioInfluencerVideo,
  fallbackRefCount: number
) {
  const computed = estimateInfluencerVideoCost({
    modelId: job.modelId,
    refCount: fallbackRefCount || 6,
    frameUsd: job.frameCostUsd,
    durationSec: Number(job.duration) || 10,
    clone: Boolean(job.referenceVideoUrl),
  });
  if (typeof job.estimatedCostUsd === "number" && Number.isFinite(job.estimatedCostUsd)) {
    return { ...computed, totalUsd: job.estimatedCostUsd };
  }
  return computed;
}

function ApiInfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-[13px] font-semibold text-white/90 backdrop-blur-sm hover:bg-black/75 hover:text-white"
      aria-label="Ver lo enviado a la API"
      onClick={onClick}
    >
      I
    </button>
  );
}

function traceForJob(
  job: EstudioInfluencerVideo,
  influencer: EstudioInfluencer
): InfluencerApiTrace | null {
  const spoken = parseInfluencerScript(job.script || "").spoken;
  const rebuilt = reconstructApiTrace({
    prompt: job.prompt,
    startImageUrl: job.startImageUrl,
    framePrompt: influencerStartFramePrompt({
      name: influencer.name,
      traits: influencer.traits,
      action: job.action || "",
      extra: job.extra || "",
      script: spoken,
      matchVideo: Boolean(job.referenceVideoUrl),
    }),
    refUrls: influencerVideoRefUrls(influencer),
    modelId: job.modelId,
    videoProvider: job.videoProvider ?? null,
  });
  return combineApiTrace(job.apiTrace, rebuilt, job.startImageUrl);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11M7.5 11.5 12 16l4.5-4.5M6 19h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatVideoCreatedAt(iso?: string | null) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t) || t <= 0) return "";
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

function VideoCreatedBadge({ createdAt }: { createdAt?: string | null }) {
  const label = formatVideoCreatedAt(createdAt);
  if (!label) return null;
  return (
    <span className="absolute bottom-2 left-2 z-20 max-w-[calc(100%-16px)] truncate rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
      {label}
    </span>
  );
}

function VideoCostBadge({
  cost,
  onDownload,
  downloading,
}: {
  cost: ReturnType<typeof estimateInfluencerVideoCost>;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  return (
    <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
      {onDownload ? (
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white/90 backdrop-blur-sm hover:bg-black/80 hover:text-white disabled:opacity-50"
          aria-label="Descargar con texto"
          title="Descargar con texto superpuesto"
          disabled={downloading}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <DownloadIcon className={`h-3.5 w-3.5 ${downloading ? "animate-pulse" : ""}`} />
        </button>
      ) : null}
      <span
        title={`${videoCostTitle(cost)} (estimado de este video, no el saldo de fal.ai)`}
        className="rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/90 backdrop-blur-sm"
      >
        est. {formatVideoCostUsd(cost.totalUsd)}
      </span>
    </div>
  );
}

export function InfluencerStudio({
  projectId,
  influencer,
  onBack,
  onChange,
  onOpenPhotos,
}: {
  projectId: string;
  influencer: EstudioInfluencer;
  onBack: () => void;
  onChange: (list: EstudioInfluencer[]) => void;
  onOpenPhotos: () => void;
}) {
  const [folderId, setFolderId] = useState(influencer.folderId || "");
  const [script, setScript] = useState("");
  const [videos, setVideos] = useState<EstudioInfluencerVideo[]>([]);
  const [gallery, setGallery] = useState<GalleryVideo[]>([]);
  const [busy, setBusy] = useState<"scripts" | "start" | "one" | "compose" | "">(
    ""
  );
  const [scriptCount, setScriptCount] = useState(3);
  const [modelId, setModelId] = useState(DEFAULT_FAL_VIDEO_MODEL);
  const [error, setError] = useState("");
  const [fal, setFal] = useState<{ connected: boolean } | null>(null);
  const [replicate, setReplicate] = useState<{ connected: boolean } | null>(null);
  const [openai, setOpenai] = useState<{ connected: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudioDeleteTarget | null>(
    null
  );
  const [inspectJob, setInspectJob] = useState<EstudioInfluencerVideo | null>(null);
  const [retryingId, setRetryingId] = useState("");
  const [stoppingId, setStoppingId] = useState("");
  const [hiddenOverlayIds, setHiddenOverlayIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVideoKeys, setSelectedVideoKeys] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const language: EstudioVideoLanguage = influencer.language === "en" ? "en" : "es";
  const [format, setFormat] = useState<EstudioVideoFormat>("talking");
  const [aiOverlay, setAiOverlay] = useState(true);
  const [overlayText, setOverlayText] = useState("");
  const [overlayStyle, setOverlayStyle] = useState<CaptionStyleMode>("snapchat");
  const [overlayPosition, setOverlayPosition] =
    useState<OverlayPosition>("upper");
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>(() =>
    normalizeFavoriteModelIds(undefined, DEFAULT_FAL_VIDEO_MODEL)
  );
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [templates, setTemplates] = useState<EstudioVideoTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [dynamics, setDynamics] = useState<StudioDynamic[]>([]);
  const [dynamicId, setDynamicId] = useState<string | null>(null);
  const [dynamicPickMode, setDynamicPickMode] =
    useState<EstudioDynamicPickMode>("random");
  const [slotClips, setSlotClips] = useState<Record<string, DynamicSlotClip[]>>(
    {}
  );
  const [hookAssetId, setHookAssetId] = useState<string | null>(null);
  const [demoAssetId, setDemoAssetId] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAction, setDraftAction] = useState("");
  const [draftExtra, setDraftExtra] = useState("");
  const [draftDuration, setDraftDuration] = useState(DEFAULT_FAL_KLING_DURATION);
  const [draftSource, setDraftSource] = useState<"describe" | "video">("describe");
  const [draftSpeak, setDraftSpeak] = useState(true);
  const [draftVideoUrl, setDraftVideoUrl] = useState("");
  const [draftVideoName, setDraftVideoName] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState("");
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(10);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const videoInput = useRef<HTMLInputElement>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<EstudioVideoTemplate | null>(
    null
  );
  const [demoProgress, setDemoProgress] = useState<Record<string, number>>({});
  const composingRef = useRef(new Set<string>());
  const demoFailedRef = useRef(new Set<string>());

  const cover = influencerCoverUrl(influencer);
  const refCount = influencerVideoRefUrls(influencer).length;
  const progress = influencerProgress(influencer);
  const selectedTemplate =
    templates.find((t) => t.id === templateId) ?? null;
  const selectedDynamic =
    dynamics.find((item) => item.id === dynamicId) ?? null;
  const isHookAppDemo = selectedDynamic?.id === HOOK_APP_DEMO_ID;
  const isAutomatic = dynamicPickMode !== "manual";
  const hookClips = slotClips["hook-reference"] ?? [];
  const demoClips = slotClips["app-demo"] ?? [];
  const selectedModel = getFalVideoModel(modelId);
  const isMotionClone =
    selectedTemplate?.source === "video" && Boolean(selectedTemplate.videoUrl);
  const duration = isMotionClone
    ? String(Math.min(30, Math.max(1, Number(selectedTemplate?.duration) || 10)))
    : getFalVideoDuration(selectedModel.id, selectedTemplate?.duration);
  const videoCost = estimateInfluencerVideoCost({
    modelId: selectedModel.id,
    refCount: refCount || 6,
    durationSec: Number(duration),
    clone: isMotionClone,
  });
  const reloadVideos = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/creator/influencers/${influencer.id}/videos`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los videos");
    setVideos((data.videos ?? []) as EstudioInfluencerVideo[]);
    setGallery(
      newestFirst(
        ((data.gallery ?? []) as {
          id: string;
          name: string;
          publicUrl: string;
          createdAt: string;
        }[])
          .filter((a) => !/^mimic[-_]/i.test(a.name || ""))
          .map((a) => ({
          id: a.id,
          name: a.name,
          publicUrl: a.publicUrl,
          createdAt: a.createdAt,
        }))
      )
    );
  }, [influencer.id, projectId]);

  useEffect(() => {
    setFolderId(influencer.folderId || "");
  }, [influencer.folderId]);

  useEffect(() => {
    const settings = loadVideoGenSettings(projectId);
    setFormat(settings.format);
    setAiOverlay(settings.aiOverlay !== false);
    setOverlayStyle(normalizeCaptionStyleMode(settings.overlayStyle));
    setOverlayPosition(normalizeOverlayPosition(settings.overlayPosition));
    setOverlayText(settings.overlayText || "");
    setModelId(getFalVideoModel(settings.modelId).id);
    setFavoriteModelIds(
      normalizeFavoriteModelIds(settings.favoriteModelIds, settings.modelId)
    );
    setTemplates(settings.templates);
    setTemplateId(settings.templateId);
    setDynamicId(settings.dynamicId);
    setDynamicPickMode(settings.dynamicPickMode);
  }, [projectId]);

  function persistGen(next: {
    language?: EstudioVideoLanguage;
    format?: EstudioVideoFormat;
    aiOverlay?: boolean;
    overlayStyle?: CaptionStyleMode;
    overlayPosition?: OverlayPosition;
    overlayText?: string;
    modelId?: string;
    favoriteModelIds?: string[];
    templateId?: string | null;
    templates?: EstudioVideoTemplate[];
    dynamicId?: string | null;
    dynamicPickMode?: EstudioDynamicPickMode;
  }) {
    const nextModelId = getFalVideoModel(next.modelId ?? modelId).id;
    const settings = {
      language,
      format: next.format ?? format,
      aiOverlay: next.aiOverlay ?? aiOverlay,
      overlayStyle: next.overlayStyle ?? overlayStyle,
      overlayPosition: next.overlayPosition ?? overlayPosition,
      overlayText: next.overlayText ?? overlayText,
      modelId: nextModelId,
      favoriteModelIds: normalizeFavoriteModelIds(
        next.favoriteModelIds ?? favoriteModelIds,
        nextModelId
      ),
      beauty: false,
      templateId:
        next.templateId === undefined ? templateId : next.templateId,
      templates: next.templates ?? templates,
      dynamicId: next.dynamicId === undefined ? dynamicId : next.dynamicId,
      dynamicPickMode: next.dynamicPickMode ?? dynamicPickMode,
    };
    setFormat(settings.format);
    setAiOverlay(settings.aiOverlay);
    setOverlayStyle(settings.overlayStyle);
    setOverlayPosition(settings.overlayPosition);
    setOverlayText(settings.overlayText);
    setModelId(settings.modelId);
    setFavoriteModelIds(settings.favoriteModelIds);
    setTemplateId(settings.templateId);
    setTemplates(settings.templates);
    setDynamicId(settings.dynamicId);
    setDynamicPickMode(settings.dynamicPickMode);
    saveVideoGenSettings(projectId, settings);
  }

  function toggleFavoriteModel(id: string) {
    const current = normalizeFavoriteModelIds(favoriteModelIds);
    if (current.includes(id)) {
      const next = current.filter((item) => item !== id);
      persistGen({
        favoriteModelIds: next,
        modelId: next.includes(modelId) ? modelId : next[0] ?? modelId,
      });
      return;
    }
    if (current.length >= FAVORITE_MODEL_LIMIT) return;
    persistGen({ favoriteModelIds: [...current, id] });
  }

  function appDemoSnapshot() {
    const draft = loadAppDemo(projectId);
    return {
      code: draft.code.trim() || DEFAULT_APP_DEMO_CODE,
      phoneFrame: draft.phoneFrame !== false,
      variables: draft.variables,
    };
  }

  function templatePayload() {
    return {
      language,
      duration,
      templateAction: isMotionClone
        ? selectedTemplate?.action || "Clonar movimiento del video de referencia."
        : selectedTemplate?.action || "",
      templateExtra: isMotionClone ? "" : selectedTemplate?.extra || "",
      format,
      demo: appDemoSnapshot(),
      withOverlay: true,
      overlay: overlayText.trim() || DEFAULT_OVERLAY_PREVIEW,
      overlayStyle,
      overlayPosition,
      beauty: false,
      templateSpeak: isMotionClone ? false : selectedTemplate?.speak !== false,
      templateVideoUrl: isMotionClone ? selectedTemplate?.videoUrl || "" : "",
    };
  }

  function resetDynamicDraft() {
    if (draftPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(draftPreviewUrl);
    }
    setDraftTitle("");
    setDraftAction("");
    setDraftExtra("");
    setDraftDuration(DEFAULT_FAL_KLING_DURATION);
    setDraftSource("describe");
    setDraftSpeak(true);
    setDraftVideoUrl("");
    setDraftVideoName("");
    setDraftFile(null);
    setDraftPreviewUrl("");
    setClipStart(0);
    setClipEnd(10);
    setAnalyzeError("");
    setAnalyzing(false);
    if (videoInput.current) videoInput.current.value = "";
  }

  function pickReferenceVideo(file: File) {
    const mime = (file.type || "").toLowerCase();
    if (
      mime &&
      !["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"].includes(mime)
    ) {
      setAnalyzeError("Usa un MP4, MOV o WEBM.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setAnalyzeError("El video no puede superar 500 MB.");
      return;
    }
    if (draftPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(draftPreviewUrl);
    }
    setAnalyzeError("");
    setDraftFile(file);
    setDraftVideoName(file.name);
    setDraftPreviewUrl(URL.createObjectURL(file));
    setClipStart(0);
    setClipEnd(MOTION_CLONE_MAX_SEC);
  }

  async function persistReferenceClip(): Promise<{ url: string; duration: string }> {
    let sourceUrl = draftVideoUrl;
    if (draftFile) {
      const supabase = createClient();
      const ext =
        (draftFile.name.split(".").pop() || "mp4")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "mp4";
      const storagePath = `${projectId}/dynamics/pending/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, draftFile, {
          contentType: draftFile.type || "video/mp4",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
      sourceUrl = supabase.storage.from("gallery").getPublicUrl(storagePath).data
        .publicUrl;
    }
    if (!sourceUrl) throw new Error("Sube un video de referencia.");
    if (clipEnd - clipStart < MOTION_CLONE_TRIM_MIN_SEC - 0.02) {
      throw new Error("El recorte es demasiado corto.");
    }
    const res = await fetch(`/api/projects/${projectId}/creator/dynamics/clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: sourceUrl,
        startSec: clipStart,
        endSec: clipEnd,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      videoUrl?: string;
      duration?: string;
    };
    if (!res.ok || !data.videoUrl) {
      throw new Error(data.error || "No se pudo recortar el video");
    }
    return {
      url: data.videoUrl,
      duration: String(
        data.duration || Math.max(1, Math.round(clipEnd - clipStart))
      ),
    };
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/replicate/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setReplicate({ connected: Boolean(data.connected) });
      })
      .catch(() => {
        if (!cancelled) setReplicate({ connected: false });
      });
    fetch("/api/fal/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFal({ connected: Boolean(data.connected) });
      })
      .catch(() => {
        if (!cancelled) setFal({ connected: false });
      });
    fetch("/api/openai/api-settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setOpenai({ connected: Boolean(data.connected) });
      })
      .catch(() => {
        if (!cancelled) setOpenai({ connected: false });
      });
    fetch(`/api/projects/${projectId}/creator/dynamics`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = mergeStudioDynamics(
          (Array.isArray(data.dynamics) ? data.dynamics : []) as StudioDynamic[],
          projectId
        );
        setDynamics(list);
        setDynamicId((current) => {
          if (current && list.some((item) => item.id === current)) return current;
          const saved = loadVideoGenSettings(projectId).dynamicId;
          if (saved && list.some((item) => item.id === saved)) return saved;
          return list.length === 1 ? list[0]!.id : current;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        await reloadVideos();
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(() => {
      if (cancelled) return;
      void tick();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reloadVideos]);

  useEffect(() => {
    const dyn = dynamics.find((item) => item.id === dynamicId) ?? null;
    if (!dyn?.slots.length) {
      setSlotClips({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      dyn.slots.map(async (slot) => {
        if (!slot.folderId) return [slot.id, [] as DynamicSlotClip[]] as const;
        const res = await fetch(
          `/api/projects/${projectId}/gallery?folderId=${encodeURIComponent(slot.folderId)}&kind=video`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los clips");
        const assets = (data.assets ?? []) as {
          id: string;
          name: string;
          kind: string;
          publicUrl: string;
        }[];
        return [
          slot.id,
          assets
            .filter((a) => a.kind === "video" && a.publicUrl)
            .map((a) => ({ id: a.id, name: a.name, publicUrl: a.publicUrl })),
        ] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setSlotClips(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los clips");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dynamicId, dynamics, projectId]);

  useEffect(() => {
    for (const job of videos) {
      const status = (job.status || "").toLowerCase();
      const needsBrowserDemo =
        !job.error &&
        !job.demoVideoUrl &&
        !demoFailedRef.current.has(job.id) &&
        (job.format === "app-demo" || Boolean(job.demoCode)) &&
        (status === "demo_pending" || status === "composing");
      if (needsBrowserDemo) {
        void composeAppDemo(job);
      }
    }
  }, [videos]);

  async function postVideos(body: Record<string, unknown>) {
    const res = await fetch(
      `/api/projects/${projectId}/creator/influencers/${influencer.id}/videos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "No se pudo completar");
    }
    return data;
  }

  async function composeDynamicVideo(count = 1) {
    if (busy || !selectedDynamic) return;
    if (
      isHookAppDemo &&
      dynamicPickMode === "manual" &&
      (!hookAssetId || !demoAssetId)
    ) {
      setError("Elige un hook y una demo.");
      return;
    }
    setBusy("compose");
    setError("");
    try {
      await postVideos({
        action: "compose-dynamic",
        dynamicId: selectedDynamic.id,
        mode: dynamicPickMode,
        hookAssetId: hookAssetId || "",
        demoAssetId: demoAssetId || "",
        count,
        modelId: selectedModel.id,
        ...templatePayload(),
        overlay: "",
        withOverlay: false,
      });
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron unir los videos");
    } finally {
      setBusy("");
    }
  }

  async function generateClone(count = scriptCount) {
    if (busy) return;
    if (!isMotionClone) {
      setError("Elige una dinámica con video de referencia.");
      return;
    }
    persistGen({ modelId: selectedModel.id });
    setBusy("start");
    setError("");
    try {
      await postVideos({
        action: "enqueue-clone",
        count,
        modelId: selectedModel.id,
        ...templatePayload(),
      });
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar");
    } finally {
      setBusy("");
    }
  }

  async function enqueueOne(e: FormEvent) {
    e.preventDefault();
    if (busy || !script.trim()) return;
    setBusy("one");
    setError("");
    try {
      await postVideos({
        action: "enqueue",
        script: script.trim(),
        modelId: selectedModel.id,
        ...templatePayload(),
      });
      setScript("");
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el guion");
    } finally {
      setBusy("");
    }
  }

  async function startGeneration(count = scriptCount) {
    if (isMotionClone) {
      await generateClone(count);
      return;
    }
    if (busy) return;
    persistGen({ modelId: selectedModel.id });
    setBusy("start");
    setError("");
    try {
      if (script.trim()) {
        await postVideos({
          action: "enqueue",
          script: script.trim(),
          modelId: selectedModel.id,
          ...templatePayload(),
        });
        setScript("");
      }
      await postVideos({
        action: "start",
        modelId: selectedModel.id,
        product: productBriefFor(projectId, "short"),
        ...templatePayload(),
      });
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar");
    } finally {
      setBusy("");
    }
  }

  async function runDynamicJob(kind: "test" | "auto") {
    if (!selectedDynamic || busy) return;
    await composeDynamicVideo(kind === "test" ? 1 : Math.min(5, scriptCount));
  }

  async function downloadJob(job: EstudioInfluencerVideo) {
    if (!job.videoUrl && !job.assetId) return;
    setDownloadingId(job.id);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/influencers/${influencer.id}/videos?download=${encodeURIComponent(job.id)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No se pudo descargar el video con texto."
        );
      }
      const blob = await res.blob();
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (type.includes("application/json")) {
        const data = JSON.parse(await blob.text()) as { error?: string };
        throw new Error(data.error || "No se pudo descargar el video con texto.");
      }
      const header = res.headers.get("content-disposition") || "";
      const named = header.match(/filename="([^"]+)"/)?.[1];
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = named || `influencer-${job.id.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar");
    } finally {
      setDownloadingId("");
    }
  }

  async function stopGeneration(job: EstudioInfluencerVideo) {
    if (stoppingId) return;
    setStoppingId(job.id);
    setError("");
    try {
      await postVideos({ action: "cancel", videoId: job.id });
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo parar");
    } finally {
      setStoppingId("");
    }
  }

  async function retryJob(job: EstudioInfluencerVideo) {
    if (busy || retryingId || deleting) return;
    const status = (job.status || "").toLowerCase();
    if (status === "demo_pending") {
      composingRef.current.delete(job.id);
      demoFailedRef.current.delete(job.id);
      void composeAppDemo(job, true);
      return;
    }
    setRetryingId(job.id);
    setError("");
    try {
      await postVideos({
        action: "retry",
        videoId: job.id,
        modelId: selectedModel.id,
      });
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reintentar");
    } finally {
      setRetryingId("");
    }
  }

  async function composeAppDemo(
    job: EstudioInfluencerVideo,
    force = false
  ) {
    if (!force && composingRef.current.has(job.id)) return;
    composingRef.current.add(job.id);
    setDemoProgress((prev) => ({ ...prev, [job.id]: 0 }));
    try {
      const { compileAppDemoCode } = await import(
        "@/lib/creator/app-demo-code"
      );
      const { exportAppDemoCodeVideo } = await import(
        "./app-demo/export-app-demo"
      );
      const snap = appDemoSnapshot();
      const code = job.demoCode?.trim() || snap.code;
      const variables = (job.demoVariables?.length
        ? job.demoVariables
        : snap.variables) as AppDemoVariable[];
      const compiled = compileAppDemoCode(code, {
        phoneFrame: job.demoPhoneFrame !== false,
        variables,
      });
      const blob = await exportAppDemoCodeVideo(compiled, (percent) => {
        setDemoProgress((prev) => ({ ...prev, [job.id]: percent }));
      });
      const supabase = createClient();
      const fileName = `demo-${job.id.slice(0, 8)}.mp4`;
      const storagePath = `${projectId}/influencers/${influencer.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, blob, { contentType: "video/mp4", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      await postVideos({
        action: "attach-demo",
        videoId: job.id,
        demoUrl: pub.publicUrl,
      });
      await reloadVideos();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo renderizar la demo";
      demoFailedRef.current.add(job.id);
      try {
        await postVideos({
          action: "demo-error",
          videoId: job.id,
          error: message,
        });
      } catch {
        /* keep local */
      }
      setError(message);
      await reloadVideos();
    } finally {
      composingRef.current.delete(job.id);
      setDemoProgress((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res =
        deleteTarget.kind === "job"
          ? await fetch(
              `/api/projects/${projectId}/creator/influencers/${influencer.id}/videos?videoId=${encodeURIComponent(deleteTarget.job.id)}`,
              { method: "DELETE" }
            )
          : await fetch(
              `/api/projects/${projectId}/gallery/assets/${encodeURIComponent(deleteTarget.asset.id)}`,
              { method: "DELETE" }
            );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar");
      }
      setDeleteTarget(null);
      await reloadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete(keys: string[]) {
    if (deleting || keys.length === 0) return;
    setDeleting(true);
    setError("");
    const failures: string[] = [];
    await Promise.all(
      keys.map(async (key) => {
        const res = key.startsWith("asset:")
          ? await fetch(
              `/api/projects/${projectId}/gallery/assets/${encodeURIComponent(key.slice("asset:".length))}`,
              { method: "DELETE" }
            )
          : await fetch(
              `/api/projects/${projectId}/creator/influencers/${influencer.id}/videos?videoId=${encodeURIComponent(key.slice("job:".length))}`,
              { method: "DELETE" }
            );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failures.push(
            typeof data.error === "string" ? data.error : "No se pudo eliminar"
          );
        }
      })
    );
    setBulkDeleteOpen(false);
    setSelectedVideoKeys([]);
    if (failures.length === 0) setSelectMode(false);
    if (failures.length > 0) {
      setError(
        failures.length === keys.length
          ? failures[0]
          : `Se eliminaron ${keys.length - failures.length}. ${failures[0]}`
      );
    }
    try {
      await reloadVideos();
    } finally {
      setDeleting(false);
    }
  }

  const pending = newestFirst(
    videos.filter(
      (v) =>
        isActive(v.status) ||
        (["failed", "cancelled", "canceled"].includes((v.status || "").toLowerCase()) &&
          !v.assetId)
    )
  );
  const extraCompleted = newestFirst(
    videos.filter(
      (v) =>
        v.videoUrl &&
        !v.assetId &&
        !isActive(v.status) &&
        (v.status || "").toLowerCase() !== "failed"
    )
  );
  const queuedCount = videos.filter(
    (v) => (v.status || "").toLowerCase() === "draft"
  ).length;
  const selectableIds = [
    ...pending
      .filter((job) => canDeleteInfluencerVideo(job))
      .map((job) => `job:${job.id}`),
    ...extraCompleted
      .filter((job) => canDeleteInfluencerVideo(job))
      .map((job) => `job:${job.id}`),
    ...gallery.map((asset) => {
      const job = videos.find((v) => v.assetId === asset.id);
      if (job) {
        return canDeleteInfluencerVideo(job) ? `job:${job.id}` : null;
      }
      return `asset:${asset.id}`;
    }),
  ].filter((id): id is string => Boolean(id));
  const selectedVisible = selectedVideoKeys.filter((id) =>
    selectableIds.includes(id)
  );
  const allVideosSelected =
    selectableIds.length > 0 && selectedVisible.length === selectableIds.length;

  function toggleVideoKey(key: string) {
    setSelectedVideoKeys((current) =>
      current.includes(key)
        ? current.filter((id) => id !== key)
        : [...current, key]
    );
  }

  function toggleAllVideos() {
    setSelectedVideoKeys(allVideosSelected ? [] : selectableIds);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedVideoKeys([]);
    setBulkDeleteOpen(false);
  }
  const bulkList = splitInfluencerScripts(script);

  return (
    <div className="px-6 py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 6 9 12l6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Influencers
      </button>

      {isMotionClone ? (
        fal && !fal.connected ? (
          <div className="mb-5">
            <ApiMissingBanner
              projectId={projectId}
              providerName="fal.ai"
              message="Conecta fal.ai en Ajustes → API para clonar el movimiento del video."
            />
          </div>
        ) : openai && !openai.connected ? (
          <div className="mb-5">
            <ApiMissingBanner
              projectId={projectId}
              providerName="OpenAI"
              message="Conecta OpenAI en Ajustes → API para crear un fotograma nuevo adaptado al video de referencia."
            />
          </div>
        ) : null
      ) : replicate && !replicate.connected && fal && !fal.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="Replicate"
            message="Conecta Replicate en Ajustes → API para generar videos. fal.ai queda de respaldo si Replicate falla."
          />
        </div>
      ) : openai && !openai.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="OpenAI"
            message="Conecta OpenAI en Ajustes → API para el fotograma (GPT Image 2) y los guiones."
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-12 w-12 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-alt)] text-[11px] text-[var(--muted-soft)]">
              {progress.generating ? "…" : "—"}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold tracking-tight text-[var(--foreground)]">
              {influencer.name}
            </h2>
            <p className="text-[13px] text-[var(--muted-soft)]">
              Studio de video · estilo iPhone
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            title={videoCostTitle(videoCost)}
            className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-right"
          >
            <p className="text-[11px] font-medium text-[var(--muted-soft)]">
              Estimado / video
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatVideoCostUsd(videoCost.totalUsd)}
            </p>
          </span>
          <button
            type="button"
            className="ui-btn-secondary shrink-0"
            onClick={onOpenPhotos}
          >
            Ver fotos
          </button>
        </div>
      </div>

      <ModeSwitch
        manual={dynamicPickMode === "manual"}
        disabled={Boolean(busy)}
        onChange={(next) =>
          persistGen({ dynamicPickMode: next ? "manual" : "random" })
        }
      />

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {isAutomatic ? "Dinámica" : "1. Dinámica"}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                {isAutomatic
                  ? selectedDynamic
                    ? selectedDynamic.description
                    : "Elige una dinámica. Luego genera una prueba o lanza la generación automática."
                  : isHookAppDemo
                    ? "Une un hook y una demo de app en un solo video. Elige dos al azar o selecciónalos a mano."
                    : selectedDynamic
                      ? selectedDynamic.description
                      : "Elige cómo se arma el video. Hook + App Demo une dos clips de Dynamics."}
              </p>
            </div>

            <div>
              {isAutomatic ? null : (
              <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
                Formato
              </p>
              )}
              <div className="grid gap-2">
                {dynamics.map((item) => {
                  const active = item.id === dynamicId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => persistGen({ dynamicId: item.id })}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                        active
                          ? "border-[#18181b] bg-white text-[var(--foreground)]"
                          : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)] hover:bg-white"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold">
                        {item.name}
                      </span>
                      <span
                        className="mt-0.5 block text-[11px] leading-snug text-[var(--muted-soft)]"
                      >
                        {item.description}
                      </span>
                    </button>
                  );
                })}
                {dynamics.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-3 py-4 text-[12px] text-[var(--muted-soft)]">
                    Cargando dinámicas…
                  </p>
                ) : null}
              </div>
            </div>

            {isAutomatic ? (
              selectedDynamic ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="ui-btn-primary"
                    disabled={
                      Boolean(busy) ||
                      (isHookAppDemo &&
                        (hookClips.length === 0 || demoClips.length === 0))
                    }
                    onClick={() => void runDynamicJob("test")}
                  >
                    {busy === "compose" || busy === "start"
                      ? "Generando…"
                      : "Generar video de prueba"}
                  </button>
                  <button
                    type="button"
                    className="ui-btn-ghost"
                    disabled={
                      Boolean(busy) ||
                      (isHookAppDemo &&
                        (hookClips.length === 0 || demoClips.length === 0))
                    }
                    onClick={() => void runDynamicJob("auto")}
                  >
                    {busy === "compose" || busy === "start"
                      ? "Iniciando…"
                      : "Generación automática"}
                  </button>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">
                  Elige una dinámica para generar.
                </p>
              )
            ) : isHookAppDemo ? (
              <div className="space-y-3">
                <p className="text-[12px] font-medium text-[var(--muted)]">
                  Clips de Hook + App Demo
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[var(--muted)]">
                      Hook
                    </p>
                    <DynamicClipGrid
                      clips={hookClips}
                      selectedId={hookAssetId}
                      disabled={Boolean(busy)}
                      emptyLabel="No hay hooks. Súbelos en Dynamics › Hook + App Demo."
                      onSelect={setHookAssetId}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[var(--muted)]">
                      App Demo
                    </p>
                    <DynamicClipGrid
                      clips={demoClips}
                      selectedId={demoAssetId}
                      disabled={Boolean(busy)}
                      emptyLabel="No hay demos. Créalas en App Demo o súbelas en Dynamics."
                      onSelect={setDemoAssetId}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="ui-btn-primary w-full py-3 text-[14px] font-semibold"
                  disabled={
                    Boolean(busy) ||
                    hookClips.length === 0 ||
                    demoClips.length === 0 ||
                    !hookAssetId ||
                    !demoAssetId
                  }
                  onClick={() => void composeDynamicVideo()}
                >
                  {busy === "compose" ? "Uniendo videos…" : "Unir video"}
                </button>
              </div>
            ) : selectedDynamic ? (
              <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">
                Los slots de este formato llegan después. Hook + App Demo ya se
                puede usar para unir dos clips.
              </p>
            ) : null}

            {!isAutomatic && !isMotionClone ? (
            <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => persistGen({ format: "talking" })}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  format === "talking"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                <span className="block text-[13px] font-semibold">
                  Influencer
                </span>
                <span
                  className={`mt-1 block text-[11px] leading-snug ${
                    format === "talking" ? "text-white/70" : "text-[var(--muted-soft)]"
                  }`}
                >
                  Solo hablando a cámara
                </span>
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => persistGen({ format: "app-demo" })}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  format === "app-demo"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                <span className="block text-[13px] font-semibold">
                  Mostrar demo de la app
                </span>
                <span
                  className={`mt-1 block text-[11px] leading-snug ${
                    format === "app-demo" ? "text-white/70" : "text-[var(--muted-soft)]"
                  }`}
                >
                  Habla + demo de la app
                </span>
              </button>
            </div>
            {format === "app-demo" ? (
              <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">
                Usa la App Demo de este proyecto.{" "}
                <Link
                  href={`/projects/${projectId}/app-demo`}
                  className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
                >
                  Abrir editor
                </Link>
              </p>
            ) : null}
            </>
            ) : null}

            {!isAutomatic ? (
            <>
            <div>
                <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
                  Plantilla de movimiento
                </p>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setAddingTemplate(false);
                    setEditingTemplateId(null);
                    setTemplateOpen(true);
                  }}
                  className="ui-input w-full text-left"
                >
                  {selectedTemplate ? (
                    <span className="block truncate">
                      {selectedTemplate.title || selectedTemplate.action}
                      {isMotionClone
                        ? " · clon"
                        : selectedTemplate.speak === false
                          ? " · no habla"
                          : ""}
                    </span>
                  ) : (
                    <span className="text-[var(--muted-soft)]">Seleccionar plantilla</span>
                  )}
                </button>
              </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                Modelo
              </span>
              <div className="flex items-stretch gap-2">
                {normalizeFavoriteModelIds(favoriteModelIds).map((id) => {
                  const active = selectedModel.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (active) {
                          toggleFavoriteModel(id);
                          return;
                        }
                        persistGen({ modelId: id });
                      }}
                      className={`min-w-0 flex-1 rounded-2xl border px-2 py-2.5 text-left ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-soft)]"
                      }`}
                    >
                      <span className="block truncate text-[12px] font-semibold leading-tight">
                        {shortModelName(id)}
                      </span>
                      <span
                        className={`mt-1 block text-[10px] leading-tight ${
                          active ? "text-white/70" : "text-[var(--muted-soft)]"
                        }`}
                      >
                        {modelMetaLine(id)}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="flex h-auto w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                  aria-label="Ajustes de modelos"
                  title="Favoritos"
                  onClick={() => setModelSettingsOpen(true)}
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
                {isMotionClone
                  ? `${duration} s · GPT Image 2 ${formatVideoCostUsd(videoCost.frameUsd)} + clonación ${formatVideoCostUsd(videoCost.videoUsd)}`
                  : `${refCount} foto${refCount === 1 ? "" : "s"} · GPT Image 2 ${formatVideoCostUsd(videoCost.frameUsd)} + video ${formatVideoCostUsd(videoCost.videoUsd)}`}
              </p>
            </div>
            </>
            ) : null}
          </div>

          {!isAutomatic && (isMotionClone ? (
            <>
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">
                    2. Texto en pantalla
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                    Si lo dejas vacío, se usa la previsualización. Smart position mueve el texto.
                  </p>
                </div>
                <div>
                  <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                    Estilo del subtítulo
                  </span>
                  <div className="space-y-1">
                    {CAPTION_STYLES.map((item) => {
                      const active = overlayStyle === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => persistGen({ overlayStyle: item.id })}
                          className={`flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left ${
                            active ? "bg-[var(--surface-alt)]" : "hover:bg-[var(--background)]"
                          }`}
                        >
                          <CaptionStyleSwatch styleId={item.id} active={active} />
                          <span
                            className={`text-[13px] ${
                              active
                                ? "font-semibold text-[var(--foreground)]"
                                : "text-[var(--foreground-soft)]"
                            }`}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
                  <div>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        persistGen({
                          overlayPosition: nextOverlayPosition(overlayPosition),
                        })
                      }
                      className="mb-2 w-full rounded-xl border border-[var(--border)] bg-white px-2 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--foreground)]"
                    >
                      Smart position
                    </button>
                    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#111827]">
                      <img
                        src={OVERLAY_PREVIEW_PHOTO}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <SnapCaption
                        text={overlayText.trim() || DEFAULT_OVERLAY_PREVIEW}
                        styleId={overlayStyle === "mix" ? "snapchat" : overlayStyle}
                        position={overlayPosition}
                      />
                    </div>
                  </div>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                      Texto
                    </span>
                    <input
                      value={overlayText}
                      onChange={(e) => persistGen({ overlayText: e.target.value })}
                      className="ui-input"
                      placeholder={DEFAULT_OVERLAY_PREVIEW}
                      disabled={Boolean(busy)}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">
                    3. Generar
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                    Siempre crea un fotograma nuevo adaptado al video de referencia. Las fotos del influencer solo sirven para la identidad.
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                    Cuántos videos
                  </span>
                  <select
                    value={Math.min(5, scriptCount)}
                    onChange={(e) => setScriptCount(Number(e.target.value))}
                    disabled={Boolean(busy)}
                    className="ui-input"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {refCount === 0 ? (
                  <p className="text-[12px] text-[#b45309]">
                    Espera a que termine al menos el rostro para clonar el movimiento.
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--muted-soft)]">
                    Crea un fotograma nuevo adaptado al video y luego clona el movimiento.
                  </p>
                )}
              </div>
            <button
              type="button"
              className="ui-btn-primary w-full py-4 text-[16px] font-semibold"
              disabled={
                Boolean(busy) ||
                refCount === 0 ||
                fal?.connected === false ||
                openai?.connected === false
              }
              onClick={() => void startGeneration()}
            >
              {busy === "start"
                ? "Iniciando…"
                : `Iniciar${scriptCount > 1 ? ` (${Math.min(5, scriptCount)})` : ""}`}
            </button>
            </>
          ) : (
            <>
          <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                2. Texto en pantalla
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Lo que va entre <span className="font-medium text-[var(--foreground)]">[ ]</span>{" "}
                se quema en el video. Si no escribes nada, se usa la previsualización.
              </p>
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                Estilo del subtítulo
              </span>
              <div className="space-y-1">
                {CAPTION_STYLES.map((item) => {
                  const active = overlayStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => persistGen({ overlayStyle: item.id })}
                      className={`flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left ${
                        active ? "bg-[var(--surface-alt)]" : "hover:bg-[var(--background)]"
                      }`}
                    >
                      <CaptionStyleSwatch styleId={item.id} active={active} />
                      <span
                        className={`text-[13px] ${
                          active
                            ? "font-semibold text-[var(--foreground)]"
                            : "text-[var(--foreground-soft)]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => persistGen({ overlayStyle: "mix" })}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left ${
                    overlayStyle === "mix" ? "bg-[var(--surface-alt)]" : "hover:bg-[var(--background)]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[10px] border text-[11px] font-semibold ${
                      overlayStyle === "mix"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                    }`}
                  >
                    Mix
                  </span>
                  <span
                    className={`text-[13px] ${
                      overlayStyle === "mix"
                        ? "font-semibold text-[var(--foreground)]"
                        : "text-[var(--foreground-soft)]"
                    }`}
                  >
                    Varios
                  </span>
                </button>
              </div>
            </div>
            <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
              <div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    persistGen({
                      overlayPosition: nextOverlayPosition(overlayPosition),
                    })
                  }
                  className="mb-2 w-full rounded-xl border border-[var(--border)] bg-white px-2 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--foreground)]"
                >
                  Smart position
                </button>
                <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#111827]">
                  <img
                    src={OVERLAY_PREVIEW_PHOTO}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <SnapCaption
                    text={overlayText.trim() || DEFAULT_OVERLAY_PREVIEW}
                    styleId={overlayStyle === "mix" ? "snapchat" : overlayStyle}
                    position={overlayPosition}
                  />
                </div>
              </div>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                  Texto
                </span>
                <input
                  value={overlayText}
                  onChange={(e) => persistGen({ overlayText: e.target.value })}
                  className="ui-input"
                  placeholder={DEFAULT_OVERLAY_PREVIEW}
                  disabled={Boolean(busy)}
                />
              </label>
            </div>
          </div>

          <form
            onSubmit={(e) => void enqueueOne(e)}
            className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                3. Guiones en masa
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Pega varios separados por{" "}
                <span className="font-medium text-[var(--foreground)]">;</span>, igual que
                en fotos. Se sigue al pie de la letra, sin el contexto de
                Producto. El texto entre [ ] va arriba del video.
              </p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                Guiones
              </span>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="ui-input min-h-[140px]"
                placeholder="la chica salta en el parque bajo la lluvia [Pov: te encanta saltar en los charcos]; ok no os voy a mentir, esto me ha cambiado las mañanas [Pov: mañanas distintas]"
                disabled={Boolean(busy)}
                required
              />
              <span className="mt-1 block text-[11px] text-[var(--muted-soft)]">
                {bulkList.length} guion{bulkList.length === 1 ? "" : "es"} en esta cola
              </span>
            </label>
            <button
              type="submit"
              className="ui-btn-secondary"
              disabled={Boolean(busy) || bulkList.length === 0}
            >
              {busy === "one" ? "Añadiendo…" : `Añadir a cola (${bulkList.length})`}
            </button>
          </form>
            <button
              type="button"
              className="ui-btn-primary w-full py-4 text-[16px] font-semibold"
              disabled={
                Boolean(busy) ||
                refCount === 0 ||
                (queuedCount === 0 && !script.trim())
              }
              onClick={() => void startGeneration()}
            >
              {busy === "start" || busy === "one"
                ? "Iniciando…"
                : queuedCount > 0
                  ? `Iniciar (${queuedCount})`
                  : "Iniciar"}
            </button>
            {refCount === 0 ? (
              <p className="text-[12px] text-[#b45309]">
                Espera a que termine al menos el rostro para iniciar los videos.
              </p>
            ) : null}
            </>
          ))}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">Videos</p>
            {selectableIds.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={selectMode}
                  aria-label={selectMode ? "Salir de selección" : "Seleccionar"}
                  title={selectMode ? "Salir de selección" : "Seleccionar"}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    selectMode
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background)]"
                  }`}
                  onClick={() => {
                    if (selectMode) exitSelectMode();
                    else setSelectMode(true);
                  }}
                >
                  <SelectionModeIcon className="h-4 w-4" />
                </button>
                {selectMode ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
                      onClick={toggleAllVideos}
                    >
                      {allVideosSelected ? "Quitar todo" : "Seleccionar todos"}
                    </button>
                    <button
                      type="button"
                      aria-label="Eliminar seleccionados"
                      title="Eliminar seleccionados"
                      disabled={selectedVisible.length === 0 || deleting}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40"
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                    {selectedVisible.length > 0 ? (
                      <span className="text-[12px] tabular-nums text-[var(--muted)]">
                        {selectedVisible.length}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {pending.length === 0 &&
          gallery.length === 0 &&
          extraCompleted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 py-8 text-center text-[13px] text-[var(--muted-soft)]">
              {folderId
                ? "Aquí saldrán los videos de esta carpeta."
                : "Los videos se guardarán en Galería → Influencers."}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {pending.map((job) => (
                <li
                  key={job.id}
                  className={`relative overflow-hidden rounded-2xl bg-[#111827] ${
                    selectedVisible.includes(`job:${job.id}`)
                      ? "ring-2 ring-[var(--accent)] ring-offset-2"
                      : ""
                  }`}
                >
                  <VideoCostBadge
                    cost={displayJobCost(job, refCount)}
                    onDownload={job.videoUrl ? () => void downloadJob(job) : undefined}
                    downloading={downloadingId === job.id}
                  />
                  <VideoCreatedBadge createdAt={job.createdAt} />
                  {selectMode && canDeleteInfluencerVideo(job) ? (
                    <button
                      type="button"
                      className="absolute inset-0 z-[15]"
                      aria-label={
                        selectedVisible.includes(`job:${job.id}`)
                          ? "Quitar de la selección"
                          : "Seleccionar"
                      }
                      onClick={() => toggleVideoKey(`job:${job.id}`)}
                    />
                  ) : null}
                  <div className="absolute left-2 top-2 z-20 flex gap-1">
                    {selectMode && canDeleteInfluencerVideo(job) ? (
                      <VideoPickButton
                        selected={selectedVisible.includes(`job:${job.id}`)}
                        onToggle={() => toggleVideoKey(`job:${job.id}`)}
                      />
                    ) : null}
                    {canRetryQueued(job) ||
                    (!selectMode && canDeleteInfluencerVideo(job)) ||
                    traceForJob(job, influencer) ||
                    (!selectMode && Boolean(job.overlay?.trim())) ? (
                      <>
                      {traceForJob(job, influencer) ? (
                        <ApiInfoButton onClick={() => setInspectJob(job)} />
                      ) : null}
                      {canRetryQueued(job) ? (
                        <button
                          type="button"
                          className="rounded-lg bg-black/55 p-1.5 text-white/85 backdrop-blur-sm hover:bg-black/75 hover:text-white disabled:opacity-50"
                          aria-label="Reintentar"
                          disabled={Boolean(busy) || retryingId === job.id}
                          onClick={() => void retryJob(job)}
                        >
                          <RetryIcon
                            className={`h-3.5 w-3.5 ${
                              retryingId === job.id ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                      ) : null}
                      {!selectMode && canDeleteInfluencerVideo(job) ? (
                        <VideoDeleteButton
                          onClick={() => setDeleteTarget({ kind: "job", job })}
                        />
                      ) : null}
                      {!selectMode && job.overlay?.trim() ? (
                        <VideoCaptionButton
                          hidden={hiddenOverlayIds.includes(job.id)}
                          onClick={() =>
                            setHiddenOverlayIds((cur) =>
                              cur.includes(job.id)
                                ? cur.filter((id) => id !== job.id)
                                : [...cur, job.id]
                            )
                          }
                        />
                      ) : null}
                      </>
                    ) : null}
                  </div>
                  {isGeneratingJob(job) ? (
                    <button
                      type="button"
                      className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)] disabled:opacity-60"
                      disabled={stoppingId === job.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void stopGeneration(job);
                      }}
                    >
                      {stoppingId === job.id ? "Parando…" : "Parar"}
                    </button>
                  ) : null}
                  {job.videoUrl ? (
                    <StudioVideoPlayer
                      src={job.videoUrl}
                      poster={job.startImageUrl ?? undefined}
                      caption={
                        hiddenOverlayIds.includes(job.id) ? undefined : job.overlay
                      }
                      captionStyle={job.overlayStyle}
                      captionPosition={job.overlayPosition}
                    />
                  ) : (
                    <div className="relative flex aspect-[9/16] flex-col items-center justify-center px-3 text-center">
                      {(() => {
                        const progress = jobProgress(job);
                        const elapsed = formatElapsed(job.createdAt);
                        const checked = formatElapsed(job.updatedAt);
                        return (
                          <>
                            {job.startImageUrl ? (
                              <img
                                src={job.startImageUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-35"
                              />
                            ) : null}
                            {job.overlay ? (
                              <SnapCaption
                                text={job.overlay}
                                styleId={job.overlayStyle}
                                position={job.overlayPosition}
                              />
                            ) : null}
                            <span
                              className={`mb-2 h-2 w-2 rounded-full ${
                                progress.live
                                  ? "animate-pulse bg-[#34d399]"
                                  : "bg-white/35"
                              }`}
                            />
                            <span className="text-[12px] font-medium text-white/90">
                              {progress.title}
                            </span>
                            <span className="mt-1 line-clamp-4 text-[11px] text-white/55">
                              {job.error &&
                              (job.status || "").toLowerCase() !== "failed" &&
                              progress.detail !== job.error
                                ? `${progress.detail} · ${job.error}`
                                : job.error && (job.status || "").toLowerCase() === "failed"
                                  ? job.error
                                  : progress.detail}
                            </span>
                            <span className="mt-2 text-[10px] text-white/40">
                              {[
                                elapsed ? `lleva ${elapsed}` : "",
                                progress.live && checked
                                  ? `visto ${checked}`
                                  : "",
                                job.requestId
                                  ? job.requestId.slice(0, 8)
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {job.script ? (
                              <span className="mt-1 line-clamp-3 text-[10px] text-white/45">
                                {job.script}
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {(() => {
                    const s = (job.status || "").toLowerCase();
                    const local = demoProgress[job.id];
                    const waitingDemo =
                      s === "demo_pending" || s === "composing" || local != null;
                    if (!waitingDemo) return null;
                    const progress = jobProgress(job);
                    const updated = Date.parse(job.updatedAt || job.createdAt || "");
                    const stale =
                      Number.isFinite(updated) && Date.now() - updated >= 150_000;
                    const detail = job.error
                      ? job.error
                      : local != null
                        ? "Renderizando la demo en esta pestaña."
                        : progress.detail;
                    return (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/65 px-3 text-center">
                        <span className="text-[13px] font-semibold text-white">
                          {local != null
                            ? `Renderizando demo ${local}%`
                            : progress.title}
                        </span>
                        <span className="mt-1 text-[11px] text-white/70">
                          {detail}
                        </span>
                        {job.error || (s === "composing" && stale && local == null) ? (
                          <button
                            type="button"
                            className="mt-3 rounded-xl bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)]"
                            onClick={() => {
                              if (job.demoVideoUrl) {
                                void postVideos({
                                  action: "attach-demo",
                                  videoId: job.id,
                                  demoUrl: job.demoVideoUrl,
                                })
                                  .then(() => reloadVideos())
                                  .catch((err) => {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "No se pudieron unir los videos"
                                    );
                                  });
                                return;
                              }
                              if (s === "demo_pending" && job.error) {
                                void retryJob(job);
                                return;
                              }
                              composingRef.current.delete(job.id);
                              demoFailedRef.current.delete(job.id);
                              void composeAppDemo(job, true);
                            }}
                          >
                            Reintentar unión
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}
                </li>
              ))}
              {extraCompleted.map((job) => (
                <li
                  key={job.id}
                  className={`relative overflow-hidden rounded-2xl bg-[#111827] ${
                    selectedVisible.includes(`job:${job.id}`)
                      ? "ring-2 ring-[var(--accent)] ring-offset-2"
                      : ""
                  }`}
                >
                  <VideoCostBadge
                    cost={displayJobCost(job, refCount)}
                    onDownload={job.videoUrl ? () => void downloadJob(job) : undefined}
                    downloading={downloadingId === job.id}
                  />
                  <VideoCreatedBadge createdAt={job.createdAt} />
                  {selectMode && canDeleteInfluencerVideo(job) ? (
                    <button
                      type="button"
                      className="absolute inset-0 z-[15]"
                      aria-label={
                        selectedVisible.includes(`job:${job.id}`)
                          ? "Quitar de la selección"
                          : "Seleccionar"
                      }
                      onClick={() => toggleVideoKey(`job:${job.id}`)}
                    />
                  ) : null}
                  <div className="absolute left-2 top-2 z-20 flex gap-1">
                    {selectMode && canDeleteInfluencerVideo(job) ? (
                      <VideoPickButton
                        selected={selectedVisible.includes(`job:${job.id}`)}
                        onToggle={() => toggleVideoKey(`job:${job.id}`)}
                      />
                    ) : null}
                    {traceForJob(job, influencer) ? (
                      <ApiInfoButton onClick={() => setInspectJob(job)} />
                    ) : null}
                    {!selectMode && canDeleteInfluencerVideo(job) ? (
                      <VideoDeleteButton
                        onClick={() => setDeleteTarget({ kind: "job", job })}
                      />
                    ) : null}
                    {!selectMode && job.overlay?.trim() ? (
                      <VideoCaptionButton
                        hidden={hiddenOverlayIds.includes(job.id)}
                        onClick={() =>
                          setHiddenOverlayIds((cur) =>
                            cur.includes(job.id)
                              ? cur.filter((id) => id !== job.id)
                              : [...cur, job.id]
                          )
                        }
                      />
                    ) : null}
                  </div>
                  {job.videoUrl ? (
                    <StudioVideoPlayer
                      src={job.videoUrl}
                      poster={job.startImageUrl ?? undefined}
                      caption={
                        hiddenOverlayIds.includes(job.id) ? undefined : job.overlay
                      }
                      captionStyle={job.overlayStyle}
                      captionPosition={job.overlayPosition}
                    />
                  ) : null}
                </li>
              ))}
              {gallery.map((asset) => {
                const job = videos.find((v) => v.assetId === asset.id);
                const selectionKey = job
                  ? canDeleteInfluencerVideo(job)
                    ? `job:${job.id}`
                    : null
                  : `asset:${asset.id}`;
                return (
                <li
                  key={asset.id}
                  className={`relative overflow-hidden rounded-2xl bg-[#111827] ${
                    selectionKey && selectedVisible.includes(selectionKey)
                      ? "ring-2 ring-[var(--accent)] ring-offset-2"
                      : ""
                  }`}
                >
                  {job ? (
                    <VideoCostBadge
                      cost={displayJobCost(job, refCount)}
                      onDownload={
                        job.videoUrl || asset.publicUrl
                          ? () => void downloadJob(job)
                          : undefined
                      }
                      downloading={downloadingId === job.id}
                    />
                  ) : null}
                  <VideoCreatedBadge createdAt={job?.createdAt || asset.createdAt} />
                  {selectMode && selectionKey ? (
                    <button
                      type="button"
                      className="absolute inset-0 z-[15]"
                      aria-label={
                        selectedVisible.includes(selectionKey)
                          ? "Quitar de la selección"
                          : "Seleccionar"
                      }
                      onClick={() => toggleVideoKey(selectionKey)}
                    />
                  ) : null}
                  <div className="absolute left-2 top-2 z-20 flex gap-1">
                    {selectMode && selectionKey ? (
                      <VideoPickButton
                        selected={selectedVisible.includes(selectionKey)}
                        onToggle={() => toggleVideoKey(selectionKey)}
                      />
                    ) : null}
                    {job && traceForJob(job, influencer) ? (
                      <ApiInfoButton onClick={() => setInspectJob(job)} />
                    ) : null}
                    {!selectMode && (!job || canDeleteInfluencerVideo(job)) ? (
                    <VideoDeleteButton
                      onClick={() =>
                        setDeleteTarget(
                          job
                            ? { kind: "job", job }
                            : { kind: "asset", asset }
                        )
                      }
                    />
                    ) : null}
                    {!selectMode && job?.overlay?.trim() ? (
                      <VideoCaptionButton
                        hidden={hiddenOverlayIds.includes(job.id)}
                        onClick={() =>
                          setHiddenOverlayIds((cur) =>
                            cur.includes(job.id)
                              ? cur.filter((id) => id !== job.id)
                              : [...cur, job.id]
                          )
                        }
                      />
                    ) : null}
                  </div>
                  <StudioVideoPlayer
                    src={asset.publicUrl}
                    poster={job?.startImageUrl ?? undefined}
                    caption={
                      job && hiddenOverlayIds.includes(job.id) ? undefined : job?.overlay
                    }
                    captionStyle={job?.overlayStyle}
                    captionPosition={job?.overlayPosition}
                  />
                </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <InfluencerApiTraceModal
        open={Boolean(inspectJob)}
        onClose={() => setInspectJob(null)}
        trace={inspectJob ? traceForJob(inspectJob, influencer) : null}
        createdAt={inspectJob?.createdAt}
      />

      {modelSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={() => setModelSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-settings-title"
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3
                  id="model-settings-title"
                  className="text-[16px] font-semibold text-[var(--foreground)]"
                >
                  Modelos favoritos
                </h3>
                <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                  Toca para marcar o quitar favoritos. En acceso rápido salen hasta {FAVORITE_MODEL_LIMIT}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModelSettingsOpen(false)}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {FAL_VIDEO_MODELS.map((model) => {
                const favorite = normalizeFavoriteModelIds(
                  favoriteModelIds
                ).includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleFavoriteModel(model.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      favorite ? "bg-[var(--surface-alt)]" : "hover:bg-[var(--background)]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        favorite
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-white text-[var(--muted-soft)]"
                      }`}
                    >
                      {favorite ? "★" : "☆"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
                        {shortModelName(model.id)}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                        {falVideoModelMeta(model)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {templateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={() => setTemplateOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-modal-title"
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3
                  id="template-modal-title"
                  className="text-[16px] font-semibold text-[var(--foreground)]"
                >
                  Dinámicas
                </h3>
                <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                  Describe el ritmo, o sube un video para clonar el movimiento con el rostro del influencer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateOpen(false)}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {addingTemplate ? (
                <form
                  className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = draftTitle.trim();
                    if (!title || analyzing) return;
                    void (async () => {
                      try {
                        setAnalyzing(true);
                        setAnalyzeError("");
                        const source: "describe" | "video" =
                          draftSource === "video" ? "video" : "describe";
                        if (source === "video" && !draftFile && !draftVideoUrl) {
                          setAnalyzeError("Sube un video de referencia.");
                          return;
                        }
                        let actionText = draftAction.trim();
                        let extra = draftExtra.trim();
                        let duration: string = getFalKlingDuration(draftDuration);
                        let videoUrl = "";
                        if (source === "video") {
                          const clipped = await persistReferenceClip();
                          videoUrl = clipped.url;
                          duration = clipped.duration;
                          actionText =
                            actionText || "Clonar movimiento del video de referencia.";
                          extra = "";
                        } else if (!actionText) {
                          return;
                        }
                        const payload = {
                          title,
                          action: actionText,
                          extra,
                          duration,
                          source,
                          videoUrl,
                          speak: source === "video" ? false : draftSpeak,
                        };
                        if (editingTemplateId) {
                          persistGen({
                            templates: templates.map((t) =>
                              t.id === editingTemplateId ? { ...t, ...payload } : t
                            ),
                          });
                        } else {
                          const item: EstudioVideoTemplate = {
                            id: newId(),
                            ...payload,
                            createdAt: new Date().toISOString(),
                          };
                          persistGen({
                            templates: [item, ...templates],
                            templateId: item.id,
                          });
                        }
                        resetDynamicDraft();
                        setEditingTemplateId(null);
                        setAddingTemplate(false);
                      } catch (err) {
                        setAnalyzeError(
                          err instanceof Error ? err.message : "No se pudo guardar"
                        );
                      } finally {
                        setAnalyzing(false);
                      }
                    })();
                  }}
                >
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">
                    {editingTemplateId ? "Editar dinámica" : "Agregar dinámica"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1">
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => setDraftSource("describe")}
                      className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
                        draftSource === "describe"
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      Describir
                    </button>
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => setDraftSource("video")}
                      className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
                        draftSource === "video"
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      Video referencia
                    </button>
                  </div>
                  {draftSource === "describe" ? (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1">
                        <button
                          type="button"
                          disabled={analyzing}
                          onClick={() => setDraftSpeak(true)}
                          className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
                            draftSpeak
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          Habla
                        </button>
                        <button
                          type="button"
                          disabled={analyzing}
                          onClick={() => setDraftSpeak(false)}
                          className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
                            !draftSpeak
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          No habla
                        </button>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">
                        {draftSpeak
                          ? "El influencer dice el guion a cámara."
                          : "Clip mudo: solo acción y cámara, sin diálogo."}
                      </p>
                    </>
                  ) : null}
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                      Nombre de plantilla
                    </span>
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      required
                      placeholder={
                        draftSource === "video"
                          ? "Ej. Baile de referencia"
                          : "Ej. Camina y habla"
                      }
                      className="ui-input"
                      disabled={analyzing}
                    />
                  </label>
                  {draftSource === "video" ? (
                    <div>
                      <label
                        htmlFor="dynamic-video"
                        className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]"
                      >
                        Subir video
                      </label>
                      <input
                        ref={videoInput}
                        id="dynamic-video"
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        disabled={analyzing}
                        className="ui-input text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) pickReferenceVideo(file);
                        }}
                      />
                      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted-soft)]">
                        Recorta el tramo que quieres clonar (máx. {MOTION_CLONE_MAX_SEC} s). Si dura menos de 3 s, se duplica el clip para Kling.
                      </p>
                      {draftPreviewUrl ? (
                        <div className="mt-3">
                          <VideoClipTrimmer
                            src={draftPreviewUrl}
                            start={clipStart}
                            end={clipEnd}
                            disabled={analyzing}
                            onChange={(start, end) => {
                              setClipStart(start);
                              setClipEnd(end);
                            }}
                          />
                        </div>
                      ) : null}
                      {draftVideoName ? (
                        <p className="mt-2 truncate text-[12px] text-[var(--foreground-soft)]">
                          {draftVideoName}
                        </p>
                      ) : null}
                      {analyzing ? (
                        <p className="mt-2 text-[12px] font-medium text-[var(--foreground)]">
                          Recortando el video…
                        </p>
                      ) : null}
                      {analyzeError ? (
                        <p role="alert" className="mt-2 text-[12px] text-[var(--danger)]">
                          {analyzeError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">
                        Describe ritmo, cámara y beats. El influencer sigue siendo el mismo.
                      </p>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                          Estructura del video
                        </span>
                        <textarea
                          value={draftAction}
                          onChange={(e) => setDraftAction(e.target.value)}
                          rows={3}
                          required
                          placeholder="Ej. plano medio, habla caminando, energía alta al inicio y cierra mirando el móvil"
                          className="ui-input min-h-[72px]"
                          disabled={analyzing}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                          Ambiente (opcional)
                        </span>
                        <textarea
                          value={draftExtra}
                          onChange={(e) => setDraftExtra(e.target.value)}
                          rows={2}
                          placeholder="Ej. calle de día, luz natural…"
                          className="ui-input min-h-[56px]"
                          disabled={analyzing}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                          Tiempo de video
                        </span>
                        <select
                          value={draftDuration}
                          onChange={(e) =>
                            setDraftDuration(getFalKlingDuration(e.target.value))
                          }
                          className="ui-input"
                          disabled={analyzing}
                        >
                          {FAL_KLING_DURATIONS.map((d) => (
                            <option key={d} value={d}>
                              {d} s
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="ui-btn-secondary"
                      disabled={analyzing}
                      onClick={() => {
                        resetDynamicDraft();
                        setAddingTemplate(false);
                        setEditingTemplateId(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="ui-btn-primary"
                      disabled={
                        analyzing ||
                        !draftTitle.trim() ||
                        (draftSource === "describe" && !draftAction.trim()) ||
                        (draftSource === "video" &&
                          (!draftFile && !draftVideoUrl ||
                            clipEnd - clipStart < MOTION_CLONE_TRIM_MIN_SEC - 0.02))
                      }
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--background)] px-3 py-3 text-[13px] font-medium text-[var(--foreground-soft)] hover:border-[#93c5fd] hover:bg-[#eff6ff]"
                  onClick={() => {
                    setEditingTemplateId(null);
                    resetDynamicDraft();
                    setAddingTemplate(true);
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Agregar dinámica
                </button>
              )}

              {templates.length === 0 && !addingTemplate ? (
                <p className="py-8 text-center text-[13px] text-[var(--muted-soft)]">
                  Aún no hay dinámicas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {templates.length > 0 ? (
                    <li>
                      <button
                        type="button"
                        className={`w-full rounded-2xl border px-3 py-3 text-left text-[13px] ${
                          !templateId
                            ? "border-[#93c5fd] bg-[#eff6ff] font-medium text-[var(--foreground)]"
                            : "border-[var(--border)] bg-white text-[var(--muted)]"
                        }`}
                        onClick={() => {
                          persistGen({ templateId: null });
                          setTemplateOpen(false);
                        }}
                      >
                        Sin dinámica
                      </button>
                    </li>
                  ) : null}
                  {templates.map((item) => {
                    const active = item.id === templateId;
                    return (
                      <li key={item.id}>
                        <div
                          className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 ${
                            active
                              ? "border-[#93c5fd] bg-[#eff6ff]"
                              : "border-[var(--border)] bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--foreground)]"
                            onClick={() => {
                              persistGen({ templateId: item.id });
                              setTemplateOpen(false);
                            }}
                          >
                            {item.title || item.action}
                            {item.speak === false && item.source !== "video" ? (
                              <span className="ml-1.5 text-[11px] font-medium text-[var(--muted)]">
                                · no habla
                              </span>
                            ) : null}
                            {item.source === "video" ? (
                              <span className="ml-1.5 text-[11px] font-medium text-[var(--muted)]">
                                · clon
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
                            onClick={() => {
                              setEditingTemplateId(item.id);
                              setDraftTitle(item.title || "");
                              setDraftAction(item.action);
                              setDraftExtra(item.extra);
                              setDraftDuration(getFalKlingDuration(item.duration));
                              setDraftSource(item.source === "video" ? "video" : "describe");
                              setDraftSpeak(item.speak !== false);
                              setDraftVideoUrl(item.videoUrl || "");
                              setDraftVideoName(item.videoUrl ? "Video de referencia" : "");
                              setDraftFile(null);
                              setDraftPreviewUrl(item.videoUrl || "");
                              setClipStart(0);
                              setClipEnd(
                                Math.min(
                                  MOTION_CLONE_MAX_SEC,
                                  Math.max(1, Number(item.duration) || 10)
                                )
                              );
                              setAnalyzeError("");
                              setAddingTemplate(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                            onClick={() => setDeleteTemplate(item)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteTemplate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={() => setDeleteTemplate(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-template-title"
            className="relative w-full max-w-md rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <h3
                id="delete-template-title"
                className="text-[16px] font-semibold text-[var(--foreground)]"
              >
                Eliminar dinámica
              </h3>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                aria-label="Cerrar"
                onClick={() => setDeleteTemplate(null)}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-[14px] leading-relaxed text-[var(--foreground-soft)]">
                ¿Eliminar esta dinámica? Esta acción no se puede deshacer.
              </p>
              <p className="mt-3 rounded-2xl bg-[#f6f7f9] px-3 py-2.5 text-[13px] font-semibold text-[var(--foreground)]">
                {deleteTemplate.title || deleteTemplate.action}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() => setDeleteTemplate(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  const id = deleteTemplate.id;
                  persistGen({
                    templates: templates.filter((t) => t.id !== id),
                    templateId: templateId === id ? null : templateId,
                  });
                  if (editingTemplateId === id) {
                    setEditingTemplateId(null);
                    setAddingTemplate(false);
                  }
                  setDeleteTemplate(null);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            disabled={deleting}
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-video-title"
            className="relative w-full max-w-md rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3
                  id="delete-video-title"
                  className="text-[16px] font-semibold text-[var(--foreground)]"
                >
                  Eliminar video
                </h3>
                <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deleting) setDeleteTarget(null);
                }}
                disabled={deleting}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-[14px] leading-relaxed text-[var(--foreground-soft)]">
                {deleteTarget.kind === "asset"
                  ? "¿Eliminar este video?"
                  : deleteTarget.job.videoUrl || deleteTarget.job.assetId
                    ? "¿Eliminar este video?"
                    : (deleteTarget.job.status || "").toLowerCase() === "failed" ||
                        deleteTarget.job.error
                      ? "Este video dio error. ¿Eliminarlo?"
                      : "¿Eliminar este video de la cola?"}
              </p>
              {deleteTarget.kind === "job" &&
              (deleteTarget.job.script || deleteTarget.job.overlay) ? (
                <p className="mt-3 line-clamp-4 rounded-2xl bg-[#f6f7f9] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--foreground-soft)]">
                  {deleteTarget.job.script}
                  {deleteTarget.job.overlay ? (
                    <span className="mt-1 block text-[12px] text-[var(--muted)]">
                      [{deleteTarget.job.overlay}]
                    </span>
                  ) : null}
                </p>
              ) : deleteTarget.kind === "asset" && deleteTarget.asset.name ? (
                <p className="mt-3 line-clamp-2 rounded-2xl bg-[#f6f7f9] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--foreground-soft)]">
                  {deleteTarget.asset.name}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            disabled={deleting}
            onClick={() => {
              if (!deleting) setBulkDeleteOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-videos-title"
            className="relative w-full max-w-md rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
          >
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3
                id="delete-videos-title"
                className="text-[16px] font-semibold text-[var(--foreground)]"
              >
                Eliminar videos
              </h3>
              <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-[14px] leading-relaxed text-[var(--foreground-soft)]">
                {selectedVisible.length === 1
                  ? "¿Eliminar el video seleccionado?"
                  : `¿Eliminar ${selectedVisible.length} videos seleccionados?`}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={deleting}
                onClick={() => setBulkDeleteOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                disabled={deleting}
                onClick={() => void confirmBulkDelete(selectedVisible)}
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
