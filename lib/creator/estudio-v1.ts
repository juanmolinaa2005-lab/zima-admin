import { normalizeCaptionStyleMode, normalizeOverlayPosition, type CaptionStyleMode, type OverlayPosition } from "@/lib/creator/overlay-styles";
import {
  DEFAULT_FAL_VIDEO_MODEL,
  getFalVideoModel,
  normalizeFavoriteModelIds,
} from "@/lib/creator/fal-video-models";

export const ESTUDIO_NAV_GROUPS = [
  {
    label: "Creation",
    items: [{ id: "creator-imagen", label: "Creator Imagen" }],
  },
  {
    label: "Influencers",
    items: [
      { id: "influencers", label: "Influencers" },
      { id: "app-demo", label: "App Demo" },
      { id: "simulador", label: "Simulador" },
      { id: "dynamics", label: "Dynamics" },
    ],
  },
  {
    label: "Redes",
    items: [{ id: "redes", label: "Redes" }],
  },
  {
    label: "Library",
    items: [{ id: "library", label: "Library" }],
  },
] as const;

export const ESTUDIO_NAV = ESTUDIO_NAV_GROUPS.flatMap((group) => [...group.items]);

export type EstudioSectionId =
  (typeof ESTUDIO_NAV_GROUPS)[number]["items"][number]["id"];

export type EstudioFormatId =
  | "slideshow"
  | "wall-of-text"
  | "hook-demo"
  | "talking-head"
  | "gs-meme"
  | "talking-gs"
  | "product-spokesperson"
  | "gs-mobile"
  | "ai-studio";

export type EstudioPieceStatus = "draft" | "approved" | "rejected";

export type EstudioPiece = {
  id: string;
  formatId: EstudioFormatId;
  overlay: string;
  script: string;
  imageUrl: string | null;
  videoUrl: string | null;
  status: EstudioPieceStatus;
  createdAt: string;
};

export type EstudioInfluencerShot = {
  id: string;
  label: string;
  imageUrl: string | null;
  status?: string;
  error?: string | null;
};

export type EstudioInfluencer = {
  language?: "es" | "en";
  id: string;
  name: string;
  traits: string;
  folderId: string | null;
  createdAt: string;
  active?: boolean;
  images: EstudioInfluencerShot[];
};

export function isInfluencerActive(item: Pick<EstudioInfluencer, "active">) {
  return item.active !== false;
}

export type EstudioVideoFormat = "talking" | "app-demo";

