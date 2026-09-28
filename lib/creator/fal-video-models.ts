export type FalVideoQuality =
  | "bajo"
  | "realista"
  | "super realista"
  | "hiperrealista";

export type FalVideoModel = {
  id: string;
  /** Visible in the picker: "Kling 3.0 Pro · hiperrealista" */
  name: string;
  quality: FalVideoQuality;
  /** Default duration in seconds, without suffix. */
  duration: string;
  /** Allowed durations in seconds, without suffix. */
  durations: readonly string[];
  /** How fal expects `duration`: "10" or "8s". */
  durationFormat: "plain" | "seconds";
  imageField: "image_url" | "start_image_url";
  generateAudio: boolean;
  extraInput?: Record<string, unknown>;
  usdPerSec: number;
};

const O3_DURATIONS = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
] as const;

const FIVE_TEN = ["5", "10"] as const;
const VEO_DURATIONS = ["4", "6", "8"] as const;

export const FAL_VIDEO_MODELS: FalVideoModel[] = [
  {
    id: "fal-ai/kling-video/v2.1/standard/image-to-video",
    name: "Kling 2.1 Standard · bajo",
    quality: "bajo",
    duration: "5",
    durations: FIVE_TEN,
    durationFormat: "plain",
    imageField: "image_url",
    generateAudio: false,
    usdPerSec: 0.05,
  },
  {
    id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    name: "Kling 2.5 Turbo Pro · realista",
    quality: "realista",
    duration: "5",
    durations: FIVE_TEN,
    durationFormat: "plain",
    imageField: "image_url",
    generateAudio: false,
    usdPerSec: 0.07,
  },
  {
    id: "fal-ai/kling-video/o3/standard/image-to-video",
    name: "Kling O3 Omni Standard · realista",
    quality: "realista",
    duration: "10",
    durations: O3_DURATIONS,
    durationFormat: "plain",
    imageField: "image_url",
    generateAudio: true,
    usdPerSec: 0.112,
  },
  {
    id: "fal-ai/kling-video/v2.6/pro/image-to-video",
    name: "Kling 2.6 Pro · super realista",
    quality: "super realista",
    duration: "10",
    durations: FIVE_TEN,
    durationFormat: "plain",
    imageField: "start_image_url",
    generateAudio: true,
    usdPerSec: 0.14,
  },
  {
    id: "fal-ai/kling-video/o3/pro/image-to-video",
    name: "Kling O3 Omni Pro · super realista",
    quality: "super realista",
    duration: "10",
    durations: O3_DURATIONS,
    durationFormat: "plain",
    imageField: "image_url",
    generateAudio: true,
    usdPerSec: 0.14,
  },
  {
    id: "fal-ai/kling-video/v3/standard/image-to-video",
    name: "Kling 3.0 Standard · super realista",
    quality: "super realista",
    duration: "10",
    durations: O3_DURATIONS,
    durationFormat: "plain",
    imageField: "start_image_url",
    generateAudio: true,
    usdPerSec: 0.112,
  },
  {
    id: "fal-ai/veo3.1/fast/image-to-video",
    name: "Veo 3.1 Fast · super realista",
    quality: "super realista",
    duration: "8",
    durations: VEO_DURATIONS,
    durationFormat: "seconds",
    imageField: "image_url",
    generateAudio: true,
    extraInput: { aspect_ratio: "9:16", resolution: "720p" },
    usdPerSec: 0.15,
  },
  {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    // Official API also has multi_prompt (exclusive with prompt), elements,
    // shot_type customize|intelligent. Not wired: montage + campaign isolation first.
    // Native audio: Chinese/English; other languages auto-translated to English.
    name: "Kling 3.0 Pro · hiperrealista",
    quality: "hiperrealista",
    duration: "10",
    durations: O3_DURATIONS,
    durationFormat: "plain",
    imageField: "start_image_url",
    generateAudio: true,
    usdPerSec: 0.168,
  },
  {
    id: "fal-ai/veo3.1/image-to-video",
    name: "Veo 3.1 · hiperrealista",
    quality: "hiperrealista",
    duration: "8",
    durations: VEO_DURATIONS,
    durationFormat: "seconds",
    imageField: "image_url",
    generateAudio: true,
    extraInput: { aspect_ratio: "9:16", resolution: "720p" },
    usdPerSec: 0.4,
  },
];

/** Kling O3 Omni image-to-video duration enum (seconds). Used by plantillas. */
export const FAL_KLING_DURATIONS = O3_DURATIONS;

export type FalKlingDuration = (typeof FAL_KLING_DURATIONS)[number];

export const DEFAULT_FAL_KLING_DURATION: FalKlingDuration = "10";

