import { isFalRequestMissingError } from "@/lib/fal/errors";

const QUEUE = "https://queue.fal.run";
const MODELS = "https://api.fal.ai/v1/models";

export const FAL_GPT_IMAGE_2 = "openai/gpt-image-2";
export const FAL_GPT_IMAGE_2_EDIT = "openai/gpt-image-2/edit";
export const FAL_FLUX_2_PRO = "fal-ai/flux-2-pro";
export const FAL_FLUX_2_PRO_EDIT = "fal-ai/flux-2-pro/edit";
export const FAL_OPENROUTER = "openrouter/router";
export const FAL_GROK_MODEL = "x-ai/grok-4.3";

export type FalImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | "auto";

const FAL_IMAGE_SIZES: FalImageSize[] = [
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
  "auto",
];

export function toFalImageSize(
  value: string | null | undefined,
  fallback: FalImageSize = "square_hd"
): FalImageSize {
  const raw = (value || "").trim() as FalImageSize;
  return FAL_IMAGE_SIZES.includes(raw) ? raw : fallback;
}

export type FalImageFile = {
  url: string;
  content_type?: string;
  file_name?: string;
  width?: number;
  height?: number;
};

function falHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function falGetHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    Accept: "application/json",
  };
}

function falQueueRoot(model: string): string {
  const cleaned = model
    .trim()
    .replace(/^https?:\/\/(queue\.)?fal\.run\//i, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "workflows" || parts[0] === "comfy") {
    return parts.slice(0, 3).join("/");
  }
  return parts.slice(0, 2).join("/") || cleaned;
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = (url || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function falStatusUrls(model: string, requestId: string): string[] {
  const id = encodeURIComponent(requestId);
  const root = falQueueRoot(model);
  return uniqueUrls([
    `${QUEUE}/${model}/requests/${id}/status?logs=1`,
    `${QUEUE}/${root}/requests/${id}/status?logs=1`,
  ]);
}

function falResultUrls(model: string, requestId: string): string[] {
  const id = encodeURIComponent(requestId);
  const root = falQueueRoot(model);
  return uniqueUrls([
    `${QUEUE}/${model}/requests/${id}`,
    `${QUEUE}/${root}/requests/${id}`,
  ]);
}

async function falGetJson(apiKey: string, urls: string[]): Promise<Record<string, unknown>> {
  let lastError = "fal.ai no respondió";
  for (const url of urls) {
    const res = await fetch(url, {
      method: "GET",
      headers: falGetHeaders(apiKey),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    lastError = falErrorMessage(data, res.status);
    const missing = isFalRequestMissingError(lastError);
    if (res.ok && !missing) return data;
    if (
      missing ||
      res.status === 404 ||
      res.status === 405
    ) {
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

function falErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const detail = o.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d) => {
          if (typeof d === "string") return d;
          if (d && typeof d === "object" && "msg" in d) {
            return String((d as { msg?: unknown }).msg || "");
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join(" · ");
    }
    if (typeof o.error === "string" && o.error.trim()) return o.error;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
  }
  if (status === 401 || status === 403) return "API key de fal.ai inválida";
  return `fal.ai error (${status})`;
}

export async function verifyFalApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${MODELS}?limit=1`, {
    headers: falHeaders(apiKey),
    cache: "no-store",
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(falErrorMessage(data, res.status));
}

export async function falQueueSubmit(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
  opts?: { webhookUrl?: string | null }
): Promise<string> {
  const webhook = (opts?.webhookUrl || "").trim();
  const url = webhook
    ? `${QUEUE}/${model}?fal_webhook=${encodeURIComponent(webhook)}`
    : `${QUEUE}/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: falHeaders(apiKey),
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    request_id?: string;
    requestId?: string;
  };
  if (!res.ok) throw new Error(falErrorMessage(data, res.status));
  const id = (data.request_id || data.requestId || "").trim();
  if (!id) throw new Error("fal.ai no devolvió request_id");
  return id;
}

export async function falQueueStatus(
  apiKey: string,
  model: string,
  requestId: string
): Promise<{
  status: string;
  error?: string;
  queuePosition?: number | null;
  lastLog?: string | null;
}> {
  const data = await falGetJson(apiKey, falStatusUrls(model, requestId));
  const logs = Array.isArray(data.logs) ? data.logs : [];
  const last = logs.length ? logs[logs.length - 1] : null;
  const lastLog =
    last && typeof last === "object" && typeof (last as { message?: unknown }).message === "string"
      ? String((last as { message: string }).message).trim()
      : typeof last === "string"
        ? last.trim()
        : null;
  const posRaw = data.queue_position ?? data.queuePosition;
  const queuePosition =
    typeof posRaw === "number" && Number.isFinite(posRaw) ? posRaw : null;
  const status = String(data.status || "").toUpperCase();
  if (status === "NOT_FOUND") {
    throw new Error("fal.ai no encontró este job");
  }
  return {
    status,
    error:
      typeof data.error === "string"
        ? data.error
        : typeof data.detail === "string"
          ? data.detail
          : undefined,
    queuePosition,
    lastLog: lastLog || null,
  };
}

export async function falQueueCancel(
  apiKey: string,
  model: string,
  requestId: string
): Promise<void> {
  const id = encodeURIComponent(requestId);
  const root = falQueueRoot(model);
  const urls = uniqueUrls([
    `${QUEUE}/${model}/requests/${id}/cancel`,
    `${QUEUE}/${root}/requests/${id}/cancel`,
  ]);
  for (const url of urls) {
    const res = await fetch(url, {
      method: "PUT",
      headers: falHeaders(apiKey),
      cache: "no-store",
    });
    if (res.ok || res.status === 404 || res.status === 409) return;
  }
}

export async function falQueuePayload(
  apiKey: string,
  model: string,
  requestId: string
): Promise<Record<string, unknown>> {
  return falGetJson(apiKey, falResultUrls(model, requestId));
}

export async function falQueueResult(
  apiKey: string,
  model: string,
  requestId: string
): Promise<{ images: FalImageFile[] }> {
  const data = await falQueuePayload(apiKey, model, requestId);
  const images = Array.isArray(data.images)
    ? (data.images as FalImageFile[])
    : [];
  if (!images.length && data.image && typeof data.image === "object") {
    images.push(data.image as FalImageFile);
  }
  return { images };
}

export async function falWaitForOutput(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 2_500;
  const requestId = await falQueueSubmit(apiKey, model, input);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const st = await falQueueStatus(apiKey, model, requestId);
    if (st.status === "FAILED" || st.status === "ERROR") {
      throw new Error(st.error || "fal.ai falló al generar la respuesta");
    }
    if (st.status === "CANCELED" || st.status === "CANCELLED") {
      throw new Error("fal.ai canceló la generación");
    }
    if (st.status === "COMPLETED") {
      const data = await falQueuePayload(apiKey, model, requestId);
      const output = data.output;
      if (typeof output === "string" && output.trim()) return output.trim();
      if (output && typeof output === "object") return JSON.stringify(output);
      if (typeof data.error === "string" && data.error.trim()) {
        throw new Error(data.error);
      }
      throw new Error("fal.ai terminó sin texto");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("fal.ai tardó demasiado en responder");
}

export function extractFalVideoUrl(
  data: Record<string, unknown> | null | undefined
): string | null {
  if (!data || typeof data !== "object") return null;
  const video = data.video;
  if (typeof video === "string" && /^https?:\/\//i.test(video.trim())) {
    return video.trim();
  }
  if (video && typeof video === "object") {
    const url = (video as { url?: unknown }).url;
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
  }
  for (const key of ["url", "video_url", "output_url"]) {
    const raw = data[key];
    if (typeof raw === "string" && /\.(mp4|webm|mov)(\?|$)/i.test(raw)) {
      return raw.trim();
    }
  }
  const nested = data.data;
  if (nested && typeof nested === "object" && nested !== data) {
    return extractFalVideoUrl(nested as Record<string, unknown>);
  }
  return null;
}

export function extractFalText(
  data: Record<string, unknown> | null | undefined
): string | null {
  if (!data || typeof data !== "object") return null;
  const output = data.output;
  if (typeof output === "string" && output.trim()) return output.trim();
  if (output && typeof output === "object") return JSON.stringify(output);
  if (typeof data.error === "string" && data.error.trim()) return null;
  return extractFalText(data.data as Record<string, unknown> | undefined);
}

export function extractFalImageUrl(
  images: FalImageFile[] | null | undefined
): string | null {
  if (!images?.length) return null;
  for (const item of images) {
    const url = item?.url?.trim();
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

export function extractFalImageFromPayload(
  data: Record<string, unknown> | null | undefined
): string | null {
  if (!data || typeof data !== "object") return null;
  const images: FalImageFile[] = [];
  if (Array.isArray(data.images)) {
    images.push(...(data.images as FalImageFile[]));
  }
  if (data.image && typeof data.image === "object") {
    images.push(data.image as FalImageFile);
  }
  const fromArr = extractFalImageUrl(images);
  if (fromArr) return fromArr;
  if (typeof data.image === "string" && /^https?:\/\//i.test(data.image.trim())) {
    return data.image.trim();
  }
  const nested = data.data;
  if (nested && typeof nested === "object" && nested !== data) {
    return extractFalImageFromPayload(nested as Record<string, unknown>);
  }
  return null;
}

export async function falWaitForImage(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<{ url: string; contentType: string }> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 2_500;
  const requestId = await falQueueSubmit(apiKey, model, input);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const st = await falQueueStatus(apiKey, model, requestId);
    if (st.status === "FAILED" || st.status === "ERROR") {
      throw new Error(st.error || "fal.ai falló al generar la imagen");
    }
    if (st.status === "CANCELED" || st.status === "CANCELLED") {
      throw new Error("fal.ai canceló la generación");
    }
    if (st.status === "COMPLETED") {
      const result = await falQueueResult(apiKey, model, requestId);
      const url = extractFalImageUrl(result.images);
      if (!url) throw new Error("fal.ai terminó sin imagen");
      const contentType =
        result.images[0]?.content_type?.split(";")[0]?.trim() || "image/png";
      return { url, contentType };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("fal.ai tardó demasiado en generar la imagen");
}