export type EstudioInfluencerVideo = {
  id: string;
  script: string;
  prompt?: string | null;
  status: string;
  videoUrl: string | null;
  assetId: string | null;
  error: string | null;
  modelId?: string | null;
  requestId?: string | null;
  providerStatus?: string | null;
  queuePosition?: number | null;
  startImageUrl?: string | null;
  estimatedCostUsd?: number | null;
  frameCostUsd?: number | null;
  duration?: string | null;
  action?: string | null;
  extra?: string | null;
  format?: EstudioVideoFormat | null;
  demoCode?: string | null;
  demoPhoneFrame?: boolean | null;
  demoVariables?: {
    id: string;
    key: string;
    type: string;
    value: string;
  }[] | null;
  talkingVideoUrl?: string | null;
  demoVideoUrl?: string | null;
  overlay?: string | null;
  overlayStyle?: string | null;
  overlayPosition?: string | null;
  beauty?: boolean | null;
  videoProvider?: "replicate" | "fal" | "kling" | null;
  apiTrace?: import("@/lib/creator/influencer-api-trace").InfluencerApiTrace | null;
  referenceVideoUrl?: string | null;
  sourceVideoUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export function influencerCoverUrl(
  item: EstudioInfluencer
): string | null {
  const face = item.images.find((s) => s.id === "face-front" && s.imageUrl);
  return face?.imageUrl || item.images.find((s) => s.imageUrl)?.imageUrl || null;
}

export function influencerProgress(item: EstudioInfluencer): {
  done: number;
  total: number;
  generating: boolean;
} {
  const total = item.images.length;
  const done = item.images.filter(
    (s) => s.status === "saved" || Boolean(s.imageUrl)
  ).length;
  const generating = item.images.some((s) => {
    const st = (s.status || "").toLowerCase();
    return (
      !s.imageUrl &&
      st !== "failed" &&
      st !== "saved"
    );
  });
  return { done, total, generating };
}

export type EstudioAutomation = {
  id: string;
  name: string;
  formatId: EstudioFormatId;
  brief: string;
  createdAt: string;
};

export const ESTUDIO_FORMATS: {
  id: Exclude<EstudioFormatId, "ai-studio">;
  name: string;
  description: string;
  overlay: string;
  cover: string;
  tint: string;
}[] = [
  {
    id: "slideshow",
    name: "Slideshow",
    description: "Carrusel de varias imágenes con captions",
    overlay: "si fuera proveedor en 2026… haría esto primero",
    cover:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/55 via-black/20 to-transparent",
  },
  {
    id: "wall-of-text",
    name: "Wall of Text",
    description: "Texto grande sobre un fondo limpio",
    overlay:
      "la cantidad de cosas que recuerdas con las manos ocupadas y olvidas al instante porque escribirlas parece un trámite extra",
    cover:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/70 via-black/35 to-transparent",
  },
  {
    id: "hook-demo",
    name: "Video Hook & Demo",
    description: "Clip de hook + demo de app unidos",
    overlay: "mira lo que pasa cuando dejas de teclear la idea",
    cover:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/50 via-black/15 to-transparent",
  },
  {
    id: "talking-head",
    name: "Talking Head UGC",
    description: "Avatar IA habla el guion a cámara",
    overlay: "esto es lo que diría si lo grabara ahora mismo",
    cover:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/45 via-black/10 to-transparent",
  },
  {
    id: "gs-meme",
    name: "Green Screen Meme",
    description: "Meme con recorte sobre cualquier fondo",
    overlay: "cuando el calendario te pide un evento más",
    cover:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/55 via-black/20 to-transparent",
  },
  {
    id: "talking-gs",
    name: "Talking Head Green Screen",
    description: "Cara delante de una captura o UI",
    overlay: "te enseño la pantalla mientras te lo explico",
    cover:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/50 via-black/20 to-transparent",
  },
  {
    id: "product-spokesperson",
    name: "Product Spokesperson",
    description: "Presentador con el producto en mano",
    overlay: "un detalle que cambia cómo usas esto cada día",
    cover:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/45 via-black/15 to-transparent",
  },
  {
    id: "gs-mobile",
    name: "Green Screen Mobile",
    description: "Green screen con el móvil en primer plano",
    overlay: "el gráfico que nadie espera ver en Stories",
    cover:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&h=640&q=80",
    tint: "from-black/50 via-black/20 to-transparent",
  },
];

export function formatById(id: EstudioFormatId) {
  return ESTUDIO_FORMATS.find((f) => f.id === id) ?? null;
}

export function formatLabel(id: EstudioFormatId): string {
  if (id === "ai-studio") return "AI Studio";
  return formatById(id)?.name ?? id;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function piecesKey(projectId: string) {
  return `zima:estudio-v1:pieces:${projectId}`;
}
function influencersKey(projectId: string) {
  return `zima:estudio-v1:influencers:${projectId}`;
}
function automationsKey(projectId: string) {
  return `zima:estudio-v1:automations:${projectId}`;
}
function baseIdeaKey(projectId: string) {
  return `zima:estudio-v1:base-idea:${projectId}`;
}
function productContextKey(projectId: string) {
  return `zima:estudio-v1:product-context:${projectId}`;
}
function productSummaryKey(projectId: string) {
  return `zima:estudio-v1:product-summary:${projectId}`;
}

/** Brief corto para videos/guiones (Kling tope 2500 en el prompt completo). */
export const PRODUCT_SUMMARY_MAX = 480;

function blitzSettingsKey(projectId: string) {
  return `zima:estudio-v1:blitz-settings:${projectId}`;
}
function blitzCarouselsKey(projectId: string) {
  return `zima:estudio-v1:blitz-carousels:${projectId}`;
}

export const BLITZ_MODELS = [{ id: "chatgpt", label: "ChatGPT" }] as const;
export type BlitzModelId = (typeof BLITZ_MODELS)[number]["id"];

export type BlitzSlide = {
  assetId: string;
  imageUrl: string;
  overlay: string;
  hashtag: string | null;
};

export type BlitzCarousel = {
  id: string;
  folderId: string;
  folderName: string;
  destFolderId: string;
  format: string;
  angle: string;
  why: string;
  slides: BlitzSlide[];
};

export type BlitzTextStyle = "box" | "outline";

export type BlitzFolderRoute = {
  sourceId: string;
  destId: string;
};

export type BlitzGenSettings = {
  carouselsPerGeneration: number;
  photosMin: number;
  photosMax: number;
  routes: BlitzFolderRoute[];
  model: BlitzModelId;
  mentionApp: boolean;
  textStyle: BlitzTextStyle;
};

export const DEFAULT_BLITZ_SETTINGS: BlitzGenSettings = {
  carouselsPerGeneration: 1,
  photosMin: 5,
  photosMax: 6,
  routes: [],
  model: "chatgpt",
  mentionApp: false,
  textStyle: "box",
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function normalizeBlitzSettings(raw: unknown): BlitzGenSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const photosMin = clampInt(o.photosMin, 1, 20, DEFAULT_BLITZ_SETTINGS.photosMin);
  const photosMax = Math.max(
    photosMin,
    clampInt(o.photosMax, 1, 20, DEFAULT_BLITZ_SETTINGS.photosMax)
  );
  return {
    carouselsPerGeneration: clampInt(
      o.carouselsPerGeneration,
      1,
      50,
      DEFAULT_BLITZ_SETTINGS.carouselsPerGeneration
    ),
    photosMin,
    photosMax,
    routes: parseBlitzRoutes(o),
    model: o.model === "chatgpt" ? "chatgpt" : "chatgpt",
    mentionApp: o.mentionApp === true,
    textStyle: o.textStyle === "outline" ? "outline" : "box",
  };
}

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function parseBlitzRoutes(o: Record<string, unknown>): BlitzFolderRoute[] {
  if (Array.isArray(o.routes)) {
    const seen = new Set<string>();
    const out: BlitzFolderRoute[] = [];
    for (const row of o.routes) {
      if (!row || typeof row !== "object") continue;
      const sourceId =
        typeof (row as { sourceId?: unknown }).sourceId === "string"
          ? (row as { sourceId: string }).sourceId.trim()
          : "";
      const destId =
        typeof (row as { destId?: unknown }).destId === "string"
          ? (row as { destId: string }).destId.trim()
          : "";
      if (!sourceId) continue;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      out.push({ sourceId, destId });
    }
    return out;
  }
  const sources = parseIdList(o.sourceFolderIds);
  const dests = parseIdList(o.destFolderIds);
  return sources.map((sourceId, i) => ({
    sourceId,
    destId: dests[i] || dests[0] || "",
  }));
}

export function activeBlitzRoutes(settings: BlitzGenSettings): BlitzFolderRoute[] {
  return settings.routes.filter((r) => r.sourceId && r.destId);
}

export function destFolderForSource(
  sourceFolderId: string,
  routes: BlitzFolderRoute[]
): string | null {
  const hit = routes.find((r) => r.sourceId === sourceFolderId && r.destId);
  return hit?.destId || null;
}

export function loadBlitzSettings(projectId: string): BlitzGenSettings {
  return normalizeBlitzSettings(readJson(blitzSettingsKey(projectId), DEFAULT_BLITZ_SETTINGS));
}

export function saveBlitzSettings(projectId: string, settings: BlitzGenSettings) {
  writeJson(blitzSettingsKey(projectId), normalizeBlitzSettings(settings));
}

export function loadBlitzCarousels(projectId: string): BlitzCarousel[] {
  const list = readJson<BlitzCarousel[]>(blitzCarouselsKey(projectId), []);
  return Array.isArray(list) ? list.filter((c) => c && Array.isArray(c.slides)) : [];
}

export function saveBlitzCarousels(projectId: string, list: BlitzCarousel[]) {
  writeJson(blitzCarouselsKey(projectId), list.slice(0, 80));
}

function imageQueuesKey(projectId: string) {
  return `zima:estudio-v1:image-queues:${projectId}`;
}

export function loadPieces(projectId: string): EstudioPiece[] {
  const list = readJson<EstudioPiece[]>(piecesKey(projectId), []);
  return Array.isArray(list) ? list : [];
}

export function savePieces(projectId: string, pieces: EstudioPiece[]) {
  writeJson(piecesKey(projectId), pieces.slice(0, 80));
}

function normalizeInfluencer(raw: unknown): EstudioInfluencer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const images = Array.isArray(o.images)
    ? o.images
        .map((shot): EstudioInfluencerShot | null => {
          if (!shot || typeof shot !== "object") return null;
          const s = shot as Record<string, unknown>;
          if (typeof s.id !== "string") return null;
          const imageUrl =
            typeof s.imageUrl === "string" && s.imageUrl.trim()
              ? s.imageUrl
              : null;
          return {
            id: s.id,
            label: typeof s.label === "string" ? s.label : s.id,
            imageUrl,
            status: typeof s.status === "string" ? s.status : undefined,
            error: typeof s.error === "string" ? s.error : null,
          };
        })
        .filter((s): s is EstudioInfluencerShot => Boolean(s))
    : [];
  return {
    id: o.id,
    name: o.name,
    traits: typeof o.traits === "string" ? o.traits : "",
    folderId: typeof o.folderId === "string" && o.folderId ? o.folderId : null,
    createdAt:
      typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    active: o.active !== false,
    images,
  };
}

export function loadInfluencers(projectId: string): EstudioInfluencer[] {
  const list = readJson<unknown[]>(influencersKey(projectId), []);
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeInfluencer)
    .filter((item): item is EstudioInfluencer => Boolean(item));
}

