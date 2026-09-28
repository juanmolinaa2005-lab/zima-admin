"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { OverlayCaption } from "./StudioVideoPlayer";
import { CloseIcon, PlusIcon, TrashIcon } from "../icons";
import {
  DEFAULT_CLIP_SEC,
  DYNAMIC_PART_KIND_LABELS,
  MIN_CLIP_SEC,
  withVideoPartIds,
  type DynamicPart,
  type DynamicPartKind,
  type DynamicTemplateExtras,
} from "@/lib/creator/dynamics";
import { OverlayTextEditor } from "./OverlayTextEditor";
import {
  normalizeCaptionStyle,
  normalizeOverlayPosition,
  type CaptionStyleId,
  type OverlayPosition,
} from "@/lib/creator/overlay-styles";

type MusicTrack = { id: string; name: string; publicUrl: string };

type PartVideo = {
  id: string;
  name: string;
  publicUrl: string;
  partId: string;
  partName: string;
};

type Selected =
  | { kind: "video"; index: number }
  | { kind: "overlay" }
  | { kind: "music" }
  | null;

type AddMenu = "video" | "music" | "overlay" | "replace" | "speed" | "part" | null;

function overlayTrackLabel(draft: DynamicTemplateExtras, parts: DynamicPart[]) {
  const part = parts.find((item) => item.id === draft.overlayPartId);
  if (draft.overlayMode === "prompt" && part) return "Texto de IA";
  const lines = (part?.prompts || []).map((item) => item.text.trim()).filter(Boolean);
  if (lines.length > 1) return `Aleatorio · ${lines.length}`;
  return lines[0] || draft.overlayText || "Texto";
}

function OverlayModePicker({
  mode,
  part,
  onMode,
}: {
  mode: "list" | "prompt";
  part: DynamicPart | null;
  onMode: (mode: "list" | "prompt") => void;
}) {
  const lines = (part?.prompts || []).map((item) => item.text.trim()).filter(Boolean);
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        Caso de texto
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["list", "Lista aleatoria"],
            ["prompt", "Prompt de IA"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onMode(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              mode === id ? "bg-[#16181d] text-white" : "bg-[var(--surface-alt)] text-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
        {!part
          ? "Elige una part de texto para usar la lista o el prompt."
          : mode === "prompt"
            ? part.overlayPrompt?.trim()
              ? "Al generar, la IA escribe el texto con el prompt de esta part."
              : "Esta part no tiene prompt. Escríbelo en Parts."
            : lines.length
              ? `${lines.length} texto${lines.length === 1 ? "" : "s"}. Al generar se elige uno al azar.`
              : "Esta part no tiene textos. Añádelos en Parts."}
      </p>
    </div>
  );
}

const SAMPLE_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const PX_PER_SEC = 104;
const TICK_SEC = 5;
const CLIP_GAP = 4;
const STRIP_H = 52;
const GUTTER_W = 88;
const FRAME_SEC = 1 / 30;

function snapFrame(sec: number) {
  return Math.max(0, Math.round(sec * 30) / 30);
}

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatClipClock(sec: number) {
  const frames = Math.max(0, Math.round(sec * 30));
  const ff = frames % 30;
  const totalSec = Math.floor(frames / 30);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
}

function clipTrimAt(draft: DynamicTemplateExtras, i: number) {
  const n = draft.videoTrimStarts?.[i];
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

function clipDurAt(draft: DynamicTemplateExtras, i: number) {
  const n = draft.videoDurations?.[i];
  return typeof n === "number" && Number.isFinite(n) && n > 0
    ? Math.max(FRAME_SEC, n)
    : DEFAULT_CLIP_SEC;
}

function layoutFromDurations(durs: number[]) {
  const widths = durs.map((d) => Math.max(36, d * PX_PER_SEC));
  const offsets: number[] = [];
  let x = 0;
  for (const w of widths) {
    offsets.push(x);
    x += w + CLIP_GAP;
  }
  return {
    widths,
    offsets,
    totalW: widths.length ? x - CLIP_GAP : 0,
  };
}

type PreviewClip = {
  url: string;
  label: string;
  fileName: string;
  demo: boolean;
  trimStart: number;
  duration: number;
  speed: number;
  muted: boolean;
};

type ResizeDrag = {
  index: number;
  edge: "left" | "right";
  startX: number;
  trim: number;
  dur: number;
  source: number;
};

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (!Number.isFinite(time)) {
      resolve();
      return;
    }
    if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.04) {
      resolve();
      return;
    }
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("seek"));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    video.currentTime = time;
  });
}

function FilmstripCell({ src, at }: { src: string; at: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seek = () => {
      if (!el.duration) return;
      el.currentTime = Math.min(el.duration * 0.98, at * el.duration);
    };
    el.addEventListener("loadedmetadata", seek);
    if (el.readyState >= 1) seek();
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [src, at]);
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      className="h-full min-w-0 flex-1 object-cover"
    />
  );
}

