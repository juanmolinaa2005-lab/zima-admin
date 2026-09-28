import {
  normalizeOverlayLanguage,
  type OverlayLanguageId,
} from "@/lib/creator/overlay-language";
import {
  isCaptionStyleId,
  isOverlayPosition,
  type CaptionStyleId,
  type OverlayPosition,
} from "@/lib/creator/overlay-styles";

export type DynamicSlot = {
  id: string;
  name: string;
  description: string;
  folderId: string;
  allowTrim: boolean;
};

export type DynamicPartPrompt = {
  id: string;
  text: string;
};

export const DYNAMIC_PART_KINDS = ["mimic", "video", "music", "overlay"] as const;
export type DynamicPartKind = (typeof DYNAMIC_PART_KINDS)[number];

export function isDynamicPartKind(v: unknown): v is DynamicPartKind {
  return v === "mimic" || v === "video" || v === "music" || v === "overlay";
}

export function isVideoLikePartKind(kind: string) {
  return kind === "video" || kind === "mimic";
}

export function parseDynamicPartKind(v: unknown): DynamicPartKind {
  if (v === "texto" || v === "text" || v === "overlay") return "overlay";
  if (v === "music") return "music";
  if (v === "mimic" || v === "mimic_motion" || v === "mimic-motion") return "mimic";
  return "video";
}

export type OverlayTextMode = "list" | "prompt";

export function isOverlayTextMode(v: unknown): v is OverlayTextMode {
  return v === "list" || v === "prompt";
}

export type DynamicPart = {
  id: string;
  name: string;
  kind: DynamicPartKind;
  folderId: string;
  prompts: DynamicPartPrompt[];
  videoCount: number;
  previewUrl: string | null;
  audioCount: number;
  audioUrl: string | null;
  overlayStyle?: CaptionStyleId;
  overlayPosition?: OverlayPosition;
  overlayPrompt?: string;
  overlayLanguage?: OverlayLanguageId;
};

export const DEFAULT_CLIP_SEC = 4;
export const MIN_CLIP_SEC = 0.4;

export const DYNAMIC_COVERS = [
  { id: "aurora", from: "#7c3aed", to: "#22d3ee" },
  { id: "sunset", from: "#f43f5e", to: "#fb923c" },
  { id: "ocean", from: "#2563eb", to: "#06b6d4" },
  { id: "lime", from: "#059669", to: "#a3e635" },
  { id: "orchid", from: "#db2777", to: "#818cf8" },
  { id: "ember", from: "#ea580c", to: "#fbbf24" },
  { id: "night", from: "#1e1b4b", to: "#6366f1" },
  { id: "mint", from: "#0f766e", to: "#5eead4" },
] as const;

export type DynamicCoverId = (typeof DYNAMIC_COVERS)[number]["id"];

export function isDynamicCoverId(v: unknown): v is DynamicCoverId {
  return typeof v === "string" && DYNAMIC_COVERS.some((c) => c.id === v);
}

function hashCoverIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % DYNAMIC_COVERS.length;
}

export function coverIdForDynamic(id: string, stored?: string | null): DynamicCoverId {
  if (isDynamicCoverId(stored)) return stored;
  return DYNAMIC_COVERS[hashCoverIndex(id || "dynamic")].id;
}

export function nextCoverId(used: (string | null | undefined)[]): DynamicCoverId {
  const taken = new Set(used.filter(isDynamicCoverId));
  const free = DYNAMIC_COVERS.find((c) => !taken.has(c.id));
  return free?.id ?? DYNAMIC_COVERS[used.length % DYNAMIC_COVERS.length].id;
}

export function coverGradientCss(id: string, stored?: string | null): string {
  const cover =
    DYNAMIC_COVERS.find((c) => c.id === coverIdForDynamic(id, stored)) ?? DYNAMIC_COVERS[0];
  return `linear-gradient(165deg, ${cover.from} 0%, ${cover.to} 100%)`;
}

export function dynamicsEditorPath(projectId: string, dynamicId: string) {
  return `/projects/${projectId}/dynamics/${encodeURIComponent(dynamicId)}`;
}

