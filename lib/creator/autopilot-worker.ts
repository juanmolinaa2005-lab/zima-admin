import { DIRECTOR_MODEL, buildDirectedInput, productionDirectionPrompt, parseProductionDirection } from "./autopilot-director";
import { prepareEvidence, describeProductEvidence, reviewProduction } from "./autopilot-evidence";
import { NATIVE_VIDEO_MODEL, buildNativeVideoInput, nativeDirectionPrompt, parseNativeDirection } from "./autopilot-native";
import { fitNarration, narrationDuration, NarrationDurationError } from "./autopilot-narration";
import { composePhoneVideo, selectDemoWindow } from "./autopilot-phone-video";
import { composeVerifiedPhoneScreen } from "./autopilot-phone";
import { after } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import {
  AUTOPILOT_SELECT,
  AUTOPILOT_STAGE_PROGRESS,
  parseAutopilotState,
  type AutopilotJobSlot,
  type AutopilotPendingFal,
  type AutopilotRow,
  type AutopilotState,
} from "@/lib/creator/autopilot-types";
import {
  AUTOPILOT_MODEL_ID,
  AUTOPILOT_TOTAL_SEC,
  autopilotBrollFramePrompt,
  autopilotBrollPrompt,
  autopilotDemoClipPrompt,
  autopilotDemoFramePrompt,
  autopilotImprovePrompt,
  autopilotPlanPrompt,
  autopilotProductOnScreenPrompt,
  autopilotTalkingClipPrompt,
  autopilotTalkingFramePrompt,
  autopilotViralPrompt,
  languageFromProfile,
  parseAutopilotPlan,
  parseAutopilotProductionPlan,
  parseAutopilotViral,
  parseJsonObject,
} from "@/lib/creator/autopilot-plan";
import {
  downloadUrl,
  downloadGalleryAsset,
  ensureAutopilotFolder,
  loadAutopilotProductMedia,
  MAX_STILL_BYTES,
  MAX_VIDEO_BYTES,
  missingProductError,
  montageWithContinuousAudio,
  persistAutopilotFile,
  persistAutopilotAudio,
  resolveProductStill,
} from "@/lib/creator/autopilot-media";
import { loadProjectInfluencer } from "@/lib/creator/autopilot-server";
import { clipKlingPrompt, influencerVideoRefUrls } from "@/lib/creator/influencer-video";
import {
  assembleInfluencers,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import {
  buildFalVideoInput,
  getFalVideoDuration,
  getFalVoiceVideoModel,
} from "@/lib/creator/fal-video-models";
import {
  extractFalImageFromPayload,
  extractFalText,
  extractFalVideoUrl,
  FAL_FLUX_2_PRO_EDIT,
  FAL_GROK_MODEL,
  FAL_OPENROUTER,
  falQueuePayload,
  falQueueStatus,
  falQueueSubmit,
} from "@/lib/fal/client";
import {
  falAutopilotWebhookUrl,
  parseFalWebhookBody,
  type FalWebhookBody,
} from "@/lib/fal/webhook";
import { isAuthorizedImageWorker } from "@/lib/creator/image-queue-worker";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_LOCK_MS = 3 * 60 * 1000;
const STALE_FAL_MS = 2 * 60 * 1000;
const INF_SELECT =
  "id, project_id, user_id, name, traits, folder_id, language, created_at";
const SHOT_SELECT =
  "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at";

let lastKick = 0;

export { isAuthorizedImageWorker as isAuthorizedAutopilotWorker };

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type FalSlot = AutopilotPendingFal["slot"];
type ImageSlot = "identityFrame" | "talkingFrame" | "brollFrame" | "demoFrame";
type ClipSlot = "talkingClip" | "brollClip" | "demoClip";

class LockLostError extends Error {
  constructor() {
    super("lock lost");
    this.name = "LockLostError";
  }
}

export function scheduleVideoAutopilotWorker(opts?: { force?: boolean }) {
  const now = Date.now();
  if (!opts?.force && now - lastKick < 8_000) return;
  lastKick = now;
  after(() => runVideoAutopilotWorker({ budgetMs: 55_000 }));
}

async function falKeyForUser(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("user_settings")
    .select("fal_api_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cipher = data?.fal_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

async function patchRun(
  admin: Admin,
  id: string,
  token: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await admin
    .from("estudio_video_autopilot_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lock_token", token)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new LockLostError();
}

async function failRun(
  admin: Admin,
  id: string,
  token: string | null,
  message: string
) {
  let query = admin
    .from("estudio_video_autopilot_runs")
    .update({
      status: "failed",
      error: message.slice(0, 500),
      locked_at: null,
      lock_token: null,
      fal_request_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (token) query = query.eq("lock_token", token);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function releaseLock(admin: Admin, id: string, token: string, extra: Record<string, unknown> = {}) {
  await patchRun(admin, id, token, {
    ...extra,
    lock_token: null,
    locked_at: null,
  });
}

function imageSlot(state: AutopilotState, kind: ImageSlot): AutopilotJobSlot {
  return state[kind] ?? {};
}

function clipSlot(state: AutopilotState, kind: ClipSlot): AutopilotJobSlot {
  return state[kind] ?? {};
}

function nameOf(state: AutopilotState): string {
  return state.creatorName?.trim() || "Creador";
}

function traitsOf(state: AutopilotState): string {
  return state.creatorTraits?.trim() || "";
}

function productBrief(state: AutopilotState, idea: string): string {
  return (state.productContext || "").trim() || idea;
}

function identityRefs(state: AutopilotState, extra: string[]): string[] {
  const urls = [...(state.identityReferenceUrls || []), imageSlot(state, "identityFrame").url, ...extra]
    .map((u) => (u || "").trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

async function pollFalOnce(opts: {
  apiKey: string;
  model: string;
  requestId: string;
}): Promise<"wait" | { payload: Record<string, unknown> }> {
  const st = await falQueueStatus(opts.apiKey, opts.model, opts.requestId);
  if (st.status === "FAILED" || st.status === "ERROR") {
    throw new Error(st.error || "fal.ai falló");
  }
  if (st.status === "CANCELED" || st.status === "CANCELLED") {
    throw new Error("fal.ai canceló el job");
  }
  if (st.status !== "COMPLETED") return "wait";
  const payload = await falQueuePayload(opts.apiKey, opts.model, opts.requestId);
  return { payload };
}

async function parkFalJob(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  pending: AutopilotPendingFal
) {
  state.pendingFal = pending;
  await releaseLock(admin, row.id, token, {
    state,
    fal_request_id: pending.requestId,
    status: "running",
  });
}

async function submitFal(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  falKey: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    kind: AutopilotPendingFal["kind"];
    slot: FalSlot;
  }
): Promise<true> {
  const requestId = await falQueueSubmit(falKey, opts.model, opts.input, {
    webhookUrl: falAutopilotWebhookUrl(),
  });
  if (
    opts.slot === "nativeClip" ||
    opts.slot === "narration" ||
    opts.slot === "syncedTalking" ||
    opts.slot === "identityFrame" ||
    opts.slot === "talkingFrame" ||
    opts.slot === "brollFrame" ||
    opts.slot === "demoFrame" ||
    opts.slot === "talkingClip" ||
    opts.slot === "brollClip" ||
    opts.slot === "demoClip"
  ) {
    state[opts.slot] = { requestId, url: null };
  }
  await parkFalJob(admin, row, token, state, {
    requestId,
    model: opts.model,
    kind: opts.kind,
    slot: opts.slot,
  });
  return true;
}

async function persistGeneratedImage(opts: {
  row: AutopilotRow;
  state: AutopilotState;
  url: string;
  name: string;
}): Promise<string> {
  const buffer = await downloadUrl(opts.url, MAX_STILL_BYTES);
  const folderId =
    opts.state.folderId ||
    (await ensureAutopilotFolder(
      await createAdminClient(),
      opts.row.project_id,
      opts.row.user_id
    ));
  opts.state.folderId = folderId;
  const saved = await persistAutopilotFile({
    projectId: opts.row.project_id,
    userId: opts.row.user_id,
    folderId,
    buffer,
    contentType: "image/jpeg",
    name: opts.name,
    kind: "image",
  });
  return saved.publicUrl;
}

async function applyCompletedPayload(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  pending: AutopilotPendingFal,
  payload: Record<string, unknown>
) {
  const slot = pending.slot;
  const already =
    (slot === "nativeDirection" && Boolean(state.nativeDirection || state.productionDirection)) ||
    (slot === "nativeClip" && Boolean(state.nativeClip?.url)) ||
    (slot === "narration" && Boolean(state.narration?.url)) ||
    (slot === "syncedTalking" && Boolean(state.syncedTalking?.url)) ||
    (slot === "viral" && state.viralRaw != null) ||
    (slot === "improved" && state.improvedRaw != null) ||
    (slot === "plan" && state.planRaw != null) ||
    ((slot === "identityFrame" ||
      slot === "talkingFrame" ||
      slot === "brollFrame" ||
      slot === "demoFrame") &&
      Boolean(state[slot]?.url)) ||
    ((slot === "talkingClip" || slot === "brollClip" || slot === "demoClip") &&
      Boolean(state[slot]?.url)) ||
    (slot === "demoScreen" && state.screenMethod === "edit" && Boolean(state.demoFrame?.url));
  if (already) {
    state.pendingFal = null;
    await releaseLock(admin, row.id, token, {
      state,
      fal_request_id: null,
      status: "running",
      error: null,
    });
    return;
  }
  if (pending.kind === "audio") {
    const audio = payload.audio as {url?: string} | undefined;
    if (slot !== "narration" || !audio?.url || !/^https:\/\//.test(audio.url)) throw new Error("El proveedor no devolvió la narración.");
    state.narration = {url: audio.url, requestId: pending.requestId};
  } else if (pending.kind === "text") {
    const text = extractFalText(payload);
    if (!text) throw new Error("fal.ai terminó sin texto");
    if (slot === "nativeDirection") {
      const direction = state.pipelineVersion === 4 ? parseProductionDirection(parseJsonObject(text)) : parseNativeDirection(parseJsonObject(text));
      state.planAttempts = (state.planAttempts || 0) + 1;
      if (!direction) {
        if (state.planAttempts >= 2) throw new Error("No se pudo preparar una idea breve para el video. No se inició la generación.");
        state.planRepairReason = state.pipelineVersion === 4 ? "Repair JSON: 16–30 integer seconds, 3–6 contiguous shots, at least one 4-second productUse shot, at most 2.5 spoken words per second per shot." : "Return 10–19 spoken words and concrete scene direction of 30–1000 characters.";
      } else {
        if ("shots" in direction) state.productionDirection = direction;
        else state.nativeDirection = direction;
        state.planRaw = text;
      }
    } else if (slot === "viral") {
      state.viralRaw = text;
      state.viral = parseAutopilotViral(text);
    } else if (slot === "improved") {
      state.improvedRaw = text;
      const obj = parseJsonObject(text);
      const improved =
        typeof obj?.improvedIdea === "string"
          ? obj.improvedIdea.trim().slice(0, 280)
          : "";
      state.improvedIdea = improved || row.idea;
    } else if (slot === "plan") {
      const plan = state.pipelineVersion === 2 ? parseAutopilotProductionPlan(parseJsonObject(text)) : parseAutopilotPlan(parseJsonObject(text), AUTOPILOT_TOTAL_SEC);
      state.planAttempts = (state.planAttempts || 0) + 1;
      if (!plan) {
        if (state.planAttempts >= 3) throw new Error("No se pudo ajustar el guion a la duración del video. No se generaron tomas nuevas.");
        delete state.planRaw;
        state.planRepairReason = "Return a complete spoken narration of 30–36 words for 15 seconds, plus valid shot durations. No generic field instructions: name a concrete location, physical action and object. A short hook alone is insufficient.";
      } else {
        state.planRaw = text;
        state.plan = state.pipelineVersion === 2 ? { ...plan, talkingDurationSec: 5, brollDurationSec: 3, demoDurationSec: 7 } : plan;
        delete state.planRepairReason;
      }
    } else {
      throw new Error("Slot de texto desconocido");
    }
  } else if (pending.kind === "image") {
    const rawUrl = extractFalImageFromPayload(payload);
    if (!rawUrl) throw new Error("fal.ai terminó sin imagen");
    if (slot === "demoScreen" || slot === "demoFrame") {
      const url = await persistGeneratedImage({
        row,
        state,
        url: rawUrl,
        name: `autopilot-demo-frame-${row.id.slice(0, 8)}.jpg`,
      });
      let finalUrl = url;
      let verifiedScreen = false;
      state.demoFrameAttempts = (state.demoFrameAttempts || 0) + 1;
      state.screenMethod = null;
      const { data: visionSettings } = await admin.from("user_settings").select("openai_api_key_ciphertext").eq("user_id", row.user_id).maybeSingle();
      if (visionSettings?.openai_api_key_ciphertext && state.productImageUrl) {
        const visionKey = decryptSecret(visionSettings.openai_api_key_ciphertext);
        const [person, product] = await Promise.all([downloadUrl(rawUrl, MAX_STILL_BYTES), downloadUrl(state.productImageUrl, MAX_STILL_BYTES)]);
        const composed = await composeVerifiedPhoneScreen(person, product, visionKey);
        if (composed && state.folderId) {
          const saved = await persistAutopilotFile({projectId: row.project_id, userId: row.user_id, folderId: state.folderId, buffer: composed.buffer, contentType: "image/jpeg", name: `autopilot-phone-${row.id.slice(0,8)}.jpg`, kind: "image"});
          finalUrl = saved.publicUrl;
          state.screenMethod = "corners";
          verifiedScreen = true;
        }
      }
      if (!visionSettings?.openai_api_key_ciphertext) throw new Error("Conecta OpenAI en Ajustes para verificar la pantalla de la toma del producto.");
      if (verifiedScreen) {
        state.demoFrame = { requestId: pending.requestId, url: finalUrl };
        if (state.pipelineVersion === 2) state.demoPlateUrl = url;
      } else {
        delete state.demoFrame;
        if (state.demoFrameAttempts >= 3) throw new Error("No se consiguió una toma con la pantalla despejada después de tres intentos. No se generó un video con una demo incorrecta.");
      }
    } else {
      const kind = slot as ImageSlot;
      const url = await persistGeneratedImage({
        row,
        state,
        url: rawUrl,
        name: `autopilot-${kind}-${row.id.slice(0, 8)}.jpg`,
      });
      state[kind] = { requestId: pending.requestId, url };
    }
  } else {
    const url = extractFalVideoUrl(payload);
    if (!url) throw new Error("fal.ai terminó sin vídeo");
    const kind = slot as ClipSlot | "syncedTalking" | "nativeClip";
    state[kind] = { requestId: pending.requestId, url };
  }
  state.pendingFal = null;
  await releaseLock(admin, row.id, token, {
    state,
    fal_request_id: null,
    status: "running",
    error: null,
  });
}

export async function ingestFalAutopilotWebhook(
  body: FalWebhookBody | unknown
): Promise<{ runId: string | null }> {
  const parsed = parseFalWebhookBody(body);
  const requestId = (parsed?.request_id || "").trim();
  if (!requestId) return { runId: null };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("estudio_video_autopilot_runs")
    .select(AUTOPILOT_SELECT)
    .eq("fal_request_id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { runId: null };

  const row = data as AutopilotRow;
  if (row.status === "done" || row.status === "failed") {
    return { runId: row.id };
  }
  const token = await acquireLock(admin, row);
  if (!token) return { runId: row.id };

  const state = parseAutopilotState(row.state);
  const pending = state.pendingFal;
  if (!pending || pending.requestId !== requestId) {
    await releaseLock(admin, row.id, token, { state });
    return { runId: row.id };
  }

  const status = String(parsed?.status || "").toUpperCase();
  if (status === "ERROR" || status === "FAILED") {
    await failRun(
      admin,
      row.id,
      token,
      (typeof parsed?.error === "string" && parsed.error) ||
        "fal.ai falló al generar"
    );
    return { runId: row.id };
  }

  const payload =
    parsed?.payload && typeof parsed.payload === "object"
      ? parsed.payload
      : parsed && typeof parsed === "object"
        ? (parsed as unknown as Record<string, unknown>)
        : {};
  try {
    await applyCompletedPayload(admin, row, token, state, pending, payload);
  } catch (e) {
    if (e instanceof LockLostError) return { runId: row.id };
    await failRun(
      admin,
      row.id,
      token,
      e instanceof Error ? e.message : "No se pudo guardar el resultado de fal.ai"
    );
  }
  return { runId: row.id };
}

async function acquireLock(admin: Admin, row: AutopilotRow): Promise<string | null> {
  const staleLock = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const lockedFresh =
    Boolean(row.lock_token) &&
    Boolean(row.locked_at) &&
    row.locked_at! >= staleLock;
  if (lockedFresh) return null;
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  let query = admin
    .from("estudio_video_autopilot_runs")
    .update({
      status: "running",
      lock_token: token,
      locked_at: now,
      attempt: (row.attempt || 0) + 1,
      updated_at: now,
    })
    .eq("id", row.id)
    .in("status", ["queued", "running"]);
  query = row.lock_token
    ? query.eq("lock_token", row.lock_token)
    : query.is("lock_token", null);
  const { data } = await query.select("id").maybeSingle();
  return data ? token : null;
}

export async function runVideoAutopilotWorker(opts?: { budgetMs?: number; runId?: string }) {
  const deadline = Date.now() + Math.min(opts?.budgetMs ?? 55_000, 90_000);
  let didWork = false;
  for (let step = 0; step < 16 && Date.now() < deadline; step++) {
    const result = await runVideoAutopilotStep(opts);
    didWork ||= result.didWork;
    if (!result.didWork || !result.hasMore) return { didWork, hasMore: result.hasMore };
  }
  return { didWork, hasMore: true };
}

async function runVideoAutopilotStep(opts?: {
  budgetMs?: number;
  runId?: string;
}) {
  const admin = await createAdminClient();
  const staleLock = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const staleFal = new Date(Date.now() - STALE_FAL_MS).toISOString();
  let query = admin
    .from("estudio_video_autopilot_runs")
    .select(AUTOPILOT_SELECT)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(12);
  if (opts?.runId) query = query.eq("id", opts.runId);
  const { data: candidates, error } = await query;
  if (error) throw new Error(error.message);

  const webhook = falAutopilotWebhookUrl();
  const next = ((candidates ?? []) as AutopilotRow[]).find((row) => {
    const state = parseAutopilotState(row.state);
    const pending = state.pendingFal?.requestId || row.fal_request_id;
    if (pending) {
      if (!webhook) return true;
      return row.updated_at < staleFal;
    }
    if (row.lock_token && row.locked_at && row.locked_at >= staleLock) return false;
    return true;
  });
  if (!next) return { didWork: false, hasMore: false };

  const token = await acquireLock(admin, next);
  if (!token) return { didWork: false, hasMore: true };

  try {
    await advanceRun(admin, { ...next, status: "running", lock_token: token }, token);
  } catch (e) {
    if (!(e instanceof LockLostError)) {
      await failRun(
        admin,
        next.id,
        token,
        e instanceof Error ? e.message : "El autopilot falló"
      );
    }
  }
  return { didWork: true, hasMore: true };
}

async function recoverPendingFal(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  falKey: string
): Promise<boolean> {
  const pending = state.pendingFal;
  const requestId = pending?.requestId || row.fal_request_id;
  if (!pending || !requestId) return false;
  const polled = await pollFalOnce({
    apiKey: falKey,
    model: pending.model,
    requestId,
  });
  if (polled === "wait") {
    await parkFalJob(admin, row, token, state, pending);
    return true;
  }
  await applyCompletedPayload(admin, row, token, state, pending, polled.payload);
  return true;
}

async function bindIdentity(
  admin: Admin,
  row: AutopilotRow,
  state: AutopilotState
) {
  const loaded = await loadProjectInfluencer({
    supabase: admin,
    projectId: row.project_id,
    userId: row.user_id,
    influencerId: row.influencer_id,
  });
  state.influencerId = loaded.item.id;
  state.language = loaded.language;
  state.creatorName = loaded.item.name;
  state.creatorTraits = loaded.item.traits;
  if (loaded.item.folderId) state.folderId = loaded.item.folderId;
  state.identityFrame = { url: loaded.refs[0], requestId: null };
}

async function advanceRun(admin: Admin, row: AutopilotRow, token: string): Promise<void> {
  const falKey = await falKeyForUser(admin, row.user_id);
  if (!falKey) {
    throw new Error("Falta la clave de fal.ai del usuario.");
  }
  const state = parseAutopilotState(row.state);
  const profile = await loadProjectInfluencer({
    supabase: admin,
    projectId: row.project_id,
    userId: row.user_id,
    influencerId: row.influencer_id,
  });
  state.language = profile.language;
  state.influencerId = profile.item.id;
  state.creatorName = profile.item.name;
  state.creatorTraits = profile.item.traits;
  state.identityReferenceUrls = profile.refs;
  if (profile.item.folderId) state.folderId = profile.item.folderId;
  if (!imageSlot(state, "identityFrame").url) {
    state.identityFrame = { url: profile.refs[0], requestId: null };
  }
  const language = profile.language;
  state.modelId = state.pipelineVersion === 4 ? DIRECTOR_MODEL : state.pipelineVersion === 3 ? NATIVE_VIDEO_MODEL : getFalVoiceVideoModel(state.modelId || AUTOPILOT_MODEL_ID).id;

  if (state.pendingFal?.requestId || row.fal_request_id) {
    await recoverPendingFal(admin, row, token, state, falKey);
    return;
  }

  if (state.pendingFal?.slot === "demoScreen" && !state.pendingFal.requestId) {
    if (!state.demoFrame?.url || !state.productImageUrl) {
      throw new Error("Falta el plano o la captura para colocar el producto.");
    }
    await submitFal(admin, row, token, state, falKey, {
      model: FAL_FLUX_2_PRO_EDIT,
      kind: "image",
      slot: "demoScreen",
      input: {
        prompt: autopilotProductOnScreenPrompt(),
        image_urls: [state.demoFrame.url, state.productImageUrl],
        image_size: state.pipelineVersion === 2 ? {width: 1080, height: 1920} : "portrait_16_9",
        output_format: "jpeg",
        safety_tolerance: "4",
      },
    });
    return;
  }

  const setStage = async (stage: keyof typeof AUTOPILOT_STAGE_PROGRESS) => {
    await patchRun(admin, row.id, token, {
      stage,
      progress: AUTOPILOT_STAGE_PROGRESS[stage],
      state,
      error: null,
    });
  };

  if (row.stage === "queued" || row.stage === "validate") {
    await setStage("validate");
    const media = await loadAutopilotProductMedia(admin, row.project_id);
    const missing = missingProductError(media);
    if (missing) throw new Error(missing);
    if (state.pipelineVersion === 2) {
      if (!media.video) throw new Error("Falta una grabación real de la app en la galería para mostrar su uso en movimiento.");
      const recording = await downloadGalleryAsset(admin, media.video, MAX_VIDEO_BYTES);
      state.productVideoStartSec = await selectDemoWindow(recording, 7);
      state.productVideoUrl = media.video.publicUrl;
    }
    if (state.pipelineVersion === 4 && !state.productEvidence) {
      if (!media.video) throw new Error("Añade una grabación del uso real de la app a la galería antes de crear el video.");
      const { data: settings } = await admin.from("user_settings").select("openai_api_key_ciphertext").eq("user_id",row.user_id).maybeSingle();
      if (!settings?.openai_api_key_ciphertext) throw new Error("Conecta OpenAI en Ajustes para analizar la demo y revisar la calidad visual.");
      const prepared = await prepareEvidence(await downloadGalleryAsset(admin,media.video,MAX_VIDEO_BYTES),true);
      state.productEvidence = await describeProductEvidence(decryptSecret(settings.openai_api_key_ciphertext),prepared.frames);
      const folderId = state.folderId || await ensureAutopilotFolder(admin,row.project_id,row.user_id);
      const save = (buffer:Buffer,name:string,kind:"image"|"video") => persistAutopilotFile({projectId:row.project_id,userId:row.user_id,folderId,buffer,name,kind,contentType:kind==="video"?"video/mp4":"image/jpeg"});
      state.productReferenceVideoUrl = (await save(prepared.video!,`autopilot-reference-${row.id}.mp4`,"video")).publicUrl;
      state.productEndImageUrl = (await save(prepared.frames[prepared.frames.length-1],`autopilot-result-${row.id}.jpg`,"image")).publicUrl;
      state.productVideoAssetId = media.video.id;
    }
    const still = await resolveProductStill(admin, media);
    const folderId = await ensureAutopilotFolder(
      admin,
      row.project_id,
      row.user_id
    );
    const saved = await persistAutopilotFile({
      projectId: row.project_id,
      userId: row.user_id,
      folderId,
      buffer: still.buffer,
      contentType: "image/jpeg",
      name: `autopilot-product-${row.id.slice(0, 8)}.jpg`,
      kind: "image",
    });
    state.folderId = folderId;
    state.productImageAssetId = still.assetId;
    state.productVideoAssetId = still.videoAssetId;
    state.productImageUrl = saved.publicUrl;
    await setStage("influencer");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if (row.stage === "influencer") {
    await bindIdentity(admin, row, state);
    await setStage("research");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if (row.stage === "research") {
    if (state.viralRaw == null && !Array.isArray(state.viral)) {
      await submitFal(admin, row, token, state, falKey, {
        model: FAL_OPENROUTER,
        kind: "text",
        slot: "viral",
        input: {
          prompt: autopilotViralPrompt({ idea: row.idea, language }),
          system_prompt:
            "You research live short-form UGC. Real https links only. Never invent URLs. If none are verifiable, return {\"items\":[]}. Return ONLY JSON.",
          model: FAL_GROK_MODEL,
          enable_web_search: true,
          web_search_options: { engine: "native", max_results: 8 },
          temperature: 0.2,
          max_tokens: 4000,
        },
      });
      return;
    }
    if (state.improvedRaw == null && !state.improvedIdea) {
      await submitFal(admin, row, token, state, falKey, {
        model: FAL_OPENROUTER,
        kind: "text",
        slot: "improved",
        input: {
          prompt: autopilotImprovePrompt({
            idea: row.idea,
            productContext: state.productContext || "",
            viral: state.viral || [],
            language,
          }),
          system_prompt: "Return ONLY JSON. Do not invent product features or trends.",
          model: FAL_GROK_MODEL,
          temperature: 0.4,
          max_tokens: 800,
        },
      });
      return;
    }
    await setStage("plan");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if ((state.pipelineVersion === 3 || state.pipelineVersion === 4) && row.stage === "plan") {
    if (!state.nativeDirection && !state.productionDirection) {
      await submitFal(admin, row, token, state, falKey, {
        model: FAL_OPENROUTER, kind: "text", slot: "nativeDirection",
        input: { prompt: state.pipelineVersion === 4 ? productionDirectionPrompt(row.idea,state) : nativeDirectionPrompt(row.idea, state), system_prompt: "Return only valid JSON.", model: FAL_GROK_MODEL, temperature: 0.4, max_tokens: state.pipelineVersion === 4 ? 3500 : 700 },
      });
      return;
    }
    await setStage("clips");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if ((state.pipelineVersion === 3 || state.pipelineVersion === 4) && (row.stage === "clips" || row.stage === "montage")) {
    if (!state.nativeClip?.url) {
      await submitFal(admin, row, token, state, falKey, { model: state.pipelineVersion === 4 ? DIRECTOR_MODEL : NATIVE_VIDEO_MODEL, kind: "video", slot: "nativeClip", input: state.pipelineVersion === 4 ? buildDirectedInput(state) : buildNativeVideoInput(state) });
      return;
    }
    // Preserve the provider's native audiovisual output byte for byte.
    const buffer = await downloadUrl(state.nativeClip.url, state.pipelineVersion === 4 ? 200 * 1024 * 1024 : MAX_VIDEO_BYTES);
    if (state.pipelineVersion === 4) {
      await setStage("montage");
      if (!state.visualReview) {
        const { data: settings } = await admin.from("user_settings").select("openai_api_key_ciphertext").eq("user_id",row.user_id).maybeSingle();
        if (!settings?.openai_api_key_ciphertext) throw new Error("Falta OpenAI para completar la revisión visual.");
        const {frames} = await prepareEvidence(buffer);
        state.visualReview = await reviewProduction(decryptSecret(settings.openai_api_key_ciphertext),frames,state.identityReferenceUrls![0],[state.productImageUrl!,state.productEndImageUrl!],state.productEvidence!);
        await patchRun(admin,row.id,token,{state});
      }
      if (!state.visualReview.passed) throw new Error(`El video no superó la revisión visual: ${state.visualReview.issues.join(" ")} No se inició otra generación automáticamente.`);
    }
    const saved = await persistAutopilotFile({projectId: row.project_id, userId: row.user_id, folderId: state.folderId || await ensureAutopilotFolder(admin, row.project_id, row.user_id), buffer, contentType: "video/mp4", name: `autopilot-native-${row.id.slice(0,8)}.mp4`, kind: "video"});
    await patchRun(admin, row.id, token, {status: "done", stage: "done", progress: 100, video_url: saved.publicUrl, asset_id: saved.id, error: null, state, locked_at: null, lock_token: null, fal_request_id: null});
    return;
  }

  if (row.stage === "plan") {
    if (state.planRaw == null && !state.plan) {
      await submitFal(admin, row, token, state, falKey, {
        model: FAL_OPENROUTER,
        kind: "text",
        slot: "plan",
        input: {
          prompt: autopilotPlanPrompt({
            idea: row.idea,
            improvedIdea: state.improvedIdea || row.idea,
            productContext: state.productContext || "",
            viral: state.viral || [],
            language,
            totalSec: AUTOPILOT_TOTAL_SEC,
            repairReason: state.planRepairReason,
          }),
          system_prompt: "Return ONLY JSON.",
          model: FAL_GROK_MODEL,
          temperature: 0.4,
          max_tokens: 1200,
        },
      });
      return;
    }
    if (await prepareNarration(admin, row, token, state, falKey)) return;
    await setStage("frames");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if (row.stage === "frames") {
    const parked = await advanceFrames(admin, row, token, state, falKey);
    if (parked) return;
    await setStage("clips");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if (row.stage === "clips") {
    const parked = await advanceClips(admin, row, token, state, falKey);
    if (parked) return;
    await setStage("montage");
    await releaseLock(admin, row.id, token, { state, status: "running" });
    return;
  }

  if (row.stage === "montage") {
    await finishMontage(admin, row, token, state);
    return;
  }

  await releaseLock(admin, row.id, token, { state });
}

async function loadIdentityRefs(admin: Admin, row: AutopilotRow, state: AutopilotState) {
  const refs = identityRefs(state, []);
  if (refs.length) return refs;
  const { data: inf, error } = await admin
    .from("estudio_influencers")
    .select(INF_SELECT)
    .eq("id", row.influencer_id)
    .eq("project_id", row.project_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inf) throw new Error("Influencer no encontrado.");
  const { data: shots, error: sErr } = await admin
    .from("estudio_influencer_shots")
    .select(SHOT_SELECT)
    .eq("influencer_id", row.influencer_id);
  if (sErr) throw new Error(sErr.message);
  const item = assembleInfluencers(
    [inf as InfluencerRow],
    (shots ?? []) as InfluencerShotRow[]
  )[0];
  if (!item) throw new Error("Influencer no encontrado.");
  const urls = influencerVideoRefUrls(item);
  if (!urls.length) {
    throw new Error("Este influencer aún no tiene fotos de identidad.");
  }
  state.identityFrame = { url: urls[0], requestId: null };
  return urls;
}

async function advanceFrames(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  falKey: string
): Promise<boolean> {
  if (!state.plan || !state.productImageUrl) {
    throw new Error("Falta plan o captura de producto para los fotogramas.");
  }
  const refs = await loadIdentityRefs(admin, row, state);
  const name = nameOf(state);
  const traits = traitsOf(state);
  const plan = state.plan;

  const ensureImage = async (
    kind: Exclude<ImageSlot, "identityFrame">,
    prompt: string,
    extraUrls: string[] = []
  ): Promise<boolean> => {
    if (imageSlot(state, kind).url) return false;
    await submitFal(admin, row, token, state, falKey, {
      model: FAL_FLUX_2_PRO_EDIT,
      kind: "image",
      slot: kind,
      input: {
        prompt,
        image_urls: [...refs, ...extraUrls],
        image_size: state.pipelineVersion === 2 ? {width: 1080, height: 1920} : "portrait_16_9",
        output_format: "jpeg",
        safety_tolerance: "4",
      },
    });
    return true;
  };

  if (
    await ensureImage(
      "talkingFrame",
      autopilotTalkingFramePrompt({
        name,
        traits,
        action: plan.talkingAction,
        extra: plan.setting,
        script: plan.hook,
      })
    )
  ) {
    return true;
  }
  if (
    await ensureImage(
      "brollFrame",
      autopilotBrollFramePrompt({
        name,
        traits,
        action: plan.brollAction,
        extra: plan.setting,
      })
    )
  ) {
    return true;
  }
  if (
    await ensureImage(
      "demoFrame",
      [
        autopilotDemoFramePrompt({
          name,
          traits,
          extra: plan.setting,
        }),
        "Reference photos establish the creator identity only. Create the magenta display exactly as instructed; the final real app capture is composited afterward.",
        (state.demoFrameAttempts || 0) > 0 ? "The previous image obscured the display. This time the phone rests vertically on a small stand on the breakfast table. The creator is beside it, speaking a voice reminder into it, hands away from the display. Over-the-shoulder camera sees the entire FRONT SCREEN and all four corners clearly. No hand overlaps the device." : "",
      ].join(" "),
      []
    )
  ) {
    return true;
  }
  return false;
}

async function advanceClips(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState,
  falKey: string
): Promise<boolean> {
  const plan = state.plan;
  if (
    !plan ||
    !imageSlot(state, "talkingFrame").url ||
    !imageSlot(state, "brollFrame").url ||
    !imageSlot(state, "demoFrame").url
  ) {
    throw new Error("Faltan fotogramas para generar los clips.");
  }
  if (state.pipelineVersion === 2 && !state.demoPlateUrl) throw new Error("Falta la toma verificada para integrar la grabación real.");
  const model = getFalVoiceVideoModel(state.modelId || AUTOPILOT_MODEL_ID);
  const totalDur = getFalVideoDuration(model.id, state.durationSec || AUTOPILOT_TOTAL_SEC);
  const name = nameOf(state);

  if (await prepareNarration(admin, row, token, state, falKey)) return true;

  const ensureClip = async (
    kind: ClipSlot,
    imageUrl: string,
    prompt: string,
    durationSec: string,
    withAudio: boolean
  ): Promise<boolean> => {
    if (clipSlot(state, kind).url) return false;
    const input = buildFalVideoInput({
      model,
      prompt: clipKlingPrompt(prompt),
      imageUrl,
      durationSec,
    });
    if (!withAudio || state.pipelineVersion === 2) input.generate_audio = false;
    await submitFal(admin, row, token, state, falKey, {
      model: model.id,
      kind: "video",
      slot: kind,
      input,
    });
    return true;
  };

  if (
    await ensureClip(
      "talkingClip",
      imageSlot(state, "talkingFrame").url!,
      autopilotTalkingClipPrompt({
        name,
        script: plan.hook,
        product: productBrief(state, row.idea),
        language: languageFromProfile(state.language),
        action: plan.talkingAction,
        extra: plan.setting,
      }),
      totalDur,
      true
    )
  ) {
    return true;
  }

  if (state.pipelineVersion === 2 && !state.syncedTalking?.url) {
    await submitFal(admin, row, token, state, falKey, {model: "fal-ai/sync-lipsync/v2/pro", kind: "video", slot: "syncedTalking", input: {video_url: state.talkingClip!.url, audio_url: state.narrationReadyUrl, sync_mode: "cut_off"}});
    return true;
  }

  if (
    await ensureClip(
      "brollClip",
      imageSlot(state, "brollFrame").url!,
      autopilotBrollPrompt({
        name,
        action: plan.brollAction,
        extra: plan.setting,
      }),
      getFalVideoDuration(model.id, plan.brollDurationSec),
      false
    )
  ) {
    return true;
  }

  if (
    await ensureClip(
      "demoClip",
      state.pipelineVersion === 2 ? state.demoPlateUrl! : imageSlot(state, "demoFrame").url!,
      autopilotDemoClipPrompt({
        name,
        action: plan.demoAction,
        rawPlate: state.pipelineVersion === 2,
      }),
      getFalVideoDuration(model.id, plan.demoDurationSec),
      false
    )
  ) {
    return true;
  }
  return false;
}

async function finishMontage(
  admin: Admin,
  row: AutopilotRow,
  token: string,
  state: AutopilotState
) {
  const plan = state.plan;
  const talkingUrl = state.pipelineVersion === 2 ? state.syncedTalking?.url : clipSlot(state, "talkingClip").url;
  const brollUrl = clipSlot(state, "brollClip").url;
  const demoUrl = clipSlot(state, "demoClip").url;
  if (!plan || !talkingUrl || !brollUrl || !demoUrl) {
    throw new Error("Faltan clips para el montaje.");
  }
  if (state.pipelineVersion === 2 && !state.composedDemoUrl) {
    if (!state.productVideoUrl || state.productVideoStartSec == null) throw new Error("Falta la grabación real del producto.");
    const [plate, recording] = await Promise.all([downloadUrl(demoUrl, MAX_VIDEO_BYTES), downloadUrl(state.productVideoUrl, MAX_VIDEO_BYTES)]);
    const composed = await composePhoneVideo({plate, recording, durationSec: plan.demoDurationSec, startSec: state.productVideoStartSec});
    const saved = await persistAutopilotFile({projectId: row.project_id, userId: row.user_id, folderId: state.folderId || await ensureAutopilotFolder(admin, row.project_id, row.user_id), buffer: composed, contentType: "video/mp4", name: `autopilot-demo-composed-${row.id.slice(0,8)}.mp4`, kind: "video"});
    state.composedDemoUrl = saved.publicUrl;
    await releaseLock(admin, row.id, token, {state});
    return;
  }
  const [talking, broll, demo] = await Promise.all([
    downloadUrl(talkingUrl, MAX_VIDEO_BYTES),
    downloadUrl(brollUrl, MAX_VIDEO_BYTES),
    downloadUrl(state.composedDemoUrl || demoUrl, MAX_VIDEO_BYTES),
  ]);
  const combined = await montageWithContinuousAudio({
    talking,
    broll,
    demo,
    talkingVisualSec: plan.talkingDurationSec,
    brollSec: plan.brollDurationSec,
    demoSec: plan.demoDurationSec,
    interleave: state.pipelineVersion === 2,
  });
  const folderId =
    state.folderId ||
    (await ensureAutopilotFolder(admin, row.project_id, row.user_id));
  const saved = await persistAutopilotFile({
    projectId: row.project_id,
    userId: row.user_id,
    folderId,
    buffer: combined,
    contentType: "video/mp4",
    name: `autopilot-${row.id.slice(0, 8)}.mp4`,
    kind: "video",
  });
  await patchRun(admin, row.id, token, {
    status: "done",
    stage: "done",
    progress: 100,
    video_url: saved.publicUrl,
    asset_id: saved.id,
    error: null,
    state,
    locked_at: null,
    lock_token: null,
    fal_request_id: null,
  });
}

async function prepareNarration(admin: Admin, row: AutopilotRow, token: string, state: AutopilotState, falKey: string): Promise<boolean> {
  const plan = state.plan;
  if (!plan) throw new Error("Falta el guion para generar la voz.");
  if (state.pipelineVersion === 2 && !state.narration?.url) {
    await submitFal(admin, row, token, state, falKey, {model: "fal-ai/elevenlabs/tts/multilingual-v2", kind: "audio", slot: "narration", input: {text: plan.hook, voice: "Aria", language_code: languageFromProfile(state.language), stability: 0.5, style: 0.15, speed: 1}});
    return true;
  }
  if (state.pipelineVersion === 2 && !state.narrationReadyUrl) {
    const audio = await downloadUrl(state.narration!.url!, 10*1024*1024);
    try {
      const duration = Math.min(15, Math.max(12, Math.ceil(await narrationDuration(audio) + 0.3)));
      state.narrationReadyUrl = await persistAutopilotAudio(row.project_id, await fitNarration(audio, duration));
      state.durationSec = duration;
      const talking = duration <= 13 ? 4 : 5;
      state.plan = {...plan, talkingDurationSec: talking, brollDurationSec: 3, demoDurationSec: duration - talking - 3};
      if (state.productVideoUrl) state.productVideoStartSec = await selectDemoWindow(await downloadUrl(state.productVideoUrl, MAX_VIDEO_BYTES), state.plan.demoDurationSec);
    } catch (error) {
      if (!(error instanceof NarrationDurationError)) throw error;
      state.narrationAttempts = (state.narrationAttempts || 0) + 1;
      if (state.narrationAttempts >= 2) throw error;
      for (const key of ["plan", "planRaw", "narration", "narrationReadyUrl", "talkingFrame", "brollFrame", "demoFrame", "demoPlateUrl", "talkingClip", "brollClip", "demoClip", "syncedTalking", "composedDemoUrl"] as const) delete state[key];
      state.planRepairReason = "The spoken narration did not fit 15 seconds at a natural pace. Write exactly 36 conversational words with concrete actions and location. No placeholders.";
      await releaseLock(admin, row.id, token, {state, stage: "plan", progress: AUTOPILOT_STAGE_PROGRESS.plan});
      return true;
    }
    await releaseLock(admin, row.id, token, {state});
    return true;
  }

  return false;
}