export function saveInfluencers(
  projectId: string,
  list: EstudioInfluencer[]
) {
  writeJson(influencersKey(projectId), list.slice(0, 40));
}

export function loadAutomations(projectId: string): EstudioAutomation[] {
  const list = readJson<EstudioAutomation[]>(automationsKey(projectId), []);
  return Array.isArray(list) ? list : [];
}

export function saveAutomations(
  projectId: string,
  list: EstudioAutomation[]
) {
  writeJson(automationsKey(projectId), list.slice(0, 40));
}

export function loadBaseIdea(projectId: string): string {
  const value = readJson<string>(baseIdeaKey(projectId), "");
  return typeof value === "string" ? value : "";
}

export function saveBaseIdea(projectId: string, text: string) {
  writeJson(baseIdeaKey(projectId), text);
}

export function loadProductContext(projectId: string): string {
  const value = readJson<string>(productContextKey(projectId), "");
  return typeof value === "string" ? value : "";
}

export function saveProductContext(projectId: string, text: string) {
  writeJson(productContextKey(projectId), text);
}

export function loadProductSummary(projectId: string): string {
  const value = readJson<string>(productSummaryKey(projectId), "");
  return typeof value === "string" ? value : "";
}

export function saveProductSummary(projectId: string, text: string) {
  writeJson(productSummaryKey(projectId), text);
}