export type DynamicTemplateExtras = {
  name?: string;
  coverId: string | null;
  videoPartIds: string[];
  videoAssetIds: (string | null)[];
  videoTrimStarts: number[];
  videoDurations: number[];
  partAId: string | null;
  partBId: string | null;
  overlayEnabled: boolean;
  overlayText: string;
  overlayStyle: CaptionStyleId;
  overlayPosition: OverlayPosition;
  overlayPartId: string | null;
  overlayMode: OverlayTextMode;
  musicEnabled: boolean;
  musicAssetId: string | null;
  musicName: string | null;
  musicUrl: string | null;
};

export type StudioDynamic = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  folderId: string;
  slots: DynamicSlot[];
} & DynamicTemplateExtras;

export const EMPTY_DYNAMIC_EXTRAS: DynamicTemplateExtras = {
  coverId: null,
  videoPartIds: [],
  videoAssetIds: [],
  videoTrimStarts: [],
  videoDurations: [],
  partAId: null,
  partBId: null,
  overlayEnabled: false,
  overlayText: "",
  overlayStyle: "snapchat",
  overlayPosition: "upper",
  overlayPartId: null,
  overlayMode: "list",
  musicEnabled: false,
  musicAssetId: null,
  musicName: null,
  musicUrl: null,
};

export const DYNAMIC_PART_KIND_LABELS: Record<DynamicPartKind, string> = {
  mimic: "Mimic Motion",
  video: "Video",
  music: "Música",
  overlay: "Texto",
};

function numAt(list: number[] | null | undefined, i: number, fallback: number) {
  const n = list?.[i];
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : fallback;
}

export function withVideoPartIds(
  ids: string[],
  assetIds?: (string | null)[] | null,
  trimStarts?: number[] | null,
  durations?: number[] | null
): Pick<
  DynamicTemplateExtras,
  | "videoPartIds"
  | "videoAssetIds"
  | "videoTrimStarts"
  | "videoDurations"
  | "partAId"
  | "partBId"
> {
  const videoPartIds = ids.filter(Boolean);
  const videoAssetIds = videoPartIds.map((_, i) => {
    const id = assetIds?.[i];
    return typeof id === "string" && id ? id : null;
  });
  const videoTrimStarts = videoPartIds.map((_, i) => numAt(trimStarts, i, 0));
  const videoDurations = videoPartIds.map((_, i) =>
    Math.max(MIN_CLIP_SEC, numAt(durations, i, DEFAULT_CLIP_SEC) || DEFAULT_CLIP_SEC)
  );
  return {
    videoPartIds,
    videoAssetIds,
    videoTrimStarts,
    videoDurations,
    partAId: videoPartIds[0] || null,
    partBId: videoPartIds[1] || null,
  };
}

export type DynamicPartMeta = {
  prompts: DynamicPartPrompt[];
  kind: DynamicPartKind;
  overlayStyle?: CaptionStyleId;
  overlayPosition?: OverlayPosition;
  overlayPrompt?: string;
  overlayLanguage?: OverlayLanguageId;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

export function parseDynamicPrompts(raw: unknown): DynamicPartPrompt[] {
  if (!Array.isArray(raw)) return [];
  const list: DynamicPartPrompt[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    const id = typeof o.id === "string" && o.id ? o.id : "";
    if (!text && !id) continue;
    list.push({
      id: id || `prompt-${list.length + 1}`,
      text: text.slice(0, 800),
    });
  }
  return list;
}

export function parseDynamicExtras(raw: unknown): DynamicTemplateExtras {
  const root = asRecord(raw);
  const o = asRecord(root?.extras) || root;
  if (!o) return { ...EMPTY_DYNAMIC_EXTRAS };
  return extrasFromPartial({
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 120) : undefined,
    coverId: isDynamicCoverId(o.coverId) ? o.coverId : null,
    videoPartIds: Array.isArray(o.videoPartIds)
      ? o.videoPartIds.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [],
    videoAssetIds: Array.isArray(o.videoAssetIds)
      ? o.videoAssetIds.map((id) => (typeof id === "string" && id ? id : null))
      : [],
    videoTrimStarts: Array.isArray(o.videoTrimStarts)
      ? o.videoTrimStarts.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0))
      : [],
    videoDurations: Array.isArray(o.videoDurations)
      ? o.videoDurations.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0))
      : [],
    partAId: typeof o.partAId === "string" && o.partAId ? o.partAId : null,
    partBId: typeof o.partBId === "string" && o.partBId ? o.partBId : null,
    overlayEnabled: o.overlayEnabled === true,
    overlayText: typeof o.overlayText === "string" ? o.overlayText.slice(0, 140) : "",
    overlayStyle: isCaptionStyleId(o.overlayStyle) ? o.overlayStyle : "snapchat",
    overlayPosition: isOverlayPosition(o.overlayPosition) ? o.overlayPosition : "upper",
    overlayPartId: typeof o.overlayPartId === "string" && o.overlayPartId ? o.overlayPartId : null,
    overlayMode: isOverlayTextMode(o.overlayMode) ? o.overlayMode : "list",
    musicEnabled: o.musicEnabled === true,
    musicAssetId:
      typeof o.musicAssetId === "string" && o.musicAssetId ? o.musicAssetId : null,
    musicName: typeof o.musicName === "string" ? o.musicName : null,
    musicUrl: typeof o.musicUrl === "string" ? o.musicUrl : null,
  });
}

