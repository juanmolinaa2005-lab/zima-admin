import { newId, type EstudioVideoLanguage } from "@/lib/creator/estudio-v1";
import { getFalVideoDuration, isFalVoiceVideoModel, DEFAULT_FAL_VIDEO_MODEL } from "@/lib/creator/fal-video-models";
import {
  influencerActionVideoPrompt,
  influencerIphoneVideoPrompt,
} from "@/lib/creator/influencer-video";
import {
  estimateInfluencerVideoCost,
  type InfluencerVideoCost,
} from "@/lib/creator/influencer-video-cost";

export const KLING_AUDIO_VOICE_NOTE =
  "Kling genera voz nativa en chino o inglés. Otros idiomas, incluido el español, se traducen a inglés en el proveedor: el guion en español no garantiza voz en español.";
export const V2_MAX_SCENES = 8;
export const V2_MIN_DURATION_SEC = 1;
export const V2_MAX_DURATION_SEC = 15;
export const V2_MAX_TOTAL_DURATION_SEC = 90;
export const V2_MAX_CLIP_BYTES = 80 * 1024 * 1024;
export const V2_MAX_COMPOSE_BYTES = 400 * 1024 * 1024;

export const V2_ROLES = ["presenter", "action", "product"] as const;
export type V2SceneRole = (typeof V2_ROLES)[number];

export const V2_SOURCES = ["generate", "gallery", "app-demo"] as const;
export type V2SceneSource = (typeof V2_SOURCES)[number];

export const V2_FRAMINGS = [
  "close-up",
  "medium",
  "wide",
  "over-shoulder",
] as const;
export type V2Framing = (typeof V2_FRAMINGS)[number];

export type V2SceneAudio = "input" | "silent";

export type V2Continuity = {
  wardrobe: string;
  lighting: string;
  setting: string;
};

export type V2CampaignStatus =
  | "draft"
  | "planned"
  | "generating"
  | "ready"
  | "composing"
  | "done"
  | "failed";

export type V2Scene = {
  id: string;
  role: V2SceneRole;
  source: V2SceneSource;
  title: string;
  script: string;
  overlay: string;
  action: string;
  extra: string;
  framing: V2Framing;
  durationSec: number;
  audio: V2SceneAudio;
  galleryAssetId: string | null;
  galleryAssetName: string | null;
  videoId: string | null;
  /** True: note on the timeline only. Not generated, not included in the MP4. */
  planningOnly: boolean;
};

