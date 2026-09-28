import { getServiceRoleAccess } from "@/lib/supabase/admin";

const MOTION_PATH = "/v1/videos/motion-control";

export function klingMotionSpec(modelId: string | null | undefined): {
  modelName: "kling-v2-6" | "kling-v3";
  mode: "std" | "pro";
} {
  const id = modelId || "";
  const modelName = id.includes("/v2.6/") ? "kling-v2-6" : "kling-v3";
  const mode = id.includes("/pro/") || id.includes("/v2.6/") ? "pro" : "std";
  return { modelName, mode };
}

export function klingMotionEndpoint(): string {
  return `https://api-singapore.klingai.com${MOTION_PATH}`;
}

type KlingEnvelope = {
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{ url?: string }>;
    };
  };
};

async function klingFunction(
  path: string,
  init?: { method: "GET" | "POST"; body?: Record<string, unknown> }
): Promise<KlingEnvelope> {
  const { url, serviceKey, anonKey } = await getServiceRoleAccess();
  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/kling-motion${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as KlingEnvelope & {
    error?: string;
  };
  if (!res.ok || (typeof data.code === "number" && data.code !== 0)) {
    const message = (data.message || data.error || "").trim();
    throw new Error(message || `Kling respondió ${res.status}`);
  }
  return data;
}

export async function submitKlingMotionControl(opts: {
  imageUrl: string;
  videoUrl: string;
  modelId?: string | null;
  prompt?: string;
}): Promise<{ taskId: string; model: string; endpoint: string; body: Record<string, unknown> }> {
  const spec = klingMotionSpec(opts.modelId);
  const prompt = (opts.prompt || "").trim().slice(0, 2500);
  const body: Record<string, unknown> = {
    model_name: spec.modelName,
    image_url: opts.imageUrl,
    video_url: opts.videoUrl,
    character_orientation: "video",
    mode: spec.mode,
    keep_original_sound: "no",
  };
  if (prompt) body.prompt = prompt;
  const data = await klingFunction("", { method: "POST", body });
  const taskId = data.data?.task_id?.trim() || "";
  if (!taskId) throw new Error("Kling no devolvió el id de la tarea.");
  return {
    taskId,
    model: spec.modelName,
    endpoint: klingMotionEndpoint(),
    body,
  };
}

export type KlingMotionPoll = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error: string | null;
  videoUrl: string | null;
};

export async function getKlingMotionTask(taskId: string): Promise<KlingMotionPoll> {
  const data = await klingFunction(`?taskId=${encodeURIComponent(taskId)}`);
  const task = data.data;
  const raw = (task?.task_status || "").toLowerCase();
  const videoUrl =
    task?.task_result?.videos?.find((item) => item.url?.trim())?.url?.trim() || null;
  if (raw === "succeed") {
    return { status: "COMPLETED", error: null, videoUrl };
  }
  if (raw === "failed") {
    return {
      status: "FAILED",
      error: (task?.task_status_msg || data.message || "Kling no pudo generar el video").trim(),
      videoUrl: null,
    };
  }
  if (raw === "submitted") {
    return { status: "IN_QUEUE", error: null, videoUrl: null };
  }
  return { status: "IN_PROGRESS", error: null, videoUrl: null };
}
