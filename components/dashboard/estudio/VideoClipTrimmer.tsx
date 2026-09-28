"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MOTION_CLONE_MAX_SEC,
  MOTION_CLONE_MIN_SEC,
  MOTION_CLONE_TRIM_MIN_SEC,
} from "@/lib/creator/motion-control";

const FPS = 30;
const FRAME = 1 / FPS;

function snapFrame(sec: number, duration: number) {
  const snapped = Math.round(Math.max(0, sec) / FRAME) * FRAME;
  return Math.min(duration, Math.max(0, Number(snapped.toFixed(4))));
}

function formatTimecode(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.00";
  const frames = Math.max(0, Math.round(sec * FPS));
  const whole = Math.floor(frames / FPS);
  const frame = frames % FPS;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}.${String(frame).padStart(2, "0")}`;
}

function waitSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(finish, 800);
    function finish() {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    }
    video.addEventListener("seeked", finish);
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number
) {
  const vw = video.videoWidth || 9;
  const vh = video.videoHeight || 16;
  const scale = Math.max(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

async function extractFrames(src: string, duration: number, count: number) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), 8000);
      video.onloadeddata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("video"));
      };
    });
    const canvas = document.createElement("canvas");
    canvas.width = 72;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const frames: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const at = Math.min(duration - 0.04, (duration * (i + 0.5)) / count);
      video.currentTime = Math.max(0, at);
      await waitSeek(video);
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, video, canvas.width, canvas.height);
      try {
        frames.push(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        return frames;
      }
    }
    return frames;
  } catch {
    return [];
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

type DragMode = "start" | "end" | "move" | "playhead";

export function VideoClipTrimmer(opts: {
  src: string;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    originX: number;
    originStart: number;
    originEnd: number;
  } | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(opts.start);
  const playheadRef = useRef(opts.start);
  const [frames, setFrames] = useState<string[]>([]);
  const [edge, setEdge] = useState<DragMode>("playhead");
  const maxWindow = MOTION_CLONE_MAX_SEC;
  const minWindow = MOTION_CLONE_TRIM_MIN_SEC;
  const duration = mediaDuration > 0 ? mediaDuration : Math.max(opts.end, minWindow);
  const windowSec = Math.max(0, opts.end - opts.start);
  const willLoop = windowSec + 0.05 < MOTION_CLONE_MIN_SEC && duration >= minWindow;
  const locked = Boolean(opts.disabled) || duration < minWindow;

  useEffect(() => {
    setFrames([]);
    setMediaDuration(0);
    setPlayhead(opts.start);
    setPlaying(false);
  }, [opts.src]);

  useEffect(() => {
    if (mediaDuration <= 0) return;
    let cancelled = false;
    const count = Math.min(16, Math.max(8, Math.round(mediaDuration * 1.6)));
    void extractFrames(opts.src, mediaDuration, count).then((next) => {
      if (!cancelled) setFrames(next);
    });
    return () => {
      cancelled = true;
    };
  }, [opts.src, mediaDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (dragRef.current) return;
      const time = video.currentTime;
      if (time >= opts.end - 0.03) {
        video.currentTime = opts.start;
        playheadRef.current = opts.start;
        setPlayhead(opts.start);
        if (video.paused) setPlaying(false);
        return;
      }
      playheadRef.current = time;
      setPlayhead(time);
    };
    const onPause = () => {
      if (!dragRef.current) setPlaying(false);
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
    };
  }, [opts.end, opts.start]);

  function seek(sec: number) {
    const video = videoRef.current;
    const next = snapFrame(sec, duration);
    playheadRef.current = next;
    setPlayhead(next);
    if (video && Math.abs(video.currentTime - next) > 0.008) {
      video.currentTime = next;
    }
  }

  function pause() {
    videoRef.current?.pause();
    setPlaying(false);
  }

  function clampWindow(nextStart: number, nextEnd: number, changed: "start" | "end") {
    let start = snapFrame(nextStart, duration);
    let end = snapFrame(nextEnd, duration);
    if (end < start) {
      if (changed === "start") start = end;
      else end = start;
    }
    if (end - start < minWindow) {
      if (changed === "start") start = snapFrame(Math.max(0, end - minWindow), duration);
      else end = snapFrame(Math.min(duration, start + minWindow), duration);
    }
    if (end - start > maxWindow) {
      if (changed === "start") start = snapFrame(end - maxWindow, duration);
      else end = snapFrame(start + maxWindow, duration);
    }
    start = snapFrame(Math.max(0, start), duration);
    end = snapFrame(Math.min(duration, Math.max(start + minWindow, end)), duration);
    if (Math.abs(start - opts.start) > 0.004 || Math.abs(end - opts.end) > 0.004) {
      opts.onChange(start, end);
    }
    seek(changed === "start" ? start : end);
  }

  function timeAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function onTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (locked) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    pause();
    const x = event.clientX - rect.left;
    const startPx = (opts.start / duration) * rect.width;
    const endPx = (opts.end / duration) * rect.width;
    let mode: DragMode = "playhead";
    if (Math.abs(x - startPx) <= 14) mode = "start";
    else if (Math.abs(x - endPx) <= 14) mode = "end";
    else if (x > startPx && x < endPx) mode = "move";
    dragRef.current = {
      mode,
      originX: event.clientX,
      originStart: opts.start,
      originEnd: opts.end,
    };
    setEdge(mode);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "playhead") seek(timeAt(event.clientX));
    if (mode === "start") seek(opts.start);
    if (mode === "end") seek(opts.end);
  }

  function onTrackPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!drag || !rect || rect.width <= 0) return;
    const delta = ((event.clientX - drag.originX) / rect.width) * duration;
    if (drag.mode === "playhead") {
      seek(timeAt(event.clientX));
      return;
    }
    if (drag.mode === "start") {
      clampWindow(drag.originStart + delta, drag.originEnd, "start");
      return;
    }
    if (drag.mode === "end") {
      clampWindow(drag.originStart, drag.originEnd + delta, "end");
      return;
    }
    const len = drag.originEnd - drag.originStart;
    let start = drag.originStart + delta;
    let end = drag.originEnd + delta;
    if (start < 0) {
      start = 0;
      end = len;
    }
    if (end > duration) {
      end = duration;
      start = duration - len;
    }
    const nextStart = snapFrame(start, duration);
    const nextEnd = snapFrame(Math.min(duration, nextStart + len), duration);
    if (
      Math.abs(nextStart - opts.start) > 0.004 ||
      Math.abs(nextEnd - opts.end) > 0.004
    ) {
      opts.onChange(nextStart, nextEnd);
    }
    seek(nextStart);
  }

  function onTrackPointerUp() {
    dragRef.current = null;
  }

  function step(dir: -1 | 1) {
    if (locked) return;
    pause();
    if (edge === "start") {
      clampWindow(opts.start + dir * FRAME, opts.end, "start");
      return;
    }
    if (edge === "end") {
      clampWindow(opts.start, opts.end + dir * FRAME, "end");
      return;
    }
    seek(playheadRef.current + dir * FRAME);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video || locked) return;
    if (playing) {
      pause();
      return;
    }
    const from = playhead < opts.start || playhead >= opts.end - FRAME ? opts.start : playhead;
    video.currentTime = from;
    setPlayhead(from);
    void video.play().then(
      () => setPlaying(true),
      () => setPlaying(false)
    );
  }

  const startPct = duration > 0 ? (opts.start / duration) * 100 : 0;
  const endPct = duration > 0 ? (opts.end / duration) * 100 : 100;
  const headPct = duration > 0 ? (playhead / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={opts.src}
        playsInline
        muted
        preload="auto"
        className="aspect-[9/16] max-h-64 w-full rounded-2xl bg-black object-contain"
        onLoadedMetadata={(event) => {
          const d = event.currentTarget.duration;
          if (!Number.isFinite(d) || d <= 0) return;
          setMediaDuration(d);
          if (d < minWindow) {
            opts.onChange(0, d);
            seek(0);
            return;
          }
          const start = Math.min(opts.start, Math.max(0, d - minWindow));
          let end = Math.min(
            d,
            Math.max(start + minWindow, opts.end || Math.min(maxWindow, d))
          );
          if (end - start > maxWindow) end = start + maxWindow;
          if (end - start < minWindow) end = Math.min(d, start + minWindow);
          const snappedStart = snapFrame(start, d);
          const snappedEnd = snapFrame(end, d);
          if (snappedStart !== opts.start || snappedEnd !== opts.end) {
            opts.onChange(snappedStart, snappedEnd);
          }
          seek(snappedStart);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] tabular-nums text-[var(--muted)]">
          {formatTimecode(opts.start)} – {formatTimecode(opts.end)}
          <span className="text-[var(--muted-soft)]"> · {windowSec.toFixed(2)} s</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)] disabled:opacity-40"
            aria-label="Fotograma anterior"
            title="Fotograma anterior"
            disabled={locked}
            onClick={() => step(-1)}
          >
            <FrameIcon dir="prev" />
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)] disabled:opacity-40"
            disabled={locked}
            onClick={togglePlay}
          >
            {playing ? "Pausa" : "Ver recorte"}
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)] disabled:opacity-40"
            aria-label="Fotograma siguiente"
            title="Fotograma siguiente"
            disabled={locked}
            onClick={() => step(1)}
          >
            <FrameIcon dir="next" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-label="Línea de fotogramas"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * FPS)}
        aria-valuenow={Math.round(playhead * FPS)}
        className="relative h-16 cursor-pointer select-none overflow-hidden rounded-xl bg-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          step(event.key === "ArrowRight" ? 1 : -1);
        }}
      >
        <div className="absolute inset-0 flex">
          {frames.length > 0 ? (
            frames.map((frame, index) => (
              <img
                key={`${opts.src}-${index}`}
                src={frame}
                alt=""
                draggable={false}
                className="h-full min-w-0 flex-1 object-cover"
              />
            ))
          ) : (
            <div className="h-full w-full bg-[repeating-linear-gradient(90deg,#1f2937_0,#1f2937_10px,#111827_10px,#111827_18px)]" />
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
          style={{ width: `${Math.max(0, 100 - endPct)}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-white"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <TrimHandle left={startPct} active={edge === "start"} />
        <TrimHandle left={endPct} active={edge === "end"} />
        <div
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white"
          style={{ left: `${headPct}%` }}
        >
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-b-sm bg-white" />
        </div>
      </div>
      <p className="text-[11px] text-[var(--muted-soft)]">
        {edge === "start"
          ? "Ajustando el inicio, fotograma a fotograma."
          : edge === "end"
            ? "Ajustando el fin, fotograma a fotograma."
            : "Arrastra los bordes. Las flechas mueven un fotograma."}
        {duration > maxWindow ? ` Máximo ${maxWindow} s.` : ""}
      </p>
      {willLoop ? (
        <p className="text-[12px] text-[var(--muted)]">
          Dura menos de {MOTION_CLONE_MIN_SEC} s: se duplicará el recorte para Kling.
        </p>
      ) : null}
    </div>
  );
}

function TrimHandle({ left, active }: { left: number; active: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-10 w-2.5 -translate-x-1/2 ${
        active ? "bg-white" : "bg-white/90"
      }`}
      style={{ left: `${left}%` }}
    >
      <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#111827]/50" />
    </div>
  );
}

function FrameIcon({ dir }: { dir: "prev" | "next" }) {
  const left = dir === "prev";
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={left ? "M14 6 8 12l6 6" : "M10 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