export function clipProductSummary(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= PRODUCT_SUMMARY_MAX) return t;
  const sliced = t.slice(0, PRODUCT_SUMMARY_MAX);
  const last = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf(" "));
  return (last > PRODUCT_SUMMARY_MAX * 0.55 ? sliced.slice(0, last) : sliced).trim();
}

/** `long` → Blitz/carruseles. `short` → videos/guiones de influencer. */
export function productBriefFor(
  projectId: string,
  kind: "long" | "short"
): string {
  if (kind === "long") return loadProductContext(projectId).trim();
  const short = clipProductSummary(loadProductSummary(projectId));
  if (short) return short;
  return clipProductSummary(loadProductContext(projectId));
}

export type EstudioVideoLanguage = "es" | "en";

export function normalizeVideoFormat(value: unknown): EstudioVideoFormat {
  return value === "app-demo" ? "app-demo" : "talking";
}

export type EstudioVideoTemplate = {
  id: string;
  title: string;
  action: string;
  extra: string;
  duration: string;
  createdAt: string;
  source?: "describe" | "video";
  videoUrl?: string;
  speak?: boolean;
};

export type EstudioDynamicPickMode = "random" | "manual";

export type EstudioVideoGenSettings = {
  language: EstudioVideoLanguage;
  format: EstudioVideoFormat;
  templateId: string | null;
  templates: EstudioVideoTemplate[];
  aiOverlay: boolean;
  overlayStyle: CaptionStyleMode;
  overlayPosition: OverlayPosition;
  overlayText: string;
  modelId: string;
  favoriteModelIds: string[];
  beauty: boolean;
  dynamicId: string | null;
  dynamicPickMode: EstudioDynamicPickMode;
};

