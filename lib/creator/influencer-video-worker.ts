import { after } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { downloadBinary } from "@/lib/download-binary";
import { saveBufferToGallery } from "@/lib/creator/gallery-save";
import { burnTopText } from "@/lib/creator/overlay-top-text";
import { applyBeautyFilter } from "@/lib/creator/beauty-filter";
import { ensureIosMp4 } from "@/lib/creator/ios-mp4";
import { normalizeOverlayPosition } from "@/lib/creator/overlay-styles";
import { ensureInfluencerPersonFolder } from "@/lib/gallery/influencers-folder";
import {
  buildFalVideoInput,
  getFalVideoDuration,
  getFalVideoModel,
  isFalVideoModel,
} from "@/lib/creator/fal-video-models";
import {
  clipKlingPrompt,
  influencerClipPrompt,
  influencerStartFramePrompt,
  influencerMotionRefs,
  influencerVideoRefUrls,
  isKlingPromptError,
  isSilentInfluencerPrompt,
  parseInfluencerScript,
} from "@/lib/creator/influencer-video";
import {
  estimateInfluencerVideoCost,
} from "@/lib/creator/influencer-video-cost";
import {
  assembleInfluencers,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import {
  extractFalVideoUrl,
  falQueuePayload,
  falQueueStatus,
  falQueueSubmit,
} from "@/lib/fal/client";
import { isFalBalanceLockError, isFalRequestMissingError, isKlingDurationError, isKlingResolutionError } from "@/lib/fal/errors";
import {
  extractReplicateVideoUrl,
  replicateCreatePrediction,
  replicateGetPrediction,
  replicateStatusLabel,
} from "@/lib/replicate/client";
import { buildReplicateVideoInput } from "@/lib/creator/replicate-video-models";
import {
  falQueueEndpoint,
  makeApiCallTrace,
  mergeApiTrace,
  openaiImageEditsEndpoint,
  parseApiTrace,
  replicatePredictionBody,
  replicatePredictionEndpoint,
  type ApiCallTrace,
} from "@/lib/creator/influencer-api-trace";
import {
  OPENAI_IMAGE_MODEL,
  editOpenAIImages,
} from "@/lib/openai/images";
import { createAdminClient, getServiceRoleAccess } from "@/lib/supabase/admin";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";
import { createClient } from "@/lib/supabase/server";
import { getKlingMotionTask } from "@/lib/kling/client";
import {
  MOTION_CLONE_MIN_SEC,
  MOTION_CLONE_TRIM_MIN_SEC,
  buildMotionControlInput,
  falJobModelId,
} from "@/lib/creator/motion-control";
import { concatVerticalClips } from "@/lib/creator/concat-videos";
import { jobNeedsDynamicCompose, parseDynamicJobExtra } from "@/lib/creator/dynamics";
import {
  alignKeepSecToGenerated,
  ensureKlingMinDuration,
  extractVideoStartFrames,
  probeVideoDurationSec,
  repeatedMotionTakeSec,
  trimGeneratedToKeepSec,
} from "@/lib/creator/video-dynamic";

type Db = Awaited<ReturnType<typeof createClient>>;

export type InfluencerVideoRow = {
  id: string;
  influencer_id: string;
  project_id: string;
  user_id: string;
  script: string;
  prompt: string;
  request_id: string | null;
  status: string;
  video_url: string | null;
  asset_id: string | null;
  error: string | null;
  model_id: string | null;
  provider_status: string | null;
  queue_position: number | null;
  start_image_url: string | null;
  estimated_cost_usd: number | null;
  frame_cost_usd: number | null;
  duration: string | null;
  action: string | null;
  extra: string | null;
  format?: string | null;
  talking_video_url?: string | null;
  demo_video_url?: string | null;
  overlay?: string | null;
  overlay_style?: string | null;
  overlay_position?: string | null;
  beauty?: boolean | null;
  video_provider?: string | null;
  api_trace?: unknown;
  reference_video_url?: string | null;
  source_video_url?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const VIDEO_SELECT =
  "id, influencer_id, project_id, user_id, script, prompt, request_id, status, video_url, asset_id, error, model_id, provider_status, queue_position, start_image_url, estimated_cost_usd, frame_cost_usd, duration, action, extra, format, talking_video_url, demo_video_url, overlay, overlay_style, overlay_position, beauty, video_provider, api_trace, reference_video_url, source_video_url, created_at, updated_at";

const INF_SELECT =
  "id, project_id, user_id, name, traits, folder_id, created_at";
const SHOT_SELECT =
  "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at";

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const FRAME_LOCK_MS = 3 * 60 * 1000;

let lastKick = 0;

export function scheduleEstudioInfluencerVideoWorker(opts?: {
  force?: boolean;
}) {
  const now = Date.now();
  if (!opts?.force && now - lastKick < 8_000) return;
  lastKick = now;
  after(() => runEstudioInfluencerVideoWorker({ budgetMs: 240_000 }));
}

async function getFalKeyForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await admin
    .from("user_settings")
    .select("fal_api_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  const cipher = data?.fal_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

async function getReplicateKeyForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await admin
    .from("user_settings")
    .select("replicate_api_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  const cipher = data?.replicate_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

async function getOpenAIKeyForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await admin
    .from("user_settings")
    .select("openai_api_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  const cipher = data?.openai_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

async function mergeStoredApiTrace(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  videoId: string,
  patch: { frame?: ApiCallTrace; video?: ApiCallTrace }
) {
  const { data } = await admin
    .from("estudio_influencer_videos")
    .select("api_trace")
    .eq("id", videoId)
    .maybeSingle();
  return mergeApiTrace(data?.api_trace, patch);
}

async function loadInfluencerAdmin(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  influencerId: string
) {
  const { data: row } = await admin
    .from("estudio_influencers")
    .select(INF_SELECT)
    .eq("id", influencerId)
    .maybeSingle();
  if (!row) return null;
  const { data: shots } = await admin
    .from("estudio_influencer_shots")
    .select(SHOT_SELECT)
    .eq("influencer_id", influencerId)
    .order("sort_index", { ascending: true });
  return assembleInfluencers(
    [row as InfluencerRow],
    (shots ?? []) as InfluencerShotRow[]
  )[0];
}

async function persistStartFrame(opts: {
  projectId: string;
  influencerId: string;
  videoId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const mime = opts.contentType.startsWith("image/")
    ? opts.contentType.split(";")[0]!.trim()
    : "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("webp")
      ? "webp"
      : "png";
  const storagePath = `${opts.projectId}/influencers/${opts.influencerId}/start-${opts.videoId.slice(0, 8)}-${crypto.randomUUID()}.${ext}`;
  const access = await getServiceRoleAccess();
  await uploadStorageObject({
    supabaseUrl: access.url,
    accessToken: access.serviceKey,
    anonKey: access.anonKey,
    bucket: "gallery",
    path: storagePath,
    body: opts.buffer,
    contentType: mime,
  });
  const admin = await createAdminClient();
  const { data: pub } = admin.storage.from("gallery").getPublicUrl(storagePath);
  return pub.publicUrl;
}

async function persistLoopedClip(opts: {
  projectId: string;
  videoId: string;
  buffer: Buffer;
}): Promise<string> {
  const storagePath = `${opts.projectId}/dynamics/clips/${opts.videoId.slice(0, 8)}-${crypto.randomUUID()}.mp4`;
  const access = await getServiceRoleAccess();
  await uploadStorageObject({
    supabaseUrl: access.url,
    accessToken: access.serviceKey,
    anonKey: access.anonKey,
    bucket: "gallery",
    path: storagePath,
    body: opts.buffer,
    contentType: "video/mp4",
  });
  const adminClient = await createAdminClient();
  const { data } = adminClient.storage.from("gallery").getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function composeInfluencerDynamicVideo(row: InfluencerVideoRow) {
  const admin = await createAdminClient();
  const videoUrl = (row.video_url || row.talking_video_url || "").trim();
  if (!videoUrl) throw new Error("Falta el video clonado para unir la dinámica.");
  const folderId = await resolveInfluencerGalleryFolder(admin, row);
  await finishTalkingVideo({ admin, row, videoUrl, folderId });
}

export async function composeInfluencerExport(opts: {
  sourceUrl: string;
  overlay?: string | null;
  style?: string | null;
  beauty?: boolean;
  position?: string | null;
}): Promise<Buffer> {
  const downloaded = await downloadBinary(opts.sourceUrl, MAX_VIDEO_BYTES);
  const overlay = (opts.overlay || "").trim();
  const beauty = opts.beauty === true;
  if (overlay) {
    return ensureIosMp4(
      await burnTopText(downloaded.buffer, overlay, opts.style, {
        beauty,
        position: normalizeOverlayPosition(opts.position),
      })
    );
  }
  if (beauty) {
    return ensureIosMp4(await applyBeautyFilter(downloaded.buffer));
  }
  return ensureIosMp4(downloaded.buffer);
}

export async function persistInfluencerTalkingClip(opts: {
  projectId: string;
  influencerId: string;
  videoId: string;
  sourceUrl: string;
  overlay?: string | null;
  style?: string | null;
  beauty?: boolean;
  position?: string | null;
}): Promise<{ publicUrl: string; buffer: Buffer }> {
  let body: Buffer;
  try {
    body = await composeInfluencerExport(opts);
  } catch {
    const downloaded = await downloadBinary(opts.sourceUrl, MAX_VIDEO_BYTES);
    try {
      body = await ensureIosMp4(downloaded.buffer);
    } catch {
      body = downloaded.buffer;
    }
  }
  const storagePath = `${opts.projectId}/influencers/${opts.influencerId}/talking-${opts.videoId.slice(0, 8)}-${crypto.randomUUID()}.mp4`;
  const access = await getServiceRoleAccess();
  await uploadStorageObject({
    supabaseUrl: access.url,
    accessToken: access.serviceKey,
    anonKey: access.anonKey,
    bucket: "gallery",
    path: storagePath,
    body,
    contentType: "video/mp4",
  });
  const admin = await createAdminClient();
  const { data: pub } = admin.storage.from("gallery").getPublicUrl(storagePath);
  return { publicUrl: pub.publicUrl, buffer: body };
}

async function persistTalkingClip(opts: {
  projectId: string;
  influencerId: string;
  videoId: string;
  sourceUrl: string;
  overlay?: string | null;
  style?: string | null;
  beauty?: boolean;
  position?: string | null;
}): Promise<string> {
  return (await persistInfluencerTalkingClip(opts)).publicUrl;
}

async function resolveInfluencerGalleryFolder(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  row: InfluencerVideoRow
): Promise<string | null> {
  const { data: inf } = await admin
    .from("estudio_influencers")
    .select("id, name, folder_id, user_id, project_id")
    .eq("id", row.influencer_id)
    .maybeSingle();
  if (!inf) return null;
  try {
    const folder = await ensureInfluencerPersonFolder(
      admin,
      String(inf.project_id || row.project_id),
      String(inf.user_id || row.user_id),
      {
        id: String(inf.id),
        name: String(inf.name || "Influencer"),
        folderId: (inf.folder_id as string | null) ?? null,
      }
    );
    return folder.id;
  } catch {
    return (inf.folder_id as string | null) || null;
  }
}

function cloneFaceRefs(
  extra: string[] | undefined,
  faceUrl: string | null | undefined,
  startUrl: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...(extra || []), startUrl]) {
    const clean = url.trim();
    if (!clean || clean === faceUrl || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 3) break;
  }
  return out;
}

function motionKeepSec(raw: string | null | undefined): number | null {
  if (!raw || !raw.trim().startsWith("{")) return null;
  try {
    const n = Number((JSON.parse(raw) as { motionKeepSec?: unknown }).motionKeepSec);
    return Number.isFinite(n) && n >= 0.4 ? n : null;
  } catch {
    return null;
  }
}

function motionLoopCopies(raw: string | null | undefined): number | null {
  if (!raw || !raw.trim().startsWith("{")) return null;
  try {
    const n = Number((JSON.parse(raw) as { motionLoopCopies?: unknown }).motionLoopCopies);
    return Number.isFinite(n) && n >= 2 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

function mergeMotionKeepSec(
  raw: string | null | undefined,
  keepSec: number | undefined,
  copies?: number
): string | null {
  const loopCopies = copies && copies >= 2 ? Math.round(copies) : null;
  if ((!keepSec || !Number.isFinite(keepSec)) && !loopCopies) return null;
  let base: Record<string, unknown> = {};
  if (raw && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) base = parsed;
    } catch {
      base = {};
    }
  } else if (raw && raw.trim()) {
    return null;
  }
  return JSON.stringify({
    ...base,
    ...(keepSec && Number.isFinite(keepSec)
      ? { motionKeepSec: Number(keepSec.toFixed(3)) }
      : {}),
    ...(loopCopies ? { motionLoopCopies: loopCopies } : {}),
  });
}

async function isVideoCancelled(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  videoId: string
) {
  const { data } = await admin
    .from("estudio_influencer_videos")
    .select("status")
    .eq("id", videoId)
    .maybeSingle();
  const status = String(data?.status || "").toLowerCase();
  return status === "cancelled" || status === "canceled";
}

async function finishTalkingVideo(opts: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  row: InfluencerVideoRow;
  videoUrl: string;
  folderId: string | null;
}) {
  if (await isVideoCancelled(opts.admin, opts.row.id)) return;
  let keepSec = motionKeepSec(opts.row.extra);
  let copies = motionLoopCopies(opts.row.extra);
  const referenceForKeep = (opts.row.reference_video_url || "").trim();
  if (!copies && keepSec && referenceForKeep) {
    const reference = await probeVideoDurationSec(referenceForKeep);
    if (reference && reference > keepSec * 1.6) {
      copies = Math.max(2, Math.round(reference / keepSec));
    }
  }
  if (!keepSec && !copies && referenceForKeep) {
    keepSec = await repeatedMotionTakeSec(referenceForKeep);
    if (keepSec) {
      const reference = await probeVideoDurationSec(referenceForKeep);
      if (reference && reference > keepSec * 1.6) {
        copies = Math.max(2, Math.round(reference / keepSec));
      }
    }
  }
  if (copies && copies >= 2) {
    const generated = await probeVideoDurationSec(opts.videoUrl);
    if (generated && generated > MOTION_CLONE_TRIM_MIN_SEC * copies) {
      keepSec = generated / copies;
    }
  } else if (keepSec && referenceForKeep) {
    keepSec = await alignKeepSecToGenerated(opts.videoUrl, referenceForKeep, keepSec);
  }
  if (keepSec) {
    try {
      const cut = await trimGeneratedToKeepSec(opts.videoUrl, keepSec);
      if (cut) {
        opts = {
          ...opts,
          videoUrl: await persistLoopedClip({
            projectId: opts.row.project_id,
            videoId: opts.row.id,
            buffer: cut,
          }),
        };
      }
    } catch {
      /* keep the full generation */
    }
  }
  const overlay = jobNeedsDynamicCompose(opts.row)
    ? (opts.row.overlay || "").trim()
    : (opts.row.overlay || "").trim() ||
      parseInfluencerScript(opts.row.script || "").overlay;
  const style = opts.row.overlay_style || null;
  const beauty = opts.row.beauty === true;
  const position = opts.row.overlay_position || null;
  const extraTailsAll = parseDynamicJobExtra(opts.row.extra).tails;
  const referenceUrl = (opts.row.reference_video_url || "").trim();
  const sameClip = (url: string) => {
    const key = url.split("?")[0];
    if (!key) return false;
    return (
      key === opts.videoUrl.split("?")[0] ||
      (referenceUrl && key === referenceUrl.split("?")[0])
    );
  };
  const tailUrls = extraTailsAll.filter((url) => url.trim() && !sameClip(url.trim()));
  const demoUrl =
    [(opts.row.demo_video_url || "").trim(), tailUrls[0] || ""].find(
      (url) => url && !sameClip(url)
    ) || "";
  const extraTails = tailUrls.filter((url) => url !== demoUrl);

  if (demoUrl) {
    try {
      const urls = [opts.videoUrl, demoUrl, ...extraTails];
      const files = await Promise.all(
        urls.map((url) => downloadBinary(url, MAX_VIDEO_BYTES))
      );
      let combined = await concatVerticalClips(
        files.map((file) => ({ buffer: file.buffer, audio: "input" as const }))
      );
      if (overlay) {
        try {
          combined = await burnTopText(combined, overlay, style, {
            beauty,
            position: normalizeOverlayPosition(position),
          });
        } catch {
          /* keep combined */
        }
      }
      try {
        combined = await ensureIosMp4(combined);
      } catch {
        /* keep combined */
      }
      if (!opts.folderId) {
        await opts.admin
          .from("estudio_influencer_videos")
          .update({
            status: "completed",
            video_url: opts.videoUrl,
            talking_video_url: opts.videoUrl,
            demo_video_url: demoUrl,
            source_video_url: opts.row.source_video_url || opts.videoUrl,
            provider_status: "COMPLETED",
            error: "Video listo, no hay carpeta para guardar el montaje",
            updated_at: new Date().toISOString(),
          })
          .eq("id", opts.row.id);
        return;
      }
      const saved = await saveBufferToGallery({
        supabase: opts.admin as unknown as Db,
        userId: opts.row.user_id,
        projectId: opts.row.project_id,
        buffer: combined,
        contentType: "video/mp4",
        folderId: opts.folderId,
        name: `dynamic-${opts.row.id.slice(0, 8)}.mp4`,
        kind: "video",
      });
      await opts.admin
        .from("estudio_influencer_videos")
        .update({
          status: "saved",
          video_url: saved.publicUrl,
          asset_id: saved.id,
          talking_video_url: opts.videoUrl,
          demo_video_url: demoUrl,
          source_video_url: opts.row.source_video_url || opts.videoUrl,
          provider_status: "COMPLETED",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opts.row.id);
      return;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo unir la dinámica";
      await opts.admin
        .from("estudio_influencer_videos")
        .update({
          status: "failed",
          talking_video_url: opts.videoUrl,
          video_url: opts.videoUrl,
          error: message.slice(0, 400),
          provider_status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", opts.row.id);
      return;
    }
  }

  if ((opts.row.format || "") === "app-demo") {
    let talkingUrl = opts.videoUrl;
    try {
      talkingUrl = await persistTalkingClip({
        projectId: opts.row.project_id,
        influencerId: opts.row.influencer_id,
        videoId: opts.row.id,
        sourceUrl: opts.videoUrl,
        overlay,
        style,
        beauty,
        position,
      });
    } catch {
      talkingUrl = opts.videoUrl;
    }
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "demo_pending",
        talking_video_url: talkingUrl,
        video_url: talkingUrl,
        source_video_url: opts.row.source_video_url || opts.videoUrl,
        provider_status: "COMPLETED",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
    return;
  }

  if (!opts.folderId) {
    let videoUrl = opts.videoUrl;
    if (overlay || beauty) {
      try {
        videoUrl = await persistTalkingClip({
          projectId: opts.row.project_id,
          influencerId: opts.row.influencer_id,
          videoId: opts.row.id,
          sourceUrl: opts.videoUrl,
          overlay,
          style,
          beauty,
          position,
        });
      } catch {
        videoUrl = opts.videoUrl;
      }
    }
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "completed",
        video_url: videoUrl,
        source_video_url: opts.row.source_video_url || opts.videoUrl,
        provider_status: "COMPLETED",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
    return;
  }

  try {
    const downloaded = await downloadBinary(opts.videoUrl, MAX_VIDEO_BYTES);
    let body = downloaded.buffer;
    if (overlay) {
      try {
        body = await burnTopText(body, overlay, style, {
          beauty,
          position: normalizeOverlayPosition(position),
        });
      } catch {
        if (beauty) {
          try {
            body = await applyBeautyFilter(downloaded.buffer);
          } catch {
            body = downloaded.buffer;
          }
        } else {
          body = downloaded.buffer;
        }
      }
    } else if (beauty) {
      try {
        body = await applyBeautyFilter(body);
      } catch {
        body = downloaded.buffer;
      }
    }
    try {
      body = await ensureIosMp4(body);
    } catch {
      /* keep the buffer we have */
    }
    const saved = await saveBufferToGallery({
      supabase: opts.admin as unknown as Db,
      userId: opts.row.user_id,
      projectId: opts.row.project_id,
      buffer: body,
      contentType: "video/mp4",
      folderId: opts.folderId,
      name: `influencer-${opts.row.id.slice(0, 8)}.mp4`,
      kind: "video",
    });
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "saved",
        video_url: saved.publicUrl,
        source_video_url: opts.row.source_video_url || opts.videoUrl,
        asset_id: saved.id,
        error: null,
        provider_status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
  } catch {
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "completed",
        video_url: opts.videoUrl,
        source_video_url: opts.row.source_video_url || opts.videoUrl,
        error: "Video listo, no se pudo guardar en Galería",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
  }
}

async function generateStartFrame(opts: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  row: InfluencerVideoRow;
}): Promise<{ url: string; frameUsd: number; call: ApiCallTrace } | null> {
  const influencer = await loadInfluencerAdmin(opts.admin, opts.row.influencer_id);
  const refs = influencer ? influencerVideoRefUrls(influencer) : [];
  if (!refs.length) {
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "failed",
        error: "Faltan las fotos de referencia del influencer",
        provider_status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
    return null;
  }

  const apiKey = await getOpenAIKeyForUser(opts.admin, opts.row.user_id);
  if (!apiKey) {
    await opts.admin
      .from("estudio_influencer_videos")
      .update({
        status: "failed",
        error: "Conecta OpenAI en Supabase → Secrets para crear el fotograma.",
        provider_status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.row.id);
    return null;
  }

  const { data: claimed } = await opts.admin
    .from("estudio_influencer_videos")
    .update({
      provider_status: "GENERATING_FRAME",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.row.id)
    .in("status", ["queued", "pending", "draft"])
    .select("id");
  if (!claimed?.length) return null;

  const spoken = parseInfluencerScript(opts.row.script || "").spoken;
  const silent = isSilentInfluencerPrompt(opts.row.prompt);
  const matchVideo = Boolean(opts.row.reference_video_url);
  const prompt = influencerStartFramePrompt({
    name: influencer?.name || "",
    traits: influencer?.traits || "",
    action: opts.row.action || "",
    extra: opts.row.extra || "",
    script: spoken,
    speak: silent ? false : undefined,
    matchVideo,
  });

  const images: Array<{ buffer: Buffer; contentType: string }> = [];
  for (const ref of refs) {
    try {
      const downloaded = await downloadBinary(ref, MAX_IMAGE_BYTES);
      if (downloaded.buffer.byteLength) {
        images.push({
          buffer: downloaded.buffer,
          contentType: downloaded.contentType,
        });
      }
    } catch {
      /* skip unreadable refs */
    }
  }
  if (!images.length) {
    throw new Error("No se pudieron leer las fotos de referencia");
  }
  let stillCount = 0;
  if (matchVideo && opts.row.reference_video_url) {
    const stills = await extractVideoStartFrames(opts.row.reference_video_url);
    stillCount = stills.length;
    for (const still of stills) {
      images.push({ buffer: still, contentType: "image/jpeg" });
    }
  }

  const generated = await editOpenAIImages(apiKey, {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    images,
    aspectRatio: "9:16",
    quality: "high",
  });
  const contentType = generated.contentType.startsWith("image/")
    ? generated.contentType
    : "image/png";
  let call = makeApiCallTrace({
    provider: "openai",
    model: OPENAI_IMAGE_MODEL,
    endpoint: openaiImageEditsEndpoint(),
    body: {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: "1024x1536",
      quality: "high",
      image_urls: matchVideo
        ? [...refs, "(stills del video de referencia)"]
        : refs,
    },
  });

  const url = await persistStartFrame({
    projectId: opts.row.project_id,
    influencerId: opts.row.influencer_id,
    videoId: opts.row.id,
    buffer: generated.buffer,
    contentType,
  });
  const frameUsd = estimateInfluencerVideoCost({
    modelId: opts.row.model_id,
    refCount: refs.length + stillCount,
    clone: matchVideo,
  }).frameUsd;
  const total = estimateInfluencerVideoCost({
    modelId: opts.row.model_id,
    refCount: refs.length + stillCount,
    frameUsd,
    durationSec: Number(opts.row.duration) || 10,
    clone: matchVideo,
  }).totalUsd;

  call = { ...call, outputUrl: url };
  if (await isVideoCancelled(opts.admin, opts.row.id)) return null;

  await opts.admin
    .from("estudio_influencer_videos")
    .update({
      start_image_url: url,
      frame_cost_usd: frameUsd,
      estimated_cost_usd: total,
      provider_status: null,
      error: null,
      api_trace: await mergeStoredApiTrace(opts.admin, opts.row.id, { frame: call }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.row.id);

  return { url, frameUsd, call };
}

export async function submitFalInfluencerVideo(opts: {
  apiKey: string;
  imageUrl: string;
  prompt: string;
  modelId: string;
  duration?: string | null;
  referenceVideoUrl?: string | null;
  faceUrl?: string | null;
  extraFaceUrls?: string[];
}): Promise<{ requestId: string; call: ApiCallTrace }> {
  if (opts.referenceVideoUrl) {
    const endpoint = falJobModelId({
      modelId: opts.modelId,
      referenceVideoUrl: opts.referenceVideoUrl,
    });
    const input = buildMotionControlInput({
      modelId: opts.modelId,
      imageUrl: opts.imageUrl,
      videoUrl: opts.referenceVideoUrl,
      faceUrl: opts.faceUrl,
      extraFaceUrls: opts.extraFaceUrls,
      keepSound: false,
    });
    const requestId = await falQueueSubmit(opts.apiKey, endpoint, input);
    return {
      requestId,
      call: makeApiCallTrace({
        provider: "fal",
        model: endpoint,
        endpoint: falQueueEndpoint(endpoint),
        body: input,
      }),
    };
  }
  const model = getFalVideoModel(opts.modelId);
  const durationSec = getFalVideoDuration(model.id, opts.duration || model.duration);
  const input = buildFalVideoInput({
    model,
    prompt: clipKlingPrompt(opts.prompt),
    imageUrl: opts.imageUrl,
    durationSec,
    speak: isSilentInfluencerPrompt(opts.prompt) ? false : undefined,
  });
  const requestId = await falQueueSubmit(opts.apiKey, model.id, input);
  return {
    requestId,
    call: makeApiCallTrace({
      provider: "fal",
      model: model.id,
      endpoint: falQueueEndpoint(model.id),
      body: input,
    }),
  };
}

function isFal405Error(error: string | null | undefined) {
  const t = (error || "").toLowerCase();
  return t.includes("405") || t.includes("method not allowed");
}

const PROMPT_TOO_LONG =
  "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres).";

export async function joinReadyInfluencerVideos(opts?: { budgetMs?: number }) {
  const budgetMs = opts?.budgetMs ?? 80_000;
  const started = Date.now();
  const admin = await createAdminClient();
  const { data: composeReady } = await admin
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .is("asset_id", null)
    .in("status", ["in_progress", "completed", "saving", "composing"])
    .order("created_at", { ascending: true })
    .limit(8);
  let composed = 0;
  for (const row of (composeReady ?? []) as InfluencerVideoRow[]) {
    if (composed >= 1 || Date.now() - started > budgetMs) break;
    const status = (row.status || "").toLowerCase();
    const clipUrl = (row.video_url || row.talking_video_url || "").trim();
    const demoUrl = (row.demo_video_url || "").trim();
    const dynamic = jobNeedsDynamicCompose(row);
    const appDemo = (row.format || "") === "app-demo";
    const updated = Date.parse(row.updated_at || "");
    const joining =
      (row.provider_status || "").toUpperCase() === "JOINING" &&
      Number.isFinite(updated) &&
      Date.now() - updated < 90_000;
    if (!clipUrl || joining) continue;

    if (status === "composing" && appDemo && !demoUrl && !dynamic) {
      const { data: handed } = await admin
        .from("estudio_influencer_videos")
        .update({
          status: "demo_pending",
          error: null,
          provider_status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "composing")
        .select("id");
      if (handed?.length) composed += 1;
      continue;
    }

    const serverJoin = dynamic || (status === "composing" && Boolean(demoUrl));
    if (!serverJoin) continue;

    const claimedAt = new Date().toISOString();
    let claim = admin
      .from("estudio_influencer_videos")
      .update({
        provider_status: "JOINING",
        updated_at: claimedAt,
      })
      .eq("id", row.id)
      .is("asset_id", null);
    claim = row.updated_at
      ? claim.eq("updated_at", row.updated_at)
      : claim;
    const { data: claimed } = await claim.select("id");
    if (!claimed?.length) continue;

    await finishTalkingVideo({
      admin,
      row,
      videoUrl: clipUrl,
      folderId: await resolveInfluencerGalleryFolder(admin, row),
    });
    composed += 1;
  }
}

export async function runEstudioInfluencerVideoWorker(opts?: {
  budgetMs?: number;
}) {
  const budgetMs = opts?.budgetMs ?? 90_000;
  const started = Date.now();
  const admin = await createAdminClient();
  await joinReadyInfluencerVideos({ budgetMs: Math.min(80_000, budgetMs) });

  const { data: stuck } = await admin
    .from("estudio_influencer_videos")
    .select("id, error, status")
    .is("asset_id", null)
    .in("status", ["in_progress", "queued", "draft", "pending"])
    .limit(80);
  const promptFailIds = (stuck ?? [])
    .filter((row) => isKlingPromptError(row.error as string | null))
    .map((row) => row.id as string);
  if (promptFailIds.length) {
    await admin
      .from("estudio_influencer_videos")
      .update({
        status: "failed",
        provider_status: "FAILED",
        error: PROMPT_TOO_LONG,
        updated_at: new Date().toISOString(),
      })
      .in("id", promptFailIds);
  }

  const { data: failed405 } = await admin
    .from("estudio_influencer_videos")
    .select("id, request_id, error")
    .eq("status", "failed")
    .is("asset_id", null)
    .limit(40);
  const retrySubmit = (failed405 ?? [])
    .filter((row) => isFal405Error(row.error as string | null) && !row.request_id)
    .map((row) => row.id as string);
  const retryPoll = (failed405 ?? [])
    .filter((row) => isFal405Error(row.error as string | null) && row.request_id)
    .map((row) => row.id as string);
  if (retrySubmit.length) {
    await admin
      .from("estudio_influencer_videos")
      .update({
        status: "queued",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", retrySubmit);
  }
  if (retryPoll.length) {
    await admin
      .from("estudio_influencer_videos")
      .update({
        status: "in_progress",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", retryPoll);
  }

  const { data: lostJobs } = await admin
    .from("estudio_influencer_videos")
    .select("id, error, status")
    .is("asset_id", null)
    .in("status", ["failed", "in_progress", "queued"])
    .limit(40);
  const lostIds = (lostJobs ?? [])
    .filter((row) => isFalRequestMissingError(row.error as string | null))
    .map((row) => row.id as string);
  if (lostIds.length) {
    await admin
      .from("estudio_influencer_videos")
      .update({
        status: "queued",
        request_id: null,
        provider_status: null,
        queue_position: null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", lostIds);
  }

  const { data: queued } = await admin
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .eq("status", "queued")
    .is("request_id", null)
    .order("created_at", { ascending: true })
    .limit(4);

  let madeFrame = false;
  for (const row of (queued ?? []) as InfluencerVideoRow[]) {
    if (Date.now() - started > budgetMs - 8_000) break;
    if (await isVideoCancelled(admin, row.id)) continue;
    if (!isFalVideoModel(row.model_id)) continue;

    const isClone = Boolean(row.reference_video_url);
    if (isClone && row.reference_video_url) {
      try {
        const ensured = await ensureKlingMinDuration(row.reference_video_url);
        const extra = mergeMotionKeepSec(row.extra, ensured.keepSec, ensured.copies);
        if (ensured.buffer || extra) {
          const loopedUrl = ensured.buffer
            ? await persistLoopedClip({
                projectId: row.project_id,
                videoId: row.id,
                buffer: ensured.buffer,
              })
            : null;
          const duration = loopedUrl
            ? String(Math.max(MOTION_CLONE_MIN_SEC, Math.round(ensured.durationSec)))
            : null;
          await admin
            .from("estudio_influencer_videos")
            .update({
              ...(loopedUrl ? { reference_video_url: loopedUrl, duration } : {}),
              ...(extra ? { extra } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (loopedUrl && duration) {
            row.reference_video_url = loopedUrl;
            row.duration = duration;
          }
          if (extra) row.extra = extra;
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No se pudo preparar el video de referencia";
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: message,
            provider_status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
    }
    if (await isVideoCancelled(admin, row.id)) continue;
    const influencer = await loadInfluencerAdmin(admin, row.influencer_id);
    const motionRefs = influencer ? influencerMotionRefs(influencer) : null;

    let startUrl = row.start_image_url;
    let apiTrace = parseApiTrace(row.api_trace);
    if (!startUrl) {
      const locked =
        row.provider_status === "GENERATING_FRAME" &&
        row.updated_at &&
        Date.now() - new Date(row.updated_at).getTime() < FRAME_LOCK_MS;
      if (locked || madeFrame) continue;
      try {
        const frame = await generateStartFrame({ admin, row });
        if (!frame || (await isVideoCancelled(admin, row.id))) continue;
        startUrl = frame.url;
        apiTrace = mergeApiTrace(apiTrace, { frame: frame.call });
        madeFrame = true;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No se pudo crear el fotograma";
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: message,
            provider_status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
    }

    if (!startUrl) continue;

    if (Date.now() - started > budgetMs - 8_000) break;
    const replicateKey = isClone ? null : await getReplicateKeyForUser(admin, row.user_id);
    const falKey = await getFalKeyForUser(admin, row.user_id);
    if (!replicateKey && !falKey) continue;
    const prompt = clipKlingPrompt(
      row.prompt ||
        influencerClipPrompt({
          name: influencer?.name || "",
          script: parseInfluencerScript(row.script).spoken,
          product: "",
          action: row.action || "",
          extra: row.extra || "",
          speak: isSilentInfluencerPrompt(row.prompt) ? false : undefined,
        })
    );
    const preferFal = isClone || (row.video_provider || "") === "fal";
    let submitted = false;
    let lastError = "";

    if (!preferFal && replicateKey) {
      const packed = buildReplicateVideoInput({
        falModelId: row.model_id,
        prompt,
        imageUrl: startUrl,
        durationSec: row.duration,
      });
      if (packed) {
        try {
          const requestId = await replicateCreatePrediction(
            replicateKey,
            packed.model,
            packed.input
          );
          const call = makeApiCallTrace({
            provider: "replicate",
            model: packed.model,
            endpoint: replicatePredictionEndpoint(packed.model),
            body: replicatePredictionBody(packed.input),
          });
          await admin
            .from("estudio_influencer_videos")
            .update({
              request_id: requestId,
              video_provider: "replicate",
              status: "in_progress",
              provider_status: "IN_QUEUE",
              error: null,
              api_trace: await mergeStoredApiTrace(admin, row.id, {
                frame: apiTrace?.frame,
                video: call,
              }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          submitted = true;
        } catch (e) {
          lastError =
            e instanceof Error ? e.message : "No se pudo enviar a Replicate";
        }
      }
    }

    if (!submitted && falKey) {
      try {
        const submittedFal = await submitFalInfluencerVideo({
          apiKey: falKey,
          imageUrl: startUrl,
          prompt,
          modelId: row.model_id || "",
          duration: row.duration,
          referenceVideoUrl: row.reference_video_url || null,
          faceUrl: isClone ? motionRefs?.faceUrl || startUrl : null,
          extraFaceUrls: isClone
            ? cloneFaceRefs(motionRefs?.extraFaceUrls, motionRefs?.faceUrl, startUrl)
            : [],
        });
        apiTrace = mergeApiTrace(apiTrace, { video: submittedFal.call });
        await admin
          .from("estudio_influencer_videos")
          .update({
            request_id: submittedFal.requestId,
            video_provider: "fal",
            status: "in_progress",
            provider_status: "IN_QUEUE",
            error: lastError
              ? `Replicate falló, usando fal.ai. ${lastError}`
              : null,
            api_trace: await mergeStoredApiTrace(admin, row.id, {
              frame: apiTrace?.frame,
              video: submittedFal.call,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        submitted = true;
      } catch (e) {
        lastError =
          e instanceof Error ? e.message : "No se pudo enviar a fal.ai";
      }
    }

    if (!submitted) {
      await admin
        .from("estudio_influencer_videos")
        .update({
          status: "failed",
          error: isKlingPromptError(lastError) ? PROMPT_TOO_LONG : lastError || "No hay proveedor de video",
          provider_status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  const { data: active } = await admin
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .eq("status", "in_progress")
    .not("request_id", "is", null)
    .is("asset_id", null)
    .order("created_at", { ascending: true })
    .limit(4);
  for (const row of (active ?? []) as InfluencerVideoRow[]) {
    if (Date.now() - started > budgetMs) break;
    if ((row.video_provider || "") === "kling" && row.request_id) {
      try {
        const st = await getKlingMotionTask(row.request_id);
        if (st.status === "FAILED") {
          await admin
            .from("estudio_influencer_videos")
            .update({
              status: "failed",
              error: st.error || "Kling no pudo generar el video",
              provider_status: "FAILED",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          continue;
        }
        if (st.status !== "COMPLETED") {
          await admin
            .from("estudio_influencer_videos")
            .update({
              status: "in_progress",
              error: null,
              provider_status: st.status,
              queue_position: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          continue;
        }
        if (!st.videoUrl) continue;
        const folderId = await resolveInfluencerGalleryFolder(admin, row);
        await finishTalkingVideo({
          admin,
          row,
          videoUrl: st.videoUrl,
          folderId,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Error al consultar Kling";
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "in_progress",
            error: message,
            provider_status: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
      continue;
    }
    if (!isFalVideoModel(row.model_id) || !row.request_id) continue;
    const replicateKey = await getReplicateKeyForUser(admin, row.user_id);
    const falKey = await getFalKeyForUser(admin, row.user_id);
    const usingReplicate =
      (row.video_provider || "") === "replicate" && !row.reference_video_url;

    if (usingReplicate) {
      if (!replicateKey) continue;
      try {
        const pred = await replicateGetPrediction(replicateKey, row.request_id);
        const label = replicateStatusLabel(pred.status);
        if (label === "FAILED") {
          if (falKey && row.start_image_url) {
            try {
              const fallbackInfluencer = await loadInfluencerAdmin(admin, row.influencer_id);
              const fallbackRefs = fallbackInfluencer
                ? influencerMotionRefs(fallbackInfluencer)
                : null;
              const fallbackStart = row.start_image_url || "";
              const submittedFal = await submitFalInfluencerVideo({
                apiKey: falKey,
                imageUrl: fallbackStart,
                prompt: clipKlingPrompt(row.prompt || ""),
                modelId: row.model_id || "",
                duration: row.duration,
                referenceVideoUrl: row.reference_video_url || null,
                faceUrl: row.reference_video_url
                  ? fallbackRefs?.faceUrl || fallbackStart
                  : null,
                extraFaceUrls: row.reference_video_url
                  ? cloneFaceRefs(fallbackRefs?.extraFaceUrls, fallbackRefs?.faceUrl, fallbackStart)
                  : [],
              });
              await admin
                .from("estudio_influencer_videos")
                .update({
                  request_id: submittedFal.requestId,
                  video_provider: "fal",
                  status: "in_progress",
                  provider_status: "IN_QUEUE",
                  error: pred.error
                    ? `Replicate falló, usando fal.ai. ${pred.error}`
                    : "Replicate falló, usando fal.ai",
                  api_trace: await mergeStoredApiTrace(admin, row.id, {
                    video: submittedFal.call,
                  }),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
            } catch (e) {
              const message =
                e instanceof Error ? e.message : pred.error || "Replicate falló";
              await admin
                .from("estudio_influencer_videos")
                .update({
                  status: "failed",
                  error: message,
                  provider_status: "FAILED",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
            }
            continue;
          }
          await admin
            .from("estudio_influencer_videos")
            .update({
              status: "failed",
              error: pred.error || "Replicate falló",
              provider_status: "FAILED",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          continue;
        }
        if (label !== "COMPLETED") {
          await admin
            .from("estudio_influencer_videos")
            .update({
              status: "in_progress",
              error: null,
              provider_status: label,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          continue;
        }
        const videoUrl = extractReplicateVideoUrl(pred.output);
        if (!videoUrl) continue;
        const folderId = await resolveInfluencerGalleryFolder(admin, row);
        await finishTalkingVideo({ admin, row, videoUrl, folderId });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Error al consultar Replicate";
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: message,
            provider_status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
      continue;
    }

    if (!falKey) continue;
    const jobModel = falJobModelId({
      modelId: row.model_id,
      referenceVideoUrl: row.reference_video_url,
    });
    try {
      const st = await falQueueStatus(falKey, jobModel, row.request_id);
      if (isFalRequestMissingError(st.error)) {
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "queued",
            request_id: null,
            provider_status: null,
            queue_position: null,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      if (st.status === "FAILED" || st.status === "ERROR" || isKlingPromptError(st.error) || isFalBalanceLockError(st.error)) {
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: isKlingPromptError(st.error)
              ? PROMPT_TOO_LONG
              : isKlingDurationError(st.error)
                ? `El recorte debe durar al menos ${MOTION_CLONE_MIN_SEC} segundos. Edita la dinámica y elige un tramo más largo.`
                : isKlingResolutionError(st.error)
                  ? "El video de referencia se va a reescalar. Reintenta."
                  : st.error || "fal.ai falló",
            provider_status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      if (st.status !== "COMPLETED") {
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "in_progress",
            error: null,
            provider_status: st.status,
            queue_position: st.queuePosition ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      const payload = await falQueuePayload(
        falKey,
        jobModel,
        row.request_id
      );
      const videoUrl = extractFalVideoUrl(payload);
      if (!videoUrl) continue;
      const folderId = await resolveInfluencerGalleryFolder(admin, row);
      await finishTalkingVideo({ admin, row, videoUrl, folderId });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Error al consultar fal.ai";
      if (isFalRequestMissingError(message)) {
        await admin
          .from("estudio_influencer_videos")
          .update({
            status: "queued",
            request_id: null,
            provider_status: null,
            queue_position: null,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      const fatal = isKlingPromptError(message) || isFalBalanceLockError(message);
      await admin
        .from("estudio_influencer_videos")
        .update({
          status: fatal ? "failed" : "in_progress",
          error: isKlingPromptError(message) ? PROMPT_TOO_LONG : message,
          provider_status: fatal ? "FAILED" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
}
