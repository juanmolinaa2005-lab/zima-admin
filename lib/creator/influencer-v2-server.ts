import { downloadBinary } from "@/lib/download-binary";
import { concatVerticalClips } from "@/lib/creator/concat-videos";
import { saveBufferToGallery } from "@/lib/creator/gallery-save";
import { GALLERY_ASSET_SELECT, mapGalleryAsset } from "@/lib/gallery/asset";
import { ensureInfluencerPersonFolder } from "@/lib/gallery/influencers-folder";
import { scheduleEstudioInfluencerVideoWorker } from "@/lib/creator/influencer-video-worker";
import { influencerVideoRefUrls } from "@/lib/creator/influencer-video";
import {
  assembleInfluencers,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import {
  DEFAULT_FAL_VIDEO_MODEL,
  getFalVideoDuration,
  getFalVoiceVideoModel,
} from "@/lib/creator/fal-video-models";
import {
  applyV2CampaignEdits,
  assertV2NotComposing,
  composeBlockers,
  composeLockMode,
  continuityLine,
  estimateV2CampaignCost,
  httpError,
  isActiveVideoStatus,
  isReadyVideoStatus,
  mapCampaignRow,
  normalizeV2Scenes,
  parseV2PatchBody,
  sceneKind,
  scenesForCompose,
  scenesToEnqueue,
  v2SceneVideoPrompt,
  v2StoredJobScript,
  V2_MAX_CLIP_BYTES,
  V2_MAX_COMPOSE_BYTES,
  V2_MAX_TOTAL_DURATION_SEC,
  type V2Campaign,
  type V2JobPublic,
} from "@/lib/creator/influencer-v2";
import { estimateInfluencerVideoCost } from "@/lib/creator/influencer-video-cost";
import type { EstudioInfluencer } from "@/lib/creator/estudio-v1";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export const V2_CAMPAIGN_SELECT =
  "id, project_id, influencer_id, title, brief, objective, language, model_id, status, continuity, scenes, final_asset_id, final_video_url, estimated_cost_usd, created_at, updated_at";

export const V2_JOB_SELECT =
  "id, influencer_id, script, status, video_url, asset_id, error, request_id, estimated_cost_usd, duration, action, extra, overlay, model_id, provider_status, v2_campaign_id, v2_scene_id, created_at, updated_at";

type VideoJobRow = {
  id: string;
  influencer_id: string;
  script: string;
  status: string;
  video_url: string | null;
  asset_id: string | null;
  error: string | null;
  request_id: string | null;
  estimated_cost_usd?: number | string | null;
  duration: string | null;
  action: string | null;
  extra: string | null;
  overlay: string | null;
  model_id: string | null;
  provider_status: string | null;
  v2_campaign_id: string | null;
  v2_scene_id: string | null;
  created_at: string;
  updated_at?: string | null;
};

function asMoney(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapV2Job(row: VideoJobRow): V2JobPublic {
  return {
    id: row.id,
    sceneId: row.v2_scene_id,
    status: row.status,
    videoUrl: row.video_url,
    assetId: row.asset_id,
    error: row.error,
    requestId: row.request_id,
    estimatedCostUsd: asMoney(row.estimated_cost_usd),
    duration: row.duration,
    providerStatus: row.provider_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

export function jobsById(jobs: V2JobPublic[]): Record<string, V2JobPublic> {
  const out: Record<string, V2JobPublic> = {};
  for (const job of jobs) out[job.id] = job;
  return out;
}

export async function loadV2Campaign(
  supabase: Db,
  projectId: string,
  campaignId: string
): Promise<V2Campaign | null> {
  const { data, error } = await supabase
    .from("estudio_influencer_v2_campaigns")
    .select(V2_CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCampaignRow(data);
}

export async function saveV2Campaign(
  supabase: Db,
  campaign: V2Campaign,
  patch: Record<string, unknown>
): Promise<V2Campaign> {
  const { data, error } = await supabase
    .from("estudio_influencer_v2_campaigns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", campaign.id)
    .eq("project_id", campaign.projectId)
    .select(V2_CAMPAIGN_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message || "No se pudo guardar la campaña");
  return mapCampaignRow(data);
}

export async function listV2Jobs(
  supabase: Db,
  campaignId: string
): Promise<V2JobPublic[]> {
  const { data, error } = await supabase
    .from("estudio_influencer_videos")
    .select(V2_JOB_SELECT)
    .eq("v2_campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as VideoJobRow[]).map(mapV2Job);
}

export async function loadInfluencerForV2(
  supabase: Db,
  projectId: string,
  influencerId: string
): Promise<EstudioInfluencer | null> {
  const { data: row, error } = await supabase
    .from("estudio_influencers")
    .select("id, project_id, user_id, name, traits, folder_id, created_at")
    .eq("id", influencerId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const { data: shots, error: sErr } = await supabase
    .from("estudio_influencer_shots")
    .select(
      "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at"
    )
    .eq("influencer_id", influencerId)
    .order("sort_index", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  return assembleInfluencers(
    [row as InfluencerRow],
    (shots ?? []) as InfluencerShotRow[]
  )[0] ?? null;
}

async function findJobByScene(
  supabase: Db,
  campaignId: string,
  sceneId: string
): Promise<VideoJobRow | null> {
  const { data, error } = await supabase
    .from("estudio_influencer_videos")
    .select(V2_JOB_SELECT)
    .eq("v2_campaign_id", campaignId)
    .eq("v2_scene_id", sceneId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as VideoJobRow | null) ?? null;
}

export async function loadV2PlanMedia(
  supabase: Db,
  projectId: string
): Promise<{ hasAppDemo: boolean; galleryCount: number }> {
  const [gallery, appDemoAssets, influencerDemos, appDemoJobs] =
    await Promise.all([
      supabase
        .from("project_gallery_assets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("kind", "video"),
      supabase
        .from("project_gallery_assets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("kind", "video")
        .ilike("name", "app-demo-%"),
      supabase
        .from("project_gallery_assets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("kind", "video")
        .ilike("name", "influencer-demo-%"),
      supabase
        .from("estudio_influencer_videos")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("format", "app-demo")
        .not("demo_video_url", "is", null),
    ]);
  for (const result of [gallery, appDemoAssets, influencerDemos, appDemoJobs]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    galleryCount: gallery.count ?? 0,
    hasAppDemo:
      (appDemoAssets.count ?? 0) > 0 ||
      (influencerDemos.count ?? 0) > 0 ||
      (appDemoJobs.count ?? 0) > 0,
  };
}

export async function enqueueV2Campaign(opts: {
  supabase: Db;
  userId: string;
  campaign: V2Campaign;
  sceneIds?: string[];
}): Promise<{ campaign: V2Campaign; jobs: V2JobPublic[]; queued: number }> {
  assertV2NotComposing(opts.campaign);
  if (!opts.campaign.influencerId) {
    throw Object.assign(new Error("Elige un influencer de V1 para generar."), {
      status: 400,
    });
  }
  const influencer = await loadInfluencerForV2(
    opts.supabase,
    opts.campaign.projectId,
    opts.campaign.influencerId
  );
  if (!influencer) {
    throw Object.assign(new Error("Influencer no encontrado"), { status: 404 });
  }
  const refs = influencerVideoRefUrls(influencer);
  if (!refs.length) {
    throw Object.assign(
      new Error(
        "Espera a que esté lista al menos una foto del influencer para usarla de referencia."
      ),
      { status: 409 }
    );
  }

  const jobs = await listV2Jobs(opts.supabase, opts.campaign.id);
  const byId = jobsById(jobs);
  const model = getFalVoiceVideoModel(
    opts.campaign.modelId || DEFAULT_FAL_VIDEO_MODEL
  );
  let scenes = normalizeV2Scenes(opts.campaign.scenes);
  const wanted = new Set(opts.sceneIds?.filter(Boolean) ?? []);
  const toCreate = scenesToEnqueue(scenes, byId).filter(
    (scene) => !wanted.size || wanted.has(scene.id)
  );
  if (!toCreate.length) {
    throw Object.assign(
      new Error(
        "No hay escenas nuevas que generar. Las de galería/App Demo no lanzan jobs; las ya encoladas no se duplican."
      ),
      { status: 409 }
    );
  }

  let queued = 0;
  for (const scene of toCreate) {
    const existing = await findJobByScene(
      opts.supabase,
      opts.campaign.id,
      scene.id
    );
    if (existing) {
      scenes = scenes.map((s) =>
        s.id === scene.id ? { ...s, videoId: existing.id } : s
      );
      continue;
    }

    const duration = getFalVideoDuration(model.id, scene.durationSec);
    const estimatedCostUsd = estimateInfluencerVideoCost({
      modelId: model.id,
      refCount: refs.length || 6,
      durationSec: Number(duration),
    }).totalUsd;
    const prompt = v2SceneVideoPrompt({
      scene,
      name: influencer.name,
      traits: influencer.traits,
      language: opts.campaign.language,
      continuity: opts.campaign.continuity,
    });
    const extra = [scene.extra, continuityLine(opts.campaign.continuity)]
      .filter(Boolean)
      .join(". ");
    const storedScript = v2StoredJobScript(scene);
    const storedAction =
      scene.role === "action" ? storedScript : scene.action || null;

    const { data: created, error } = await opts.supabase
      .from("estudio_influencer_videos")
      .insert({
        influencer_id: influencer.id,
        project_id: opts.campaign.projectId,
        user_id: opts.userId,
        script: storedScript,
        overlay: scene.overlay || null,
        prompt,
        request_id: null,
        status: "queued",
        model_id: model.id,
        duration,
        action: storedAction,
        extra: extra || null,
        estimated_cost_usd: estimatedCostUsd,
        format: "talking",
        v2_campaign_id: opts.campaign.id,
        v2_scene_id: scene.id,
      })
      .select(V2_JOB_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        const raced = await findJobByScene(
          opts.supabase,
          opts.campaign.id,
          scene.id
        );
        if (raced) {
          scenes = scenes.map((s) =>
            s.id === scene.id ? { ...s, videoId: raced.id } : s
          );
          continue;
        }
      }
      throw new Error(error.message);
    }
    if (!created) continue;
    queued += 1;
    scenes = scenes.map((s) =>
      s.id === scene.id ? { ...s, videoId: (created as VideoJobRow).id } : s
    );
  }

  const estimate = estimateV2CampaignCost({
    scenes,
    modelId: model.id,
    refCount: refs.length || 6,
    jobs: byId,
  });
  const campaign = await saveV2Campaign(opts.supabase, opts.campaign, {
    scenes,
    influencer_id: influencer.id,
    model_id: model.id,
    status: "generating",
    estimated_cost_usd: estimate.cost.totalUsd,
  });
  if (queued > 0) scheduleEstudioInfluencerVideoWorker({ force: true });
  return { campaign, jobs: await listV2Jobs(opts.supabase, campaign.id), queued };
}

export async function retryV2Scene(opts: {
  supabase: Db;
  campaign: V2Campaign;
  sceneId: string;
}): Promise<{ campaign: V2Campaign; jobs: V2JobPublic[]; retried: string | null }> {
  assertV2NotComposing(opts.campaign);
  const jobs = await listV2Jobs(opts.supabase, opts.campaign.id);
  const byId = jobsById(jobs);
  const scene = opts.campaign.scenes.find((s) => s.id === opts.sceneId);
  if (!scene) {
    throw Object.assign(new Error("Escena no encontrada"), { status: 404 });
  }
  if (sceneKind(scene) !== "generate" || !scene.videoId) {
    throw Object.assign(
      new Error("Esta escena no tiene un job de esta campaña."),
      { status: 409 }
    );
  }
  const job = byId[scene.videoId];
  if (job && (isActiveVideoStatus(job.status) || isReadyVideoStatus(job.status))) {
    return { campaign: opts.campaign, jobs, retried: null };
  }
  const { data, error } = await opts.supabase
    .from("estudio_influencer_videos")
    .update({
      status: "queued",
      request_id: null,
      video_provider: null,
      start_image_url: null,
      api_trace: null,
      provider_status: null,
      queue_position: null,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scene.videoId)
    .eq("v2_campaign_id", opts.campaign.id)
    .eq("v2_scene_id", scene.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw Object.assign(
      new Error("El job ya no está fallido o no pertenece a esta campaña."),
      { status: 409 }
    );
  }
  scheduleEstudioInfluencerVideoWorker({ force: true });
  const campaign = await saveV2Campaign(opts.supabase, opts.campaign, {
    status: "generating",
  });
  return {
    campaign,
    jobs: await listV2Jobs(opts.supabase, campaign.id),
    retried: scene.videoId,
  };
}

async function downloadGalleryVideo(
  supabase: Db,
  opts: {
    projectId: string;
    userId: string;
    assetId: string;
  }
): Promise<{ buffer: Buffer; name: string }> {
  const { data, error } = await supabase
    .from("project_gallery_assets")
    .select(GALLERY_ASSET_SELECT)
    .eq("id", opts.assetId)
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw Object.assign(new Error("Asset de galería no encontrado"), {
      status: 404,
    });
  }
  const asset = mapGalleryAsset(data);
  if (asset.kind !== "video") {
    throw Object.assign(
      new Error(`${asset.name}: solo se aceptan vídeos reales de galería.`),
      { status: 400 }
    );
  }
  if (asset.sizeBytes > V2_MAX_CLIP_BYTES) {
    throw Object.assign(
      new Error(`${asset.name}: supera el límite de ${Math.round(V2_MAX_CLIP_BYTES / (1024 * 1024))} MB.`),
      { status: 400 }
    );
  }
  const { data: file, error: downErr } = await supabase.storage
    .from("gallery")
    .download(asset.storagePath);
  if (downErr || !file) {
    throw new Error(downErr?.message || `No se pudo leer ${asset.name}`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) throw new Error(`${asset.name} está vacío.`);
  if (buffer.byteLength > V2_MAX_CLIP_BYTES) {
    throw Object.assign(
      new Error(`${asset.name}: el archivo descargado es demasiado grande.`),
      { status: 400 }
    );
  }
  return { buffer, name: asset.name };
}

export async function composeV2Campaign(opts: {
  supabase: Db;
  userId: string;
  campaign: V2Campaign;
  force?: boolean;
}): Promise<{ campaign: V2Campaign; jobs: V2JobPublic[] }> {
  if (
    !opts.force &&
    opts.campaign.status === "done" &&
    opts.campaign.finalAssetId &&
    opts.campaign.finalVideoUrl
  ) {
    return {
      campaign: opts.campaign,
      jobs: await listV2Jobs(opts.supabase, opts.campaign.id),
    };
  }
  const lockMode = composeLockMode(
    opts.campaign.status,
    opts.campaign.updatedAt
  );
  if (lockMode === "conflict") {
    throw httpError("Esta campaña ya se está montando.", 409);
  }

  const jobs = await listV2Jobs(opts.supabase, opts.campaign.id);
  const byId = jobsById(jobs);
  const blockers = composeBlockers(opts.campaign.scenes, byId);
  if (blockers.length) {
    throw Object.assign(new Error(blockers[0]), { status: 409 });
  }

  const influencer = opts.campaign.influencerId
    ? await loadInfluencerForV2(
        opts.supabase,
        opts.campaign.projectId,
        opts.campaign.influencerId
      )
    : null;
  let folderId = influencer?.folderId || null;
  if (influencer) {
    try {
      folderId = (
        await ensureInfluencerPersonFolder(
          opts.supabase,
          opts.campaign.projectId,
          opts.userId,
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
  }
  if (!folderId) {
    throw Object.assign(
      new Error(
        "No se pudo crear la carpeta de Galería para este influencer."
      ),
      { status: 409 }
    );
  }

  const lockAt = new Date().toISOString();
  let lockQuery = opts.supabase
    .from("estudio_influencer_v2_campaigns")
    .update({
      status: "composing",
      updated_at: lockAt,
    })
    .eq("id", opts.campaign.id)
    .eq("project_id", opts.campaign.projectId);
  lockQuery =
    lockMode === "steal"
      ? lockQuery
          .eq("status", "composing")
          .eq("updated_at", opts.campaign.updatedAt)
      : lockQuery.neq("status", "composing");
  const { data: locked, error: lockErr } = await lockQuery
    .select("id, status, updated_at")
    .maybeSingle();
  if (lockErr) throw new Error(lockErr.message);
  if (!locked) {
    throw httpError("Esta campaña ya se está montando.", 409);
  }
  const heldUpdatedAt = String(
    (locked as { updated_at?: string }).updated_at || lockAt
  );

  const clips: { buffer: Buffer; audio: "input" | "silent"; durationSec: number }[] =
    [];
  let totalBytes = 0;
  let totalDur = 0;

  try {
    for (const scene of scenesForCompose(opts.campaign.scenes)) {
      const kind = sceneKind(scene);
      totalDur += scene.durationSec;
      if (totalDur > V2_MAX_TOTAL_DURATION_SEC) {
        throw Object.assign(
          new Error(`Duración total máxima ${V2_MAX_TOTAL_DURATION_SEC}s.`),
          { status: 400 }
        );
      }
      let buffer: Buffer;
      if (kind === "gallery" || kind === "app-demo") {
        if (!scene.galleryAssetId) {
          throw Object.assign(new Error(`${scene.title}: falta el asset.`), {
            status: 409,
          });
        }
        buffer = (
          await downloadGalleryVideo(opts.supabase, {
            projectId: opts.campaign.projectId,
            userId: opts.userId,
            assetId: scene.galleryAssetId,
          })
        ).buffer;
      } else {
        const job = scene.videoId ? byId[scene.videoId] : undefined;
        if (!job) {
          throw Object.assign(new Error(`${scene.title}: falta el job.`), {
            status: 409,
          });
        }
        if (job.assetId) {
          buffer = (
            await downloadGalleryVideo(opts.supabase, {
              projectId: opts.campaign.projectId,
              userId: opts.userId,
              assetId: job.assetId,
            })
          ).buffer;
        } else if (job.videoUrl) {
          const downloaded = await downloadBinary(job.videoUrl, V2_MAX_CLIP_BYTES);
          buffer = downloaded.buffer;
        } else {
          throw Object.assign(
            new Error(`${scene.title}: el clip generado no tiene archivo.`),
            { status: 409 }
          );
        }
      }
      totalBytes += buffer.byteLength;
      if (totalBytes > V2_MAX_COMPOSE_BYTES) {
        throw Object.assign(
          new Error("El montaje supera el tamaño máximo permitido."),
          { status: 400 }
        );
      }
      clips.push({
        buffer,
        audio: scene.audio,
        durationSec: scene.durationSec,
      });
    }

    const combined = await concatVerticalClips(clips);
    const saved = await saveBufferToGallery({
      supabase: opts.supabase,
      userId: opts.userId,
      projectId: opts.campaign.projectId,
      buffer: combined,
      contentType: "video/mp4",
      folderId,
      name: `influencers-2-${opts.campaign.id.slice(0, 8)}.mp4`,
      kind: "video",
    });
    const { data: done, error: doneErr } = await opts.supabase
      .from("estudio_influencer_v2_campaigns")
      .update({
        status: "done",
        final_asset_id: saved.id,
        final_video_url: saved.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.campaign.id)
      .eq("project_id", opts.campaign.projectId)
      .eq("status", "composing")
      .eq("updated_at", heldUpdatedAt)
      .select(V2_CAMPAIGN_SELECT)
      .maybeSingle();
    if (doneErr) throw new Error(doneErr.message);
    if (!done) {
      throw httpError("El montaje perdió el bloqueo. Inténtalo de nuevo.", 409);
    }
    return { campaign: mapCampaignRow(done), jobs };
  } catch (e) {
    await opts.supabase
      .from("estudio_influencer_v2_campaigns")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.campaign.id)
      .eq("status", "composing")
      .eq("updated_at", heldUpdatedAt);
    throw e;
  }
}

export async function patchCampaignInput(
  supabase: Db,
  campaign: V2Campaign,
  body: unknown
): Promise<Record<string, unknown>> {
  assertV2NotComposing(campaign);
  const edit = parseV2PatchBody(body);
  if (!Object.keys(edit).length) return {};
  if (edit.influencerId) {
    const influencer = await loadInfluencerForV2(
      supabase,
      campaign.projectId,
      edit.influencerId
    );
    if (!influencer) {
      throw httpError("influencerId no pertenece a este proyecto", 400);
    }
  }
  const jobs = await listV2Jobs(supabase, campaign.id);
  const { next } = applyV2CampaignEdits(campaign, edit, {
    jobs: jobsById(jobs),
  });
  return {
    title: next.title,
    brief: next.brief,
    objective: next.objective,
    language: next.language,
    model_id: next.modelId,
    influencer_id: next.influencerId,
    continuity: next.continuity,
    scenes: next.scenes,
    final_asset_id: next.finalAssetId,
    final_video_url: next.finalVideoUrl,
  };
}