export type V2JobPublic = {
  id: string;
  sceneId: string | null;
  status: string;
  videoUrl: string | null;
  assetId: string | null;
  error: string | null;
  requestId: string | null;
  estimatedCostUsd: number | null;
  duration: string | null;
  providerStatus: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type V2Campaign = {
  id: string;
  projectId: string;
  influencerId: string | null;
  title: string;
  brief: string;
  objective: string;
  language: EstudioVideoLanguage;
  modelId: string;
  status: V2CampaignStatus;
  continuity: V2Continuity;
  scenes: V2Scene[];
  finalAssetId: string | null;
  finalVideoUrl: string | null;
  estimatedCostUsd: number | null;
  createdAt: string;
  updatedAt: string;
};

export type V2SceneKind = "generate" | "gallery" | "app-demo" | "planning";

export function v2RoleLabel(role: V2SceneRole): string {
  if (role === "presenter") return "Presentadora";
  if (role === "action") return "Acción / B-roll";
  return "Prueba del producto";
}

export function v2SourceLabel(source: V2SceneSource): string {
  if (source === "generate") return "Generación IA del personaje";
  if (source === "gallery") return "Vídeo real de galería";
  return "App Demo existente";
}

export function v2FramingLabel(framing: V2Framing): string {
  if (framing === "close-up") return "Primer plano";
  if (framing === "medium") return "Plano medio";
  if (framing === "wide") return "Plano general";
  return "Sobre el hombro";
}

export function emptyContinuity(): V2Continuity {
  return { wardrobe: "", lighting: "", setting: "" };
}

function asRole(value: unknown): V2SceneRole {
  return V2_ROLES.includes(value as V2SceneRole)
    ? (value as V2SceneRole)
    : "presenter";
}

function asSource(value: unknown): V2SceneSource {
  return V2_SOURCES.includes(value as V2SceneSource)
    ? (value as V2SceneSource)
    : "generate";
}

function asFraming(value: unknown): V2Framing {
  return V2_FRAMINGS.includes(value as V2Framing)
    ? (value as V2Framing)
    : "medium";
}

export function clampV2Duration(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(V2_MAX_DURATION_SEC, Math.max(V2_MIN_DURATION_SEC, Math.round(n)));
}

function clipText(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function asId(value: unknown): string {
  const id = String(value ?? "").trim();
  return id || newId();
}

/**
 * Product proof cannot be AI-invented UI. Gallery/app-demo without an asset
 * stay as planning notes until the user attaches a real clip.
 */
export function normalizeV2Scene(raw: unknown): V2Scene {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let role = asRole(o.role);
  let source = asSource(o.source);
  const galleryAssetId =
    typeof o.galleryAssetId === "string" && o.galleryAssetId.trim()
      ? o.galleryAssetId.trim()
      : null;
  const videoId =
    typeof o.videoId === "string" && o.videoId.trim() ? o.videoId.trim() : null;

  if (role === "product" && source === "generate") {
    source = "gallery";
  }
  if (source === "generate" && role === "product") {
    role = "action";
    source = "generate";
  }

  const planningFlag = o.planningOnly === true;
  const needsAsset = source === "gallery" || source === "app-demo";
  const planningOnly =
    source === "generate"
      ? false
      : planningFlag || (needsAsset && !galleryAssetId);

  const audio: V2SceneAudio =
    o.audio === "silent" || o.audio === "input"
      ? o.audio
      : source === "generate" && role === "presenter"
        ? "input"
        : "silent";

  return {
    id: asId(o.id),
    role,
    source,
    title:
      clipText(o.title, 80) ||
      (role === "presenter"
        ? "Hook a cámara"
        : role === "action"
          ? "B-roll en contexto"
          : "Prueba visual real"),
    script: clipText(o.script, 700),
    overlay: clipText(o.overlay, 80),
    action: clipText(o.action, 420),
    extra: clipText(o.extra, 180),
    framing: asFraming(o.framing),
    durationSec: clampV2Duration(o.durationSec, role === "presenter" ? 8 : 5),
    audio,
    galleryAssetId,
    galleryAssetName: clipText(o.galleryAssetName, 180) || null,
    videoId,
    planningOnly,
  };
}

export function normalizeV2Scenes(raw: unknown): V2Scene[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: V2Scene[] = [];
  for (let i = 0; i < list.length && out.length < V2_MAX_SCENES; i++) {
    const scene = normalizeV2Scene(list[i]);
    if (seen.has(scene.id)) scene.id = newId();
    seen.add(scene.id);
    out.push(scene);
  }
  return out;
}

export function defaultV2Scenes(): V2Scene[] {
  return normalizeV2Scenes([
    {
      role: "presenter",
      source: "generate",
      title: "Hook a cámara",
      action:
        "Habla a cámara con un micro de mano, tono natural de TikTok, sin pose de anuncio.",
      framing: "medium",
      durationSec: 8,
      audio: "input",
    },
    {
      role: "action",
      source: "generate",
      title: "B-roll en contexto",
      action:
        "Hace la actividad del producto en un entorno real (gimnasio, cocina, calle). No mira a cámara.",
      framing: "wide",
      durationSec: 5,
      audio: "silent",
    },
    {
      role: "product",
      source: "gallery",
      title: "Prueba visual real",
      action:
        "Primer plano del producto o la app real. No inventar la UI: usar un vídeo de galería o la App Demo guardada.",
      framing: "close-up",
      durationSec: 5,
      audio: "silent",
      planningOnly: true,
    },
  ]);
}

export function normalizeContinuity(raw: unknown): V2Continuity {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    wardrobe: clipText(o.wardrobe, 180),
    lighting: clipText(o.lighting, 120),
    setting: clipText(o.setting, 180),
  };
}

export function continuityLine(c: V2Continuity): string {
  return [c.wardrobe && `ropa ${c.wardrobe}`, c.lighting && `luz ${c.lighting}`, c.setting && `lugar ${c.setting}`]
    .filter(Boolean)
    .join(", ");
}

export function sceneKind(scene: V2Scene): V2SceneKind {
  if (scene.planningOnly) return "planning";
  if (scene.source === "gallery") {
    return scene.galleryAssetId ? "gallery" : "planning";
  }
  if (scene.source === "app-demo") {
    return scene.galleryAssetId ? "app-demo" : "planning";
  }
  return "generate";
}

export function sceneKindLabel(kind: V2SceneKind): string {
  if (kind === "planning") {
    return "Solo planificación — no se genera ni entra en el MP4";
  }
  if (kind === "generate") return "Se genera con el modelo de vídeo (personaje)";
  if (kind === "gallery") return "Clip real de galería";
  return "App Demo ya guardada (no se inventa la UI)";
}

export function isActiveVideoStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return (
    s === "queued" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "saving" ||
    s === "draft"
  );
}

