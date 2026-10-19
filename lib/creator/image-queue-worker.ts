import { after } from "next/server";
import { timingSafeEqual } from "crypto";
import { downloadBinary } from "@/lib/download-binary";
import { decryptSecret } from "@/lib/crypto";
import { normalizeHashtag } from "@/lib/gallery/asset";
import {
  extractHiggsfieldImageUrl,
  getHiggsfieldJobStatus,
  isHiggsfieldTerminal,
  submitHiggsfieldJob,
  type HiggsfieldCredentials,
} from "@/lib/higgsfield/client";
import { getImagePreset } from "@/lib/higgsfield/presets";
import { generateOpenAIImage } from "@/lib/openai/images";
import { createAdminClient, getServiceRoleAccess } from "@/lib/supabase/admin";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";
import {
  imageQueueActiveCount,
  type EstudioImageJob,
  type EstudioImageQueue,
} from "@/lib/creator/estudio-v1";

export type ImageQueueRow = {
  id: string;
  project_id: string;
  user_id: string;
  preset_id: string;
  model_id: string;
  model_name: string;
  folder_id: string;
  folder_name: string;
  created_at: string;
};

export type ImageJobRow = {
  id: string;
  queue_id: string;
  project_id: string;
  user_id: string;
  prompt: string;
  sort_index: number;
  request_id: string | null;
  status: string;
  image_url: string | null;
  asset_id: string | null;
  error: string | null;
  created_at: string;
  updated_at?: string | null;
  locked_at?: string | null;
  archived_at?: string | null;
};

const STALE_LOCK_MS = 3 * 60 * 1000;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

function cronSecret(): string {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.MAIL_ENCRYPTION_KEY?.trim() ||
    ""
  );
}

