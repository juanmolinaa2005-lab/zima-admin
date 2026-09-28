import { getFalVideoDuration, getFalVideoModel } from "@/lib/creator/fal-video-models";

export type VideoProvider = "replicate" | "fal";

export type ReplicateVideoTarget = {
  model: string;
  imageField: "start_image" | "image";
  extraInput?: Record<string, unknown>;
};

const REPLICATE_BY_FAL_ID: Record<string, ReplicateVideoTarget> = {
  "fal-ai/kling-video/v2.1/standard/image-to-video": {
    model: "kwaivgi/kling-v2.1",
    imageField: "start_image",
    extraInput: { mode: "standard" },
  },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    model: "kwaivgi/kling-v2.5-turbo-pro",
    imageField: "start_image",
  },
  "fal-ai/kling-video/o3/standard/image-to-video": {
    model: "kwaivgi/kling-v3-omni-video",
    imageField: "start_image",
    extraInput: { mode: "standard", generate_audio: true, aspect_ratio: "9:16" },
  },
  "fal-ai/kling-video/v2.6/pro/image-to-video": {
    model: "kwaivgi/kling-v2.6",
    imageField: "image",
    extraInput: { generate_audio: true, aspect_ratio: "9:16" },
  },
  "fal-ai/kling-video/o3/pro/image-to-video": {
    model: "kwaivgi/kling-v3-omni-video",
    imageField: "start_image",
    extraInput: { mode: "pro", generate_audio: true, aspect_ratio: "9:16" },
  },
  "fal-ai/kling-video/v3/standard/image-to-video": {
    model: "kwaivgi/kling-v3-omni-video",
    imageField: "start_image",
    extraInput: { mode: "standard", generate_audio: true, aspect_ratio: "9:16" },
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    model: "kwaivgi/kling-v3-omni-video",
    imageField: "start_image",
    extraInput: { mode: "pro", generate_audio: true, aspect_ratio: "9:16" },
  },
  "fal-ai/veo3.1/fast/image-to-video": {
    model: "google/veo-3.1-fast",
    imageField: "image",
    extraInput: { aspect_ratio: "9:16", resolution: "720p" },
  },
  "fal-ai/veo3.1/image-to-video": {
    model: "google/veo-3.1",
    imageField: "image",
    extraInput: { aspect_ratio: "9:16" },
  },
};

export function getReplicateVideoTarget(
  falModelId: string | null | undefined
): ReplicateVideoTarget | null {
  const model = getFalVideoModel(falModelId);
  return REPLICATE_BY_FAL_ID[model.id] ?? null;
}

export function buildReplicateVideoInput(opts: {
  falModelId: string | null | undefined;
  prompt: string;
  imageUrl: string;
  durationSec?: string | null;
}): { model: string; input: Record<string, unknown> } | null {
  const target = getReplicateVideoTarget(opts.falModelId);
  if (!target) return null;
  const duration = getFalVideoDuration(opts.falModelId, opts.durationSec);
  const n = Number.parseInt(duration, 10);
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    [target.imageField]: opts.imageUrl,
    duration: Number.isFinite(n) ? n : duration,
    ...target.extraInput,
  };
  return { model: target.model, input };
}

export function normalizeVideoProvider(
  value: string | null | undefined
): VideoProvider | null {
  if (value === "replicate" || value === "fal") return value;
  return null;
}
