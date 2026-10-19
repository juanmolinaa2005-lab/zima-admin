import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { createClient } from "@/lib/supabase/server";
import {
  saveBufferToGallery,
  saveRemoteMediaToGallery,
  replaceGalleryAssetVideo,
  saveScratchBuffer,
} from "@/lib/creator/gallery-save";
import { downloadBinary } from "@/lib/download-binary";
import { burnTopText } from "@/lib/creator/overlay-top-text";
import {
  captionStyleForIndex,
  DEFAULT_OVERLAY_PREVIEW,
  normalizeCaptionStyleMode,
  normalizeOverlayPosition,
} from "@/lib/creator/overlay-styles";
import {
  influencerAppDemoScriptsPrompt,
  influencerClipPrompt,
  influencerScriptsPrompt,
  influencerVideoRefUrls,
  isKlingPromptError,
  canDeleteInfluencerVideo,
  parseAppDemoScriptItems,
  parseInfluencerScript,
  parseScriptList,
  splitInfluencerScripts,
} from "@/lib/creator/influencer-video";
import {
  composeInfluencerExport,
  persistInfluencerTalkingClip,
  joinReadyInfluencerVideos,
  scheduleEstudioInfluencerVideoWorker,
} from "@/lib/creator/influencer-video-worker";
import {
  concatTalkingAndDemo,
  concatVerticalClips,
} from "@/lib/creator/concat-videos";
import {
  loadStudioDynamics,
  loadStudioParts,
  listFolderVideoAssets,
  pickHookAppDemoClips,
  resolveCustomDynamicPlan,
  resolveOverlayCaption,
} from "@/lib/creator/dynamics-server";
import { jobNeedsDynamicCompose } from "@/lib/creator/dynamics";
import { clipReferenceVideo } from "@/lib/creator/video-dynamic";
import { HOOK_APP_DEMO_ID } from "@/lib/gallery/dynamics-folder";
import { parseApiTrace } from "@/lib/creator/influencer-api-trace";
import { getFalVideoDuration, getFalVideoModel, isFalVideoModel } from "@/lib/creator/fal-video-models";
import { getKlingMotionTask } from "@/lib/kling/client";
import { falJobModelId, MOTION_CLONE_MIN_SEC, MOTION_CLONE_TRIM_MIN_SEC, normalizeCloneDuration } from "@/lib/creator/motion-control";
import { projectGalleryVideoUrl } from "@/lib/creator/video-dynamic";
import {
  assembleInfluencers,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import {
  clipProductSummary,
  normalizeVideoFormat,
  type EstudioInfluencerVideo,
  type EstudioVideoFormat,
} from "@/lib/creator/estudio-v1";
import {
  applyAppDemoVariablePatch,
  parseAppDemoSnapshot,
  type AppDemoCodeSnapshot,
  type AppDemoVariable,
} from "@/lib/creator/app-demo";
import {
  estimateInfluencerVideoCost,
} from "@/lib/creator/influencer-video-cost";
import {
  extractFalVideoUrl,
  falQueueCancel,
  falQueuePayload,
  falQueueStatus,
  falWaitForOutput,
  FAL_GROK_MODEL,
  FAL_OPENROUTER,
} from "@/lib/fal/client";
import { getFalApiKey } from "@/lib/fal/user-key";
import { getReplicateApiKey } from "@/lib/replicate/user-key";
import {
  extractReplicateVideoUrl,
  replicateGetPrediction,
  replicateStatusLabel,
} from "@/lib/replicate/client";
import { isFalBalanceLockError, isFalRequestMissingError, isKlingDurationError, isKlingResolutionError } from "@/lib/fal/errors";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { openaiChatJson } from "@/lib/openai/chat";
import {
  extractHiggsfieldVideoUrl,
  getHiggsfieldJobStatus,
  isHiggsfieldTerminal,
} from "@/lib/higgsfield/client";
import { getHiggsfieldCredentials } from "@/lib/higgsfield/user-key";
import { GALLERY_ASSET_SELECT, mapGalleryAsset } from "@/lib/gallery/asset";
import { ensureInfluencerPersonFolder } from "@/lib/gallery/influencers-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; influencerId: string }> };
type Db = Awaited<ReturnType<typeof createClient>>;

const INF_SELECT =
  "id, project_id, user_id, name, traits, language, folder_id, created_at";
const SHOT_SELECT =
  "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at";
const VIDEO_SELECT =
  "id, influencer_id, project_id, user_id, script, prompt, request_id, status, video_url, asset_id, error, model_id, provider_status, queue_position, start_image_url, estimated_cost_usd, frame_cost_usd, duration, action, extra, format, demo_code, demo_phone_frame, demo_variables, talking_video_url, demo_video_url, overlay, overlay_style, overlay_position, beauty, video_provider, api_trace, reference_video_url, source_video_url, created_at, updated_at";

const VIDEO_CONNECT_MSG =
  "Conecta Replicate en Supabase → Secrets. fal.ai se usa solo si Replicate falla.";
const ACTIVE = new Set(["queued", "in_progress", "saving", "pending", "composing"]);

type VideoRow = {
  id: string;
  influencer_id: string;
  project_id?: string;
  user_id?: string;
  script: string;
  prompt: string;
  request_id: string | null;
  status: string;
  video_url: string | null;
  asset_id: string | null;
  error: string | null;
  model_id: string | null;
  provider_status?: string | null;
  queue_position?: number | null;
  start_image_url?: string | null;
  estimated_cost_usd?: number | string | null;
  frame_cost_usd?: number | string | null;
  duration?: string | null;
  action?: string | null;
  extra?: string | null;
  format?: string | null;
  demo_code?: string | null;
  demo_phone_frame?: boolean | null;
  demo_variables?: unknown;
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

function asDemoVariables(value: unknown): AppDemoVariable[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const key = typeof o.key === "string" ? o.key.trim() : "";
      if (!key) return null;
      return {
        id: typeof o.id === "string" && o.id ? o.id : key,
        key,
        type: typeof o.type === "string" ? o.type : "text",
        value: typeof o.value === "string" ? o.value : String(o.value ?? ""),
      } as AppDemoVariable;
    })
    .filter((v): v is AppDemoVariable => Boolean(v));
  return list.length ? list : null;
}