export function isFailedVideoStatus(status: string | null | undefined): boolean {
  return (status || "").toLowerCase() === "failed";
}

export function isReadyVideoStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "saved" || s === "completed";
}

/** New provider jobs only. Existing queued/ready/failed jobs are never re-inserted. */
export function scenesToEnqueue(
  scenes: V2Scene[],
  jobs: Record<string, { status: string; error?: string | null; requestId?: string | null }>
): V2Scene[] {
  return scenes.filter((scene) => {
    if (sceneKind(scene) !== "generate") return false;
    if (!scene.videoId) return true;
    return !jobs[scene.videoId];
  });
}

/** Failed jobs of this campaign only — never other influencer drafts. */
export function scenesToRetry(
  scenes: V2Scene[],
  jobs: Record<string, { status: string; error?: string | null }>
): V2Scene[] {
  return scenes.filter((scene) => {
    if (sceneKind(scene) !== "generate") return false;
    if (!scene.videoId) return false;
    const job = jobs[scene.videoId];
    if (!job) return false;
    if (isActiveVideoStatus(job.status) || isReadyVideoStatus(job.status)) {
      return false;
    }
    return isFailedVideoStatus(job.status);
  });
}

export function scenesForCompose(scenes: V2Scene[]): V2Scene[] {
  return scenes.filter((scene) => {
    const kind = sceneKind(scene);
    return kind === "generate" || kind === "gallery" || kind === "app-demo";
  });
}

export function composeBlockers(
  scenes: V2Scene[],
  jobs: Record<string, { status: string; videoUrl?: string | null; assetId?: string | null }>
): string[] {
  const blockers: string[] = [];
  const usable = scenesForCompose(scenes);
  if (!usable.length) {
    blockers.push(
      "No hay escenas montables. Añade generación del personaje o un vídeo real de galería."
    );
    return blockers;
  }
  for (const scene of usable) {
    const kind = sceneKind(scene);
    if (kind === "gallery" || kind === "app-demo") {
      if (!scene.galleryAssetId) {
        blockers.push(`${scene.title}: falta el vídeo de galería.`);
      }
      continue;
    }
    if (!scene.videoId) {
      blockers.push(`${scene.title}: todavía no tiene job de generación.`);
      continue;
    }
    const job = jobs[scene.videoId];
    if (!job || (!job.videoUrl && !job.assetId) || !isReadyVideoStatus(job.status)) {
      blockers.push(`${scene.title}: el clip generado aún no está listo.`);
    }
  }
  const total = usable.reduce((n, s) => n + s.durationSec, 0);
  if (total > V2_MAX_TOTAL_DURATION_SEC) {
    blockers.push(
      `Duración total ${total}s (máx. ${V2_MAX_TOTAL_DURATION_SEC}s). Recorta escenas.`
    );
  }
  return blockers;
}

