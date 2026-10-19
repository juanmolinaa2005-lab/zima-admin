import {
  AUTOPILOT_SELECT,
  AUTOPILOT_STAGE_PROGRESS,
  type AutopilotRun,
  type AutopilotRow,
  type AutopilotState,
} from "@/lib/creator/autopilot-types";
import {
  asAutopilotStage,
  asAutopilotStatus,
  httpError,
  languageFromProfile,
  parseAutopilotCreateBody,
  parseUuid,
} from "@/lib/creator/autopilot-plan";
import {
  loadAutopilotProductMedia,
  missingProductError,
} from "@/lib/creator/autopilot-media";
import {
  assembleInfluencers,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import { influencerVideoRefUrls } from "@/lib/creator/influencer-video";
import { getFalApiKey } from "@/lib/fal/user-key";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

const INF_SELECT =
  "id, project_id, user_id, name, traits, folder_id, language, created_at";
const SHOT_SELECT =
  "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at";

export function mapAutopilotRun(row: AutopilotRow): AutopilotRun {
  return {
    id: row.id,
    influencerId: row.influencer_id,
    idea: row.idea,
    status: asAutopilotStatus(row.status),
    stage: asAutopilotStage(row.stage),
    progress: Math.min(100, Math.max(0, Number(row.progress) || 0)),
    videoUrl: row.video_url,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutopilotRuns(
  supabase: Db,
  projectId: string,
  influencerId?: string | null
): Promise<AutopilotRun[]> {
  let query = supabase
    .from("estudio_video_autopilot_runs")
    .select(AUTOPILOT_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (influencerId) {
    query = query.eq("influencer_id", parseUuid(influencerId, "influencerId"));
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as AutopilotRow[]).map(mapAutopilotRun);
}

export async function loadProjectInfluencer(opts: {
  supabase: Db;
  projectId: string;
  userId: string;
  influencerId: string;
}) {
  const { data: row, error } = await opts.supabase
    .from("estudio_influencers")
    .select(INF_SELECT)
    .eq("id", opts.influencerId)
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    throw httpError("Ese influencer no pertenece a este proyecto.", 404);
  }
  const { data: shots, error: sErr } = await opts.supabase
    .from("estudio_influencer_shots")
    .select(SHOT_SELECT)
    .eq("influencer_id", opts.influencerId);
  if (sErr) throw new Error(sErr.message);
  const item = assembleInfluencers(
    [row as InfluencerRow],
    (shots ?? []) as InfluencerShotRow[]
  )[0];
  if (!item) {
    throw httpError("Ese influencer no pertenece a este proyecto.", 404);
  }
  const refs = influencerVideoRefUrls(item);
  if (!refs.length) {
    throw httpError(
      "Este influencer aún no tiene fotos de identidad. Genera sus fotos en Influencers antes de crear el video.",
      400
    );
  }
  return {
    item,
    refs,
    language: languageFromProfile((row as InfluencerRow).language),
  };
}

export async function createAutopilotRun(opts: {
  supabase: Db;
  projectId: string;
  userId: string;
  body: unknown;
}): Promise<{ run: AutopilotRun; created: boolean }> {
  const parsed = parseAutopilotCreateBody(opts.body);
  const falKey = await getFalApiKey();
  if (!falKey) {
    throw httpError(
      "Conecta fal.ai en Supabase → Secrets. El autopilot no simula generaciones.",
      403
    );
  }
  const influencer = await loadProjectInfluencer({
    supabase: opts.supabase,
    projectId: opts.projectId,
    userId: opts.userId,
    influencerId: parsed.influencerId,
  });
  const media = await loadAutopilotProductMedia(opts.supabase, opts.projectId);
  const missing = missingProductError(media);
  if (missing) throw httpError(missing, 400);

  const admin = await createAdminClient();
  const { data: existing } = await admin
    .from("estudio_video_autopilot_runs")
    .select(AUTOPILOT_SELECT)
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .eq("influencer_id", parsed.influencerId)
    .eq("client_request_id", parsed.requestId)
    .maybeSingle();
  if (existing) {
    return { run: mapAutopilotRun(existing as AutopilotRow), created: false };
  }

  const state: AutopilotState = {
    pipelineVersion: 4,
    language: influencer.language,
    productContext: parsed.productContext,
    influencerId: parsed.influencerId,
    creatorName: influencer.item.name,
    creatorTraits: influencer.item.traits,
    folderId: influencer.item.folderId,
    identityFrame: { url: influencer.refs[0], requestId: null },
  };

  const { data, error } = await admin
    .from("estudio_video_autopilot_runs")
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      influencer_id: parsed.influencerId,
      client_request_id: parsed.requestId,
      idea: parsed.idea,
      status: "queued",
      stage: "queued",
      progress: AUTOPILOT_STAGE_PROGRESS.queued,
      lock_token: null,
      state,
    })
    .select(AUTOPILOT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("estudio_video_autopilot_runs")
        .select(AUTOPILOT_SELECT)
        .eq("project_id", opts.projectId)
        .eq("user_id", opts.userId)
        .eq("influencer_id", parsed.influencerId)
        .eq("client_request_id", parsed.requestId)
        .maybeSingle();
      if (raced) {
        return { run: mapAutopilotRun(raced as AutopilotRow), created: false };
      }
    }
    throw new Error(error.message);
  }
  return { run: mapAutopilotRun(data as AutopilotRow), created: true };
}
