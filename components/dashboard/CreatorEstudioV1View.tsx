"use client";

import {
  useEffect,
  useRef,
  useState,
  Fragment,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { VIDEO_PRESETS } from "@/lib/higgsfield/presets";
import {
  ESTUDIO_FORMATS,
  destFolderForSource,
  formatLabel,
  loadAutomations,
  loadBaseIdea,
  loadBlitzCarousels,
  loadBlitzSettings,
  loadInfluencers,
  loadPieces,
  loadProductContext,
  newId,
  saveAutomations,
  saveBaseIdea,
  saveBlitzCarousels,
  saveBlitzSettings,
  saveInfluencers,
  type BlitzCarousel,
  type BlitzGenSettings,
  type EstudioAutomation,
  type EstudioFormatId,
  type EstudioInfluencer,
  type EstudioPiece,
  type EstudioSectionId,
} from "@/lib/creator/estudio-v1";
import {
  cacheBlitzImage,
  cachedBlitzSrc,
  pinBlitzImages,
  prefetchBlitzImages,
  subscribeBlitzImageCache,
} from "@/lib/creator/blitz-image-cache";
import { composeBlitzSlide } from "@/lib/creator/blitz-compose";
import { ApiMissingBanner } from "./ApiMissingBanner";
import {
  CreatorImagenHome,
  useImageQueueWorker,
} from "./estudio/CreatorImagenHome";
import { InfluencersHome } from "./estudio/InfluencersHome";
import { AppDemoHome } from "./estudio/AppDemoHome";
import { SimuladorHome } from "./estudio/SimuladorHome";
import { DynamicsHome } from "./estudio/DynamicsHome";
import { EstudioMobileNav, EstudioSidebar } from "./estudio/EstudioSidebar";
import { GalleryView } from "./GalleryView";
import { RedesView } from "./RedesView";
import { CloseIcon, PlusIcon } from "./icons";

type HiggsStatus = {
  connected: boolean;
  keyHint: string | null;
};

type AiJob = {
  requestId: string;
  prompt: string;
  status: string;
  videoUrl: string | null;
  imageUrl: string | null;
  error: string | null;
  createdAt: string;
};

function jobsKey(projectId: string) {
  return `zima:estudio-v1:ai-jobs:${projectId}`;
}

function loadJobs(projectId: string): AiJob[] {
  try {
    const raw = localStorage.getItem(jobsKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistJobs(projectId: string, jobs: AiJob[]) {
  try {
    localStorage.setItem(jobsKey(projectId), JSON.stringify(jobs.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function CreatorEstudioV1View({
  projectId,
  initialSection,
  onSectionChange,
  onOpenGallery,
}: {
  projectId: string;
  initialSection?: EstudioSectionId;
  onSectionChange?: (id: EstudioSectionId) => void;
  onOpenGallery?: () => void;
}) {
  const [section, setSection] = useState<EstudioSectionId>(initialSection ?? "influencers");
  const [pieces, setPieces] = useState<EstudioPiece[]>([]);
  const [influencers, setInfluencers] = useState<EstudioInfluencer[]>([]);
  const [automations, setAutomations] = useState<EstudioAutomation[]>([]);
  const imageQueues = useImageQueueWorker(projectId);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setPieces(loadPieces(projectId));
    setInfluencers(loadInfluencers(projectId));
    setAutomations(loadAutomations(projectId));
  }, [projectId]);

  function go(id: EstudioSectionId) {
    setSection(id);
    onSectionChange?.(id);
  }

  return (
    <div className="studio-shell flex h-full min-h-0">
      <EstudioSidebar
        section={section}
        imageQueueCount={imageQueues.activeCount}
        onSelect={go}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EstudioMobileNav section={section} onSelect={go} />
        <div
          className={`min-h-0 flex-1 ${
            section === "library" ||
            section === "dynamics" ||
            section === "redes"
              ? "overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
        {section === "dynamics" ? (
          <DynamicsHome projectId={projectId} />
        ) : null}
        {section === "library" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-[var(--border)] px-5 py-3.5 sm:px-6">
              <p className="studio-kicker">Archivo</p>
              <h2 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
                Galería
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <GalleryView projectId={projectId} />
            </div>
          </div>
        ) : null}
        {section === "creator-imagen" ? (
          <CreatorImagenHome
            projectId={projectId}
            queues={imageQueues.queues}
            reload={imageQueues.reload}
          />
        ) : null}
        {section === "influencers" ? (
          <InfluencersHome
            projectId={projectId}
            influencers={influencers}
            onChange={(next) => {
              setInfluencers(next);
              saveInfluencers(projectId, next);
            }}
          />
        ) : null}
        {section === "app-demo" ? (
          <AppDemoHome projectId={projectId} />
        ) : null}
        {section === "simulador" ? (
          <SimuladorHome projectId={projectId} />
        ) : null}
        {section === "redes" ? (
          <RedesView projectId={projectId} onOpenGallery={onOpenGallery} />
        ) : null}
      </div>
      </div>
    </div>
  );
}

function StudioHome({
  pieces,
  onOpenContent,
  onOpenBlitz,
  onOpenLibrary,
}: {
  pieces: EstudioPiece[];
  onOpenContent: () => void;
  onOpenBlitz: () => void;
  onOpenLibrary: () => void;
}) {
  const drafts = pieces.filter((p) => p.status === "draft").length;
  const approved = pieces.filter((p) => p.status === "approved").length;
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <h2 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
        Home
      </h2>
      <p className="mt-1 text-[14px] text-[var(--muted-soft)]">
        Crea, revisa y publica contenido corto desde un solo sitio.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenContent}
          className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:border-[#93c5fd]"
        >
          <p className="text-[12px] font-medium text-[var(--muted)]">Content</p>
          <p className="mt-1 text-[22px] font-semibold">Nuevo</p>
        </button>
        <button
          type="button"
          onClick={onOpenBlitz}
          className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:border-[#93c5fd]"
        >
          <p className="text-[12px] font-medium text-[var(--muted)]">Blitz</p>
          <p className="mt-1 text-[22px] font-semibold">{drafts}</p>
        </button>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:border-[#93c5fd]"
        >
          <p className="text-[12px] font-medium text-[var(--muted)]">Library</p>
          <p className="mt-1 text-[22px] font-semibold">{approved}</p>
        </button>
      </div>
    </div>
  );
}

function CalendarHome({ pieces }: { pieces: EstudioPiece[] }) {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <h2 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
        Calendar
      </h2>
      <p className="mt-1 text-[14px] text-[var(--muted-soft)]">
        Lo aprobado aparece aquí para programar.
      </p>
      {pieces.filter((p) => p.status === "approved").length === 0 ? (
        <EmptyPanel
          title="Nada programado"
          body="Aprueba piezas en Blitz y luego las verás en el calendario."
        />
      ) : (
        <ul className="mt-6 space-y-2">
          {pieces
            .filter((p) => p.status === "approved")
            .map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              >
                <p className="text-[14px] font-semibold text-[var(--foreground)]">
                  {p.overlay || formatLabel(p.formatId)}
                </p>
                <p className="text-[12px] text-[var(--muted-soft)]">
                  {formatLabel(p.formatId)} · {formatDate(p.createdAt)}
                </p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function AnalyticsHome({
  pieces,
  automations,
  influencers,
}: {
  pieces: EstudioPiece[];
  automations: number;
  influencers: number;
}) {
  const approved = pieces.filter((p) => p.status === "approved").length;
  const drafts = pieces.filter((p) => p.status === "draft").length;
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <h2 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
        Analytics
      </h2>
      <p className="mt-1 text-[14px] text-[var(--muted-soft)]">
        Volumen de producción en este proyecto.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Piezas", pieces.length],
          ["Borradores", drafts],
          ["Aprobadas", approved],
          ["Automatizaciones", automations],
          ["Influencers", influencers],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[var(--border)] bg-white p-4"
          >
            <p className="text-[12px] font-medium text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-[22px] font-semibold text-[var(--foreground)]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const BLITZ_DECK = [
  {
    imageUrl:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80",
    overlay:
      "Reminder capture tips for when typing feels like too much (and speaking is easier)",
    format: "Slideshow",
    angle: "Voice-First Accessibility",
    why: "People already try to capture ideas while their hands are busy. A voice-first hook matches that moment better than a feature list.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80",
    overlay:
      "The reminder shows up while you're cooking. Typing it out feels like too much — so you just say it.",
    format: "Slideshow",
    angle: "Hands-busy moment",
    why: "The messy real-life interrupt is the hook. The product is the fix, not the opening line.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
    overlay:
      "Your product already solves this. Lead with the messy moment, not the feature list.",
    format: "Talking Head UGC",
    angle: "Problem-first hook",
    why: "UGC works when it sounds like a friend noticing the same friction — then the product appears as the obvious next step.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
    overlay:
      "Keep the caption in their voice. Short lines, no brand speak, one clear next step.",
    format: "Wall of Text",
    angle: "Native caption",
    why: "Captions that sound like the comments section get saved. Brand voice gets skipped.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    overlay:
      "If you can say the reminder out loud, you can ship the idea before it disappears.",
    format: "Video Hook & Demo",
    angle: "Speak, don't type",
    why: "The demo should start after the spoken hook lands. Don't show UI until the pain is obvious.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80",
    overlay:
      "This is the version you'd send a friend at 11pm, not the one you'd put on a landing page.",
    format: "Talking Head UGC",
    angle: "Late-night energy",
    why: "Casual delivery reads as authentic. Polish can wait until they already care.",
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
    overlay:
      "One beat, one payoff. If they remember the line, they'll remember the product.",
    format: "Slideshow",
    angle: "Single-line memory",
    why: "A short spoken line is easier to remix and reuse than a paragraph of benefits.",
  },
];

const REMIXED_FALLBACK =
  "Bizarre regulation hacks that my therapist taught me (that actually work)";

function WandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 19 8-8M14.2 5.2 16 3l1 2.4L19.5 6 17 7.2 16 9.6l-1-2.4L12.5 6l2.4-.8ZM19 13l.7 1.7L21.5 15l-1.8.6L19 17.4l-.7-1.8L16.5 15l1.8-.3L19 13Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.6v2.2M12 18.2v2.2M4.8 6.8l1.6 1.6M17.6 15.6l1.6 1.6M3.6 12h2.2M18.2 12h2.2M4.8 17.2l1.6-1.6M17.6 8.4l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 11v5M12 8.2h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.4a3.8 3.8 0 0 1 7 3.4C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.1L19.2 8.9a1.5 1.5 0 0 0 0-2.1L17.2 4.8a1.5 1.5 0 0 0-2.1 0L4 15.9V20Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M14.5 6 8.5 12l6 6" : "M9.5 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useBlitzCachedSrc(url: string) {
  const [src, setSrc] = useState(() => cachedBlitzSrc(url) || url);
  useEffect(() => {
    if (!url) {
      setSrc("");
      return;
    }
    setSrc(cachedBlitzSrc(url) || url);
    let cancelled = false;
    const unsub = subscribeBlitzImageCache((ready) => {
      if (ready !== url) return;
      const hit = cachedBlitzSrc(url);
      if (hit && !cancelled) setSrc(hit);
    });
    void cacheBlitzImage(url).then((hit) => {
      if (!cancelled && hit) setSrc(hit);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [url]);
  return src || url;
}

function overlayPos(y: "top" | "center" | "bottom") {
  if (y === "top") return "top-[12%]";
  if (y === "bottom") return "bottom-[16%] top-auto";
  return "top-[26%]";
}

function OverlayCaption({
  text,
  overlayY,
  textStyle,
}: {
  text: string;
  overlayY: "top" | "center" | "bottom";
  textStyle: "box" | "outline";
}) {
  if (textStyle === "outline") {
    return (
      <p
        className={`pointer-events-none absolute inset-x-7 ${overlayPos(overlayY)} text-center text-[15px] font-extrabold leading-[1.2] text-black sm:text-[16px]`}
        style={{
          WebkitTextStroke: "3px #fff",
          paintOrder: "stroke fill",
          textShadow:
            "-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff, 0 0 8px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </p>
    );
  }
  return (
    <div
      className={`pointer-events-none absolute left-1/2 ${overlayPos(overlayY)} w-[72%] max-w-[210px] -translate-x-1/2`}
    >
      <p className="rounded-md bg-white px-2 py-1 text-center text-[12px] font-semibold leading-[1.3] text-[var(--foreground)] sm:text-[13px]">
        {text}
      </p>
    </div>
  );
}

function BlitzPhone({
  imageUrl,
  overlay,
  overlayY,
  index,
  total,
  onPrev,
  onNext,
  onSelectIndex,
  stats,
  onEditOverlay,
  textStyle = "box",
  preloadUrls = [],
}: {
  imageUrl: string;
  overlay: string;
  overlayY: "top" | "center" | "bottom";
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectIndex?: (i: number) => void;
  stats?: { likes: string; views: string };
  onEditOverlay?: () => void;
  textStyle?: "box" | "outline";
  preloadUrls?: string[];
}) {
  const src = useBlitzCachedSrc(imageUrl);
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl bg-[#111827] shadow-[0_18px_40px_rgba(17,24,39,0.18)]">
        <div className="relative aspect-[9/16]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          {preloadUrls.map((url) =>
            url && url !== imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={cachedBlitzSrc(url) || url}
                alt=""
                className="hidden"
              />
            ) : null
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/45" />
          {overlay ? (
            <OverlayCaption
              text={overlay}
              overlayY={overlayY}
              textStyle={textStyle}
            />
          ) : null}
          {stats ? (
            <div className="absolute right-2.5 top-[42%] flex flex-col items-center gap-3 text-white">
              <span className="flex flex-col items-center gap-0.5">
                <HeartIcon className="h-5 w-5" />
                <span className="text-[10px] font-semibold drop-shadow">{stats.likes}</span>
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <EyeIcon className="h-5 w-5" />
                <span className="text-[10px] font-semibold drop-shadow">{stats.views}</span>
              </span>
            </div>
          ) : null}
          {onEditOverlay ? (
            <button
              type="button"
              onClick={onEditOverlay}
              className="absolute inset-0 z-[1]"
              aria-label="Edit overlay"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => onSelectIndex?.(i)}
                className={`h-1.5 rounded-full transition ${
                  i === index ? "w-3.5 bg-[var(--accent)]" : "w-1.5 bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Previous"
        onClick={onPrev}
        className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--foreground-soft)] shadow-md"
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={onNext}
        className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--foreground-soft)] shadow-md"
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function RemixedFromPanel({ projectId }: { projectId: string }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [slide, setSlide] = useState(0);
  const skipSave = useRef(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const slides = [
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80",
  ];

  useEffect(() => {
    setText(loadBaseIdea(projectId));
    skipSave.current = true;
  }, [projectId]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const id = window.setTimeout(() => saveBaseIdea(projectId, text), 400);
    return () => window.clearTimeout(id);
  }, [projectId, text]);

  useEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing]);

  const overlay = text.trim() || REMIXED_FALLBACK;

  return (
    <div className="hidden w-[200px] shrink-0 lg:block">
      <p className="mb-2.5 text-[13px] font-semibold text-[var(--foreground)]">
        Remixed From
      </p>
      {editing ? (
        <div className="overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_12px_28px_rgba(17,24,39,0.12)]">
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={8}
            placeholder="Base idea for the remix…"
            className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
          />
        </div>
      ) : (
        <BlitzPhone
          imageUrl={slides[slide] ?? slides[0]!}
          overlay={overlay}
          overlayY="center"
          index={slide}
          total={slides.length}
          onPrev={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
          onNext={() => setSlide((s) => (s + 1) % slides.length)}
          onSelectIndex={setSlide}
          stats={{ likes: "16.2K", views: "144.5K" }}
          onEditOverlay={() => setEditing(true)}
        />
      )}
    </div>
  );
}

function demoCarousels(): BlitzCarousel[] {
  return BLITZ_DECK.map((d, i) => ({
    id: `demo-${i}`,
    folderId: "",
    folderName: "Demo",
    destFolderId: "",
    format: d.format,
    angle: d.angle,
    why: d.why,
    slides: [
      {
        assetId: `demo-${i}`,
        imageUrl: d.imageUrl,
        overlay: d.overlay,
        hashtag: null,
      },
    ],
  }));
}

type GalleryFolderOpt = {
  id: string;
  name: string;
  parentId: string | null;
  kind?: "folder" | "carousel";
};

function folderLabel(folders: GalleryFolderOpt[], id: string) {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return parts.join(" / ") || "Carpeta";
}

function BlitzHome({ projectId }: { projectId: string }) {
  const [generated, setGenerated] = useState<BlitzCarousel[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayY, setOverlayY] = useState<"top" | "center" | "bottom">("top");
  const [configOpen, setConfigOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState<BlitzGenSettings>(() => ({
    carouselsPerGeneration: 1,
    photosMin: 5,
    photosMax: 6,
    routes: [],
    model: "chatgpt",
    mentionApp: false,
    textStyle: "box",
  }));
  const [settingsStatus, setSettingsStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [folders, setFolders] = useState<GalleryFolderOpt[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openaiOk, setOpenaiOk] = useState<boolean | null>(null);
  const skipSettings = useRef(true);
  const overlayRef = useRef<HTMLTextAreaElement>(null);

  const items = generated.length ? generated : demoCarousels();
  const current = items[itemIndex] ?? items[0]!;
  const slides = current?.slides ?? [];
  const slide = slides[slideIndex] ?? slides[0];
  const isDemo = !generated.length;
  const libraryFolders = folders.filter((f) => f.kind !== "carousel");
  const routeRows =
    settings.routes.length > 0
      ? settings.routes
      : [{ sourceId: "", destId: "" }];

  useEffect(() => {
    setSettings(loadBlitzSettings(projectId));
    setGenerated(loadBlitzCarousels(projectId));
    skipSettings.current = true;
    setSettingsStatus("idle");
    setItemIndex(0);
    setSlideIndex(0);
    void (async () => {
      try {
        const [apiRes, galRes] = await Promise.all([
          fetch("/api/openai/api-settings"),
          fetch(`/api/projects/${projectId}/gallery?all=1&kind=image`),
        ]);
        if (apiRes.ok) {
          const data = await apiRes.json();
          setOpenaiOk(Boolean(data.connected));
        }
        if (galRes.ok) {
          const data = await galRes.json();
          setFolders((data.allFolders ?? []) as GalleryFolderOpt[]);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (skipSettings.current) {
      skipSettings.current = false;
      return;
    }
    setSettingsStatus("saving");
    const id = window.setTimeout(() => {
      saveBlitzSettings(projectId, settings);
      setSettingsStatus("saved");
    }, 350);
    return () => window.clearTimeout(id);
  }, [projectId, settings]);

  useEffect(() => {
    saveBlitzCarousels(projectId, generated);
  }, [projectId, generated]);

  useEffect(() => {
    if (editing) overlayRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const list = generated.length ? generated : demoCarousels();
    const cur = list[itemIndex] ?? list[0];
    const currentUrls = (cur?.slides ?? []).map((s) => s.imageUrl).filter(Boolean);
    pinBlitzImages(currentUrls);
    const n = list.length;
    const nextItem = n ? list[(itemIndex + 1) % n] : undefined;
    const prevItem = n ? list[(itemIndex - 1 + n) % n] : undefined;
    const rotated = [
      ...currentUrls.slice(slideIndex),
      ...currentUrls.slice(0, slideIndex),
    ];
    void prefetchBlitzImages([
      ...rotated,
      ...(nextItem?.slides.map((s) => s.imageUrl) ?? []),
      ...(prevItem?.slides.map((s) => s.imageUrl) ?? []),
    ]);
  }, [generated, itemIndex, slideIndex]);

  useEffect(() => {
    const urls = generated.flatMap((c) => c.slides.map((s) => s.imageUrl));
    if (!urls.length) return;
    const id = window.setTimeout(() => {
      void prefetchBlitzImages(urls);
    }, 250);
    return () => window.clearTimeout(id);
  }, [generated]);

  function goItem(delta: number) {
    const total = items.length;
    if (!total) return;
    setItemIndex((i) => (i + delta + total) % total);
    setSlideIndex(0);
    setWhyOpen(false);
    setEditing(false);
  }

  function goSlide(delta: number) {
    const total = slides.length;
    if (!total) return;
    setSlideIndex((i) => (i + delta + total) % total);
  }

  function dropCurrent() {
    if (isDemo) {
      goItem(1);
      return;
    }
    setGenerated((prev) => {
      const next = prev.filter((_, i) => i !== itemIndex);
      setItemIndex((i) => (next.length ? Math.min(i, next.length - 1) : 0));
      return next;
    });
    setSlideIndex(0);
    setWhyOpen(false);
    setEditing(false);
  }

  function cycleOverlay() {
    setOverlayY((prev) =>
      prev === "top" ? "center" : prev === "center" ? "bottom" : "top"
    );
  }

  function patchOverlay(text: string) {
    if (isDemo) return;
    setGenerated((prev) =>
      prev.map((c, i) => {
        if (i !== itemIndex) return c;
        return {
          ...c,
          slides: c.slides.map((s, si) =>
            si === slideIndex ? { ...s, overlay: text } : s
          ),
        };
      })
    );
  }

  async function generate() {
    setError("");
    if (!settings.routes.some((r) => r.sourceId && r.destId)) {
      setError(
        "En ajustes, elige origen y destino (ej. zxc videos → results videos zxc)"
      );
      setSettingsOpen(true);
      return;
    }
    const productContext = loadProductContext(projectId);
    if (!productContext) {
      setError(
        "Falta el producto. Ábrelo en Mi app → Producto y pega los detalles."
      );
      return;
    }
    setGenerating(true);
    setSettingsOpen(false);
    setConfigOpen(false);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/blitz/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings,
            productContext,
            baseIdea: loadBaseIdea(projectId),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      const next = (data.carousels ?? []) as BlitzCarousel[];
      if (!next.length) throw new Error("ChatGPT no devolvió carruseles");
      setGenerated(next);
      saveBlitzCarousels(projectId, next);
      setItemIndex(0);
      setSlideIndex(0);
      setOverlayY("top");
      const first = next[0]?.slides.map((s) => s.imageUrl).filter(Boolean) ?? [];
      pinBlitzImages(first);
      await Promise.race([
        prefetchBlitzImages(first),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 5000);
        }),
      ]);
      void prefetchBlitzImages(
        next.slice(1).flatMap((c) => c.slides.map((s) => s.imageUrl))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar");
    } finally {
      setGenerating(false);
    }
  }

  async function accept() {
    if (isDemo || !current) {
      goItem(1);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const destId =
        current.destFolderId ||
        destFolderForSource(current.folderId, settings.routes);
      if (!destId) {
        throw new Error("Elige origen y destino en ajustes (ej. zxc videos → results videos zxc)");
      }
      const carouselName = (
        current.angle ||
        current.slides[0]?.overlay ||
        "Blitz"
      )
        .trim()
        .slice(0, 80);
      const folderRes = await fetch(
        `/api/projects/${projectId}/gallery/folders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: carouselName || "Blitz",
            parentId: destId,
            kind: "carousel",
          }),
        }
      );
      const folderData = await folderRes.json().catch(() => ({}));
      if (!folderRes.ok) {
        throw new Error(folderData.error || "No se pudo crear el carrusel");
      }
      const carouselId = folderData.folder?.id as string | undefined;
      if (!carouselId) throw new Error("No se pudo crear el carrusel");
      const supabase = createClient();
      const registered: {
        name: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
        publicUrl: string;
        hashtag: string | null;
      }[] = [];
      for (const [i, s] of current.slides.entries()) {
        const blob = await composeBlitzSlide({
          imageUrl: s.imageUrl,
          overlay: s.overlay,
          overlayY,
          textStyle: settings.textStyle,
        });
        const name = `blitz-${i + 1}.jpg`;
        const storagePath = `${projectId}/${crypto.randomUUID()}-${name}`;
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, blob, {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message || "No se pudo subir la foto");
        const { data: pub } = supabase.storage
          .from("gallery")
          .getPublicUrl(storagePath);
        registered.push({
          name,
          mimeType: "image/jpeg",
          sizeBytes: blob.size,
          storagePath,
          publicUrl: pub.publicUrl,
          hashtag: s.overlay || null,
        });
      }
      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: carouselId, files: registered }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar el carrusel");
      }
      dropCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function patchRoute(
    index: number,
    key: "sourceId" | "destId",
    id: string
  ) {
    setSettings((prev) => {
      const rows =
        prev.routes.length > 0
          ? prev.routes
          : [{ sourceId: "", destId: "" }];
      return {
        ...prev,
        routes: rows.map((r, i) =>
          i === index ? { ...r, [key]: id } : r
        ),
      };
    });
  }

  function addRoute() {
    const used = new Set(settings.routes.map((r) => r.sourceId));
    const nextSource =
      libraryFolders.find((f) => !used.has(f.id))?.id ||
      libraryFolders[0]?.id ||
      "";
    setSettings((prev) => ({
      ...prev,
      routes: [...prev.routes, { sourceId: nextSource, destId: "" }],
    }));
  }

  function removeRoute(index: number) {
    setSettings((prev) => ({
      ...prev,
      routes: prev.routes.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface-alt)]">
      {openaiOk === false ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="OpenAI API"
          message="Conecta OpenAI API (ChatGPT) para generar carruseles en Blitz."
        />
      ) : null}

      <div className="absolute left-5 top-4 z-30 flex items-center gap-2">
        <button
          type="button"
          disabled={generating}
          onClick={() => void generate()}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {generating ? "Generando…" : "Generar"}
        </button>
        <div className="relative">
          <button
            type="button"
            title="Ajustes de generación"
            onClick={() => {
              setSettingsOpen((v) => !v);
              setConfigOpen(false);
              setWhyOpen(false);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground-soft)] shadow-sm"
          >
            <GearIcon className="h-3.5 w-3.5" />
          </button>
          {settingsOpen ? (
            <div className="absolute left-0 top-11 w-[min(94vw,440px)] rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Ajustes de Blitz
                </p>
                <span className="text-[10px] text-[var(--muted-soft)]">
                  {settingsStatus === "saving"
                    ? "Guardando…"
                    : settingsStatus === "saved"
                      ? "Guardado"
                      : ""}
                </span>
              </div>
              <label className="mt-2 block text-[11px] font-medium text-[var(--muted)]">
                Carruseles por generación (1–50)
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.carouselsPerGeneration}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      carouselsPerGeneration: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[13px] text-[var(--foreground)] outline-none"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-medium text-[var(--muted)]">
                  Fotos mín.
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.photosMin}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        photosMin: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[13px] text-[var(--foreground)] outline-none"
                  />
                </label>
                <label className="block text-[11px] font-medium text-[var(--muted)]">
                  Fotos máx.
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.photosMax}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        photosMax: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[13px] text-[var(--foreground)] outline-none"
                  />
                </label>
              </div>
              <label className="mt-2 block text-[11px] font-medium text-[var(--muted)]">
                Modelo
                <select
                  value={settings.model}
                  onChange={() =>
                    setSettings((s) => ({ ...s, model: "chatgpt" }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[13px] text-[var(--foreground)] outline-none"
                >
                  <option value="chatgpt">ChatGPT</option>
                </select>
              </label>
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--border)] px-2 py-2 text-[12px] text-[var(--foreground-soft)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.mentionApp}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      mentionApp: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="font-medium">Mencionar la app en el texto</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--muted-soft)]">
                    Si está apagado, los overlays no nombran el producto.
                  </span>
                </span>
              </label>
              <p className="mt-3 text-[11px] font-semibold text-[var(--foreground)]">
                Carpetas
              </p>
              <p className="text-[10px] text-[var(--muted-soft)]">
                Izquierda: de dónde salen las fotos. Derecha: dónde se guarda
                el carrusel. Ej. zxc videos → results videos zxc
              </p>
              <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-1.5 gap-y-1">
                <span className="text-[10px] font-medium text-[var(--muted-soft)]">
                  Origen
                </span>
                <span />
                <span className="text-[10px] font-medium text-[var(--muted-soft)]">
                  Destino
                </span>
                <span />
                {routeRows.map((route, i) => (
                  <Fragment key={`route-${i}`}>
                    <select
                      value={route.sourceId}
                      onChange={(e) =>
                        patchRoute(i, "sourceId", e.target.value)
                      }
                      className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[11px] text-[var(--foreground)] outline-none"
                    >
                      <option value="">Elegir…</option>
                      {libraryFolders.map((f) => (
                        <option key={`src-${f.id}`} value={f.id}>
                          {folderLabel(folders, f.id)}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-[var(--muted-soft)]">→</span>
                    <select
                      value={route.destId}
                      onChange={(e) =>
                        patchRoute(i, "destId", e.target.value)
                      }
                      className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[11px] text-[var(--foreground)] outline-none"
                    >
                      <option value="">Elegir…</option>
                      {libraryFolders.map((f) => (
                        <option key={`dst-${f.id}`} value={f.id}>
                          {folderLabel(folders, f.id)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Quitar"
                      onClick={() => removeRoute(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                    >
                      ×
                    </button>
                  </Fragment>
                ))}
              </div>
              {libraryFolders.length ? (
                <button
                  type="button"
                  onClick={addRoute}
                  className="mt-1.5 text-[11px] font-medium text-[#0078d4] hover:underline"
                >
                  + Añadir ruta
                </button>
              ) : (
                <p className="mt-1 px-1 py-2 text-[11px] text-[var(--muted-soft)]">
                  No hay carpetas en Library
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute right-5 top-4 z-30 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={cycleOverlay}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)] shadow-sm"
        >
          <WandIcon className="h-3.5 w-3.5" />
          Smart positioning
        </button>
        <label className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)] shadow-sm">
          Tipo
          <select
            value={settings.textStyle}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                textStyle: e.target.value === "outline" ? "outline" : "box",
              }))
            }
            className="bg-transparent text-[12px] font-medium text-[var(--foreground)] outline-none"
          >
            <option value="box">Caja blanca</option>
            <option value="outline">Letras + borde</option>
          </select>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setConfigOpen((v) => !v);
              setSettingsOpen(false);
              setWhyOpen(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)] shadow-sm"
          >
            <GearIcon className="h-3.5 w-3.5" />
            Configure
          </button>
          {configOpen ? (
            <div className="absolute right-0 top-11 w-[min(92vw,340px)] rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-xl">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Configure</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Overlay: {overlayY}
              </p>
              <button
                type="button"
                onClick={cycleOverlay}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)]"
              >
                Cycle overlay position
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-10 overflow-auto px-6 py-8">
        <RemixedFromPanel projectId={projectId} />

        <div className="flex min-w-0 flex-col items-center">
          {error ? (
            <p className="mb-3 max-w-[420px] rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-center text-[12px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <div className="mb-4 flex max-w-[420px] flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-[#e5e7eb] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)]">
              {current.format}
            </span>
            <span className="rounded-full border border-[#93c5fd] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#2563eb]">
              {current.angle}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setWhyOpen((v) => !v);
                  setConfigOpen(false);
                  setSettingsOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[var(--accent)]"
              >
                Why This Content?
                <InfoIcon className="h-3.5 w-3.5" />
              </button>
              {whyOpen ? (
                <div className="absolute left-1/2 top-11 z-20 w-[260px] -translate-x-1/2 rounded-2xl border border-[#ffedd5] bg-white p-3 text-[12px] leading-relaxed text-[#7c2d12] shadow-lg">
                  {current.why}
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-[min(100%,300px)] sm:w-[320px]">
            {editing && slide ? (
              <div className="aspect-[9/16] overflow-hidden rounded-xl bg-white p-4 shadow-[0_18px_40px_rgba(17,24,39,0.18)]">
                <textarea
                  ref={overlayRef}
                  value={slide.overlay}
                  onChange={(e) => {
                    if (isDemo) return;
                    patchOverlay(e.target.value);
                  }}
                  onBlur={() => setEditing(false)}
                  className="h-full w-full resize-none bg-transparent text-[15px] font-semibold leading-relaxed text-[var(--foreground)] outline-none"
                />
              </div>
            ) : (
              <BlitzPhone
                imageUrl={slide?.imageUrl || ""}
                overlay={slide?.overlay || ""}
                overlayY={overlayY}
                textStyle={settings.textStyle}
                index={slideIndex}
                total={Math.max(slides.length, 1)}
                onPrev={() => goSlide(-1)}
                onNext={() => goSlide(1)}
                onSelectIndex={setSlideIndex}
                onEditOverlay={() => setEditing(true)}
                preloadUrls={
                  slides.length > 1
                    ? [
                        slides[(slideIndex + 1) % slides.length]?.imageUrl || "",
                        slides[
                          (slideIndex - 1 + slides.length) % slides.length
                        ]?.imageUrl || "",
                      ]
                    : []
                }
              />
            )}
          </div>

          <div className="mt-7 grid grid-cols-[56px_auto_56px] items-start justify-items-center gap-x-5">
            <div className="flex flex-col items-center">
              <button
                type="button"
                title="Reject"
                disabled={saving}
                onClick={dropCurrent}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[28px] font-light leading-none text-[#ef4444] shadow-[0_8px_20px_rgba(17,24,39,0.08)] disabled:opacity-40"
              >
                ×
              </button>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => goItem(-1)}
                className="mt-2.5 flex h-7 w-7 items-center justify-center rounded-md border border-[#ececec] bg-white text-[var(--muted-soft)]"
              >
                <Chevron dir="left" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-0.5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-9 text-[15px] font-medium text-[var(--foreground-soft)] shadow-[0_8px_20px_rgba(17,24,39,0.08)]"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            <div className="flex flex-col items-center">
              <button
                type="button"
                title="Accept"
                disabled={saving}
                onClick={() => void accept()}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[22px] font-semibold text-[#22c55e] shadow-[0_8px_20px_rgba(17,24,39,0.08)] disabled:opacity-40"
              >
                {saving ? "…" : "✓"}
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => goItem(1)}
                className="mt-2.5 flex h-7 w-7 items-center justify-center rounded-md border border-[#ececec] bg-white text-[var(--muted-soft)]"
              >
                <Chevron dir="right" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-bold text-white shadow-md">
        B
      </div>
    </div>
  );
}

function AiStudioHome({
  projectId,
  onSavePiece,
}: {
  projectId: string;
  onSavePiece: (piece: EstudioPiece) => void;
}) {
  const [mode, setMode] = useState<"images" | "videos">("videos");
  const [higgs, setHiggs] = useState<HiggsStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState(
    VIDEO_PRESETS.find((p) => p.aspectRatio === "9:16")?.id ??
      VIDEO_PRESETS[0]?.id ??
      ""
  );
  const [aspect, setAspect] = useState("9:16");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = VIDEO_PRESETS.find((p) => p.id === presetId);

  useEffect(() => {
    setJobs(loadJobs(projectId));
    void (async () => {
      try {
        const res = await fetch("/api/higgsfield/settings");
        const data = await res.json();
        if (res.ok) {
          setHiggs({
            connected: Boolean(data.connected),
            keyHint: data.keyHint ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [projectId]);

  const active = jobs.filter(
    (j) => j.status === "queued" || j.status === "in_progress"
  );

  useEffect(() => {
    if (active.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      for (const job of active) {
        try {
          const res = await fetch(`/api/higgsfield/jobs/${job.requestId}`, {
            cache: "no-store",
          });
          const data = await res.json();
          if (!res.ok || cancelled) continue;
          const st = data.status as { status?: string; error?: string };
          const videoUrl =
            (typeof data.videoUrl === "string" && data.videoUrl) ||
            job.videoUrl;
          setJobs((prev) => {
            const next = prev.map((j) =>
              j.requestId === job.requestId
                ? {
                    ...j,
                    status: (st.status || j.status).toLowerCase(),
                    videoUrl,
                    error: typeof st.error === "string" ? st.error : j.error,
                  }
                : j
            );
            persistJobs(projectId, next);
            return next;
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
  }, [active.length, projectId]);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    const local = URL.createObjectURL(file);
    setImagePreview(local);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/higgsfield/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (res.ok && typeof data.url === "string") setImageUrl(data.url);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/higgsfield/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          prompt: prompt.trim(),
          imageUrl: imageUrl || undefined,
          aspectRatio: aspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "No se pudo generar");
      const job: AiJob = {
        requestId: data.job.request_id,
        prompt: data.meta.prompt,
        status: data.job.status || "queued",
        videoUrl: null,
        imageUrl: data.meta.imageUrl ?? imageUrl ?? null,
        error: null,
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => {
        const next = [job, ...prev];
        persistJobs(projectId, next);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-[640px] flex-col">
      {higgs && !higgs.connected ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="Higgsfield"
          message="Conecta Higgsfield para generar en AI Studio."
        />
      ) : null}
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex rounded-full bg-[var(--surface-alt)] p-1">
          {(["images", "videos"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold ${
                mode === id ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              {id === "images" ? "Imágenes" : "Videos"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-44 sm:px-8">
        {error ? (
          <p className="mb-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {jobs.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-alt)] text-[var(--muted-soft)]">
              ▣
            </span>
            <p className="mt-4 text-[15px] font-medium text-[var(--muted)]">
              Aún no hay generaciones — escribe un prompt abajo.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <article
                key={job.requestId}
                className="overflow-hidden rounded-2xl border border-[var(--border)]"
              >
                <div className="relative aspect-[9/16] bg-[#111827]">
                  {job.videoUrl ? (
                    <video
                      src={job.videoUrl}
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                    />
                  ) : job.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.imageUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[12px] text-white/70">
                      {job.status}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-[12px] text-[var(--muted)]">
                    {job.prompt}
                  </p>
                  {job.videoUrl ? (
                    <button
                      type="button"
                      className="ui-btn-secondary !py-1.5 !text-[12px]"
                      onClick={() =>
                        onSavePiece({
                          id: newId(),
                          formatId: "ai-studio",
                          overlay: job.prompt.slice(0, 80),
                          script: job.prompt,
                          imageUrl: job.imageUrl,
                          videoUrl: job.videoUrl,
                          status: "draft",
                          createdAt: new Date().toISOString(),
                        })
                      }
                    >
                      Enviar a Blitz
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => void generate(e)}
        className="absolute inset-x-4 bottom-4 mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-white p-3 shadow-[0_12px_40px_rgba(17,24,39,0.12)] sm:inset-x-8"
      >
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            title="Subir imagen"
            onClick={() => fileRef.current?.click()}
            className="flex h-16 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--muted)]"
          >
            +
          </button>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "images"
                ? "p. ej. selfie de mujer"
                : "p. ej. woman selfie, luz natural"
            }
            rows={2}
            className="min-h-[64px] flex-1 resize-none border-0 bg-transparent p-2 text-[14px] outline-none"
          />
        </div>
        {imagePreview ? (
          <p className="px-2 pb-1 text-[11px] text-[var(--muted-soft)]">Imagen de referencia lista</p>
        ) : preset?.needsImage ? (
          <p className="px-2 pb-1 text-[11px] text-[var(--muted-soft)]">
            Este modelo pide una imagen de referencia.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <select
            value={presetId}
            onChange={(e) => {
              setPresetId(e.target.value);
              const next = VIDEO_PRESETS.find((p) => p.id === e.target.value);
              if (next) setAspect(next.aspectRatio);
            }}
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-[12px]"
          >
            {VIDEO_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-[12px]"
          >
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
          </select>
          <button
            type="submit"
            disabled={generating || !higgs?.connected}
            className="ml-auto ui-btn-primary disabled:opacity-50"
          >
            {generating ? "Generando…" : "Generate (Higgsfield)"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AutomationsHome({
  automations,
  onCreate,
  onDelete,
}: {
  automations: EstudioAutomation[];
  onCreate: (item: EstudioAutomation) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState<EstudioFormatId>("slideshow");
  const [brief, setBrief] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !brief.trim()) return;
    onCreate({
      id: newId(),
      name: name.trim(),
      formatId,
      brief: brief.trim(),
      createdAt: new Date().toISOString(),
    });
    setName("");
    setBrief("");
    setOpen(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Automatizaciones
          </h2>
          <p className="mt-1 text-[14px] text-[var(--muted-soft)]">
            Describe una campaña una vez y genera una tira de posts.
          </p>
        </div>
        <button type="button" className="ui-btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon className="h-3.5 w-3.5" />
          Nueva automatización
        </button>
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="mt-6 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ui-input"
            placeholder="Nombre de la campaña"
          />
          <select
            value={formatId}
            onChange={(e) => setFormatId(e.target.value as EstudioFormatId)}
            className="ui-input"
          >
            {ESTUDIO_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="ui-input min-h-[100px]"
            placeholder="Describe el ritmo, cuentas y el ángulo"
          />
          <div className="flex gap-2">
            <button type="submit" className="ui-btn-primary">
              Guardar
            </button>
            <button
              type="button"
              className="ui-btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {automations.length === 0 && !open ? (
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--accent)]">
            +
          </span>
          <h3 className="mt-4 text-[18px] font-semibold text-[var(--foreground)]">
            Lanza tu primera automatización
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[var(--muted-soft)]">
            Describe una campaña una vez y generaremos una tira de posts para
            TikTok e Instagram. Revisa, ajusta y lanza.
          </p>
          <button
            type="button"
            className="ui-btn-primary mx-auto mt-5"
            onClick={() => setOpen(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Nueva automatización
          </button>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {automations.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4"
            >
              <div>
                <p className="text-[14px] font-semibold text-[var(--foreground)]">
                  {item.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--muted-soft)]">
                  {formatLabel(item.formatId)} · {formatDate(item.createdAt)}
                </p>
                <p className="mt-2 text-[13px] text-[var(--muted)]">{item.brief}</p>
              </div>
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--danger)]"
                onClick={() => onDelete(item.id)}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h3 className="text-[18px] font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted-soft)]">{body}</p>
    </div>
  );
}