function videoGenKey(projectId: string) {
  return `zima:estudio-v1:video-gen:${projectId}`;
}

function normalizeVideoLanguage(value: unknown): EstudioVideoLanguage {
  return value === "en" ? "en" : "es";
}

function normalizeVideoDuration(value: unknown): string {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 30) return "10";
  return String(n);
}

function normalizeDynamicPickMode(value: unknown): EstudioDynamicPickMode {
  return value === "manual" ? "manual" : "random";
}

function normalizeVideoTemplate(raw: unknown): EstudioVideoTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const action = typeof o.action === "string" ? o.action.trim() : "";
  const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
  const title = titleRaw || action.slice(0, 48);
  if (!title) return null;
  const videoUrl =
    typeof o.videoUrl === "string" && /^https?:\/\//i.test(o.videoUrl.trim())
      ? o.videoUrl.trim()
      : "";
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id : newId(),
    title,
    action: action || title,
    extra: typeof o.extra === "string" ? o.extra.trim() : "",
    duration: normalizeVideoDuration(o.duration),
    createdAt:
      typeof o.createdAt === "string" && o.createdAt
        ? o.createdAt
        : new Date().toISOString(),
    source: o.source === "video" || videoUrl ? "video" : "describe",
    videoUrl,
    speak: o.speak !== false,
  };
}

export function loadVideoGenSettings(projectId: string): EstudioVideoGenSettings {
  const raw = readJson<Partial<EstudioVideoGenSettings>>(videoGenKey(projectId), {
    language: "es",
    format: "talking",
    templateId: null,
    templates: [],
    aiOverlay: true,
    overlayStyle: "snapchat",
    beauty: true,
  });
  const templates = (Array.isArray(raw.templates) ? raw.templates : [])
    .map(normalizeVideoTemplate)
    .filter((t): t is EstudioVideoTemplate => Boolean(t))
    .slice(0, 80);
  const templateId =
    typeof raw.templateId === "string" &&
    templates.some((t) => t.id === raw.templateId)
      ? raw.templateId
      : null;
  const modelId = getFalVideoModel(
    typeof raw.modelId === "string" ? raw.modelId : DEFAULT_FAL_VIDEO_MODEL
  ).id;
  const favoriteModelIds = normalizeFavoriteModelIds(
    raw.favoriteModelIds,
    modelId
  );
  return {
    language: normalizeVideoLanguage(raw.language),
    format: normalizeVideoFormat(raw.format),
    aiOverlay: raw.aiOverlay !== false,
    overlayStyle: normalizeCaptionStyleMode(raw.overlayStyle),
    overlayPosition: normalizeOverlayPosition(
      (raw as { overlayPosition?: unknown }).overlayPosition
    ),
    overlayText:
      typeof (raw as { overlayText?: unknown }).overlayText === "string"
        ? (raw as { overlayText: string }).overlayText
        : "",
    modelId,
    favoriteModelIds,
    beauty: raw.beauty !== false,
    templateId,
    templates,
    dynamicId:
      typeof (raw as { dynamicId?: unknown }).dynamicId === "string" &&
      (raw as { dynamicId: string }).dynamicId.trim()
        ? (raw as { dynamicId: string }).dynamicId.trim()
        : null,
    dynamicPickMode: normalizeDynamicPickMode(
      (raw as { dynamicPickMode?: unknown }).dynamicPickMode
    ),
  };
}