export function parseDynamicPartMeta(raw: unknown): DynamicPartMeta {
  const root = asRecord(raw);
  const payload = root?.part !== undefined ? root.part : raw;
  if (Array.isArray(payload)) {
    return { prompts: parseDynamicPrompts(payload), kind: "video" };
  }
  const o = asRecord(payload);
  if (!o) return { prompts: [], kind: "video" };
  return {
    prompts: parseDynamicPrompts(o.prompts ?? payload),
    kind: isDynamicPartKind(o.kind) ? o.kind : "video",
    overlayStyle: isCaptionStyleId(o.overlayStyle) ? o.overlayStyle : undefined,
    overlayPosition: isOverlayPosition(o.overlayPosition) ? o.overlayPosition : undefined,
    overlayPrompt: typeof o.overlayPrompt === "string" ? o.overlayPrompt.slice(0, 800) : "",
    overlayLanguage:
      o.overlayLanguage === undefined
        ? undefined
        : normalizeOverlayLanguage(o.overlayLanguage),
  };
}

export function extrasHaveContent(extras: DynamicTemplateExtras) {
  return Boolean(
    extras.videoPartIds.length ||
      extras.overlayEnabled ||
      extras.musicEnabled ||
      extras.coverId ||
      extras.overlayText.trim() ||
      extras.musicUrl
  );
}

export function parseDynamicJobExtra(raw: string | null | undefined): {
  tails: string[];
  dynamic: boolean;
} {
  if (!raw || !raw.trim().startsWith("{")) return { tails: [], dynamic: false };
  try {
    const parsed = JSON.parse(raw) as { tails?: unknown; dynamic?: unknown };
    const tails = Array.isArray(parsed.tails)
      ? parsed.tails.filter(
          (url): url is string => typeof url === "string" && Boolean(url.trim())
        )
      : [];
    return { tails, dynamic: parsed.dynamic === true || tails.length > 0 };
  } catch {
    return { tails: [], dynamic: false };
  }
}

export function jobNeedsDynamicCompose(row: {
  demo_video_url?: string | null;
  extra?: string | null;
}) {
  const extra = parseDynamicJobExtra(row.extra);
  return extra.dynamic || extra.tails.length > 0;
}

export function extrasAreMeaningful(extras: DynamicTemplateExtras) {
  return extrasHaveContent(extras) || Boolean(extras.name);
}

export function extrasFromPartial(
  item: Partial<DynamicTemplateExtras>
): DynamicTemplateExtras {
  const ids = item.videoPartIds?.length
    ? item.videoPartIds
    : [item.partAId, item.partBId].filter((id): id is string => Boolean(id));
  return {
    ...EMPTY_DYNAMIC_EXTRAS,
    ...item,
    ...withVideoPartIds(
      ids,
      item.videoAssetIds,
      item.videoTrimStarts,
      item.videoDurations
    ),
  };
}