export function estimateV2CampaignCost(opts: {
  scenes: V2Scene[];
  modelId: string | null | undefined;
  refCount: number;
  jobs?: Record<string, { status: string }>;
}): {
  scenes: number;
  skipReady: number;
  cost: InfluencerVideoCost;
  billedDurationSec: number;
} {
  const jobs = opts.jobs || {};
  let scenes = 0;
  let skipReady = 0;
  let billedDurationSec = 0;
  let frameUsd = 0;
  let videoUsd = 0;
  for (const scene of opts.scenes) {
    if (sceneKind(scene) !== "generate") continue;
    const job = scene.videoId ? jobs[scene.videoId] : undefined;
    if (job && isReadyVideoStatus(job.status)) {
      skipReady += 1;
      continue;
    }
    if (job && isActiveVideoStatus(job.status)) {
      skipReady += 1;
      continue;
    }
    scenes += 1;
    const billed = Number(getFalVideoDuration(opts.modelId, scene.durationSec));
    billedDurationSec += billed;
    const part = estimateInfluencerVideoCost({
      modelId: opts.modelId,
      refCount: opts.refCount,
      durationSec: billed,
    });
    frameUsd += part.frameUsd;
    videoUsd += part.videoUsd;
  }
  return {
    scenes,
    skipReady,
    billedDurationSec,
    cost: { frameUsd, videoUsd, totalUsd: frameUsd + videoUsd },
  };
}

/** Text stored on estudio_influencer_videos.script for the start-frame worker.
 * The worker prefers script over action. B-roll must never store presenter dialogue. */
export function v2StoredJobScript(scene: V2Scene): string {
  if (scene.role === "action") {
    return (scene.action || scene.script).trim();
  }
  return (scene.script || "").trim();
}

export function v2SceneVideoPrompt(opts: {
  scene: V2Scene;
  name: string;
  traits?: string;
  language: EstudioVideoLanguage;
  continuity: V2Continuity;
}): string {
  const extra = [opts.scene.extra, continuityLine(opts.continuity)]
    .filter(Boolean)
    .join(". ");
  const framing = v2FramingLabel(opts.scene.framing);
  if (opts.scene.role === "action") {
    return influencerActionVideoPrompt({
      name: opts.name,
      traits: opts.traits,
      action: opts.scene.action || opts.scene.script,
      extra,
      framing,
      continuity: continuityLine(opts.continuity),
      language: opts.language,
    });
  }
  return influencerIphoneVideoPrompt({
    name: opts.name,
    traits: opts.traits,
    script: opts.scene.script,
    product: "",
    language: opts.language,
    action: opts.scene.action,
    extra: [extra, `Framing: ${framing}`].filter(Boolean).join(". "),
    klingVoice: opts.language === "en" ? "en" : "translated",
  });
}