export function saveVideoGenSettings(
  projectId: string,
  settings: EstudioVideoGenSettings
) {
  const templates = settings.templates
    .map(normalizeVideoTemplate)
    .filter((t): t is EstudioVideoTemplate => Boolean(t))
    .slice(0, 80);
  writeJson(videoGenKey(projectId), {
    language: normalizeVideoLanguage(settings.language),
    format: normalizeVideoFormat(settings.format),
    aiOverlay: settings.aiOverlay !== false,
    overlayStyle: normalizeCaptionStyleMode(settings.overlayStyle),
    overlayPosition: normalizeOverlayPosition(settings.overlayPosition),
    overlayText: settings.overlayText || "",
    modelId: getFalVideoModel(settings.modelId).id,
    favoriteModelIds: normalizeFavoriteModelIds(
      settings.favoriteModelIds,
      settings.modelId
    ),
    beauty: settings.beauty !== false,
    templateId:
      settings.templateId && templates.some((t) => t.id === settings.templateId)
        ? settings.templateId
        : null,
    templates,
    dynamicId: settings.dynamicId?.trim() || null,
    dynamicPickMode: normalizeDynamicPickMode(settings.dynamicPickMode),
  });
}

export type EstudioImageJobStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "saving"
  | "saved"
  | "failed";

export type EstudioImageJob = {
  id: string;
  prompt: string;
  requestId: string | null;
  status: string;
  imageUrl: string | null;
  assetId: string | null;
  error: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lockedAt?: string | null;
  archivedAt?: string | null;
};

export type EstudioImageQueue = {
  id: string;
  createdAt: string;
  modelId: string;
  modelName: string;
  presetId: string;
  folderId: string;
  folderName: string;
  jobs: EstudioImageJob[];
};