export function getFalKlingDuration(
  value: string | number | null | undefined
): FalKlingDuration {
  const raw = String(value ?? "").trim();
  const match = FAL_KLING_DURATIONS.find((d) => d === raw);
  return match ?? DEFAULT_FAL_KLING_DURATION;
}

export const DEFAULT_FAL_VIDEO_MODEL =
  "fal-ai/kling-video/o3/standard/image-to-video";

export const FAVORITE_MODEL_LIMIT = 3;

export function falVideoSoundLabel(model: FalVideoModel): string {
  return model.generateAudio ? "con sonido" : "sin sonido";
}

export function falVideoDurationRangeLabel(model: FalVideoModel): string {
  const nums = [
    ...new Set(
      model.durations
        .map((d) => Number(d))
        .filter((n) => Number.isFinite(n))
    ),
  ].sort((a, b) => a - b);
  if (!nums.length) return `${model.duration} s`;
  if (nums.length === 1) return `${nums[0]} s`;
  const consecutive = nums.every(
    (n, i) => i === 0 || n === nums[i - 1]! + 1
  );
  if (consecutive) return `${nums[0]}–${nums[nums.length - 1]} s`;
  if (nums.length === 2) return `${nums[0]} o ${nums[1]} s`;
  const last = nums[nums.length - 1];
  return `${nums.slice(0, -1).join(", ")} u ${last} s`;
}

export function falVideoModelMeta(model: FalVideoModel): string {
  return `${model.quality} · ${falVideoSoundLabel(model)} · ${falVideoDurationRangeLabel(model)}`;
}

export function normalizeFavoriteModelIds(
  ids: unknown,
  selectedId?: string | null
): string[] {
  const allowed = new Set(FAL_VIDEO_MODELS.map((m) => m.id));
  const out: string[] = [];
  const push = (id: string) => {
    if (!allowed.has(id) || out.includes(id)) return;
    out.push(id);
  };
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (out.length >= FAVORITE_MODEL_LIMIT) break;
      if (typeof id === "string") push(id);
    }
    return out.slice(0, FAVORITE_MODEL_LIMIT);
  }
  if (typeof selectedId === "string") push(selectedId);
  for (const model of FAL_VIDEO_MODELS) {
    if (out.length >= FAVORITE_MODEL_LIMIT) break;
    push(model.id);
  }
  return out.slice(0, FAVORITE_MODEL_LIMIT);
}

export const FAL_VOICE_VIDEO_MODELS = FAL_VIDEO_MODELS.filter(
  (m) => m.generateAudio
);

export function getFalVideoModel(id: string | null | undefined): FalVideoModel {
  const match = FAL_VIDEO_MODELS.find((m) => m.id === id);
  return match ?? FAL_VIDEO_MODELS.find((m) => m.id === DEFAULT_FAL_VIDEO_MODEL)!;
}

export function getFalVoiceVideoModel(
  id: string | null | undefined
): FalVideoModel {
  const match = FAL_VOICE_VIDEO_MODELS.find((m) => m.id === id);
  return (
    match ??
    FAL_VOICE_VIDEO_MODELS.find((m) => m.id === DEFAULT_FAL_VIDEO_MODEL)!
  );
}

export function falVideoModelLabel(model: FalVideoModel): string {
  return `${model.name} · ${falVideoModelMeta(model)}`;
}

export function isFalVideoModel(id: string | null | undefined): boolean {
  return Boolean(id && FAL_VIDEO_MODELS.some((m) => m.id === id));
}

export function isFalVoiceVideoModel(id: string | null | undefined): boolean {
  return Boolean(id && FAL_VOICE_VIDEO_MODELS.some((m) => m.id === id));
}

export function getFalVideoDuration(
  modelId: string | null | undefined,
  value: string | number | null | undefined
): string {
  const model = getFalVideoModel(modelId);
  const raw = String(value ?? "")
    .trim()
    .replace(/s$/i, "");
  if (model.durations.includes(raw)) return raw;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return model.duration;
  let best = model.durations[0]!;
  let bestDist = Infinity;
  for (const d of model.durations) {
    const dist = Math.abs(Number(d) - n);
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

export function falVideoDurationPayload(
  model: FalVideoModel,
  durationSec: string
): string {
  return model.durationFormat === "seconds" ? `${durationSec}s` : durationSec;
}

export function buildFalVideoInput(opts: {
  model: FalVideoModel;
  prompt: string;
  imageUrl: string;
  durationSec: string;
  speak?: boolean;
}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    [opts.model.imageField]: opts.imageUrl,
    duration: falVideoDurationPayload(opts.model, opts.durationSec),
    ...opts.model.extraInput,
  };
  if (opts.speak === false) input.generate_audio = false;
  else if (opts.model.generateAudio) input.generate_audio = true;
  return input;
}