export function v2StoryboardPrompt(opts: {
  brief: string;
  objective: string;
  product: string;
  language: EstudioVideoLanguage;
  name: string;
  traits: string;
  hasAppDemo: boolean;
  galleryCount: number;
}): string {
  const lang = opts.language === "en" ? "English" : "español";
  const who = opts.name.trim() || "el influencer";
  const product = opts.product.trim() || opts.brief.trim() || "una app consumer";
  const gallery = opts.galleryCount
    ? `Hay ${opts.galleryCount} vídeos reales en la galería del proyecto para prueba de producto.`
    : "Puede que aún no haya vídeos de galería: la escena de producto debe quedar como planificación hasta que elijan un asset.";
  const demo = opts.hasAppDemo
    ? "Hay una App Demo guardada. La prueba de producto puede usarla; nunca inventes pantallas."
    : "Si no hay App Demo, la prueba de producto es galería o planificación.";

  return `Planifica UN storyboard UGC vertical 9:16 en ${lang} (máx. ${V2_MAX_SCENES} escenas, 3 a 5 recomendadas).
Personaje: ${who}. Look: ${opts.traits.trim() || "creador UGC natural"}.
Brief: ${opts.brief.trim() || product}
Objetivo: ${opts.objective.trim() || "hook + prueba real + CTA suave"}
Producto/contexto: ${product}
${gallery}
${demo}

Estructura de calidad (tipo presentadora + B-roll + prueba real):
1) Al menos una escena role=presenter, source=generate: habla a cámara (micro de mano opcional), hook.
2) Al menos una escena role=action, source=generate: B-roll/acción del mismo personaje, continuidad de ropa/luz/lugar. NO es talking-head.
3) Al menos una escena role=product, source=gallery o app-demo: prueba visual REAL. source=generate ESTÁ PROHIBIDO en producto. No describas píxeles de una UI inventada.

Cada escena: title, role, source, script (solo presenter; action puede ir vacío), action (dirección de cámara), extra (lugar), framing (close-up|medium|wide|over-shoulder), durationSec (1-15), overlay opcional (máx 8 palabras, no se habla).
Añade continuity {wardrobe, lighting, setting} para TODO el vídeo.
No prometas grabaciones reales, métricas, ni voz española garantizada (Kling: audio nativo chino/inglés; el resto se traduce a inglés).
La generación IA solo cubre presenter/action del personaje.
Responde SOLO JSON:
{"title":"...","continuity":{"wardrobe":"...","lighting":"...","setting":"..."},"scenes":[{"role":"presenter","source":"generate","title":"...","script":"...","action":"...","extra":"...","framing":"medium","durationSec":8,"overlay":""}]}`;
}

export function parseV2Storyboard(
  text: string,
  fallback: { brief: string; objective: string }
): { title: string; continuity: V2Continuity; scenes: V2Scene[] } | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const take = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const scenes = normalizeV2Scenes(o.scenes);
    if (!scenes.length) return null;
    return {
      title:
        clipText(o.title, 80) ||
        clipText(fallback.objective, 80) ||
        clipText(fallback.brief, 80) ||
        "Campaña UGC",
      continuity: normalizeContinuity(o.continuity),
      scenes,
    };
  };
  try {
    const parsed = take(JSON.parse(cleaned));
    if (parsed) return parsed;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = take(JSON.parse(cleaned.slice(start, end + 1)));
        if (parsed) return parsed;
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

export function moveV2Scene(scenes: V2Scene[], id: string, dir: -1 | 1): V2Scene[] {
  const i = scenes.findIndex((s) => s.id === id);
  if (i < 0) return scenes;
  const j = i + dir;
  if (j < 0 || j >= scenes.length) return scenes;
  const next = [...scenes];
  const a = next[i]!;
  next[i] = next[j]!;
  next[j] = a;
  return next;
}

export const COMPOSE_STALE_MS = 3 * 60 * 1000;

export function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export function requirePlainObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError("JSON inválido", 400);
  }
  return raw as Record<string, unknown>;
}

function optionalString(
  body: Record<string, unknown>,
  key: string,
  max: number
): string | undefined {
  if (!(key in body) || body[key] === undefined) return undefined;
  if (typeof body[key] !== "string") {
    throw httpError(`"${key}" debe ser texto`, 400);
  }
  return body[key].trim().slice(0, max);
}

function optionalNullableId(
  body: Record<string, unknown>,
  key: string
): string | null | undefined {
  if (!(key in body) || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "string") {
    throw httpError(`"${key}" debe ser un id o null`, 400);
  }
  const id = body[key].trim();
  return id || null;
}

export function parseV2CreateBody(raw: unknown): {
  title: string;
  brief: string;
  objective: string;
  language: EstudioVideoLanguage;
  modelId: string;
  influencerId: string | null;
} {
  const body = requirePlainObject(raw);
  const title = optionalString(body, "title", 80);
  const brief = optionalString(body, "brief", 2000);
  const objective = optionalString(body, "objective", 500);
  if ("language" in body && body.language !== undefined) {
    if (body.language !== "es" && body.language !== "en") {
      throw httpError('"language" debe ser es o en', 400);
    }
  }
  if ("modelId" in body && body.modelId !== undefined && body.modelId !== "") {
    if (typeof body.modelId !== "string" || !isFalVoiceVideoModel(body.modelId)) {
      throw httpError("modelId no es un modelo de vídeo con audio soportado", 400);
    }
  }
  const influencerId = optionalNullableId(body, "influencerId");
  return {
    title: title || "Campaña UGC",
    brief: brief || "",
    objective: objective || "",
    language: body.language === "en" ? "en" : "es",
    modelId:
      typeof body.modelId === "string" && isFalVoiceVideoModel(body.modelId)
        ? body.modelId
        : DEFAULT_FAL_VIDEO_MODEL,
    influencerId: influencerId === undefined ? null : influencerId,
  };
}

