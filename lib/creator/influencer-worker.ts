import { after } from "next/server";
import { downloadBinary } from "@/lib/download-binary";
import { decryptSecret } from "@/lib/crypto";
import {
  FACE_SHOT_ID,
  INFLUENCER_SHOTS,
  influencerEditPrompt,
  influencerHeroPrompt,
  type InfluencerShotId,
} from "@/lib/creator/influencer-shots";
import {
  influencerProgress,
  type EstudioInfluencer,
  type EstudioInfluencerShot,
} from "@/lib/creator/estudio-v1";
import {
  OPENAI_IMAGE_MODEL,
  editOpenAIImage,
  generateOpenAIImage,
} from "@/lib/openai/images";
import { createAdminClient, getServiceRoleAccess } from "@/lib/supabase/admin";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";
import { kickEstudioImageWorkerHttp } from "@/lib/creator/image-queue-worker";

export type InfluencerRow = {
  language?: "es" | "en";
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  traits: string;
  folder_id: string | null;
  created_at: string;
  active?: boolean | null;
};

export type InfluencerShotRow = {
  id: string;
  influencer_id: string;
  project_id: string;
  user_id: string;
  shot_key: string;
  label: string;
  sort_index: number;
  prompt: string;
  image_size: string;
  reference_url: string | null;
  request_id: string | null;
  status: string;
  image_url: string | null;
  error: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const STALE_LOCK_MS = 3 * 60 * 1000;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const FACE_KEY = FACE_SHOT_ID;

let lastKick = 0;

export function scheduleEstudioInfluencerWorker(opts?: { force?: boolean }) {
  const now = Date.now();
  if (!opts?.force && now - lastKick < 8_000) return;
  lastKick = now;
  after(() => runEstudioInfluencerWorker({ budgetMs: 90_000 }));
}

export function mapInfluencerShot(row: InfluencerShotRow): EstudioInfluencerShot {
  return {
    id: row.shot_key,
    label: row.label,
    imageUrl: row.image_url,
    status: row.status,
    error: row.error,
  };
}

export function mapInfluencer(
  row: InfluencerRow,
  shots: InfluencerShotRow[]
): EstudioInfluencer {
  return {
    id: row.id,
    name: row.name,
    traits: row.traits,
    language: row.language === "en" ? "en" : "es",
    folderId: row.folder_id ?? null,
    createdAt: row.created_at,
    active: row.active !== false,
    images: shots
      .slice()
      .sort((a, b) => a.sort_index - b.sort_index)
      .map(mapInfluencerShot),
  };
}

export function assembleInfluencers(
  rows: InfluencerRow[],
  shots: InfluencerShotRow[]
): EstudioInfluencer[] {
  const byInf = new Map<string, InfluencerShotRow[]>();
  for (const shot of shots) {
    const list = byInf.get(shot.influencer_id) ?? [];
    list.push(shot);
    byInf.set(shot.influencer_id, list);
  }
  return rows.map((row) => mapInfluencer(row, byInf.get(row.id) ?? []));
}

export function influencerActiveCount(list: EstudioInfluencer[]): number {
  return list.filter((item) => influencerProgress(item).generating).length;
}

export function buildInfluencerShotInserts(opts: {
  influencerId: string;
  projectId: string;
  userId: string;
  name: string;
  traits: string;
  existing?: EstudioInfluencerShot[];
  faceReferenceUrl?: string | null;
}): Array<Record<string, unknown>> {
  const byKey = new Map((opts.existing ?? []).map((s) => [s.id, s]));
  const faceUrl =
    byKey.get(FACE_KEY)?.imageUrl ||
    opts.existing?.find((s) => s.imageUrl)?.imageUrl ||
    null;
  const uploadedFace = (opts.faceReferenceUrl || "").trim() || null;

  return INFLUENCER_SHOTS.map((shot, i) => {
    const prev = byKey.get(shot.id);
    const saved = Boolean(prev?.imageUrl);
    return {
      influencer_id: opts.influencerId,
      project_id: opts.projectId,
      user_id: opts.userId,
      shot_key: shot.id,
      label: shot.label,
      sort_index: i,
      prompt:
        shot.id === FACE_KEY
          ? influencerHeroPrompt(opts.name, opts.traits, {
              hasReference: Boolean(uploadedFace),
            })
          : influencerEditPrompt(shot.id as InfluencerShotId),
      image_size: shot.imageSize,
      reference_url: shot.id === FACE_KEY ? uploadedFace : faceUrl,
      status: saved ? "saved" : "pending",
      image_url: prev?.imageUrl ?? null,
      error: null,
    };
  });
}

async function patchShot(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  id: string,
  patch: Record<string, unknown>
) {
  const { error } = await admin
    .from("estudio_influencer_shots")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function getOpenAIKeyForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_settings")
    .select("openai_api_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cipher = data?.openai_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

function aspectForShot(shot: InfluencerShotRow): string {
  if (shot.shot_key === FACE_KEY || shot.image_size === "4:5") return "4:5";
  return shot.image_size || "portrait_16_9";
}

async function persistBuffer(opts: {
  projectId: string;
  influencerId: string;
  shotKey: string;
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
  const storagePath = `${opts.projectId}/influencers/${opts.influencerId}/${opts.shotKey}-${crypto.randomUUID()}.${ext}`;
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

export async function storeInfluencerShotImage(opts: {
  projectId: string;
  influencerId: string;
  shotKey: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  return persistBuffer(opts);
}

function isFalLegacyError(error: string | null | undefined) {
  const t = (error || "").toLowerCase();
  return (
    t.includes("405") ||
    t.includes("fal") ||
    t.includes("method not allowed") ||
    t.includes("queue.fal")
  );
}

async function requeueFalFailures(
  admin: Awaited<ReturnType<typeof createAdminClient>>
) {
  const { data } = await admin
    .from("estudio_influencer_shots")
    .select("id, error")
    .eq("status", "failed")
    .neq("shot_key", FACE_KEY)
    .is("image_url", null)
    .limit(80);
  const ids = (data ?? [])
    .filter((row) => isFalLegacyError(row.error as string | null))
    .map((row) => row.id as string);
  if (!ids.length) return;
  await admin
    .from("estudio_influencer_shots")
    .update({
      status: "pending",
      error: null,
      request_id: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
}

async function hasRemainingWork(
  admin: Awaited<ReturnType<typeof createAdminClient>>
): Promise<boolean> {
  const { data, error } = await admin
    .from("estudio_influencer_shots")
    .select("id, locked_at")
    .in("status", ["pending", "queued", "in_progress", "saving"])
    .is("image_url", null)
    .limit(20);
  if (error) throw new Error(error.message);
  const staleBefore = Date.now() - STALE_LOCK_MS;
  return (data ?? []).some((row) => {
    const locked = row.locked_at as string | null;
    if (!locked) return true;
    return new Date(locked).getTime() < staleBefore;
  });
}

async function processOne(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  shot: InfluencerShotRow
) {
  try {
    const apiKey = await getOpenAIKeyForUser(admin, shot.user_id);
    if (!apiKey) {
      throw new Error("Conecta OpenAI en Supabase → Secrets.");
    }

    await patchShot(admin, shot.id, {
      status: "in_progress",
      error: null,
      request_id: null,
    });

    const aspect = aspectForShot(shot);
    let generated: { buffer: Buffer; contentType: string };

    if (shot.shot_key === FACE_KEY && !shot.reference_url) {
      generated = await generateOpenAIImage(apiKey, {
        model: OPENAI_IMAGE_MODEL,
        prompt: shot.prompt,
        aspectRatio: aspect,
        quality: "high",
      });
    } else {
      let referenceUrl = shot.reference_url;
      if (!referenceUrl) {
        const { data: face } = await admin
          .from("estudio_influencer_shots")
          .select("image_url")
          .eq("influencer_id", shot.influencer_id)
          .eq("shot_key", FACE_KEY)
          .maybeSingle();
        referenceUrl = (face?.image_url as string | null) || null;
      }
      if (!referenceUrl) {
        await patchShot(admin, shot.id, { locked_at: null, status: "pending" });
        return;
      }

      const reference = await downloadBinary(referenceUrl, MAX_IMAGE_BYTES);
      const prompt =
        shot.shot_key === FACE_KEY
          ? shot.prompt
          : influencerEditPrompt(
              (INFLUENCER_SHOTS.some((s) => s.id === shot.shot_key)
                ? shot.shot_key
                : "face-three-quarter") as InfluencerShotId
            );
      generated = await editOpenAIImage(apiKey, {
        model: OPENAI_IMAGE_MODEL,
        prompt,
        image: reference.buffer,
        imageType: reference.contentType,
        aspectRatio: aspect,
        quality: "high",
      });
    }

    const contentType = generated.contentType.startsWith("image/")
      ? generated.contentType
      : "image/png";

    await patchShot(admin, shot.id, { status: "saving" });
    const publicUrl = await persistBuffer({
      projectId: shot.project_id,
      influencerId: shot.influencer_id,
      shotKey: shot.shot_key,
      buffer: generated.buffer,
      contentType,
    });
    await patchShot(admin, shot.id, {
      status: "saved",
      image_url: publicUrl,
      error: null,
      locked_at: null,
    });
    if (shot.shot_key === FACE_KEY) {
      await admin
        .from("estudio_influencer_shots")
        .update({
          reference_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("influencer_id", shot.influencer_id)
        .neq("shot_key", FACE_KEY)
        .is("image_url", null);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar";
    await patchShot(admin, shot.id, {
      status: "failed",
      error: message,
      locked_at: null,
    });
    if (shot.shot_key === FACE_KEY) {
      await admin
        .from("estudio_influencer_shots")
        .update({
          status: "failed",
          error: "Sin rostro de referencia",
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("influencer_id", shot.influencer_id)
        .neq("shot_key", FACE_KEY)
        .is("image_url", null);
    }
  }
}

export async function runEstudioInfluencerWorker(opts?: {
  budgetMs?: number;
}): Promise<{ more: boolean }> {
  try {
    const admin = await createAdminClient();
    await requeueFalFailures(admin);
    const budgetMs =
      opts?.budgetMs ?? (process.env.VERCEL ? 90_000 : 8 * 60_000);
    const started = Date.now();
    const hasBudget = () => Date.now() - started < budgetMs;

    while (hasBudget()) {
      const { data: claimed, error } = await admin.rpc(
        "claim_estudio_influencer_shots",
        { max_n: 1 }
      );
      if (error) throw new Error(error.message);
      const shots = (claimed ?? []) as InfluencerShotRow[];
      if (!shots.length) break;
      await processOne(admin, shots[0]!);
    }

    const more = await hasRemainingWork(admin);
    if (more) {
      if (process.env.VERCEL) {
        void kickEstudioImageWorkerHttp();
      } else {
        after(() => runEstudioInfluencerWorker(opts));
      }
    }
    return { more };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Worker de influencers falló";
    console.error("[estudio-influencer-worker]", message);
    return { more: true };
  }
}
