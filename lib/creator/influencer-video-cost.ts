import {
  getFalVideoDuration,
  getFalVideoModel,
} from "@/lib/creator/fal-video-models";
import { motionControlUsdPerSec } from "@/lib/creator/motion-control";

/** GPT Image 2 high 1024×1536. Extra refs add input-image cost. */
const GPT_IMAGE_2_HIGH_9X16_USD = 0.167;
const GPT_IMAGE_2_INPUT_IMAGE_USD = 0.02;

export const INFLUENCER_VIDEO_DURATION_S = 10;

export type InfluencerVideoCost = {
  frameUsd: number;
  videoUsd: number;
  totalUsd: number;
};

export function klingVideoCostUsd(
  modelId: string | null | undefined,
  durationSec = INFLUENCER_VIDEO_DURATION_S
): number {
  const model = getFalVideoModel(modelId);
  const seconds = Number(getFalVideoDuration(model.id, durationSec));
  return model.usdPerSec * seconds;
}

export function estimateStartFrameCostUsd(refCount: number): number {
  const refs = Math.max(1, Math.min(10, Math.round(refCount) || 1));
  return GPT_IMAGE_2_HIGH_9X16_USD + GPT_IMAGE_2_INPUT_IMAGE_USD * Math.max(0, refs - 1);
}

export function estimateInfluencerVideoCost(opts: {
  modelId: string | null | undefined;
  refCount: number;
  frameUsd?: number | null;
  durationSec?: number | null;
  clone?: boolean;
}): InfluencerVideoCost {
  if (opts.clone) {
    const frameUsd =
      typeof opts.frameUsd === "number" && Number.isFinite(opts.frameUsd)
        ? opts.frameUsd
        : estimateStartFrameCostUsd(opts.refCount);
    const seconds = Math.min(30, Math.max(3, Number(opts.durationSec) || 10));
    const videoUsd = motionControlUsdPerSec(opts.modelId) * seconds;
    return { frameUsd, videoUsd, totalUsd: frameUsd + videoUsd };
  }
  const frameUsd =
    typeof opts.frameUsd === "number" && Number.isFinite(opts.frameUsd)
      ? opts.frameUsd
      : estimateStartFrameCostUsd(opts.refCount);
  const durationSec = Number(
    getFalVideoDuration(opts.modelId, opts.durationSec ?? INFLUENCER_VIDEO_DURATION_S)
  );
  const videoUsd = klingVideoCostUsd(opts.modelId, durationSec);
  return {
    frameUsd,
    videoUsd,
    totalUsd: frameUsd + videoUsd,
  };
}

export function formatVideoCostUsd(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function videoCostTitle(cost: InfluencerVideoCost): string {
  return `Fotograma ${formatVideoCostUsd(cost.frameUsd)} · Video ${formatVideoCostUsd(cost.videoUsd)} · Total ${formatVideoCostUsd(cost.totalUsd)}`;
}