export type V2CampaignEdit = {
  title?: string;
  brief?: string;
  objective?: string;
  language?: EstudioVideoLanguage;
  modelId?: string;
  influencerId?: string | null;
  continuity?: V2Continuity;
  scenes?: V2Scene[];
};

export function parseV2PatchBody(raw: unknown): V2CampaignEdit {
  const body = requirePlainObject(raw);
  const edit: V2CampaignEdit = {};
  const title = optionalString(body, "title", 80);
  const brief = optionalString(body, "brief", 2000);
  const objective = optionalString(body, "objective", 500);
  if (title !== undefined) edit.title = title;
  if (brief !== undefined) edit.brief = brief;
  if (objective !== undefined) edit.objective = objective;
  if ("language" in body && body.language !== undefined) {
    if (body.language !== "es" && body.language !== "en") {
      throw httpError('"language" debe ser es o en', 400);
    }
    edit.language = body.language;
  }
  if ("modelId" in body && body.modelId !== undefined && body.modelId !== "") {
    if (typeof body.modelId !== "string" || !isFalVoiceVideoModel(body.modelId)) {
      throw httpError("modelId no es un modelo de vídeo con audio soportado", 400);
    }
    edit.modelId = body.modelId;
  }
  if ("influencerId" in body) {
    edit.influencerId = optionalNullableId(body, "influencerId") ?? null;
  }
  if ("continuity" in body && body.continuity !== undefined) {
    if (!body.continuity || typeof body.continuity !== "object" || Array.isArray(body.continuity)) {
      throw httpError('"continuity" inválida', 400);
    }
    edit.continuity = normalizeContinuity(body.continuity);
  }
  if ("scenes" in body && body.scenes !== undefined) {
    if (!Array.isArray(body.scenes)) {
      throw httpError('"scenes" debe ser una lista', 400);
    }
    edit.scenes = normalizeV2Scenes(body.scenes);
  }
  return edit;
}

function generationKey(scene: V2Scene): string {
  return [
    scene.role,
    scene.source,
    scene.script,
    scene.action,
    scene.extra,
    scene.overlay,
    scene.framing,
    scene.source === "generate" ? String(scene.durationSec) : "",
  ].join("\0");
}

function montageKey(scenes: V2Scene[]): string {
  return scenes
    .map(
      (s, i) =>
        `${i}:${s.id}:${s.durationSec}:${s.audio}:${s.source}:${s.galleryAssetId || ""}`
    )
    .join("|");
}

function versionScene(scene: V2Scene): V2Scene {
  return { ...scene, id: newId(), videoId: null };
}

export function composeLockMode(
  status: string,
  updatedAt: string,
  now = Date.now()
): "acquire" | "steal" | "conflict" {
  if (status === "composing") {
    const age = now - Date.parse(updatedAt);
    if (Number.isFinite(age) && age >= COMPOSE_STALE_MS) return "steal";
    return "conflict";
  }
  return "acquire";
}

export function assertV2NotComposing(campaign: V2Campaign) {
  if (campaign.status === "composing") {
    throw httpError("Esta campaña se está montando. Espera a que termine.", 409);
  }
}