function VideoFilmstrip({
  src,
  start = 0,
  length,
}: {
  src: string;
  start?: number;
  length?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || !src) return;
    const host = wrap;
    const surface = canvas;
    let cancelled = false;
    let lastW = 0;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    async function paint() {
      const w = Math.round(host.clientWidth);
      const h = Math.round(host.clientHeight);
      if (!w || !h || cancelled) return;
      lastW = w;
      try {
        if (video.src !== src) {
          video.src = src;
          await new Promise<void>((resolve, reject) => {
            const ok = () => {
              video.removeEventListener("loadeddata", ok);
              video.removeEventListener("error", bad);
              resolve();
            };
            const bad = () => {
              video.removeEventListener("loadeddata", ok);
              video.removeEventListener("error", bad);
              reject(new Error("load"));
            };
            video.addEventListener("loadeddata", ok);
            video.addEventListener("error", bad);
            video.load();
          });
        }
        if (cancelled) return;
        const full =
          Number.isFinite(video.duration) && video.duration > 0.2 ? video.duration : 1;
        const winStart = Math.max(0, Math.min(full, start));
        const winLen = Math.max(
          0.05,
          Math.min(full - winStart, length && length > 0 ? length : full - winStart)
        );
        const count = Math.max(4, Math.min(24, Math.round(w / 28)));
        const cellW = w / count;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        surface.width = Math.round(w * dpr);
        surface.height = Math.round(h * dpr);
        surface.style.width = `${w}px`;
        surface.style.height = `${h}px`;
        const ctx = surface.getContext("2d");
        if (!ctx) throw new Error("ctx");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const vw = video.videoWidth || 16;
        const vh = video.videoHeight || 9;
        for (let i = 0; i < count; i++) {
          if (cancelled) return;
          const t = Math.min(full - 0.05, winStart + ((i + 0.35) / count) * winLen);
          await seekVideo(video, Math.max(0, t));
          if (cancelled) return;
          const dx = Math.round(i * cellW);
          const dw = Math.ceil((i + 1) * cellW) - dx;
          const scale = Math.max(dw / vw, h / vh);
          const sw = dw / scale;
          const sh = h / scale;
          ctx.drawImage(
            video,
            (vw - sw) / 2,
            (vh - sh) / 2,
            sw,
            sh,
            dx,
            0,
            dw,
            h
          );
        }
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void paint();
    const ro = new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (Math.abs(w - lastW) < 8) return;
      void paint();
    });
    ro.observe(host);
    return () => {
      cancelled = true;
      ro.disconnect();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, start, length]);

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden bg-[#d1d5db]">
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
      {failed ? (
        <div className="absolute inset-0 flex">
          {Array.from({ length: 12 }, (_, i) => (
            <FilmstripCell key={i} src={src} at={i / 12} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const PHONE_RATIO = 9 / 16;

function fitPhoneFrame(availW: number, availH: number) {
  const height = Math.max(0, Math.min(availH, availW / PHONE_RATIO));
  const width = height * PHONE_RATIO;
  return { width, height };
}

type CanvasTool = "select" | "hand";

function PhoneStage({
  children,
  tool,
  zoom,
  pan,
  onPan,
  onZoom,
}: {
  children: ReactNode;
  tool: CanvasTool;
  zoom: number;
  pan: { x: number; y: number };
  onPan: (pan: { x: number; y: number }) => void;
  onZoom: (zoom: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const next = fitPhoneFrame(
        Math.max(0, el.clientWidth - 48),
        Math.max(0, el.clientHeight - 24)
      );
      setFrame((cur) =>
        Math.abs(cur.width - next.width) < 0.5 && Math.abs(cur.height - next.height) < 0.5
          ? cur
          : next
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 0.92 : 1.08;
      onZoom(Math.min(3, Math.max(0.25, zoom * dir)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoom, zoom]);

  return (
    <div
      ref={hostRef}
      className={`relative z-0 flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white ${
        tool === "hand" ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
      onPointerDown={(e) => {
        if (tool !== "hand" || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag) return;
        onPan({ x: drag.panX + e.clientX - drag.x, y: drag.panY + e.clientY - drag.y });
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragRef.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragging(false);
      }}
    >
      <span className="absolute left-4 top-3 z-10 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--muted)]">
        Relación 9:16
      </span>
      <div
        className={`relative overflow-hidden rounded-xl bg-black shadow-[0_18px_50px_rgba(17,24,39,0.12)] ${
          tool === "hand" ? "pointer-events-none" : ""
        }`}
        style={{
          width: frame.width || undefined,
          height: frame.height || undefined,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SequentialPreview({
  clips,
  overlayEnabled,
  overlayText,
  overlayStyle,
  overlayPosition,
  musicUrl,
  playing,
  activeIndex,
  seekFrac,
  scrubbing,
  onActiveIndex,
  onPlaying,
  onProgress,
  onSourceDuration,
}: {
  clips: PreviewClip[];
  overlayEnabled: boolean;
  overlayText: string;
  overlayStyle: CaptionStyleId;
  overlayPosition: OverlayPosition;
  musicUrl: string | null;
  playing: boolean;
  activeIndex: number;
  seekFrac: number;
  scrubbing: boolean;
  onActiveIndex: (i: number) => void;
  onPlaying: (v: boolean) => void;
  onProgress: (p: number) => void;
  onSourceDuration: (url: string, duration: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const endLockRef = useRef(false);
  const clip = clips[activeIndex] ?? clips[0];
  const winStart = Math.max(0, clip?.trimStart ?? 0);
  const winLen = Math.max(MIN_CLIP_SEC, clip?.duration ?? DEFAULT_CLIP_SEC);
  const speed = clip?.speed && clip.speed > 0 ? clip.speed : 1;

  function mediaTime(frac: number) {
    return winStart + Math.max(0, Math.min(0.999, frac)) * winLen;
  }

  function applySeek(frac: number) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const next = Math.max(0, Math.min(el.duration * 0.999, mediaTime(frac)));
    if (Math.abs(el.currentTime - next) > 0.04) el.currentTime = next;
  }

  function goNext() {
    if (endLockRef.current) return;
    endLockRef.current = true;
    window.setTimeout(() => {
      endLockRef.current = false;
    }, 120);
    onProgress(0);
    if (clips.length <= 1) {
      const el = videoRef.current;
      if (el) {
        el.currentTime = winStart;
        if (playing && !scrubbing) void el.play().catch(() => undefined);
      }
      return;
    }
    onActiveIndex((activeIndex + 1) % clips.length);
  }

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip) return;
    el.playbackRate = speed;
    if (playing && !scrubbing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing, scrubbing, clip?.url, activeIndex, speed]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip) return;
    const apply = () => applySeek(seekFrac);
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
  }, [activeIndex, clip?.url, winStart, winLen]);

  useEffect(() => {
    if (!scrubbing) return;
    applySeek(seekFrac);
  }, [seekFrac, scrubbing, clip, activeIndex, winStart, winLen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing && musicUrl && !scrubbing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [playing, musicUrl, scrubbing]);

  if (!clip) {
    return <div className="absolute inset-0 bg-[#111827]" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#111827]">
      <video
        ref={videoRef}
        src={clip.url}
        muted={clip.muted}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        onLoadedMetadata={() => {
          const el = videoRef.current;
          if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
          onSourceDuration(clip.url, el.duration);
          applySeek(seekFrac);
        }}
        onTimeUpdate={() => {
          const el = videoRef.current;
          if (!el || !el.duration) return;
          const end = winStart + winLen;
          if (el.currentTime >= end - 0.04) {
            if (!scrubbing) goNext();
            return;
          }
          if (el.currentTime < winStart - 0.05) {
            el.currentTime = winStart;
            return;
          }
          if (scrubbing) return;
          onProgress(Math.max(0, Math.min(1, (el.currentTime - winStart) / winLen)));
        }}
        onEnded={() => {
          if (!scrubbing) goNext();
        }}
        onError={() => {
          if (clips.length > 1) onActiveIndex((activeIndex + 1) % clips.length);
        }}
        onPlay={() => {
          if (!scrubbing) onPlaying(true);
        }}
        onPause={() => {
          if (scrubbing) return;
          const el = videoRef.current;
          if (el && !el.ended) onPlaying(false);
        }}
      />
      {musicUrl ? <audio ref={audioRef} src={musicUrl} loop preload="auto" /> : null}
      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)]">
        {activeIndex + 1}/{clips.length} · {clip.label}
        {clip.demo ? " · ejemplo" : ""}
      </span>
      {overlayEnabled ? (
        <OverlayCaption
          text={overlayText || "Texto de ejemplo"}
          styleId={overlayStyle}
          position={overlayPosition}
        />
      ) : null}
    </div>
  );
}

function ClipHandle({
  side,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  side: "left" | "right";
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-label={side === "left" ? "Acortar inicio" : "Acortar final"}
      className={`absolute top-0 z-30 h-full w-3 cursor-ew-resize touch-none ${
        side === "left" ? "left-0" : "right-0"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-y-[5px] left-1/2 w-[7px] -translate-x-1/2 rounded-full bg-[#22d3ee] shadow-sm" />
    </div>
  );
}

function AddChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)] hover:border-[#93c5fd] hover:bg-[#eff6ff]"
    >
      <PlusIcon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ConfirmDialog({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/25 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-delete-title" className="text-[15px] font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-full bg-[#b91c1c] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#991b1b]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function HoverTip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111827] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm group-hover:opacity-100">
      {children}
    </span>
  );
}

function ClipTool({
  label,
  hint,
  onClick,
  disabled,
  children,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`group relative grid h-10 w-10 shrink-0 place-items-center text-[var(--muted)] transition hover:text-[var(--foreground)] ${
        disabled ? "opacity-30" : ""
      }`}
    >
      {children}
      <HoverTip>{disabled && hint ? `${label}. ${hint}` : label}</HoverTip>
    </button>
  );
}

function VideoClipTools({
  canSplit,
  splitHint,
  canJoin,
  muted,
  onSplit,
  onDelete,
  onJoin,
  onReplace,
  onSpeed,
  onVolume,
  onDownload,
}: {
  canSplit: boolean;
  splitHint?: string;
  canJoin: boolean;
  muted: boolean;
  onSplit: () => void;
  onDelete: () => void;
  onJoin: () => void;
  onReplace: () => void;
  onSpeed: () => void;
  onVolume: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <ClipTool
        label="Dividir en el playhead"
        hint={splitHint || "Mueve el playhead dentro del clip"}
        disabled={!canSplit}
        onClick={onSplit}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path
            d="M5 5.5h4.5v13H5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 5.5h-4.5v13H19"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ClipTool>
      <ClipTool
        label="Unir con el siguiente"
        hint="No hay un clip siguiente para unir"
        disabled={!canJoin}
        onClick={onJoin}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M10 4H6v16h4M14 4h4v16h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ClipTool>
      <ClipTool label="Eliminar clip" onClick={onDelete}>
        <TrashIcon className="h-6 w-6" />
      </ClipTool>
      <ClipTool label="Reemplazar video" onClick={onReplace}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path
            d="M20 12a8 8 0 1 0-2.5 5.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M20 7.2v5.2h-5.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ClipTool>
      <ClipTool label="Cambiar velocidad" onClick={onSpeed}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path
            d="M5.1 16.2a8 8 0 1 1 13.8 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 13.2 16.2 9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="13.2" r="1.3" fill="currentColor" />
        </svg>
      </ClipTool>
      <ClipTool label={muted ? "Activar sonido" : "Silenciar clip"} onClick={onVolume}>
        {muted ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path
              d="M8 10H5v4h3l4 3V7l-4 3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="m16 9.5 5 5M21 9.5l-5 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path
              d="M8 10H5v4h3l4 3V7l-4 3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M16 9.2a3.4 3.4 0 0 1 0 5.6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M18.2 7a6 6 0 0 1 0 10"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </ClipTool>
      <ClipTool label="Descargar clip" onClick={onDownload}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 18h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </ClipTool>
    </div>
  );
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function CanvasToolbar({
  tool,
  onTool,
  zoom,
  onZoom,
  onFit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_0_0_1px_rgba(17,24,39,0.06)]">
      <button
        type="button"
        aria-label="Seleccionar"
        aria-pressed={tool === "select"}
        className={`group relative grid h-8 w-8 place-items-center rounded-full ${
          tool === "select" ? "bg-[var(--surface-alt)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        onClick={() => onTool("select")}
      >
        <HoverTip>Seleccionar</HoverTip>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M5.2 3.8 18.6 12.2l-6.1 1.3 2.8 6.4-2.6 1.1-2.8-6.3-4.7 3.4V3.8Z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Mover lienzo"
        aria-pressed={tool === "hand"}
        className={`group relative grid h-8 w-8 place-items-center rounded-full ${
          tool === "hand" ? "bg-[var(--surface-alt)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        onClick={() => onTool("hand")}
      >
        <HoverTip>Mover lienzo</HoverTip>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M8.2 11.2V7.4a1.3 1.3 0 0 1 2.6 0v3.4M10.8 10.6V6.6a1.3 1.3 0 1 1 2.6 0v4M13.4 10.4V7.8a1.3 1.3 0 1 1 2.6 0v5.1M16 12.2v-1.4a1.3 1.3 0 1 1 2.6 0v4.3c0 3-2.2 5.1-5.4 5.1h-1.1c-2.3 0-3.8-.7-5.1-2.2L5.2 15.8a1.4 1.4 0 0 1 2-2l1-1.1"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Zoom"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-0.5 rounded-full px-1.5 text-[13px] font-medium tabular-nums text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
        onClick={() => setOpen((v) => !v)}
      >
        {Math.round(zoom * 100)}%
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[var(--muted)]" fill="none" aria-hidden>
          <path d="M4 6.2 8 10l4-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="mx-1 h-4 w-px bg-[#e5e7eb]" aria-hidden />
      <button
        type="button"
        aria-label="Deshacer"
        aria-disabled={!canUndo}
        className={`group relative grid h-8 w-8 place-items-center rounded-full text-[var(--foreground)] hover:bg-[var(--surface-alt)] ${
          canUndo ? "" : "opacity-30"
        }`}
        onClick={() => {
          if (!canUndo) return;
          onUndo();
        }}
      >
        <HoverTip>{canUndo ? "Deshacer" : "Deshacer. Nada que deshacer"}</HoverTip>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M8.5 8.5 5 12l3.5 3.5M6 12h8.2a4.8 4.8 0 1 1 0 9.6H11"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Rehacer"
        aria-disabled={!canRedo}
        className={`group relative grid h-8 w-8 place-items-center rounded-full text-[var(--foreground)] hover:bg-[var(--surface-alt)] ${
          canRedo ? "" : "opacity-30"
        }`}
        onClick={() => {
          if (!canRedo) return;
          onRedo();
        }}
      >
        <HoverTip>{canRedo ? "Rehacer" : "Rehacer. Nada que rehacer"}</HoverTip>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M15.5 8.5 19 12l-3.5 3.5M18 12H9.8a4.8 4.8 0 1 0 0 9.6H13"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-32 -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-white p-1 shadow-[0_12px_32px_rgba(17,24,39,0.14)]">
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-1.5 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
            onClick={() => {
              onFit();
              setOpen(false);
            }}
          >
            Ajustar
          </button>
          {ZOOM_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={`block w-full rounded-xl px-3 py-1.5 text-left text-[13px] font-medium tabular-nums hover:bg-[var(--surface-alt)] ${
                Math.abs(zoom - value) < 0.01 ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
              onClick={() => {
                onZoom(value);
                setOpen(false);
              }}
            >
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlayCircle({
  playing,
  onClick,
}: {
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#111827] text-white"
      aria-label={playing ? "Pausar" : "Reproducir"}
      onClick={onClick}
    >
      <HoverTip>{playing ? "Pausar" : "Reproducir"}</HoverTip>
      {playing ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="ml-px h-4 w-4" fill="currentColor">
          <path d="M8 5.5v13l11-6.5-11-6.5Z" />
        </svg>
      )}
    </button>
  );
}

function DockCard({
  title,
  align = "stretch",
  onClose,
  children,
}: {
  title?: string;
  align?: "left" | "right" | "stretch";
  onClose?: () => void;
  children: ReactNode;
}) {
  const place =
    align === "right"
      ? "right-3 w-72"
      : align === "left"
        ? "left-3 w-72"
        : "left-3 right-3";
  return (
    <div
      className={`absolute bottom-full z-40 mb-3 max-h-[min(46vh,380px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-3 shadow-[0_18px_48px_rgba(17,24,39,0.18)] ${place}`}
    >
      {title || onClose ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title ? (
            <p className="text-[12px] font-semibold text-[var(--foreground)]">{title}</p>
          ) : (
            <span />
          )}
          {onClose ? (
            <button
              type="button"
              className="rounded-full p-1 text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function DynamicsEditor({
  projectId,
  name,
  onNameChange,
  draft,
  onDraftChange,
  parts,
  musicTracks,
  saving,
  saveStatus = "saved",
  error,
  onBack,
  onSave,
  onDelete,
  onNewPart,
  onUploadMusic,
}: {
  projectId: string;
  name: string;
  onNameChange: (v: string) => void;
  draft: DynamicTemplateExtras;
  onDraftChange: (next: DynamicTemplateExtras) => void;
  parts: DynamicPart[];
  musicTracks: MusicTrack[];
  saving: boolean;
  saveStatus?: "saved" | "saving" | "unsaved";
  error: string;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onNewPart: (kind: DynamicPartKind) => void;
  onUploadMusic: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [clipProgress, setClipProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  const stripCommitRef = useRef({ starts: [] as number[], durs: [] as number[] });
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [sourceLens, setSourceLens] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Selected>(null);
  const [menu, setMenu] = useState<AddMenu>(null);
  const [clipSpeeds, setClipSpeeds] = useState<number[]>([]);
  const [clipMuted, setClipMuted] = useState<boolean[]>([]);
  const [partVideos, setPartVideos] = useState<PartVideo[]>([]);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const draftRef = useRef(draft);
  const onDraftChangeRef = useRef(onDraftChange);
  draftRef.current = draft;
  onDraftChangeRef.current = onDraftChange;

  function rememberDraft() {
    pastRef.current = [...pastRef.current.slice(-39), JSON.stringify(draftRef.current)];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undoDraft() {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(JSON.stringify(draftRef.current));
    onDraftChangeRef.current(JSON.parse(prev) as DynamicTemplateExtras);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }

  function redoDraft() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(JSON.stringify(draftRef.current));
    onDraftChangeRef.current(JSON.parse(next) as DynamicTemplateExtras);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pendingDeleteIndex !== null) return;
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redoDraft();
        else undoDraft();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        if (typing) return;
        e.preventDefault();
        redoDraft();
        return;
      }
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || typing) return;
      e.preventDefault();
      setPlaying((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteIndex]);

  const videoParts = useMemo(
    () =>
      draft.videoPartIds
        .map((id) => parts.find((p) => p.id === id && p.kind !== "music" && p.kind !== "overlay") || parts.find((p) => p.id === id) || null)
        .filter((p): p is DynamicPart => Boolean(p)),
    [draft.videoPartIds, parts]
  );

  const libraryVideo = parts.filter((p) => p.kind === "video");
  const libraryMimic = parts.filter((p) => p.kind === "mimic");
  const libraryVideoLike = parts.filter((p) => p.kind === "video" || p.kind === "mimic");
  const libraryMusic = parts.filter((p) => p.kind === "music");
  const libraryOverlay = parts.filter((p) => p.kind === "overlay");

  useEffect(() => {
    let cancelled = false;
    const folders = libraryVideoLike.filter((p) => p.folderId);
    if (!folders.length) {
      setPartVideos([]);
      return;
    }
    void (async () => {
      const loaded: PartVideo[] = [];
      for (const part of folders) {
        try {
          const res = await fetch(
            `/api/projects/${projectId}/gallery?folderId=${encodeURIComponent(part.folderId)}&kind=video`,
            { cache: "no-store" }
          );
          const data = await res.json();
          if (!res.ok) continue;
          const assets = (data.assets ?? []) as {
            id: string;
            name: string;
            kind: string;
            publicUrl: string;
          }[];
          for (const asset of assets) {
            if (asset.kind !== "video" || !asset.publicUrl) continue;
            loaded.push({
              id: asset.id,
              name: asset.name,
              publicUrl: asset.publicUrl,
              partId: part.id,
              partName: part.name,
            });
          }
        } catch {
          /* ignore folder */
        }
      }
      if (!cancelled) setPartVideos(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, libraryVideoLike.map((p) => `${p.id}:${p.folderId}:${p.videoCount}`).join("|")]);

  const clips: PreviewClip[] = useMemo(() => {
    if (!videoParts.length) {
      return [];
    }
    return videoParts.map((part, i) => {
      const assetId = draft.videoAssetIds?.[i] || null;
      const chosen = assetId
        ? partVideos.find((v) => v.id === assetId)
        : partVideos.find((v) => v.partId === part.id);
      const url = chosen?.publicUrl || part.previewUrl || SAMPLE_VIDEO;
      const fileName = chosen?.name || part.name;
      return {
        url,
        label: part.name,
        fileName,
        demo: !chosen && !part.previewUrl,
        trimStart: clipTrimAt(draft, i),
        duration: clipDurAt(draft, i),
        speed: clipSpeeds[i] && clipSpeeds[i] > 0 ? clipSpeeds[i] : 1,
        muted: clipMuted[i] !== false,
      };
    });
  }, [videoParts, draft, partVideos, clipSpeeds, clipMuted]);

  const clipDurs = videoParts.length ? videoParts.map((_, i) => clipDurAt(draft, i)) : [];
  useEffect(() => {
    if (!videoParts.length) return;
    if (selected?.kind === "overlay" || selected?.kind === "music") return;
    const index = Math.min(Math.max(0, activeIndex), videoParts.length - 1);
    setSelected((cur) =>
      cur?.kind === "video" && cur.index === index ? cur : { kind: "video", index }
    );
  }, [activeIndex, videoParts.length, selected?.kind]);
  const layout = layoutFromDurations(clipDurs);
  const totalSec = videoParts.length
    ? clipDurs.reduce((sum, d) => sum + d, 0) || DEFAULT_CLIP_SEC * 2
    : 0;
  const tickCount = Math.max(2, Math.ceil(totalSec / TICK_SEC) + 1);
  const ticks = Array.from({ length: tickCount }, (_, i) => i * TICK_SEC);
  const stripStarts =
    resizingIndex === null ? draft.videoTrimStarts : stripCommitRef.current.starts;
  const stripDurs =
    resizingIndex === null ? draft.videoDurations : stripCommitRef.current.durs;

  useEffect(() => {
    if (resizingIndex !== null) return;
    stripCommitRef.current = {
      starts: videoParts.map((_, i) => clipTrimAt(draft, i)),
      durs: videoParts.map((_, i) => clipDurAt(draft, i)),
    };
  }, [draft, videoParts, resizingIndex]);

  useEffect(() => {
    if (!videoParts.length) return;
    let changed = false;
    const trims = videoParts.map((_, i) => clipTrimAt(draft, i));
    const durs = videoParts.map((_, i) => clipDurAt(draft, i));
    clips.forEach((clip, i) => {
      if (clip.demo) return;
      const src = sourceLens[clip.url];
      if (!src || src < MIN_CLIP_SEC) return;
      let trim = trims[i];
      let dur = durs[i];
      if (trim > src - MIN_CLIP_SEC) {
        trim = Math.max(0, src - MIN_CLIP_SEC);
        changed = true;
      }
      const maxDur = Math.max(MIN_CLIP_SEC, src - trim);
      if (dur > maxDur + 0.02) {
        dur = maxDur;
        changed = true;
      }
      trims[i] = trim;
      durs[i] = dur;
    });
    if (changed) {
      onDraftChange({ ...draft, videoTrimStarts: trims, videoDurations: durs });
    }
  }, [sourceLens, videoParts.length, clips.map((c) => c.url).join("|")]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, draft.videoPartIds.length - 1)));
    setClipSpeeds((list) =>
      draft.videoPartIds.map((_, i) => (list[i] && list[i] > 0 ? list[i] : 1))
    );
    setClipMuted((list) => draft.videoPartIds.map((_, i) => list[i] !== false));
  }, [draft.videoPartIds.length]);

  function setDraft(patch: Partial<DynamicTemplateExtras>) {
    const keys = Object.keys(patch);
    if (!(keys.length === 1 && keys[0] === "overlayText")) rememberDraft();
    onDraftChange({ ...draft, ...patch });
  }

  function writeClips(
    ids: string[],
    assets: (string | null)[],
    trims: number[],
    durs: number[]
  ) {
    rememberDraft();
    onDraftChange({ ...draft, ...withVideoPartIds(ids, assets, trims, durs) });
  }

  function addVideoPart(part: DynamicPart) {
    const trims = videoParts.map((_, i) => clipTrimAt(draft, i));
    const durs = videoParts.map((_, i) => clipDurAt(draft, i));
    if (part.kind === "mimic") {
      writeClips(
        [part.id, ...draft.videoPartIds],
        [null, ...(draft.videoAssetIds || [])],
        [0, ...trims],
        [DEFAULT_CLIP_SEC, ...durs]
      );
      setMenu(null);
      setSelected({ kind: "video", index: 0 });
      return;
    }
    writeClips(
      [...draft.videoPartIds, part.id],
      [...(draft.videoAssetIds || []), null],
      [...trims, 0],
      [...durs, DEFAULT_CLIP_SEC]
    );
    setMenu(null);
    setSelected({ kind: "video", index: draft.videoPartIds.length });
  }

  function removeVideoAt(index: number) {
    const nextIds = draft.videoPartIds.filter((_, i) => i !== index);
    const nextAssets = (draft.videoAssetIds || []).filter((_, i) => i !== index);
    const nextTrims = videoParts.map((_, i) => clipTrimAt(draft, i)).filter((_, i) => i !== index);
    const nextDurs = videoParts.map((_, i) => clipDurAt(draft, i)).filter((_, i) => i !== index);
    setClipSpeeds((list) => list.filter((_, i) => i !== index));
    setClipMuted((list) => list.filter((_, i) => i !== index));
    writeClips(nextIds, nextAssets, nextTrims, nextDurs);
    setSelected(null);
  }

  function splitVideoAt(index: number) {
    if (activeIndex !== index) return;
    const dur = clipDurAt(draft, index);
    const trim = clipTrimAt(draft, index);
    const at = snapFrame(clipProgress * dur);
    if (at < FRAME_SEC || dur - at < FRAME_SEC) return;
    const ids = [...draft.videoPartIds];
    const assets = videoParts.map((_, i) => draft.videoAssetIds?.[i] ?? null);
    const trims = videoParts.map((_, i) => clipTrimAt(draft, i));
    const durs = videoParts.map((_, i) => clipDurAt(draft, i));
    ids.splice(index + 1, 0, ids[index]);
    assets.splice(index + 1, 0, assets[index] ?? null);
    trims.splice(index + 1, 0, trim + at);
    durs[index] = at;
    durs.splice(index + 1, 0, dur - at);
    setClipSpeeds((list) => {
      const next = videoParts.map((_, i) => (list[i] && list[i] > 0 ? list[i] : 1));
      next.splice(index + 1, 0, next[index] ?? 1);
      return next;
    });
    setClipMuted((list) => {
      const next = videoParts.map((_, i) => list[i] !== false);
      next.splice(index + 1, 0, next[index] !== false);
      return next;
    });
    writeClips(ids, assets, trims, durs);
    setSelected({ kind: "video", index });
    setClipProgress(0);
  }

  function joinVideoWithNext(index: number) {
    if (index >= videoParts.length - 1) return;
    const samePart = draft.videoPartIds[index] === draft.videoPartIds[index + 1];
    const sameAsset =
      (draft.videoAssetIds?.[index] ?? null) === (draft.videoAssetIds?.[index + 1] ?? null);
    if (!samePart || !sameAsset) return;
    const ids = [...draft.videoPartIds];
    const assets = videoParts.map((_, i) => draft.videoAssetIds?.[i] ?? null);
    const trims = videoParts.map((_, i) => clipTrimAt(draft, i));
    const durs = videoParts.map((_, i) => clipDurAt(draft, i));
    durs[index] = durs[index] + durs[index + 1];
    ids.splice(index + 1, 1);
    assets.splice(index + 1, 1);
    trims.splice(index + 1, 1);
    durs.splice(index + 1, 1);
    setClipSpeeds((list) => list.filter((_, i) => i !== index + 1));
    setClipMuted((list) => list.filter((_, i) => i !== index + 1));
    writeClips(ids, assets, trims, durs);
    setSelected({ kind: "video", index });
  }

  function downloadClipAt(index: number) {
    const clip = clips[index];
    if (!clip?.url) return;
    const name = clip.fileName || "clip.mp4";
    void (async () => {
      try {
        const res = await fetch(clip.url);
        if (!res.ok) throw new Error("download");
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        a.click();
        URL.revokeObjectURL(href);
      } catch {
        const a = document.createElement("a");
        a.href = clip.url;
        a.download = name;
        a.click();
      }
    })();
  }

  function replaceVideoAt(index: number, video: PartVideo) {
    const nextIds = [...draft.videoPartIds];
    const nextAssets = videoParts.map((_, i) => draft.videoAssetIds?.[i] ?? null);
    const trims = videoParts.map((_, i) => clipTrimAt(draft, i));
    const durs = videoParts.map((_, i) => clipDurAt(draft, i));
    if (!nextIds[index]) return;
    nextIds[index] = video.partId;
    nextAssets[index] = video.id;
    trims[index] = 0;
    durs[index] = DEFAULT_CLIP_SEC;
    writeClips(nextIds, nextAssets, trims, durs);
    setActiveIndex(index);
    setClipProgress(0);
  }

  function applyOverlayPart(part: DynamicPart) {
    const line = part.prompts.find((item) => item.text.trim())?.text || part.name;
    setDraft({
      overlayEnabled: true,
      overlayPartId: part.id,
      overlayMode: draft.overlayMode === "prompt" ? "prompt" : "list",
      overlayText: line,
      overlayStyle: normalizeCaptionStyle(part.overlayStyle),
      overlayPosition: normalizeOverlayPosition(part.overlayPosition),
    });
    setMenu(null);
    setSelected({ kind: "overlay" });
  }

  function applyMusicPart(part: DynamicPart) {
    setDraft({
      musicEnabled: true,
      musicName: part.name,
      musicUrl: part.audioUrl,
      musicAssetId: null,
    });
    setMenu(null);
    setSelected({ kind: "music" });
  }

  function pickMusicTrack(track: MusicTrack) {
    setDraft({
      musicEnabled: true,
      musicAssetId: track.id,
      musicName: track.name,
      musicUrl: track.publicUrl,
    });
    setMenu(null);
    setSelected({ kind: "music" });
  }

  const selectedVideo =
    selected?.kind === "video" ? videoParts[selected.index] || null : null;
  const selectedClipDur =
    selected?.kind === "video" ? clipDurAt(draft, selected.index) : 0;
  const playheadInSelectedClip =
    selected?.kind === "video" && activeIndex === selected.index;
  const splitAt = snapFrame(clipProgress * selectedClipDur);
  const canSplit =
    playheadInSelectedClip &&
    splitAt >= FRAME_SEC &&
    selectedClipDur - splitAt >= FRAME_SEC;
  const splitHint = playheadInSelectedClip
    ? "Avanza o retrocede un frame para cortar"
    : "Mueve el playhead dentro del clip";
  const canJoin =
    selected?.kind === "video" &&
    selected.index < videoParts.length - 1 &&
    draft.videoPartIds[selected.index] === draft.videoPartIds[selected.index + 1] &&
    (draft.videoAssetIds?.[selected.index] ?? null) ===
      (draft.videoAssetIds?.[selected.index + 1] ?? null);

  function seekFromClientX(clientX: number) {
    const el = railRef.current;
    if (!el) return;
    const n = Math.max(1, clipDurs.length);
    const x = clientX - el.getBoundingClientRect().left - GUTTER_W;
    if (!clipDurs.length) {
      const frac = Math.max(0, Math.min(1, x / Math.max(1, totalSec * PX_PER_SEC)));
      setActiveIndex(0);
      setClipProgress(frac);
      return;
    }
    const maxX = layout.totalW;
    const clamped = Math.max(0, Math.min(maxX, x));
    let index = n - 1;
    for (let i = 0; i < n; i++) {
      const end = layout.offsets[i] + layout.widths[i];
      if (clamped <= end + CLIP_GAP / 2) {
        index = i;
        break;
      }
    }
    const w = layout.widths[index] || 1;
    const frac = Math.max(0, Math.min(1, (clamped - layout.offsets[index]) / w));
    setActiveIndex(index);
    setClipProgress(frac);
  }

  function applyResize(clientX: number) {
    const drag = resizeRef.current;
    if (!drag) return;
    const current = draftRef.current;
    const dSec = (clientX - drag.startX) / PX_PER_SEC;
    const trims = current.videoPartIds.map((_, i) => clipTrimAt(current, i));
    const durs = current.videoPartIds.map((_, i) => clipDurAt(current, i));
    if (drag.edge === "right") {
      const maxDur = Math.max(FRAME_SEC, drag.source - drag.trim);
      durs[drag.index] = Math.max(FRAME_SEC, Math.min(maxDur, drag.dur + dSec));
    } else {
      const end = drag.trim + drag.dur;
      const minTrim = Math.max(0, end - drag.source);
      const maxTrim = Math.max(minTrim, end - FRAME_SEC);
      const nextTrim = Math.max(minTrim, Math.min(maxTrim, drag.trim + dSec));
      trims[drag.index] = nextTrim;
      durs[drag.index] = Math.max(FRAME_SEC, end - nextTrim);
    }
    onDraftChangeRef.current({ ...current, videoTrimStarts: trims, videoDurations: durs });
  }

  const applyResizeRef = useRef(applyResize);
  applyResizeRef.current = applyResize;

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      if (!resizeRef.current) return;
      applyResizeRef.current(e.clientX);
    };
    const onUp = (e: globalThis.PointerEvent) => {
      if (!resizeRef.current) return;
      applyResizeRef.current(e.clientX);
      resizeRef.current = null;
      setResizingIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function onResizePointerDown(
    e: PointerEvent<HTMLDivElement>,
    index: number,
    edge: "left" | "right"
  ) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    rememberDraft();
    const trim = clipTrimAt(draft, index);
    const dur = clipDurAt(draft, index);
    const url = clips[index]?.url;
    const source = (url && sourceLens[url]) || Math.max(dur + trim, DEFAULT_CLIP_SEC);
    stripCommitRef.current = {
      starts: videoParts.map((_, i) => clipTrimAt(draft, i)),
      durs: videoParts.map((_, i) => clipDurAt(draft, i)),
    };
    resizeRef.current = {
      index,
      edge,
      startX: e.clientX,
      trim,
      dur,
      source,
    };
    setResizingIndex(index);
    setSelected({ kind: "video", index });
    setActiveIndex(index);
  }

  function onResizePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    applyResize(e.clientX);
  }

  function onResizePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (resizeRef.current) applyResize(e.clientX);
    resizeRef.current = null;
    setResizingIndex(null);
  }

  function onScrubPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    setScrubbing(true);
    seekFromClientX(e.clientX);
  }

  function onScrubPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    seekFromClientX(e.clientX);
  }

  function onScrubPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setScrubbing(false);
  }

  const playIndex = Math.min(activeIndex, Math.max(clipDurs.length - 1, 0));
  const playheadLeft =
    GUTTER_W +
    (layout.offsets[playIndex] ?? 0) +
    clipProgress * (layout.widths[playIndex] ?? 0);
  const clockNow =
    clipDurs.slice(0, playIndex).reduce((sum, d) => sum + d, 0) +
    clipProgress * (clipDurs[playIndex] ?? 0);
  const tracksW = Math.max(layout.totalW, 160);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {pendingDeleteIndex !== null ? (
        <ConfirmDialog
          title="¿Eliminar este clip del timeline?"
          confirmLabel="Eliminar"
          onCancel={() => setPendingDeleteIndex(null)}
          onConfirm={() => {
            removeVideoAt(pendingDeleteIndex);
            setPendingDeleteIndex(null);
          }}
        />
      ) : null}
      <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[var(--border)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="shrink-0 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onBack}
          >
            ← Close
          </button>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--foreground)] outline-none"
            maxLength={120}
          />
        </div>
        <CanvasToolbar
          tool={canvasTool}
          onTool={setCanvasTool}
          zoom={canvasZoom}
          onZoom={setCanvasZoom}
          onFit={() => {
            setCanvasZoom(1);
            setCanvasPan({ x: 0, y: 0 });
          }}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undoDraft}
          onRedo={redoDraft}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="ui-btn-secondary text-[var(--danger)]"
            disabled={saving}
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className={saveStatus === "saved" ? "ui-btn-secondary" : "ui-btn-primary"}
            disabled={saving || saveStatus === "saving"}
            onClick={onSave}
          >
            {saveStatus === "saving"
              ? "Guardando…"
              : saveStatus === "unsaved"
                ? "Guardar"
                : "Guardado"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="shrink-0 bg-[var(--danger-soft)] px-4 py-2 text-[13px] text-[var(--danger)]">{error}</p>
      ) : null}

      <PhoneStage
        tool={canvasTool}
        zoom={canvasZoom}
        pan={canvasPan}
        onPan={setCanvasPan}
        onZoom={setCanvasZoom}
      >
        <SequentialPreview
          clips={clips}
          overlayEnabled={draft.overlayEnabled}
          overlayText={draft.overlayText}
          overlayStyle={draft.overlayStyle}
          overlayPosition={draft.overlayPosition}
          musicUrl={draft.musicEnabled ? draft.musicUrl : null}
          playing={playing}
          activeIndex={Math.max(0, Math.min(activeIndex, Math.max(0, clips.length - 1)))}
          onActiveIndex={(i) => {
            setActiveIndex(i);
            setClipProgress(0);
          }}
          onPlaying={setPlaying}
          seekFrac={clipProgress}
          scrubbing={scrubbing}
          onProgress={setClipProgress}
          onSourceDuration={(url, duration) => {
            setSourceLens((prev) =>
              prev[url] === duration ? prev : { ...prev, [url]: duration }
            );
          }}
        />
      </PhoneStage>

      <div className="relative z-30 shrink-0 border-t border-[var(--border)] bg-[var(--background)]">
        {selected?.kind === "overlay" && draft.overlayEnabled ? (
          <DockCard title="Texto" onClose={() => setSelected(null)}>
            <OverlayModePicker
              mode={draft.overlayMode === "prompt" ? "prompt" : "list"}
              part={parts.find((item) => item.id === draft.overlayPartId) || null}
              onMode={(overlayMode) => setDraft({ overlayMode })}
            />
            <OverlayTextEditor
              compact
              hideText={Boolean(draft.overlayPartId)}
              text={draft.overlayText}
              styleId={normalizeCaptionStyle(draft.overlayStyle)}
              position={normalizeOverlayPosition(draft.overlayPosition)}
              onText={(overlayText) => setDraft({ overlayText })}
              onStyle={(overlayStyle) => setDraft({ overlayStyle })}
              onPosition={(overlayPosition) => setDraft({ overlayPosition })}
            />
          </DockCard>
        ) : null}

        {selected?.kind === "music" && draft.musicEnabled ? (
          <DockCard title="Música" onClose={() => setSelected(null)}>
            <div className="flex flex-wrap gap-2">
              {musicTracks.map((track) => {
                const active = draft.musicAssetId === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                      active
                        ? "border-[var(--accent)] bg-white text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                    }`}
                    onClick={() => pickMusicTrack(track)}
                  >
                    {track.name}
                  </button>
                );
              })}
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={onUploadMusic}
              >
                Subir audio
              </button>
            </div>
          </DockCard>
        ) : null}

        <div className="relative">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-2.5">
          <div
            className={`flex min-w-0 items-center gap-2 ${
              selected?.kind === "video" ? "overflow-visible" : "overflow-x-auto"
            }`}
          >
            {selected?.kind === "video" && selectedVideo ? (
              <VideoClipTools
                canSplit={canSplit}
                splitHint={splitHint}
                canJoin={canJoin}
                muted={clipMuted[selected.index] !== false}
                onSplit={() => splitVideoAt(selected.index)}
                onDelete={() => setPendingDeleteIndex(selected.index)}
                onJoin={() => joinVideoWithNext(selected.index)}
                onReplace={() => setMenu(menu === "replace" ? null : "replace")}
                onSpeed={() => setMenu(menu === "speed" ? null : "speed")}
                onVolume={() =>
                  setClipMuted((list) =>
                    videoParts.map((_, i) =>
                      i === selected.index ? list[i] === false : list[i] !== false
                    )
                  )
                }
                onDownload={() => downloadClipAt(selected.index)}
              />
            ) : (
              <>
                <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                  Parts
                </p>
                {parts.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)] hover:border-[#93c5fd]"
                    onClick={() => {
                      if (part.kind === "music") applyMusicPart(part);
                      else if (part.kind === "overlay") applyOverlayPart(part);
                      else addVideoPart(part);
                    }}
                  >
                    {part.previewUrl ? (
                      <video src={part.previewUrl} muted playsInline className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded bg-[#eef2ff] text-[9px] font-bold text-[#4338ca]">
                        {DYNAMIC_PART_KIND_LABELS[part.kind].slice(0, 1)}
                      </span>
                    )}
                    {part.name}
                    <span className="text-[10px] text-[var(--muted-soft)]">
                      {DYNAMIC_PART_KIND_LABELS[part.kind]}
                    </span>
                  </button>
                ))}
              </>
            )}
            {selected && selected.kind !== "video" ? (
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-[var(--muted-soft)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                aria-label="Quitar del timeline"
                onClick={() => {
                  if (selected.kind === "overlay") {
                    setDraft({ overlayEnabled: false });
                    setSelected(null);
                  }
                  if (selected.kind === "music") {
                    setDraft({
                      musicEnabled: false,
                      musicAssetId: null,
                      musicName: null,
                      musicUrl: null,
                    });
                    setSelected(null);
                  }
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_0_0_1px_rgba(17,24,39,0.06)]">
            <PlayCircle playing={playing} onClick={() => setPlaying((v) => !v)} />
            <span className="flex items-center gap-2 text-[16px] font-medium leading-none tabular-nums text-[var(--foreground)]">
              {formatClock(clockNow)}
              <span className="inline-block h-4 w-px shrink-0 bg-[#d1d5db]" aria-hidden />
              {formatClock(totalSec)}
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto">
            <AddChip
              label="Mimic Motion"
              onClick={() => {
                setSelected(null);
                setMenu(menu === "part" ? null : "part");
              }}
            />
            <AddChip
              label="Música"
              onClick={() => {
                setSelected(null);
                setMenu(menu === "music" ? null : "music");
              }}
            />
            <AddChip
              label="Texto"
              onClick={() => {
                setSelected(null);
                setMenu(menu === "overlay" ? null : "overlay");
              }}
            />
            <AddChip
              label="Video"
              onClick={() => {
                setSelected(null);
                setMenu(menu === "video" ? null : "video");
              }}
            />
          </div>
        </div>
        {menu === "replace" && selected?.kind === "video" ? (
          <DockCard title="Reemplazar" align="left" onClose={() => setMenu(null)}>
            {partVideos.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {partVideos.map((video) => {
                  const chosenId = draft.videoAssetIds?.[selected.index];
                  const active = chosenId
                    ? chosenId === video.id
                    : clips[selected.index]?.url === video.publicUrl;
                  return (
                    <button
                      key={video.id}
                      type="button"
                      className={`shrink-0 overflow-hidden rounded-xl border ${
                        active
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                          : "border-[var(--border)]"
                      }`}
                      onClick={() => {
                        replaceVideoAt(selected.index, video);
                        setMenu(null);
                      }}
                    >
                      <video
                        src={video.publicUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-24 w-16 bg-[#111827] object-cover"
                      />
                      <span className="block max-w-[64px] truncate px-1 py-1 text-[10px] font-medium text-[var(--muted)]">
                        {video.partName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-[var(--muted-soft)]">
                Aún no hay videos en las parts. Ábrelas y súbelos ahí.
              </p>
            )}
          </DockCard>
        ) : null}
        {menu === "speed" && selected?.kind === "video" ? (
          <DockCard title="Velocidad" align="left" onClose={() => setMenu(null)}>
            <div className="flex flex-wrap gap-2">
              {[0.5, 1, 1.5, 2].map((rate) => {
                const active = (clipSpeeds[selected.index] || 1) === rate;
                return (
                  <button
                    key={rate}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      active
                        ? "bg-[#111827] text-white"
                        : "bg-[var(--surface-alt)] text-[var(--foreground)]"
                    }`}
                    onClick={() => {
                      setClipSpeeds((list) =>
                        videoParts.map((_, i) =>
                          i === selected.index ? rate : list[i] && list[i] > 0 ? list[i] : 1
                        )
                      );
                      setMenu(null);
                    }}
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>
          </DockCard>
        ) : null}
        {menu === "part" ? (
          <DockCard title="Mimic Motion" align="right" onClose={() => setMenu(null)}>
            {libraryMimic.length ? (
              libraryMimic.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                  onClick={() => addVideoPart(part)}
                >
                  {part.previewUrl ? (
                    <video src={part.previewUrl} muted playsInline className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded bg-[#eef2ff] text-[10px] font-bold text-[#4338ca]">
                      M
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--foreground)]">{part.name}</span>
                  <span className="shrink-0 text-[11px] text-[var(--muted-soft)]">
                    {DYNAMIC_PART_KIND_LABELS[part.kind]}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-[13px] text-[var(--muted-soft)]">
                Aún no hay parts de Mimic Motion.
              </p>
            )}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setMenu(null);
                onNewPart("mimic");
              }}
            >
              Nueva part de Mimic Motion
            </button>
          </DockCard>
        ) : null}
        {menu === "music" ? (
          <DockCard title="Música" align="right" onClose={() => setMenu(null)}>
            {libraryMusic.map((part) => (
              <button
                key={part.id}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                onClick={() => applyMusicPart(part)}
              >
                {part.name}
              </button>
            ))}
            {musicTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                onClick={() => pickMusicTrack(track)}
              >
                {track.name}
              </button>
            ))}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setMenu(null);
                onUploadMusic();
              }}
            >
              Subir audio
            </button>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setMenu(null);
                onNewPart("music");
              }}
            >
              Nueva part de música
            </button>
          </DockCard>
        ) : null}
        {menu === "overlay" ? (
          <DockCard title="Texto" align="right" onClose={() => setMenu(null)}>
            {libraryOverlay.map((part) => (
              <button
                key={part.id}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                onClick={() => applyOverlayPart(part)}
              >
                {part.name}
              </button>
            ))}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setDraft({ overlayEnabled: true, overlayText: draft.overlayText || "Texto" });
                setMenu(null);
                setSelected({ kind: "overlay" });
              }}
            >
              Añadir texto
            </button>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setMenu(null);
                onNewPart("overlay");
              }}
            >
              Nueva part de texto
            </button>
          </DockCard>
        ) : null}
        {menu === "video" ? (
          <DockCard title="Video" align="right" onClose={() => setMenu(null)}>
            {libraryVideo.map((part) => (
              <button
                key={part.id}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                onClick={() => addVideoPart(part)}
              >
                {part.name}
              </button>
            ))}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#2563eb]"
              onClick={() => {
                setMenu(null);
                onNewPart("video");
              }}
            >
              Nueva part de video
            </button>
          </DockCard>
        ) : null}
        </div>

        <div className="overflow-x-auto px-4 pb-4">
          <div
            ref={railRef}
            className="relative min-w-full select-none"
            style={{
              width: Math.max(520, ticks.length * TICK_SEC * PX_PER_SEC + GUTTER_W, tracksW + GUTTER_W),
            }}
          >
            <div
              className="relative mb-1 h-4 cursor-ew-resize touch-none"
              style={{ marginLeft: GUTTER_W }}
              onPointerDown={onScrubPointerDown}
              onPointerMove={onScrubPointerMove}
              onPointerUp={onScrubPointerUp}
            >
              <div className="flex h-full text-[10px] tabular-nums text-[var(--muted-soft)]">
                {ticks.map((t) => (
                  <span key={t} className="shrink-0" style={{ width: TICK_SEC * PX_PER_SEC }}>
                    {formatClock(t)}
                  </span>
                ))}
              </div>
            </div>

            <TrackRow label="Video" icon="▶" align="end">
              {videoParts.length ? (
                videoParts.map((part, i) => {
                  const on = selected?.kind === "video" && selected.index === i;
                  const playingHere = i === activeIndex;
                  const src = clips[i]?.url || part.previewUrl || "";
                  const dur = clipDurAt(draft, i);
                  const stripStart = stripStarts?.[i] ?? clipTrimAt(draft, i);
                  const stripLen = stripDurs?.[i] ?? dur;
                  return (
                    <div
                      key={`${part.id}-${i}`}
                      className="relative shrink-0 pt-6"
                      style={{
                        width: layout.widths[i],
                        marginRight: CLIP_GAP,
                      }}
                    >
                      {on ? (
                        <span className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--foreground)] shadow-[0_1px_2px_rgba(17,24,39,0.08),0_0_0_1px_rgba(17,24,39,0.06)]">
                          {formatClock(dur)}
                        </span>
                      ) : null}
                      <div
                        role="button"
                        tabIndex={0}
                        style={{ height: STRIP_H }}
                        className={`relative overflow-hidden rounded-[10px] text-left ${
                          on
                            ? "ring-2 ring-[#22d3ee]"
                            : playingHere
                              ? "ring-1 ring-[var(--accent)]"
                              : ""
                        }`}
                        onPointerDown={() => {
                          setMenu(null);
                          setSelected({ kind: "video", index: i });
                          setActiveIndex(i);
                          if (activeIndex !== i) setClipProgress(0);
                        }}
                        onClick={() => {
                          setMenu(null);
                          setSelected({ kind: "video", index: i });
                          setActiveIndex(i);
                          if (activeIndex !== i) setClipProgress(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          setSelected({ kind: "video", index: i });
                          setActiveIndex(i);
                        }}
                      >
                        {src ? (
                          <VideoFilmstrip src={src} start={stripStart} length={stripLen} />
                        ) : (
                          <span className="flex h-full items-end bg-[#e5e7eb] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)]">
                            {part.name}
                          </span>
                        )}
                        {on ? (
                          <>
                            <div className="pointer-events-none absolute inset-x-3 top-0 z-10 flex items-start px-1 pt-0.5">
                              <span className="min-w-0 truncate text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.7)]">
                                {clips[i]?.fileName || part.name}
                              </span>
                            </div>
                            <ClipHandle
                              side="left"
                              onPointerDown={(e) => onResizePointerDown(e, i, "left")}
                              onPointerMove={onResizePointerMove}
                              onPointerUp={onResizePointerUp}
                            />
                            <ClipHandle
                              side="right"
                              onPointerDown={(e) => onResizePointerDown(e, i, "right")}
                              onPointerMove={onResizePointerMove}
                              onPointerUp={onResizePointerUp}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <button
                  type="button"
                  className="w-full rounded-xl border border-dashed border-[var(--border-strong)] text-[12px] text-[var(--muted-soft)]"
                  style={{ height: STRIP_H }}
                  onClick={() => setMenu("video")}
                >
                  Añade parts de video en secuencia
                </button>
              )}
            </TrackRow>

            <TrackRow label="Texto" icon="Aa">
              {draft.overlayEnabled ? (
                <button
                  type="button"
                  style={{ width: tracksW }}
                  className={`h-9 rounded-lg px-3 text-left text-[12px] font-semibold ${
                    selected?.kind === "overlay"
                      ? "bg-[#fef3c7] ring-2 ring-[#fbbf24]"
                      : "bg-[#fde68a] text-[#78350f]"
                  }`}
                  onClick={() => {
                    setMenu(null);
                    setSelected({ kind: "overlay" });
                  }}
                >
                  {overlayTrackLabel(draft, parts)}
                </button>
              ) : (
                <button
                  type="button"
                  className="h-9 w-full rounded-lg border border-dashed border-[var(--border-strong)] text-[12px] text-[var(--muted-soft)]"
                  onClick={() => {
                    setMenu(null);
                    setDraft({ overlayEnabled: true, overlayText: draft.overlayText || "Texto" });
                    setSelected({ kind: "overlay" });
                  }}
                >
                  Añadir texto
                </button>
              )}
            </TrackRow>

            <TrackRow label="Música" icon="♪">
              {draft.musicEnabled ? (
                <button
                  type="button"
                  style={{ width: tracksW }}
                  className={`h-9 rounded-lg bg-[#dbeafe] px-3 text-left text-[12px] font-semibold text-[#1e3a8a] ${
                    selected?.kind === "music" ? "ring-2 ring-[#60a5fa]" : ""
                  }`}
                  onClick={() => {
                    setMenu(null);
                    setSelected({ kind: "music" });
                  }}
                >
                  {draft.musicName || "Música"}
                </button>
              ) : (
                <button
                  type="button"
                  className="h-9 w-full rounded-lg border border-dashed border-[var(--border-strong)] text-[12px] text-[var(--muted-soft)]"
                  onClick={() => setMenu("music")}
                >
                  Añadir música
                </button>
              )}
            </TrackRow>

            <div
              className="pointer-events-none absolute top-0 z-20 flex w-8 -translate-x-1/2 select-none flex-col items-center"
              style={{ left: playheadLeft, height: 16 + 24 + STRIP_H + 10 }}
            >
              <div
                className="pointer-events-auto flex cursor-ew-resize touch-none flex-col items-center"
                onPointerDown={onScrubPointerDown}
                onPointerMove={onScrubPointerMove}
                onPointerUp={onScrubPointerUp}
              >
                <div className="h-[15px] w-[13px] rounded-[4px] bg-[#111827] shadow-sm" />
                <div className="h-0 w-0 border-x-[6.5px] border-t-[7px] border-x-transparent border-t-[#111827]" />
              </div>
              <div className="w-px flex-1 bg-[#111827]" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function TrackRow({
  label,
  icon,
  align = "center",
  children,
}: {
  label: string;
  icon: string;
  align?: "center" | "end";
  children: ReactNode;
}) {
  return (
    <div className={`mb-1.5 flex ${align === "end" ? "items-end" : "items-center"}`}>
      <span
        className="flex h-9 w-[88px] shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]"
        style={{ width: GUTTER_W }}
      >
        <span className="grid h-6 w-6 place-items-center rounded bg-white text-[11px] text-[var(--foreground)]">
          {icon}
        </span>
        {label}
      </span>
      <div className={`flex min-h-9 min-w-0 flex-1 ${align === "end" ? "items-end" : "items-center"}`}>
        {children}
      </div>
    </div>
  );
}
