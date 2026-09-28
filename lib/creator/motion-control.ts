import { getFalVideoModel } from "@/lib/creator/fal-video-models";

export const MOTION_CLONE_MAX_SEC = 30;
export const MOTION_CLONE_MIN_SEC = 3;
export const MOTION_CLONE_TRIM_MIN_SEC = 0.4;
export const KLING_VIDEO_MIN_PX = 512;
export const KLING_VIDEO_MAX_PX = 2160;

/** Keep both sides in [512, 2160] without stretching. Extreme ratios get letterboxed. */
export const KLING_SAFE_SCALE_VF = [
  `scale=w=min(iw\\,${KLING_VIDEO_MAX_PX}):h=min(ih\\,${KLING_VIDEO_MAX_PX}):force_original_aspect_ratio=decrease:force_divisible_by=2`,
  `pad=w=max(iw\\,${KLING_VIDEO_MIN_PX}):h=max(ih\\,${KLING_VIDEO_MIN_PX}):x=(ow-iw)/2:y=(oh-ih)/2:color=black`,
  "setsar=1",
].join(",");

/** Letterbox landscape (or any) into 9:16 so Kling does not output a wide clone. */
export const KLING_VERTICAL_SCALE_VF =
  "scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1";

export function klingReferenceScaleVf(width: number | null, height: number | null) {
  if (width && height && width > height) return KLING_VERTICAL_SCALE_VF;
  return KLING_SAFE_SCALE_VF;
}

export function motionControlEndpoint(modelId: string | null | undefined): string {
  const id = (modelId || "").trim();
  if (id.includes("/v2.6/")) return "fal-ai/kling-video/v2.6/pro/motion-control";
  // Standard loses the bound face near the end and the reference person comes back.
  return "fal-ai/kling-video/v3/pro/motion-control";
}

export function motionControlUsdPerSec(modelId: string | null | undefined): number {
  const endpoint = motionControlEndpoint(modelId);
  if (endpoint.includes("/v3/pro/")) return 0.112;
  return 0.07;
}

export function cloneClipDurationSec(startSec: number, endSec: number): number {
  const duration = Math.min(
    MOTION_CLONE_MAX_SEC,
    Math.max(MOTION_CLONE_MIN_SEC, endSec - startSec)
  );
  return Math.max(MOTION_CLONE_MIN_SEC, Math.round(duration));
}

export function normalizeCloneDuration(
  value: string | number | null | undefined
): string {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < MOTION_CLONE_MIN_SEC || n > MOTION_CLONE_MAX_SEC) {
    return "10";
  }
  return String(n);
}

export function falJobModelId(opts: {
  modelId: string | null | undefined;
  referenceVideoUrl?: string | null;
}): string {
  if (opts.referenceVideoUrl) return motionControlEndpoint(opts.modelId);
  return getFalVideoModel(opts.modelId).id;
}

export function buildMotionControlInput(opts: {
  modelId?: string | null;
  imageUrl: string;
  videoUrl: string;
  faceUrl?: string | null;
  extraFaceUrls?: string[];
  prompt?: string;
  keepSound?: boolean;
}): Record<string, unknown> {
  const endpoint = motionControlEndpoint(opts.modelId);
  const face = (opts.faceUrl || "").trim();
  const extras = (opts.extraFaceUrls || []).filter((url) => url && url !== face).slice(0, 3);
  const input: Record<string, unknown> = {
    image_url: opts.imageUrl,
    video_url: opts.videoUrl,
    character_orientation: "video",
    keep_original_sound: opts.keepSound === true,
  };
  const prompt = (opts.prompt || "").trim();
  const canBindFace = endpoint.includes("/v3/") && Boolean(face);
  if (canBindFace) {
    input.elements = [
      {
        frontal_image_url: face,
        ...(extras.length ? { reference_image_urls: extras } : {}),
      },
    ];
    input.prompt =
      prompt ||
      "@Element1 is the only person in every frame, including the last one. Perform the exact same actions, camera path, timing and body motion as the reference video. Keep @Element1's face, hair, age, skin, body and clothing locked until the final frame. Do not morph, fade, or revert to the person in the reference video. Photorealistic, stable identity.";
  } else if (prompt) {
    input.prompt = prompt;
  } else {
    input.prompt =
      "The person in the reference image is the only person in every frame, including the last one. Perform the exact same actions, camera path, timing and body motion as the reference video. Keep this face, hair, age, skin, body and clothing until the final frame. Do not morph or revert to the person in the reference video. Photorealistic, stable identity.";
  }
  return input;
}