export function applyV2CampaignEdits(
  campaign: V2Campaign,
  edit: V2CampaignEdit,
  opts?: { jobs?: Record<string, { status: string }> }
): {
  next: Pick<
    V2Campaign,
    | "title"
    | "brief"
    | "objective"
    | "language"
    | "modelId"
    | "influencerId"
    | "continuity"
    | "scenes"
    | "finalAssetId"
    | "finalVideoUrl"
  >;
  invalidateFinal: boolean;
} {
  const title = edit.title !== undefined ? edit.title : campaign.title;
  const brief = edit.brief !== undefined ? edit.brief : campaign.brief;
  const objective =
    edit.objective !== undefined ? edit.objective : campaign.objective;
  const language = edit.language !== undefined ? edit.language : campaign.language;
  const modelId = edit.modelId !== undefined ? edit.modelId : campaign.modelId;
  const influencerId =
    edit.influencerId !== undefined ? edit.influencerId : campaign.influencerId;
  const continuity =
    edit.continuity !== undefined ? edit.continuity : campaign.continuity;

  const genContextChanged =
    influencerId !== campaign.influencerId ||
    modelId !== campaign.modelId ||
    language !== campaign.language ||
    JSON.stringify(continuity) !== JSON.stringify(campaign.continuity);

  const jobs = opts?.jobs ?? {};
  if (genContextChanged) {
    for (const scene of campaign.scenes) {
      const job = scene.videoId ? jobs[scene.videoId] : undefined;
      if (job && isActiveVideoStatus(job.status)) {
        throw httpError(
          "No puedes cambiar influencer, modelo, idioma o continuidad mientras hay un job en curso.",
          409
        );
      }
    }
  }

  const currentById = new Map(campaign.scenes.map((s) => [s.id, s]));
  const scenes = edit.scenes
    ? edit.scenes.map((incoming) => {
        const current = currentById.get(incoming.id);
        if (!current) {
          return { ...incoming, videoId: null };
        }
        const sameGen = generationKey(current) === generationKey(incoming);
        const job = current.videoId ? jobs[current.videoId] : undefined;
        if (!sameGen && job && isActiveVideoStatus(job.status)) {
          throw httpError(
            `No puedes cambiar la generación de "${incoming.title || "la escena"}" mientras el job está en curso.`,
            409
          );
        }
        const keepJob =
          !genContextChanged && Boolean(current.videoId) && sameGen;
        return {
          ...incoming,
          id: keepJob ? current.id : current.videoId ? newId() : incoming.id,
          videoId: keepJob ? current.videoId : null,
        };
      })
    : genContextChanged
      ? campaign.scenes.map((s) => (s.videoId ? versionScene(s) : s))
      : campaign.scenes;

  const invalidateFinal =
    Boolean(campaign.finalAssetId || campaign.finalVideoUrl) &&
    (genContextChanged || montageKey(scenes) !== montageKey(campaign.scenes));

  return {
    next: {
      title,
      brief,
      objective,
      language,
      modelId,
      influencerId,
      continuity,
      scenes,
      finalAssetId: invalidateFinal ? null : campaign.finalAssetId,
      finalVideoUrl: invalidateFinal ? null : campaign.finalVideoUrl,
    },
    invalidateFinal,
  };
}

export function mapCampaignRow(row: {
  id: string;
  project_id: string;
  influencer_id: string | null;
  title: string;
  brief: string;
  objective: string;
  language: string | null;
  model_id: string | null;
  status: string;
  continuity: unknown;
  scenes: unknown;
  final_asset_id: string | null;
  final_video_url?: string | null;
  estimated_cost_usd?: number | string | null;
  created_at: string;
  updated_at: string;
}): V2Campaign {
  const cost = row.estimated_cost_usd;
  return {
    id: row.id,
    projectId: row.project_id,
    influencerId: row.influencer_id,
    title: row.title,
    brief: row.brief || "",
    objective: row.objective || "",
    language: row.language === "en" ? "en" : "es",
    modelId: row.model_id || "",
    status: (row.status as V2CampaignStatus) || "draft",
    continuity: normalizeContinuity(row.continuity),
    scenes: normalizeV2Scenes(row.scenes),
    finalAssetId: row.final_asset_id,
    finalVideoUrl: row.final_video_url ?? null,
    estimatedCostUsd:
      typeof cost === "number"
        ? cost
        : typeof cost === "string"
          ? Number(cost) || null
          : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