function asMoney(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapVideo(row: VideoRow): EstudioInfluencerVideo {
  return {
    id: row.id,
    script: row.script,
    prompt: row.prompt ?? "",
    status: row.status,
    videoUrl: row.video_url,
    assetId: row.asset_id,
    error: row.error,
    modelId: row.model_id,
    requestId: row.request_id,
    providerStatus: row.provider_status ?? null,
    queuePosition:
      typeof row.queue_position === "number" ? row.queue_position : null,
    startImageUrl: row.start_image_url ?? null,
    estimatedCostUsd: asMoney(row.estimated_cost_usd),
    frameCostUsd: asMoney(row.frame_cost_usd),
    duration: row.duration ?? null,
    action: row.action ?? null,
    extra: row.extra ?? null,
    format: normalizeVideoFormat(row.format),
    demoCode: row.demo_code ?? null,
    demoPhoneFrame: row.demo_phone_frame !== false,
    demoVariables: asDemoVariables(row.demo_variables),
    talkingVideoUrl: row.talking_video_url ?? null,
    demoVideoUrl: row.demo_video_url ?? null,
    overlay: row.overlay ?? null,
    overlayStyle: row.overlay_style ?? null,
    overlayPosition: row.overlay_position ?? null,
    beauty: row.beauty !== false,
    videoProvider:
      row.video_provider === "replicate" ||
      row.video_provider === "fal" ||
      row.video_provider === "kling"
        ? row.video_provider
        : null,
    apiTrace: parseApiTrace(row.api_trace),
    referenceVideoUrl: row.reference_video_url ?? null,
    sourceVideoUrl: row.source_video_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

async function loadInfluencer(
  supabase: Db,
  projectId: string,
  influencerId: string
) {
  const { data: row, error } = await supabase
    .from("estudio_influencers")
    .select(INF_SELECT)
    .eq("id", influencerId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const { data: shots, error: sErr } = await supabase
    .from("estudio_influencer_shots")
    .select(SHOT_SELECT)
    .eq("influencer_id", influencerId)
    .order("sort_index", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  return assembleInfluencers(
    [row as InfluencerRow],
    (shots ?? []) as InfluencerShotRow[]
  )[0];
}

function isMissingV2CampaignColumn(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  if (!msg.includes("v2_campaign_id")) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /does not exist/.test(msg) ||
    /schema cache/.test(msg) ||
    /could not find/.test(msg)
  );
}

async function listVideos(
  supabase: Db,
  influencerId: string
): Promise<VideoRow[]> {
  const filtered = await supabase
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .eq("influencer_id", influencerId)
    .is("v2_campaign_id", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (!filtered.error) return (filtered.data ?? []) as VideoRow[];
  if (!isMissingV2CampaignColumn(filtered.error)) {
    throw new Error(filtered.error.message);
  }
  const unfiltered = await supabase
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (unfiltered.error) throw new Error(unfiltered.error.message);
  return (unfiltered.data ?? []) as VideoRow[];
}

async function refreshActiveJobs(
  supabase: Db,
  rows: VideoRow[],
  folderId: string | null,
  projectId: string,
  userId: string
): Promise<VideoRow[]> {
  const falKey = await getFalApiKey();
  const replicateKey = await getReplicateApiKey();
  const creds = await getHiggsfieldCredentials();
  const pending = rows.filter((row) => {
    if (row.asset_id) return false;
    if (
      isFalVideoModel(row.model_id) &&
      isFalRequestMissingError(row.error) &&
      !row.video_url
    ) {
      return true;
    }
    if (!row.request_id) return false;
    const status = (row.status || "").toLowerCase();
    if (ACTIVE.has(status)) return true;
    if (status === "completed" && !row.video_url) return true;
    if (row.video_url && folderId && !row.asset_id) return true;
    if (
      status === "failed" &&
      isFalVideoModel(row.model_id) &&
      /405|method not allowed/i.test(row.error || "")
    ) {
      return true;
    }
    return false;
  });

  const next = [...rows];
  for (const row of pending.slice(0, 10)) {
    const idx = next.findIndex((r) => r.id === row.id);
    if (idx < 0) continue;
    try {
      if (isFalRequestMissingError(row.error) && !row.video_url) {
        await supabase
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
        next[idx] = {
          ...row,
          status: "queued",
          request_id: null,
          provider_status: null,
          queue_position: null,
          error: null,
        };
        scheduleEstudioInfluencerVideoWorker({ force: true });
        continue;
      }
      if (isKlingPromptError(row.error)) {
        const message =
          "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres).";
        await supabase
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: message,
            provider_status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        next[idx] = {
          ...row,
          status: "failed",
          error: message,
          provider_status: "FAILED",
        };
        continue;
      }
      let videoUrl = row.video_url;
      let status = row.status;
      let error = row.error;
      if (row.request_id && !videoUrl) {
        if ((row.video_provider || "") === "kling") {
          try {
            const st = await getKlingMotionTask(row.request_id);
            if (st.status === "FAILED") {
              const message = st.error || "Kling no pudo generar el video";
              await supabase
                .from("estudio_influencer_videos")
                .update({
                  status: "failed",
                  error: message,
                  provider_status: "FAILED",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
              next[idx] = {
                ...row,
                status: "failed",
                error: message,
                provider_status: "FAILED",
              };
              continue;
            }
            await supabase
              .from("estudio_influencer_videos")
              .update({
                status: "in_progress",
                error: null,
                provider_status: st.status,
                queue_position: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            next[idx] = {
              ...row,
              status: "in_progress",
              error: null,
              provider_status: st.status,
              queue_position: null,
            };
            if (st.status === "COMPLETED") {
              scheduleEstudioInfluencerVideoWorker({ force: true });
            }
            continue;
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Error al consultar Kling";
            await supabase
              .from("estudio_influencer_videos")
              .update({
                status: "in_progress",
                error: message,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            next[idx] = { ...row, status: "in_progress", error: message };
            continue;
          }
        } else if (isFalVideoModel(row.model_id)) {
          if (
            isFalVideoModel(row.model_id) &&
            (row.video_provider || "") === "replicate" &&
            !row.reference_video_url
          ) {
            if (!replicateKey) continue;
            const pred = await replicateGetPrediction(
              replicateKey,
              row.request_id
            );
            const label = replicateStatusLabel(pred.status);
            if (label === "FAILED") {
              await supabase
                .from("estudio_influencer_videos")
                .update({
                  status: "queued",
                  request_id: null,
                  video_provider: "fal",
                  provider_status: null,
                  error: pred.error
                    ? `Replicate falló, pasando a fal.ai. ${pred.error}`
                    : "Replicate falló, pasando a fal.ai",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
              next[idx] = {
                ...row,
                status: "queued",
                request_id: null,
                video_provider: "fal",
                error: pred.error
                  ? `Replicate falló, pasando a fal.ai. ${pred.error}`
                  : "Replicate falló, pasando a fal.ai",
              };
              scheduleEstudioInfluencerVideoWorker({ force: true });
              continue;
            }
            if (label === "COMPLETED") {
              videoUrl = extractReplicateVideoUrl(pred.output);
              status = "completed";
              error = null;
            } else {
              status = "in_progress";
              error = null;
            }
            await supabase
              .from("estudio_influencer_videos")
              .update({
                status,
                error: error || null,
                video_url: videoUrl,
                provider_status: label,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            next[idx] = {
              ...row,
              status,
              error: error || null,
              video_url: videoUrl,
              provider_status: label,
            };
            if (label !== "COMPLETED") continue;
          } else {
          if (!falKey) continue;
          const jobModel = falJobModelId({
            modelId: row.model_id,
            referenceVideoUrl: row.reference_video_url,
          });
          const st = await falQueueStatus(falKey, jobModel, row.request_id);
          status = st.status.toLowerCase();
          error = st.error || error;
          if (isFalRequestMissingError(st.error) || isFalRequestMissingError(error)) {
            await supabase
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
            next[idx] = {
              ...row,
              status: "queued",
              request_id: null,
              provider_status: null,
              queue_position: null,
              error: null,
            };
            scheduleEstudioInfluencerVideoWorker({ force: true });
            continue;
          }
          if (
            st.status === "FAILED" ||
            st.status === "ERROR" ||
            isKlingPromptError(st.error) ||
            isKlingPromptError(error)
          ) {
            const message = isKlingPromptError(st.error || error)
              ? "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres)."
              : isKlingDurationError(st.error || error)
                ? `El recorte debe durar al menos ${MOTION_CLONE_MIN_SEC} segundos. Edita la dinámica y elige un tramo más largo.`
                : st.error || error || "fal.ai falló";
            await supabase
              .from("estudio_influencer_videos")
              .update({
                status: "failed",
                error: message,
                provider_status: "FAILED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            next[idx] = {
              ...row,
              status: "failed",
              error: message,
              provider_status: "FAILED",
            };
            continue;
          }
          if (st.status === "COMPLETED") {
            const payload = await falQueuePayload(
              falKey,
              jobModel,
              row.request_id
            );
            videoUrl = extractFalVideoUrl(payload);
            status = "completed";
            error = null;
          } else {
            status = "in_progress";
            error = null;
          }
          await supabase
            .from("estudio_influencer_videos")
            .update({
              status,
              error: error || null,
              video_url: videoUrl,
              provider_status: st.status,
              queue_position: st.queuePosition ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          next[idx] = {
            ...row,
            status,
            error: error || null,
            video_url: videoUrl,
            provider_status: st.status,
            queue_position: st.queuePosition ?? null,
            updated_at: new Date().toISOString(),
          };
          if (st.status !== "COMPLETED") continue;
          }
        } else {
          if (!creds) continue;
          const job = await getHiggsfieldJobStatus(creds, row.request_id);
          status = job.status || status;
          videoUrl =
            (typeof job.video === "string" ? job.video : job.video?.url) ||
            extractHiggsfieldVideoUrl(job) ||
            null;
          error = job.error || error;
          if (isHiggsfieldTerminal(status) && status !== "completed") {
            await supabase
              .from("estudio_influencer_videos")
              .update({
                status,
                error: error || "No se pudo generar el video",
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            next[idx] = {
              ...row,
              status,
              error: error || "No se pudo generar el video",
            };
            continue;
          }
        }
        if (videoUrl) {
          await supabase
            .from("estudio_influencer_videos")
            .update({
              status: "completed",
              video_url: videoUrl,
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          status = "completed";
        } else if (status !== row.status || row.error) {
          await supabase
            .from("estudio_influencer_videos")
            .update({
              status,
              error: error || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      }

      if (videoUrl && jobNeedsDynamicCompose(row) && !row.asset_id) {
        if ((row.status || "").toLowerCase() !== "composing") {
          await supabase
            .from("estudio_influencer_videos")
            .update({
              status: "composing",
              video_url: videoUrl,
              talking_video_url: videoUrl,
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
        next[idx] = {
          ...row,
          status: "composing",
          video_url: videoUrl,
          talking_video_url: videoUrl,
          error: null,
        };
      } else if (videoUrl && folderId && !row.asset_id) {
        await supabase
          .from("estudio_influencer_videos")
          .update({
            status: "saving",
            video_url: videoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        const saved = await saveRemoteMediaToGallery({
          supabase,
          userId,
          projectId,
          sourceUrl: videoUrl,
          folderId,
          name: `influencer-${row.id.slice(0, 8)}.mp4`,
          kind: "video",
        });
        await supabase
          .from("estudio_influencer_videos")
          .update({
            status: "saved",
            video_url: saved.publicUrl,
            asset_id: saved.id,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        next[idx] = {
          ...row,
          status: "saved",
          video_url: saved.publicUrl,
          asset_id: saved.id,
          error: null,
        };
      } else {
        next[idx] = {
          ...row,
          status,
          video_url: videoUrl,
          error,
        };
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo consultar el video";
      if (isFalRequestMissingError(message)) {
        await supabase
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
        next[idx] = {
          ...row,
          status: "queued",
          request_id: null,
          provider_status: null,
          queue_position: null,
          error: null,
        };
        scheduleEstudioInfluencerVideoWorker({ force: true });
        continue;
      }
      const fatal = isKlingPromptError(message) || isFalBalanceLockError(message);
      await supabase
        .from("estudio_influencer_videos")
        .update({
          status: fatal ? "failed" : row.status,
          error: fatal && isKlingPromptError(message)
            ? "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres)."
            : message,
          provider_status: fatal ? "FAILED" : row.provider_status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      next[idx] = {
        ...row,
        status: fatal ? "failed" : row.status,
        error:
          fatal && isKlingPromptError(message)
            ? "El texto del producto/guion es demasiado largo para Kling (máx. 2500 caracteres)."
            : message,
        provider_status: fatal ? "FAILED" : row.provider_status,
      };
    }
  }
  return next;
}

function exportFileName(overlay: string, videoId: string) {
  const slug = overlay
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `influencer-${slug || videoId.slice(0, 8)}.mp4`;
}

async function downloadComposedVideo(opts: {
  supabase: Db;
  projectId: string;
  influencerId: string;
  videoId: string;
}) {
  const { data, error } = await opts.supabase
    .from("estudio_influencer_videos")
    .select(VIDEO_SELECT)
    .eq("id", opts.videoId)
    .eq("influencer_id", opts.influencerId)
    .eq("project_id", opts.projectId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }
  const row = data as VideoRow;
  const sourceUrl = row.video_url || row.source_video_url;
  if (!sourceUrl) {
    return NextResponse.json(
      { error: "Este video aún no está listo." },
      { status: 409 }
    );
  }
  const overlay =
    (row.overlay || "").trim() ||
    parseInfluencerScript(row.script || "").overlay;
  try {
    const body = await composeInfluencerExport({
      sourceUrl,
      overlay,
      style: row.overlay_style,
      beauty: row.beauty !== false,
      position: row.overlay_position,
    });
    const fileName = exportFileName(overlay, row.id);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo generar el video con el texto.",
      },
      { status: 502 }
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId, influencerId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const downloadId = new URL(request.url).searchParams.get("download")?.trim();
  if (downloadId) {
    return downloadComposedVideo({
      supabase: gate.supabase,
      projectId,
      influencerId,
      videoId: downloadId,
    });
  }

  try {
    const influencer = await loadInfluencer(
      gate.supabase,
      projectId,
      influencerId
    );
    if (!influencer) {
      return NextResponse.json(
        { error: "Influencer no encontrado" },
        { status: 404 }
      );
    }

    let folderId = influencer.folderId;
    try {
      folderId = (
        await ensureInfluencerPersonFolder(
          gate.supabase,
          projectId,
          gate.user.id,
          {
            id: influencer.id,
            name: influencer.name,
            folderId: influencer.folderId,
          }
        )
      ).id;
    } catch {
      /* keep existing folder if gallery sync fails */
    }

    const raw = await listVideos(gate.supabase, influencerId);
    let rows = await refreshActiveJobs(
      gate.supabase,
      raw,
      folderId,
      projectId,
      gate.user.id
    );

    if (rows.some((row) => (row.status || "").toLowerCase() === "composing")) {
      try {
        await joinReadyInfluencerVideos({ budgetMs: 80_000 });
        const fresh = await listVideos(gate.supabase, influencerId);
        const byId = new Map(fresh.map((row) => [row.id, row]));
        rows = rows.map((row) => byId.get(row.id) ?? row);
      } catch {
        /* keep the list; the next poll retries the join */
      }
    }

    if (
      rows.some(
        (row) =>
          (row.status === "queued" && !row.request_id) ||
          (row.status === "in_progress" && isFalVideoModel(row.model_id)) ||
          row.status === "composing" ||
          (row.status === "failed" &&
            /405|method not allowed/i.test(row.error || ""))
      )
    ) {
      scheduleEstudioInfluencerVideoWorker();
    }

    let gallery: ReturnType<typeof mapGalleryAsset>[] = [];
    if (folderId) {
      const { data: assets } = await gate.supabase
        .from("project_gallery_assets")
        .select(GALLERY_ASSET_SELECT)
        .eq("project_id", projectId)
        .eq("user_id", gate.user.id)
        .eq("folder_id", folderId)
        .eq("kind", "video")
        .order("created_at", { ascending: false })
        .order("sort_order", { ascending: false })
        .limit(60);
      gallery = (assets ?? [])
        .map(mapGalleryAsset)
        .filter((asset) => !/^mimic[-_]/i.test(asset.name || ""));
    }

    return NextResponse.json({
      videos: rows.map(mapVideo),
      gallery,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "No se pudieron cargar los videos",
      },
      { status: 500 }
    );
  }
}

function packAiScript(
  raw: string,
  variables: AppDemoVariable[]
): { script: string; overlay: string; variables: AppDemoVariable[] } {
  const parsed = parseInfluencerScript(raw);
  return {
    script: parsed.spoken,
    overlay: parsed.overlay,
    variables,
  };
}

async function generateScriptsWithAi(opts: {
  name: string;
  traits: string;
  product: string;
  count: number;
  language?: "es" | "en";
  action?: string;
  extra?: string;
  durationSec?: number;
  demo?: AppDemoCodeSnapshot | null;
  withOverlay?: boolean;
  speak?: boolean;
}): Promise<{ script: string; overlay: string; variables: AppDemoVariable[] }[]> {
  const demo = opts.demo;
  const prompt = demo
    ? influencerAppDemoScriptsPrompt({
        ...opts,
        variables: demo.variables.map((v) => ({
          key: v.key,
          type: v.type,
          value: v.type === "image" ? (v.value ? "(keep current image)" : "") : v.value,
        })),
        codeSnippet: demo.code,
      })
    : influencerScriptsPrompt(opts);
  const system = demo
    ? 'Responde SOLO JSON válido con la forma {"items":[{"script":"...","variables":{}}]}. Sin markdown.'
    : 'Responde SOLO JSON válido con la forma {"scripts":["..."]}. Sin markdown.';
  const falKey = await getFalApiKey();
  if (falKey) {
    const output = await falWaitForOutput(
      falKey,
      FAL_OPENROUTER,
      {
        prompt,
        system_prompt: system,
        model: FAL_GROK_MODEL,
        temperature: 0.85,
        max_tokens: demo ? 8000 : 4000,
      },
      { timeoutMs: 90_000, intervalMs: 2500 }
    );
    const items = demo
      ? parseAppDemoScriptItems(output, opts.count)
      : parseScriptList(output, opts.count).map((script) => ({
          script,
          variables: {} as Record<string, unknown>,
        }));
    if (items.length) {
      return items.map((item) =>
        packAiScript(
          item.script,
          demo ? applyAppDemoVariablePatch(demo.variables, item.variables) : []
        )
      );
    }
  }

  const openaiKey = await getOpenAIApiKey();
  if (openaiKey) {
    const json = await openaiChatJson<Record<string, unknown>>(openaiKey, {
      system,
      user: prompt,
      temperature: 0.85,
      maxTokens: demo ? 8000 : 4000,
    });
    const items = demo
      ? parseAppDemoScriptItems(JSON.stringify(json), opts.count)
      : parseScriptList(JSON.stringify(json), opts.count).map((script) => ({
          script,
          variables: {} as Record<string, unknown>,
        }));
    if (items.length) {
      return items.map((item) =>
        packAiScript(
          item.script,
          demo ? applyAppDemoVariablePatch(demo.variables, item.variables) : []
        )
      );
    }
  }

  throw new Error(
    "Conecta fal.ai (o OpenAI) en Supabase → Secrets para generar guiones."
  );
}

function demoInsertFields(
  format: EstudioVideoFormat,
  demo: AppDemoCodeSnapshot | null,
  variables?: AppDemoVariable[]
) {
  if (format !== "app-demo" || !demo) {
    return {
      format: "talking" as const,
      demo_code: null as string | null,
      demo_phone_frame: true,
      demo_variables: null as unknown,
    };
  }
  return {
    format: "app-demo" as const,
    demo_code: demo.code,
    demo_phone_frame: demo.phoneFrame,
    demo_variables: variables ?? demo.variables,
  };
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId, influencerId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: {
    action?: string;
    script?: string;
    product?: string;
    count?: number;
    modelId?: string;
    videoId?: string;
    language?: string;
    duration?: string;
    templateAction?: string;
    templateExtra?: string;
    format?: string;
    demo?: unknown;
    demoUrl?: string;
    error?: string;
    overlay?: string;
    withOverlay?: boolean;
    overlayStyle?: string;
    overlayPosition?: string;
    beauty?: boolean;
    templateSpeak?: boolean;
    templateVideoUrl?: string;
    dynamicId?: string;
    mode?: string;
    hookAssetId?: string;
    demoAssetId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = (body.action || "enqueue").trim();
  const product = clipProductSummary(body.product || "");
  const modelId = getFalVideoModel(body.modelId).id;
  const templateVideoUrl = projectGalleryVideoUrl(body.templateVideoUrl, projectId);
  const isMotionClone = Boolean(templateVideoUrl);
  const duration = isMotionClone
    ? normalizeCloneDuration(body.duration)
    : getFalVideoDuration(modelId, body.duration);
  let language: "es" | "en" = "es";
  const templateAction = (body.templateAction || "").trim();
  const templateExtra = (body.templateExtra || "").trim();
  const format = normalizeVideoFormat(body.format);
  const demoSnapshot = parseAppDemoSnapshot(body.demo);
  const withOverlay = body.withOverlay !== false;
  const overlayStyleMode = normalizeCaptionStyleMode(body.overlayStyle);
  const overlayPosition = normalizeOverlayPosition(body.overlayPosition);
  const beauty = body.beauty === true;
  const templateSpeak = isMotionClone ? false : body.templateSpeak !== false;
  const defaultOverlay = ((body.overlay || "").trim() || DEFAULT_OVERLAY_PREVIEW).slice(
    0,
    140
  );

  function spokenParts(raw: string) {
    const parsed = parseInfluencerScript(raw);
    return {
      script: parsed.spoken,
      overlay: parsed.overlay || defaultOverlay,
    };
  }

  try {
    const influencer = await loadInfluencer(
      gate.supabase,
      projectId,
      influencerId
    );
    if (!influencer) {
      return NextResponse.json(
        { error: "Influencer no encontrado" },
        { status: 404 }
      );
    }
    language = influencer.language === "en" ? "en" : "es";

    if (action === "compose-dynamic") {
      const dynamicId = (body.dynamicId || "").trim();
      const mode = body.mode === "manual" ? "manual" : "random";
      const dynamics = await loadStudioDynamics(
        gate.supabase,
        projectId,
        gate.user.id
      );
      const dynamic = dynamics.find((item) => item.id === dynamicId) ?? null;
      if (!dynamic) {
        return NextResponse.json(
          { error: "Elige una dinámica." },
          { status: 400 }
        );
      }
      if (dynamic.id !== HOOK_APP_DEMO_ID) {
        const refs = influencerVideoRefUrls(influencer);
        if (!refs.length) {
          return NextResponse.json(
            {
              error:
                "Espera a que esté lista al menos una foto del influencer para usarla de referencia.",
            },
            { status: 409 }
          );
        }
        const falKey = await getFalApiKey();
        if (!falKey) {
          return NextResponse.json(
            {
              error: "NOT_CONNECTED",
              message: "Conecta fal.ai en Supabase → Secrets para clonar el movimiento.",
            },
            { status: 403 }
          );
        }
        const openaiKey = await getOpenAIApiKey();
        if (!openaiKey) {
          return NextResponse.json(
            {
              error: "NOT_CONNECTED",
              message:
                "Conecta OpenAI en Supabase → Secrets para crear el fotograma nuevo.",
            },
            { status: 403 }
          );
        }

        const partsData = await loadStudioParts(
          gate.supabase,
          projectId,
          gate.user.id
        );
        let plan: Awaited<ReturnType<typeof resolveCustomDynamicPlan>>;
        try {
          plan = await resolveCustomDynamicPlan(
            gate.supabase,
            projectId,
            gate.user.id,
            dynamic,
            partsData.parts,
            mode
          );
        } catch (err) {
          return NextResponse.json(
            {
              error:
                err instanceof Error
                  ? err.message
                  : "No se pudo leer la dinámica",
            },
            { status: 400 }
          );
        }

        let folderId = influencer.folderId || null;
        try {
          folderId = (
            await ensureInfluencerPersonFolder(
              gate.supabase,
              projectId,
              gate.user.id,
              {
                id: influencer.id,
                name: influencer.name,
                folderId: influencer.folderId,
              }
            )
          ).id;
        } catch {
          /* keep existing */
        }

        let mimicUrl = plan.mimic.url;
        let mimicDurationSec = plan.mimic.durationSec;
        const hasTrim = plan.mimic.trimStart > 0.05;
        if (hasTrim) {
          try {
            const trimEnd =
              plan.mimic.durationSec > 0
                ? plan.mimic.trimStart + plan.mimic.durationSec
                : plan.mimic.trimStart + MOTION_CLONE_MIN_SEC;
            const clipped = await clipReferenceVideo(
              plan.mimic.url,
              plan.mimic.trimStart,
              trimEnd
            );
            const saved = await saveScratchBuffer({
              supabase: gate.supabase,
              projectId,
              buffer: clipped.buffer,
              contentType: "video/mp4",
              name: `mimic-${dynamic.id.slice(0, 8)}.mp4`,
            });
            mimicUrl = saved.publicUrl;
            mimicDurationSec = clipped.durationSec;
          } catch {
            mimicUrl = plan.mimic.url;
          }
        }

        const cloneDuration = String(
          Math.min(
            30,
            Math.max(3, Math.round(mimicDurationSec || 0) || 5)
          )
        );
        const count = Math.min(5, Math.max(1, Number(body.count) || 1));
        const tails = plan.tails
          .map((item) => item.url)
          .filter((url) => url && url.split("?")[0] !== mimicUrl.split("?")[0]);
        const extra = JSON.stringify({ dynamic: true, tails });
        const overlays = plan.overlayEnabled
          ? await Promise.all(
              Array.from({ length: count }, () =>
                resolveOverlayCaption({
                  apiKey: openaiKey,
                  mode: plan.overlayMode,
                  lines: plan.overlayLines,
                  prompt: plan.overlayPrompt,
                  fallback: plan.overlayText,
                  language: plan.overlayLanguage,
                })
              )
            )
          : Array.from({ length: count }, () => "");
        const rows = Array.from({ length: count }, (_, i) => ({
          influencer_id: influencerId,
          project_id: projectId,
          user_id: gate.user.id,
          script: plan.name || "Dinámica",
          overlay: overlays[i]?.trim().slice(0, 140) || null,
          overlay_style:
            plan.overlayStyle || captionStyleForIndex(overlayStyleMode, i),
          overlay_position: plan.overlayPosition || overlayPosition,
          beauty,
          prompt: influencerClipPrompt({
            name: influencer.name,
            script: "",
            product: "",
            language,
            action: "Clonar el movimiento del video de Mimic Motion.",
            extra: "",
            speak: false,
          }),
          request_id: null,
          status: "queued",
          model_id: modelId,
          duration: cloneDuration,
          action: dynamic.id,
          extra,
          estimated_cost_usd: estimateInfluencerVideoCost({
            modelId,
            refCount: refs.length || 6,
            durationSec: Number(cloneDuration),
            clone: true,
          }).totalUsd,
          reference_video_url: mimicUrl,
          demo_video_url: tails[0] || null,
          format: "talking",
        }));
        const { data: created, error } = await gate.supabase
          .from("estudio_influencer_videos")
          .insert(rows)
          .select(VIDEO_SELECT);
        if (error || !created?.length) {
          return NextResponse.json(
            { error: error?.message || "No se pudo crear el video" },
            { status: 500 }
          );
        }
        scheduleEstudioInfluencerVideoWorker({ force: true });
        return NextResponse.json({
          videos: (created as VideoRow[]).map(mapVideo),
          queued: created.length,
        });
      }
      const hookSlot = dynamic.slots.find((slot) => slot.id === "hook-reference");
      const demoSlot = dynamic.slots.find((slot) => slot.id === "app-demo");
      if (!hookSlot?.folderId || !demoSlot?.folderId) {
        return NextResponse.json(
          { error: "Faltan las carpetas de Hook + App Demo." },
          { status: 409 }
        );
      }
      const [hookVideos, demoVideos] = await Promise.all([
        listFolderVideoAssets(
          gate.supabase,
          projectId,
          gate.user.id,
          hookSlot.folderId
        ),
        listFolderVideoAssets(
          gate.supabase,
          projectId,
          gate.user.id,
          demoSlot.folderId
        ),
      ]);
      let clips: ReturnType<typeof pickHookAppDemoClips>;
      try {
        clips = pickHookAppDemoClips({
          mode,
          hookVideos,
          demoVideos,
          hookAssetId: (body.hookAssetId || "").trim(),
          demoAssetId: (body.demoAssetId || "").trim(),
        });
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "No se pudieron elegir los clips",
          },
          { status: 400 }
        );
      }

      let folderId = influencer.folderId || null;
      try {
        folderId = (
          await ensureInfluencerPersonFolder(
            gate.supabase,
            projectId,
            gate.user.id,
            {
              id: influencer.id,
              name: influencer.name,
              folderId: influencer.folderId,
            }
          )
        ).id;
      } catch {
        /* keep existing */
      }

      const { data: inserted, error: insertErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .insert({
          influencer_id: influencerId,
          project_id: projectId,
          user_id: gate.user.id,
          script: dynamic.name,
          prompt: "",
          request_id: null,
          status: "composing",
          model_id: null,
          duration: null,
          action: dynamic.id,
          extra: mode,
          format: "app-demo",
          talking_video_url: clips.hook.publicUrl,
          demo_video_url: clips.demo.publicUrl,
          estimated_cost_usd: 0,
          overlay: null,
          beauty: false,
        })
        .select(VIDEO_SELECT)
        .single();
      if (insertErr || !inserted) {
        return NextResponse.json(
          { error: insertErr?.message || "No se pudo crear el video" },
          { status: 500 }
        );
      }

      const videoId = (inserted as VideoRow).id;
      try {
        const [hookFile, demoFile] = await Promise.all([
          downloadBinary(clips.hook.publicUrl, 200 * 1024 * 1024),
          downloadBinary(clips.demo.publicUrl, 200 * 1024 * 1024),
        ]);
        const combined = await concatVerticalClips([
          { buffer: hookFile.buffer, audio: "input" },
          { buffer: demoFile.buffer, audio: "input" },
        ]);
        if (!folderId) {
          throw new Error("No hay carpeta del influencer para guardar el video.");
        }
        const saved = await saveBufferToGallery({
          supabase: gate.supabase,
          userId: gate.user.id,
          projectId,
          buffer: combined,
          contentType: "video/mp4",
          folderId,
          name: `hook-demo-${videoId.slice(0, 8)}.mp4`,
          kind: "video",
        });
        await gate.supabase
          .from("estudio_influencer_videos")
          .update({
            status: "saved",
            video_url: saved.publicUrl,
            asset_id: saved.id,
            talking_video_url: clips.hook.publicUrl,
            demo_video_url: clips.demo.publicUrl,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId);
        const { data: fresh } = await gate.supabase
          .from("estudio_influencer_videos")
          .select(VIDEO_SELECT)
          .eq("id", videoId)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          video: fresh ? mapVideo(fresh as VideoRow) : mapVideo(inserted as VideoRow),
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No se pudieron unir los videos";
        await gate.supabase
          .from("estudio_influencer_videos")
          .update({
            status: "failed",
            error: message.slice(0, 400),
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const refCount = influencerVideoRefUrls(influencer).length;
    const estimatedCostUsd = estimateInfluencerVideoCost({
      modelId,
      refCount: refCount || 6,
      durationSec: Number(duration),
      clone: isMotionClone,
    }).totalUsd;

    if (action === "demo-error") {
      const videoId = (body.videoId || "").trim();
      const message = (body.error || "").trim().slice(0, 400) || "No se pudo renderizar la demo";
      if (!videoId) {
        return NextResponse.json({ error: "Falta el video" }, { status: 400 });
      }
      const { error } = await gate.supabase
        .from("estudio_influencer_videos")
        .update({
          status: "demo_pending",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .in("status", ["demo_pending", "composing"]);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "attach-demo") {
      const videoId = (body.videoId || "").trim();
      const demoUrl = (body.demoUrl || "").trim();
      if (!videoId || !demoUrl) {
        return NextResponse.json(
          { error: "Falta el video de la demo" },
          { status: 400 }
        );
      }
      const { data: row, error: loadErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select(VIDEO_SELECT)
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      const status = String(row.status || "").toLowerCase();
      if (status !== "demo_pending" && status !== "composing") {
        return NextResponse.json(
          { error: "Este video no está esperando la demo" },
          { status: 409 }
        );
      }
      const talkingUrl =
        (row.talking_video_url as string | null) ||
        (row.video_url as string | null);
      if (!talkingUrl) {
        return NextResponse.json(
          { error: "Falta el video del influencer" },
          { status: 409 }
        );
      }

      await gate.supabase
        .from("estudio_influencer_videos")
        .update({
          status: "composing",
          demo_video_url: demoUrl,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      try {
        const [talking, demo] = await Promise.all([
          downloadBinary(talkingUrl, 200 * 1024 * 1024),
          downloadBinary(demoUrl, 200 * 1024 * 1024),
        ]);
        const combinedRaw = await concatTalkingAndDemo(
          talking.buffer,
          demo.buffer
        );
        const overlay =
          String(row.overlay || "").trim() ||
          parseInfluencerScript(String(row.script || "")).overlay;
        let combined = combinedRaw;
        if (overlay) {
          try {
            combined = await burnTopText(
              combinedRaw,
              overlay,
              String(row.overlay_style || "")
            );
          } catch {
            combined = combinedRaw;
          }
        }
        const inf = await loadInfluencer(
          gate.supabase,
          projectId,
          influencerId
        );
        let folderId = inf?.folderId || null;
        if (inf) {
          try {
            folderId = (
              await ensureInfluencerPersonFolder(
                gate.supabase,
                projectId,
                gate.user.id,
                {
                  id: inf.id,
                  name: inf.name,
                  folderId: inf.folderId,
                }
              )
            ).id;
          } catch {
            /* keep existing */
          }
        }
        if (folderId) {
          const saved = await saveBufferToGallery({
            supabase: gate.supabase,
            userId: gate.user.id,
            projectId,
            buffer: combined,
            contentType: "video/mp4",
            folderId,
            name: `influencer-demo-${videoId.slice(0, 8)}.mp4`,
            kind: "video",
          });
          await gate.supabase
            .from("estudio_influencer_videos")
            .update({
              status: "saved",
              video_url: saved.publicUrl,
              asset_id: saved.id,
              talking_video_url: talkingUrl,
              demo_video_url: demoUrl,
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", videoId);
        } else {
          const { uploadStorageObject } = await import(
            "@/lib/supabase/storage-binary"
          );
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const {
            data: { session },
          } = await gate.supabase.auth.getSession();
          const storagePath = `${projectId}/influencers/${influencerId}/combo-${videoId.slice(0, 8)}.mp4`;
          if (supabaseUrl && anonKey && session?.access_token) {
            await uploadStorageObject({
              supabaseUrl,
              accessToken: session.access_token,
              anonKey,
              bucket: "gallery",
              path: storagePath,
              body: combined,
              contentType: "video/mp4",
            });
          } else {
            const { error: upErr } = await gate.supabase.storage
              .from("gallery")
              .upload(storagePath, combined, {
                contentType: "video/mp4",
                upsert: true,
              });
            if (upErr) throw new Error(upErr.message);
          }
          const { data: pub } = gate.supabase.storage
            .from("gallery")
            .getPublicUrl(storagePath);
          await gate.supabase
            .from("estudio_influencer_videos")
            .update({
              status: "completed",
              video_url: pub.publicUrl,
              talking_video_url: talkingUrl,
              demo_video_url: demoUrl,
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", videoId);
        }
        const { data: fresh } = await gate.supabase
          .from("estudio_influencer_videos")
          .select(VIDEO_SELECT)
          .eq("id", videoId)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          video: fresh ? mapVideo(fresh as VideoRow) : null,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No se pudieron unir los videos";
        await gate.supabase
          .from("estudio_influencer_videos")
          .update({
            status: "demo_pending",
            error: message.slice(0, 400),
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (action === "start") {
      const refs = influencerVideoRefUrls(influencer);
      if (!refs.length) {
        return NextResponse.json(
          {
            error:
              "Espera a que esté lista al menos una foto del influencer para usarla de referencia.",
          },
          { status: 409 }
        );
      }
      const falKey = await getFalApiKey();
      const replicateKey = await getReplicateApiKey();
      if (!falKey && !replicateKey) {
        return NextResponse.json(
          {
            error: "NOT_CONNECTED",
            message: VIDEO_CONNECT_MSG,
          },
          { status: 403 }
        );
      }
      const { data: drafts, error: draftErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select("id, script, overlay, prompt")
        .eq("influencer_id", influencerId)
        .eq("status", "draft")
        .is("request_id", null);
      if (draftErr) {
        return NextResponse.json({ error: draftErr.message }, { status: 500 });
      }
      const ids = (drafts ?? []).map((d) => d.id as string);
      if (!ids.length) {
        return NextResponse.json({ ok: true, queued: 0 });
      }
      if (format === "app-demo" && !demoSnapshot) {
        return NextResponse.json(
          {
            error:
              "Abre App Demo en Estudio, guarda la composición y vuelve a iniciar.",
          },
          { status: 400 }
        );
      }
      const demoFields = demoInsertFields(format, demoSnapshot);
      for (const [i, row] of (drafts ?? []).entries()) {
        const parts = spokenParts(String(row.script || ""));
        const overlay = String(row.overlay || "").trim() || parts.overlay;
        const script = parts.script;
        if (script.length < 8) continue;
        await gate.supabase
          .from("estudio_influencer_videos")
          .update({
            status: "queued",
            model_id: modelId,
            duration,
            action: templateAction || null,
            extra: templateExtra || null,
            estimated_cost_usd: estimatedCostUsd,
            script,
            overlay: overlay || null,
            overlay_style: captionStyleForIndex(overlayStyleMode, i),
            overlay_position: overlayPosition,
            beauty,
            reference_video_url: templateVideoUrl,
            prompt:
              String(row.prompt || "").trim() ||
              influencerClipPrompt({
                name: influencer.name,
                script,
                product: "",
                language,
                action: templateAction,
                extra: templateExtra,
                speak: templateSpeak,
              }),
            error: null,
            updated_at: new Date().toISOString(),
            ...demoFields,
          })
          .eq("id", row.id as string)
          .eq("influencer_id", influencerId);
      }
      scheduleEstudioInfluencerVideoWorker({ force: true });
      return NextResponse.json({
        ok: true,
        queued: ids.length,
      });
    }

    if (action === "queue-demo") {
      const videoId = (body.videoId || "").trim();
      if (!videoId) {
        return NextResponse.json({ error: "Falta el video" }, { status: 400 });
      }
      const snap = demoSnapshot || parseAppDemoSnapshot(body.demo);
      if (!snap) {
        return NextResponse.json(
          {
            error:
              "Abre App Demo en Estudio, guarda la composición y vuelve a unir la demo.",
          },
          { status: 400 }
        );
      }
      const { data: row, error: loadErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select(VIDEO_SELECT)
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      const talkingUrl =
        (row.talking_video_url as string | null) ||
        (row.video_url as string | null);
      if (!talkingUrl) {
        return NextResponse.json(
          { error: "Este video todavía no tiene el clip del influencer" },
          { status: 409 }
        );
      }
      const { error: updErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .update({
          status: "demo_pending",
          format: "app-demo",
          demo_code: snap.code,
          demo_phone_frame: snap.phoneFrame,
          demo_variables: snap.variables,
          talking_video_url: talkingUrl,
          video_url: talkingUrl,
          demo_video_url: null,
          asset_id: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      const { data: fresh } = await gate.supabase
        .from("estudio_influencer_videos")
        .select(VIDEO_SELECT)
        .eq("id", videoId)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        video: fresh ? mapVideo(fresh as VideoRow) : null,
      });
    }

    if (action === "cancel") {
      const videoId = (body.videoId || "").trim();
      if (!videoId) {
        return NextResponse.json({ error: "Falta el video" }, { status: 400 });
      }
      const { data: row, error: loadErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select(
          "id, status, request_id, model_id, video_provider, asset_id, reference_video_url"
        )
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      const status = String(row.status || "").toLowerCase();
      const active = [
        "draft",
        "queued",
        "pending",
        "in_progress",
        "saving",
        "demo_pending",
        "composing",
      ].includes(status);
      if (!active || row.asset_id) {
        return NextResponse.json(
          { error: "Este video no se está generando" },
          { status: 409 }
        );
      }
      const requestId = String(row.request_id || "").trim();
      if (requestId && (row.video_provider || "") !== "replicate") {
        try {
          const falKey = await getFalApiKey();
          if (falKey) {
            await falQueueCancel(
              falKey,
              falJobModelId({
                modelId: row.model_id as string | null,
                referenceVideoUrl: row.reference_video_url as string | null,
              }),
              requestId
            );
          }
        } catch {
          /* the job is still marked stopped */
        }
      }
      const { error: cancelErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .update({
          status: "cancelled",
          provider_status: "CANCELLED",
          queue_position: null,
          error: "Generación detenida",
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId)
        .eq("influencer_id", influencerId);
      if (cancelErr) {
        return NextResponse.json({ error: cancelErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, cancelled: videoId });
    }

    if (action === "retry") {
      const videoId = (body.videoId || "").trim();
      if (!videoId) {
        return NextResponse.json({ error: "Falta el video" }, { status: 400 });
      }
      const refs = influencerVideoRefUrls(influencer);
      if (!refs.length) {
        return NextResponse.json(
          {
            error:
              "Espera a que esté lista al menos una foto del influencer para usarla de referencia.",
          },
          { status: 409 }
        );
      }
      const falKey = await getFalApiKey();
      const replicateKey = await getReplicateApiKey();
      if (!falKey && !replicateKey) {
        return NextResponse.json(
          {
            error: "NOT_CONNECTED",
            message: VIDEO_CONNECT_MSG,
          },
          { status: 403 }
        );
      }
      const { data: row, error: loadErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select("id, status, video_url, asset_id, error, request_id")
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      const status = String(row.status || "").toLowerCase();
      const retryable =
        !row.video_url &&
        !row.asset_id &&
        (status === "failed" || isKlingPromptError(row.error as string | null));
      if (!retryable) {
        return NextResponse.json(
          { error: "Este video no se puede reintentar" },
          { status: 409 }
        );
      }
      const keepFrame = isKlingResolutionError(row.error as string | null);
      const { error: retryErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .update({
          status: "queued",
          model_id: modelId,
          estimated_cost_usd: estimatedCostUsd,
          request_id: null,
          video_provider: null,
          ...(keepFrame ? {} : { start_image_url: null, api_trace: null }),
          provider_status: null,
          queue_position: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId)
        .eq("influencer_id", influencerId);
      if (retryErr) {
        return NextResponse.json({ error: retryErr.message }, { status: 500 });
      }
      scheduleEstudioInfluencerVideoWorker({ force: true });
      return NextResponse.json({ ok: true, retried: videoId });
    }

    if (action === "toggle-beauty") {
      const videoId = (body.videoId || "").trim();
      if (!videoId) {
        return NextResponse.json({ error: "Falta el video" }, { status: 400 });
      }
      const { data: row, error: loadErr } = await gate.supabase
        .from("estudio_influencer_videos")
        .select(VIDEO_SELECT)
        .eq("id", videoId)
        .eq("influencer_id", influencerId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      const mapped = mapVideo(row as VideoRow);
      const status = (mapped.status || "").toLowerCase();
      if (!mapped.videoUrl) {
        return NextResponse.json(
          { error: "Este video aún no está listo." },
          { status: 409 }
        );
      }
      if (
        status !== "completed" &&
        status !== "saved" &&
        status !== "demo_pending"
      ) {
        return NextResponse.json(
          { error: "Espera a que termine de generarse." },
          { status: 409 }
        );
      }
      const sourceUrl = mapped.sourceVideoUrl || "";
      const currentlyOn = Boolean(sourceUrl) && mapped.beauty !== false;
      const nextBeauty = !currentlyOn;
      const overlay =
        (mapped.overlay || "").trim() ||
        parseInfluencerScript(mapped.script || "").overlay;
      const reburnOverlay = Boolean(sourceUrl) && !/\/talking-/.test(sourceUrl);
      try {
        const polished = sourceUrl
          ? await persistInfluencerTalkingClip({
              projectId,
              influencerId,
              videoId,
              sourceUrl,
              overlay: reburnOverlay ? overlay : "",
              style: mapped.overlayStyle,
              beauty: nextBeauty,
              position: mapped.overlayPosition,
            })
          : await persistInfluencerTalkingClip({
              projectId,
              influencerId,
              videoId,
              sourceUrl: mapped.videoUrl,
              overlay: "",
              style: null,
              beauty: true,
            });
        let videoUrl = polished.publicUrl;
        if (mapped.assetId) {
          try {
            videoUrl = await replaceGalleryAssetVideo({
              supabase: gate.supabase,
              assetId: mapped.assetId,
              projectId,
              buffer: polished.buffer,
              name: `influencer-${videoId.slice(0, 8)}.mp4`,
            });
          } catch {
            /* keep talking clip url */
          }
        }
        const { error: updErr } = await gate.supabase
          .from("estudio_influencer_videos")
          .update({
            video_url: videoUrl,
            talking_video_url:
              mapped.format === "app-demo" ? videoUrl : mapped.talkingVideoUrl,
            beauty: nextBeauty,
            source_video_url: sourceUrl || mapped.videoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId)
          .eq("influencer_id", influencerId);
        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        const { data: fresh } = await gate.supabase
          .from("estudio_influencer_videos")
          .select(VIDEO_SELECT)
          .eq("id", videoId)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          beauty: nextBeauty,
          video: fresh ? mapVideo(fresh as VideoRow) : mapped,
        });
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "No se pudo aplicar o quitar el filtro",
          },
          { status: 400 }
        );
      }
    }

    if (action === "enqueue-clone") {
      if (!templateVideoUrl) {
        return NextResponse.json(
          { error: "Elige una dinámica con video de referencia recortado." },
          { status: 400 }
        );
      }
      const refs = influencerVideoRefUrls(influencer);
      if (!refs.length) {
        return NextResponse.json(
          {
            error:
              "Espera a que esté lista al menos una foto del influencer para usarla de referencia.",
          },
          { status: 409 }
        );
      }
      const falKey = await getFalApiKey();
      if (!falKey) {
        return NextResponse.json(
          {
            error: "NOT_CONNECTED",
            message: "Conecta fal.ai en Supabase → Secrets para clonar el movimiento.",
          },
          { status: 403 }
        );
      }
      const openaiKey = await getOpenAIApiKey();
      if (!openaiKey) {
        return NextResponse.json(
          {
            error: "NOT_CONNECTED",
            message:
              "Conecta OpenAI en Supabase → Secrets para crear el fotograma nuevo.",
          },
          { status: 403 }
        );
      }
      const count = Math.min(5, Math.max(1, Number(body.count) || 1));
      const overlay = defaultOverlay;
      const script = overlay || "Clon de movimiento";
      const rows = Array.from({ length: count }, (_, i) => ({
        influencer_id: influencerId,
        project_id: projectId,
        user_id: gate.user.id,
        script,
        overlay: overlay || null,
        overlay_style: captionStyleForIndex(overlayStyleMode, i),
        overlay_position: overlayPosition,
        beauty,
        prompt: influencerClipPrompt({
          name: influencer.name,
          script: overlay || "",
          product: "",
          language,
          action: templateAction,
          extra: "",
          speak: false,
        }),
        request_id: null,
        status: "queued",
        model_id: modelId,
        duration,
        action: templateAction || null,
        extra: null,
        estimated_cost_usd: estimatedCostUsd,
        reference_video_url: templateVideoUrl,
        format: "talking",
      }));
      const { data: created, error } = await gate.supabase
        .from("estudio_influencer_videos")
        .insert(rows)
        .select(VIDEO_SELECT);
      if (error || !created?.length) {
        return NextResponse.json(
          { error: error?.message || "No se pudo crear el video" },
          { status: 500 }
        );
      }
      scheduleEstudioInfluencerVideoWorker({ force: true });
      return NextResponse.json({
        videos: (created as VideoRow[]).map(mapVideo),
        queued: created.length,
      });
    }

    if (action === "enqueue-scripts") {
      if (format === "app-demo" && !demoSnapshot) {
        return NextResponse.json(
          {
            error:
              "Abre App Demo en Estudio, guarda la composición y vuelve a crear los guiones.",
          },
          { status: 400 }
        );
      }
      const count = Math.min(10, Math.max(1, Number(body.count) || 1));
      const scripts = await generateScriptsWithAi({
        name: influencer.name,
        traits: influencer.traits,
        product,
        count,
        language,
        action: templateAction,
        extra: templateExtra,
        durationSec: Number(duration),
        demo: demoSnapshot,
        withOverlay,
        speak: templateSpeak,
      });
      if (!scripts.length) {
        return NextResponse.json(
          { error: "No se pudieron crear los guiones" },
          { status: 422 }
        );
      }
      const rows = scripts
        .map((item, i) => {
          const overlay = item.overlay || defaultOverlay;
          return {
            influencer_id: influencerId,
            project_id: projectId,
            user_id: gate.user.id,
            script: item.script,
            overlay: overlay || null,
            overlay_style: captionStyleForIndex(overlayStyleMode, i),
            overlay_position: overlayPosition,
            beauty,
            prompt: influencerClipPrompt({
              name: influencer.name,
              script: item.script,
              product,
              language,
              action: templateAction,
              extra: templateExtra,
              speak: templateSpeak,
            }),
            request_id: null,
            status: "draft",
            model_id: modelId,
            duration,
            action: templateAction || null,
            extra: templateExtra || null,
            estimated_cost_usd: estimatedCostUsd,
            reference_video_url: templateVideoUrl,
            ...demoInsertFields(format, demoSnapshot, item.variables),
          };
        })
        .filter((row) => row.script.length >= 8);
      if (!rows.length) {
        return NextResponse.json(
          { error: "No se pudieron crear los guiones" },
          { status: 422 }
        );
      }
      const { data: created, error } = await gate.supabase
        .from("estudio_influencer_videos")
        .insert(rows)
        .select(VIDEO_SELECT);
      if (error || !created?.length) {
        return NextResponse.json(
          { error: error?.message || "No se pudieron guardar los guiones" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        videos: (created as VideoRow[]).map(mapVideo),
      });
    }

    const chunks = splitInfluencerScripts(body.script || "");
    const rows = chunks
      .map((raw, i) => {
        const parts = spokenParts(raw);
        return {
          influencer_id: influencerId,
          project_id: projectId,
          user_id: gate.user.id,
          script: parts.script,
          overlay: parts.overlay || null,
          overlay_style: captionStyleForIndex(overlayStyleMode, i),
          overlay_position: overlayPosition,
          beauty,
          prompt: influencerClipPrompt({
            name: influencer.name,
            script: parts.script,
            product: "",
            language,
            action: templateAction,
            extra: templateExtra,
            speak: templateSpeak,
          }),
          request_id: null,
          status: "draft",
          model_id: modelId,
          duration,
          action: templateAction || null,
          extra: templateExtra || null,
          estimated_cost_usd: estimatedCostUsd,
          reference_video_url: templateVideoUrl,
          ...demoInsertFields(format, demoSnapshot),
        };
      })
      .filter((row) => row.script.length >= 8);

    if (!rows.length) {
      return NextResponse.json(
        { error: "Escribe un guion un poco más largo" },
        { status: 400 }
      );
    }

    if (format === "app-demo" && !demoSnapshot) {
      return NextResponse.json(
        {
          error:
            "Abre App Demo en Estudio, guarda la composición y vuelve a añadir el guion.",
        },
        { status: 400 }
      );
    }

    const { data: created, error } = await gate.supabase
      .from("estudio_influencer_videos")
      .insert(rows)
      .select(VIDEO_SELECT);
    if (error || !created?.length) {
      return NextResponse.json(
        { error: error?.message || "No se pudo guardar el guion" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      videos: (created as VideoRow[]).map(mapVideo),
      video: mapVideo(created[0] as VideoRow),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "No se pudo procesar la cola",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId, influencerId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const videoId = new URL(request.url).searchParams.get("videoId")?.trim();
  if (!videoId) {
    return NextResponse.json({ error: "Falta el video" }, { status: 400 });
  }

  const { data: row, error: loadErr } = await gate.supabase
    .from("estudio_influencer_videos")
    .select("id, status, video_url, asset_id, error, provider_status")
    .eq("id", videoId)
    .eq("influencer_id", influencerId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (
    !canDeleteInfluencerVideo({
      status: row.status as string | null,
      error: row.error as string | null,
      providerStatus: row.provider_status as string | null,
    })
  ) {
    return NextResponse.json(
      { error: "Espera a que termine de generarse." },
      { status: 409 }
    );
  }

  const assetId = typeof row.asset_id === "string" ? row.asset_id : "";

  const { error } = await gate.supabase
    .from("estudio_influencer_videos")
    .delete()
    .eq("id", videoId)
    .eq("influencer_id", influencerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (assetId) {
    const { data: asset } = await gate.supabase
      .from("project_gallery_assets")
      .select("id, storage_path")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (asset?.storage_path) {
      await gate.supabase.storage.from("gallery").remove([asset.storage_path]);
    }
    if (asset) {
      await gate.supabase
        .from("project_gallery_assets")
        .delete()
        .eq("id", assetId)
        .eq("project_id", projectId);
    }
  }

  return NextResponse.json({ ok: true });
}