export function isAuthorizedImageWorker(request: Request): boolean {
  const secret = cronSecret();
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!secret || !token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

function workerOrigin(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export async function kickEstudioImageWorkerHttp(): Promise<void> {
  const secret = cronSecret();
  if (!secret) return;
  await fetch(`${workerOrigin()}/api/cron/estudio-images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

let lastWorkerKick = 0;

export function scheduleEstudioImageWorker(opts?: { force?: boolean }) {
  const now = Date.now();
  if (!opts?.force && now - lastWorkerKick < 8_000) return;
  lastWorkerKick = now;
  after(() => runEstudioImageWorker({ budgetMs: 45_000 }));
}

export function mapImageJob(row: ImageJobRow): EstudioImageJob {
  return {
    id: row.id,
    prompt: row.prompt,
    requestId: row.request_id,
    status: row.status,
    imageUrl: row.image_url,
    assetId: row.asset_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    lockedAt: row.locked_at ?? null,
    archivedAt: row.archived_at ?? null,
  };
}

export function mapImageQueue(
  queue: ImageQueueRow,
  jobs: ImageJobRow[]
): EstudioImageQueue {
  return {
    id: queue.id,
    createdAt: queue.created_at,
    modelId: queue.model_id,
    modelName: queue.model_name,
    presetId: queue.preset_id,
    folderId: queue.folder_id,
    folderName: queue.folder_name,
    jobs: jobs
      .slice()
      .sort((a, b) => a.sort_index - b.sort_index)
      .map(mapImageJob),
  };
}

export function assembleImageQueues(
  queues: ImageQueueRow[],
  jobs: ImageJobRow[]
): EstudioImageQueue[] {
  const byQueue = new Map<string, ImageJobRow[]>();
  for (const job of jobs) {
    if (job.archived_at) continue;
    const list = byQueue.get(job.queue_id) ?? [];
    list.push(job);
    byQueue.set(job.queue_id, list);
  }
  return queues
    .map((q) => mapImageQueue(q, byQueue.get(q.id) ?? []))
    .filter((q) => q.jobs.length > 0);
}

export { imageQueueActiveCount };

function fileNameFromPrompt(prompt: string, index: number) {
  const slug =
    prompt
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 48) || `image-${index + 1}`;
  return `${slug}.jpg`;
}

function isFailedStatus(status: string) {
  const s = status.trim().toLowerCase();
  return (
    s === "failed" ||
    s === "nsfw" ||
    s === "canceled" ||
    s === "cancelled"
  );
}

function usesOpenAI(presetId: string, modelId: string) {
  const preset = getImagePreset(presetId);
  return (
    preset?.provider === "openai" || /^(dall-e-|gpt-image-)/.test(modelId)
  );
}

async function patchJob(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  id: string,
  patch: Record<string, unknown>
) {
  const { error } = await admin
    .from("estudio_image_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function unlockJob(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  id: string
) {
  await admin
    .from("estudio_image_jobs")
    .update({ locked_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function hasRemainingWork(
  admin: Awaited<ReturnType<typeof createAdminClient>>
): Promise<boolean> {
  const { data, error } = await admin
    .from("estudio_image_jobs")
    .select("id, locked_at")
    .in("status", ["pending", "queued", "in_progress", "completed", "saving"])
    .is("asset_id", null)
    .limit(30);
  if (error) throw new Error(error.message);
  const staleBefore = Date.now() - STALE_LOCK_MS;
  return (data ?? []).some((row) => {
    const locked = row.locked_at as string | null;
    if (!locked) return true;
    return new Date(locked).getTime() < staleBefore;
  });
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

async function getHiggsfieldForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<HiggsfieldCredentials | null> {
  const { data, error } = await admin
    .from("user_settings")
    .select("higgsfield_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cipher = data?.higgsfield_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  const plain = decryptSecret(cipher);
  const idx = plain.indexOf(":");
  if (idx <= 0) return null;
  return { keyId: plain.slice(0, idx), keySecret: plain.slice(idx + 1) };
}

async function saveToGallery(opts: {
  projectId: string;
  userId: string;
  folderId: string;
  prompt: string;
  index: number;
  buffer: Buffer;
  contentType: string;
}): Promise<{ assetId: string; publicUrl: string }> {
  const admin = await createAdminClient();
  const { data: folder } = await admin
    .from("project_gallery_folders")
    .select("id")
    .eq("id", opts.folderId)
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (!folder) throw new Error("La carpeta de destino ya no existe");

  const name = fileNameFromPrompt(opts.prompt, opts.index);
  const ext = opts.contentType.includes("jpeg")
    ? "jpg"
    : opts.contentType.includes("webp")
      ? "webp"
      : opts.contentType.includes("png")
        ? "png"
        : "jpg";
  const storagePath = `${opts.projectId}/${crypto.randomUUID()}-${name.replace(/\.jpg$/i, `.${ext}`)}`;
  const access = await getServiceRoleAccess();
  await uploadStorageObject({
    supabaseUrl: access.url,
    accessToken: access.serviceKey,
    anonKey: access.anonKey,
    bucket: "gallery",
    path: storagePath,
    body: opts.buffer,
    contentType: opts.contentType,
  });

  const { data: pub } = admin.storage.from("gallery").getPublicUrl(storagePath);
  const { data: row, error } = await admin
    .from("project_gallery_assets")
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      folder_id: opts.folderId,
      name,
      mime_type: opts.contentType,
      size_bytes: opts.buffer.byteLength,
      kind: "image",
      storage_path: storagePath,
      public_url: pub.publicUrl,
      hashtag: normalizeHashtag(opts.prompt, name.replace(/\.[^.]+$/, "")),
    })
    .select("id, public_url")
    .single();
  if (error || !row) {
    await admin.storage.from("gallery").remove([storagePath]);
    throw new Error(error?.message || "No se pudo guardar en la galería");
  }
  return { assetId: row.id as string, publicUrl: row.public_url as string };
}

async function bufferFromUrl(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const downloaded = await downloadBinary(url, MAX_IMAGE_BYTES);
  const mime = downloaded.contentType;
  if (mime.includes("text/html") || mime.includes("application/json")) {
    throw new Error("El proveedor no devolvió una imagen");
  }
  const contentType = mime.startsWith("image/")
    ? mime.split(";")[0]!.trim()
    : "image/jpeg";
  return { buffer: downloaded.buffer, contentType };
}

async function processOne(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  job: ImageJobRow,
  queue: ImageQueueRow,
  hasBudget: () => boolean
) {
  const preset = getImagePreset(queue.preset_id);
  const modelId = usesOpenAI(queue.preset_id, queue.model_id)
    ? preset?.modelId || queue.model_id
    : queue.model_id;
  const openai = usesOpenAI(queue.preset_id, queue.model_id);

  try {
    if (openai) {
      const apiKey = await getOpenAIKeyForUser(admin, job.user_id);
      if (!apiKey) {
        throw new Error("Conecta tu OpenAI API key en Supabase → Secrets.");
      }
      await patchJob(admin, job.id, { status: "in_progress", error: null });
      const generated = await generateOpenAIImage(apiKey, {
        model: modelId,
        prompt: job.prompt,
        aspectRatio: preset?.aspectRatio ?? "9:16",
      });
      await patchJob(admin, job.id, { status: "saving" });
      const saved = await saveToGallery({
        projectId: job.project_id,
        userId: job.user_id,
        folderId: queue.folder_id,
        prompt: job.prompt,
        index: job.sort_index,
        buffer: generated.buffer,
        contentType: generated.contentType,
      });
      await patchJob(admin, job.id, {
        status: "saved",
        request_id: `openai-${job.id}`,
        image_url: saved.publicUrl,
        asset_id: saved.assetId,
        error: null,
        locked_at: null,
      });
      return;
    }

    const creds = await getHiggsfieldForUser(admin, job.user_id);
    if (!creds) {
      throw new Error("Conecta Higgsfield en Supabase → Secrets.");
    }

    let requestId = job.request_id;
    if (!requestId) {
      await patchJob(admin, job.id, { status: "queued", error: null });
      const payload: Record<string, unknown> = { prompt: job.prompt };
      if (preset?.sendAspectRatio) {
        payload.aspect_ratio = preset.aspectRatio ?? "9:16";
      }
      const submitted = await submitHiggsfieldJob(creds, modelId, payload, {
        allowVideoFallback: false,
      });
      requestId = submitted.request_id;
      await patchJob(admin, job.id, {
        request_id: requestId,
        status: submitted.status || "queued",
      });
    }

    if (!requestId) throw new Error("Higgsfield no devolvió request_id");

    let imageUrl = job.image_url;
    while (hasBudget()) {
      const status = await getHiggsfieldJobStatus(creds, requestId);
      const nextStatus = (status.status || "queued").toLowerCase();
      imageUrl = extractHiggsfieldImageUrl(status) || imageUrl;
      if (isFailedStatus(nextStatus)) {
        throw new Error(status.error || "Falló la generación");
      }
      if (nextStatus === "completed" && imageUrl) {
        await patchJob(admin, job.id, {
          status: "saving",
          image_url: imageUrl,
        });
        const file = await bufferFromUrl(imageUrl);
        const saved = await saveToGallery({
          projectId: job.project_id,
          userId: job.user_id,
          folderId: queue.folder_id,
          prompt: job.prompt,
          index: job.sort_index,
          buffer: file.buffer,
          contentType: file.contentType,
        });
        await patchJob(admin, job.id, {
          status: "saved",
          image_url: saved.publicUrl,
          asset_id: saved.assetId,
          error: null,
          locked_at: null,
        });
        return;
      }
      await patchJob(admin, job.id, {
        status: nextStatus,
        image_url: imageUrl,
      });
      if (isHiggsfieldTerminal(nextStatus) && !imageUrl) {
        throw new Error("Higgsfield terminó sin imagen");
      }
      await new Promise((r) => setTimeout(r, 4000));
    }

    await unlockJob(admin, job.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar";
    await patchJob(admin, job.id, {
      status: "failed",
      error: message,
      locked_at: null,
    });
  }
}

export async function runEstudioImageWorker(opts?: {
  budgetMs?: number;
}): Promise<{ more: boolean }> {
  try {
    const admin = await createAdminClient();
    const budgetMs =
      opts?.budgetMs ?? (process.env.VERCEL ? 90_000 : 8 * 60_000);
    const started = Date.now();
    const hasBudget = () => Date.now() - started < budgetMs;

    while (hasBudget()) {
      const { data: claimed, error } = await admin.rpc(
        "claim_estudio_image_jobs",
        { max_n: 2 }
      );
      if (error) throw new Error(error.message);
      const jobs = (claimed ?? []) as ImageJobRow[];
      if (!jobs.length) break;

      const queueIds = [...new Set(jobs.map((j) => j.queue_id))];
      const { data: queues, error: qErr } = await admin
        .from("estudio_image_queues")
        .select("*")
        .in("id", queueIds);
      if (qErr) throw new Error(qErr.message);
      const queueMap = new Map(
        ((queues ?? []) as ImageQueueRow[]).map((q) => [q.id, q])
      );

      await Promise.all(
        jobs.map(async (job) => {
          const queue = queueMap.get(job.queue_id);
          if (!queue) {
            await patchJob(admin, job.id, {
              status: "failed",
              error: "Cola no encontrada",
              locked_at: null,
            });
            return;
          }
          await processOne(admin, job, queue, hasBudget);
        })
      );
    }

    const more = await hasRemainingWork(admin);
    if (more) {
      if (process.env.VERCEL) {
        void kickEstudioImageWorkerHttp();
      } else {
        after(() => runEstudioImageWorker(opts));
      }
    }
    return { more };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Worker de imágenes falló";
    console.error("[estudio-image-worker]", message);
    return { more: true };
  }
}