export function splitImagePrompts(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadImageQueues(projectId: string): EstudioImageQueue[] {
  const list = readJson<EstudioImageQueue[]>(imageQueuesKey(projectId), []);
  if (!Array.isArray(list)) return [];
  return list.map((q) => {
    const retired =
      q.presetId === "openai-dall-e-3" ||
      q.modelId === "dall-e-3" ||
      q.modelId === "dall-e-2";
    const next = retired
      ? {
          ...q,
          presetId: "openai-gpt-image-2",
          modelId: "gpt-image-2",
          modelName: "GPT Image 2",
        }
      : q;
    return {
      ...next,
      jobs: (next.jobs ?? []).map((j) =>
        j.status === "saving" ? { ...j, status: "completed" } : j
      ),
    };
  });
}

export function saveImageQueues(
  projectId: string,
  list: EstudioImageQueue[]
) {
  writeJson(imageQueuesKey(projectId), list.slice(0, 40));
}

export function imageQueueActiveCount(queues: EstudioImageQueue[]): number {
  return queues.reduce(
    (n, q) =>
      n +
      q.jobs.filter(
        (j) =>
          j.status !== "saved" &&
          j.status !== "failed" &&
          j.status !== "nsfw" &&
          j.status !== "canceled" &&
          j.status !== "cancelled"
      ).length,
    0
  );
}

export function formatElapsed(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  return `${hours} h ${min % 60} min`;
}

export function describeImageJob(
  job: EstudioImageJob,
  ctx: { modelName: string; place: number; waiting: number }
): { line: string; tone: "ok" | "err" | "run" } {
  const model = ctx.modelName || "el modelo";
  const waited = formatElapsed(job.updatedAt || job.createdAt);
  const sinceCreate = formatElapsed(job.createdAt);
  const failed =
    job.status === "failed" ||
    job.status === "nsfw" ||
    job.status === "canceled" ||
    job.status === "cancelled";

  if (job.error || failed) {
    return {
      line: job.error || "Falló la generación",
      tone: "err",
    };
  }
  if (job.status === "saved") {
    return { line: "Guardada en Library", tone: "ok" };
  }
  if (job.status === "saving") {
    return {
      line: waited
        ? `Guardando en Library · ${waited}`
        : "Guardando en Library…",
      tone: "run",
    };
  }
  if (job.status === "in_progress") {
    return {
      line: waited
        ? `Generando con ${model} · lleva ${waited}`
        : `Generando con ${model}…`,
      tone: "run",
    };
  }
  if (job.status === "completed") {
    return {
      line: "Imagen lista · guardando en Library…",
      tone: "run",
    };
  }
  if (job.status === "queued" && job.requestId) {
    return {
      line: waited
        ? `${model} está generando en el proveedor · lleva ${waited}`
        : `${model} está generando en el proveedor…`,
      tone: "run",
    };
  }

  const stale =
    Boolean(job.createdAt) &&
    Date.now() - Date.parse(job.createdAt || "") > 20_000;
  const place =
    ctx.waiting > 1 ? `turno ${ctx.place} de ${ctx.waiting}` : "siguiente";
  if (stale) {
    return {
      line: `Pendiente · ${place} · lleva ${sinceCreate || waited || "un rato"} sin que el servidor la tome`,
      tone: "run",
    };
  }
  return {
    line: `Esperando turno (${place}) · ${model}${
      sinceCreate ? ` · ${sinceCreate}` : ""
    }`,
    tone: "run",
  };
}

export type EstudioInspirationLink = {
  id: string;
  url: string;
  title: string | null;
  platform: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

function inspirationKey(projectId: string) {
  return `zima:estudio-v1:inspiration:${projectId}`;
}
function viralResultKey(projectId: string) {
  return `zima:estudio-v1:viral-result:${projectId}`;
}

export function loadInspiration(
  projectId: string
): EstudioInspirationLink[] {
  const list = readJson<EstudioInspirationLink[]>(
    inspirationKey(projectId),
    []
  );
  return Array.isArray(list) ? list : [];
}

export function saveInspiration(
  projectId: string,
  list: EstudioInspirationLink[]
) {
  writeJson(inspirationKey(projectId), list.slice(0, 200));
}

export type EstudioViralHit = {
  name: string;
  structure: string;
  why: string;
  hooks: string[];
  sourceUrl: string | null;
  videoUrl: string | null;
  videoNote: string;
  videoDescription: string;
  howToUse: string;
  platform: string;
};

export type EstudioViralResult = {
  report: string;
  items: EstudioViralHit[];
  generatedAt: string;
};

export function loadViralResult(projectId: string): EstudioViralResult | null {
  const value = readJson<EstudioViralResult | null>(
    viralResultKey(projectId),
    null
  );
  if (!value || typeof value !== "object") return null;
  return {
    report: typeof value.report === "string" ? value.report : "",
    items: Array.isArray(value.items) ? value.items : [],
    generatedAt:
      typeof value.generatedAt === "string" ? value.generatedAt : "",
  };
}

export function saveViralResult(projectId: string, result: EstudioViralResult) {
  writeJson(viralResultKey(projectId), {
    ...result,
    items: result.items.slice(0, 12),
  });
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `est-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
