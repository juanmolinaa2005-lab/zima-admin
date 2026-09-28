"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../icons";
import {
  normalizeCaptionStyle,
  normalizeOverlayPosition,
  overlayPositionClass,
  type CaptionStyleId,
} from "@/lib/creator/overlay-styles";

const MUTE_KEY = "zima:estudio-v1:video-muted";
const active = new Set<HTMLVideoElement>();

function pauseOthers(el: HTMLVideoElement) {
  for (const other of active) {
    if (other !== el) other.pause();
  }
  active.add(el);
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(value: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.4 5.6v12.8c0 .7.8 1.1 1.4.7l9.2-6.4c.5-.4.5-1.1 0-1.5L9.8 4.9c-.6-.4-1.4 0-1.4.7Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5.5h3.2v13H7zM13.8 5.5H17v13h-3.2z" />
    </svg>
  );
}

function VolumeIcon({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5V9.5Z"
        fill="currentColor"
      />
      {muted ? (
        <path
          d="M16 10.2 20 14.2M20 10.2 16 14.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M15.5 9.2a4.2 4.2 0 0 1 0 5.6M18 7.2a7.2 7.2 0 0 1 0 9.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function seekFromClientX(el: HTMLElement, clientX: number, duration: number) {
  const rect = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * (duration || 0);
}

export function OverlayCaption({
  text,
  styleId,
  position,
}: {
  text: string;
  styleId?: string | null;
  position?: string | null;
}) {
  const t = text.trim();
  if (!t) return null;
  const style = normalizeCaptionStyle(styleId);
  const pos = overlayPositionClass(normalizeOverlayPosition(position));
  if (style === "snapchat") {
    return (
      <div className={`pointer-events-none absolute inset-x-0 z-[8] ${pos}`}>
        <div className="bg-black px-3 py-2">
          <p className="text-center text-[12px] font-semibold leading-[1.15] text-white sm:text-[13px]">
            {t}
          </p>
        </div>
      </div>
    );
  }
  if (style === "blitz") {
    return (
      <div className={`pointer-events-none absolute inset-x-0 z-[8] flex justify-center px-5 ${pos}`}>
        <p className="max-w-[82%] rounded-md bg-white px-2.5 py-1.5 text-center text-[12px] font-semibold leading-[1.25] text-[var(--foreground)] sm:text-[13px]">
          {t}
        </p>
      </div>
    );
  }
  if (style === "impact") {
    return (
      <p
        className={`pointer-events-none absolute inset-x-3 z-[8] text-center text-[18px] font-black uppercase leading-[1.05] text-white sm:text-[20px] ${pos}`}
        style={{
          WebkitTextStroke: "4px #000",
          paintOrder: "stroke fill",
        }}
      >
        {t}
      </p>
    );
  }
  if (style === "yellow") {
    return (
      <p
        className={`pointer-events-none absolute inset-x-4 z-[8] text-center text-[15px] font-extrabold leading-[1.15] text-[#FFD400] sm:text-[16px] ${pos}`}
        style={{
          WebkitTextStroke: "3px #000",
          paintOrder: "stroke fill",
        }}
      >
        {t}
      </p>
    );
  }
  if (style === "karaoke") {
    return (
      <p className={`pointer-events-none absolute inset-x-4 z-[8] text-center text-[13px] font-medium tracking-wide text-white sm:text-[14px] ${pos}`}>
        {t}
      </p>
    );
  }
  if (style === "script") {
    return (
      <p
        className={`pointer-events-none absolute inset-x-4 z-[8] text-center text-[18px] leading-[1.2] text-white sm:text-[20px] ${pos}`}
        style={{ fontFamily: "Pacifico, cursive" }}
      >
        {t}
      </p>
    );
  }
  return (
    <p
      className={`pointer-events-none absolute inset-x-4 z-[8] text-center text-[14px] font-semibold leading-[1.2] text-white sm:text-[15px] ${pos}`}
      style={{
        WebkitTextStroke: "2.5px #000",
        paintOrder: "stroke fill",
      }}
    >
      {t}
    </p>
  );
}

export function SnapCaption({
  text,
  styleId,
  position,
}: {
  text: string;
  styleId?: string | null;
  position?: string | null;
}) {
  return <OverlayCaption text={text} styleId={styleId} position={position} />;
}

export function CaptionStyleSwatch({
  styleId,
  active,
}: {
  styleId: CaptionStyleId;
  active?: boolean;
}) {
  const frame =
    styleId === "blitz"
      ? "bg-white"
      : "bg-black";
  const aa =
    styleId === "blitz"
      ? "text-[var(--foreground)]"
      : styleId === "yellow"
        ? "text-[#FFD400]"
        : "text-white";
  const weight =
    styleId === "impact"
      ? "text-[17px] font-black"
      : styleId === "script"
        ? "text-[16px] font-normal"
        : "text-[14px] font-semibold";
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-[10px] border ${frame} ${
        active ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <span
        className={`${aa} ${weight} leading-none ${
          styleId === "snapchat" ? "bg-white/25 px-1 py-[1px]" : ""
        }`}
        style={
          styleId === "impact" || styleId === "tiktok" || styleId === "yellow"
            ? { WebkitTextStroke: styleId === "impact" ? "2px #000" : "1.2px #000", paintOrder: "stroke fill" }
            : styleId === "script"
              ? { fontFamily: "Pacifico, cursive" }
              : undefined
        }
      >
        Aa
      </span>
    </span>
  );
}

export function StudioVideoPlayer({
  src,
  fallbackSrc,
  poster,
  caption,
  captionStyle,
  captionPosition,
}: {
  src: string;
  fallbackSrc?: string;
  poster?: string;
  caption?: string | null;
  captionStyle?: string | null;
  captionPosition?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const theaterRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const theaterBarRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [srcOverride, setSrcOverride] = useState<string | null>(null);
  const dragging = useRef(false);
  const playSrc = srcOverride || src;

  useEffect(() => {
    setSrcOverride(null);
  }, [src]);

  useEffect(() => {
    setMounted(true);
    setMuted(readMuted());
  }, []);

  const bind = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return () => undefined;
    const onTime = () => {
      if (!dragging.current) setTime(el.currentTime);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onPlay = () => {
      pauseOthers(el);
      setPaused(false);
    };
    const onPause = () => setPaused(true);
    const onEnd = () => {
      if (!el.loop) setPaused(true);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
      active.delete(el);
    };
  }, []);

  const setInlineNode = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (!el) return;
      return bind(el);
    },
    [bind]
  );

  const setTheaterNode = useCallback(
    (el: HTMLVideoElement | null) => {
      theaterRef.current = el;
      if (!el) return;
      const cleanup = bind(el);
      const inline = videoRef.current;
      el.currentTime = inline?.currentTime ?? 0;
      el.muted = inline?.muted ?? false;
      if (inline && !inline.paused) {
        inline.pause();
        void el.play();
      }
      return cleanup;
    },
    [bind]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
    const theater = theaterRef.current;
    if (theater) theater.muted = muted;
    writeMuted(muted);
  }, [muted]);

  const toggle = useCallback(async () => {
    const el = expanded ? theaterRef.current : videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = muted;
      try {
        await el.play();
      } catch {
        el.muted = true;
        setMuted(true);
        await el.play().catch(() => undefined);
      }
    } else {
      el.pause();
    }
  }, [expanded, muted]);

  const closeTheater = useCallback(() => {
    const theater = theaterRef.current;
    const inline = videoRef.current;
    const t = theater?.currentTime ?? 0;
    const wasPlaying = theater ? !theater.paused : false;
    theater?.pause();
    if (inline) {
      inline.currentTime = t;
      inline.muted = muted;
      if (wasPlaying) void inline.play();
    }
    setTime(t);
    setExpanded(false);
  }, [muted]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTheater();
      if (e.key === " " || e.key.toLowerCase() === "k") {
        e.preventDefault();
        void toggle();
      }
      if (e.key.toLowerCase() === "m") setMuted((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeTheater, toggle]);

  function onBarPointer(e: ReactPointerEvent<HTMLDivElement>, theater: boolean) {
    const bar = theater ? theaterBarRef.current : barRef.current;
    const el = theater ? theaterRef.current : videoRef.current;
    if (!bar || !el || !duration) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = seekFromClientX(bar, e.clientX, duration);
    el.currentTime = next;
    setTime(next);
  }

  function onBarMove(e: ReactPointerEvent<HTMLDivElement>, theater: boolean) {
    if (!dragging.current) return;
    const bar = theater ? theaterBarRef.current : barRef.current;
    const el = theater ? theaterRef.current : videoRef.current;
    if (!bar || !el || !duration) return;
    const next = seekFromClientX(bar, e.clientX, duration);
    el.currentTime = next;
    setTime(next);
  }

  function onBarUp() {
    dragging.current = false;
  }

  const showScrim = paused || hovering || expanded;
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  function chrome(theater: boolean) {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/10 transition-opacity duration-200 ${
            showScrim ? "opacity-100" : "opacity-0"
          }`}
        />
        {paused ? (
          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[var(--foreground)] shadow-lg hover:bg-white"
            aria-label="Reproducir"
            onClick={(e) => {
              e.stopPropagation();
              void toggle();
            }}
          >
            <PlayIcon className="ml-0.5 h-5 w-5" />
          </button>
        ) : null}
        <div
          className="pointer-events-auto absolute inset-x-0 bottom-0 space-y-1.5 px-2 pb-2 pt-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={theater ? theaterBarRef : barRef}
            className="group/bar cursor-pointer py-1"
            onPointerDown={(e) => onBarPointer(e, theater)}
            onPointerMove={(e) => onBarMove(e, theater)}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
          >
            <div className="h-1 overflow-hidden rounded-full bg-white/30 group-hover/bar:h-1.5">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-0.5 text-white">
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-white/15"
              aria-label={paused ? "Reproducir" : "Pausar"}
              onClick={() => void toggle()}
            >
              {paused ? (
                <PlayIcon className="h-4 w-4" />
              ) : (
                <PauseIcon className="h-4 w-4" />
              )}
            </button>
            <span className="min-w-0 flex-1 text-[11px] font-medium tabular-nums text-white/90">
              {formatTime(time)}
              <span className="text-white/50"> / {formatTime(duration)}</span>
            </span>
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-white/15"
              aria-label={muted ? "Activar sonido" : "Silenciar"}
              onClick={() => setMuted((v) => !v)}
            >
              <VolumeIcon muted={muted} className="h-4 w-4" />
            </button>
            {theater ? null : (
              <button
                type="button"
                className="rounded-lg p-1.5 hover:bg-white/15"
                aria-label="Ampliar"
                onClick={() => setExpanded(true)}
              >
                <ExpandIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative aspect-[9/16] w-full cursor-pointer bg-black"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => void toggle()}
      >
        <video
          ref={setInlineNode}
          src={playSrc}
          poster={poster}
          className="h-full w-full object-cover"
          playsInline
          preload="metadata"
          loop
          muted={muted}
          onError={() => {
            if (fallbackSrc && playSrc !== fallbackSrc) setSrcOverride(fallbackSrc);
          }}
        />
        {caption ? <OverlayCaption text={caption} styleId={captionStyle} position={captionPosition} /> : null}
        {chrome(false)}
      </div>
      {mounted && expanded
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
                aria-label="Cerrar"
                onClick={closeTheater}
              />
              <div
                className="relative aspect-[9/16] h-[min(86dvh,calc(90vw*16/9))] max-h-[86dvh] cursor-pointer overflow-hidden rounded-[24px] bg-black shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onClick={() => void toggle()}
              >
                <button
                  type="button"
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"
                  aria-label="Cerrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTheater();
                  }}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
                <video
                  ref={setTheaterNode}
                  src={playSrc}
                  poster={poster}
                  className="h-full w-full object-contain"
                  playsInline
                  preload="auto"
                  loop
                  muted={muted}
                  onError={() => {
                    if (fallbackSrc && playSrc !== fallbackSrc) setSrcOverride(fallbackSrc);
                  }}
                />
                {caption ? <OverlayCaption text={caption} styleId={captionStyle} position={captionPosition} /> : null}
                {chrome(true)}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
