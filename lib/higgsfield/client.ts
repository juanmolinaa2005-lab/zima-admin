/**
 * Higgsfield Platform API client
 * Docs: https://docs.higgsfield.ai/docs/how-to/introduction
 */

const BASE = "https://platform.higgsfield.ai";

export type HiggsfieldCredentials = {
  keyId: string;
  keySecret: string;
};

export type HiggsfieldJobStatus =
  | "queued"
  | "in_progress"
  | "nsfw"
  | "failed"
  | "completed"
  | string;

export type HiggsfieldSubmitResult = {
  status: HiggsfieldJobStatus;
  request_id: string;
  status_url?: string;
  cancel_url?: string;
};

export type HiggsfieldStatusResult = {
  status: HiggsfieldJobStatus;
  request_id: string;
  status_url?: string;
  cancel_url?: string;
  video?: { url?: string } | string | null;
  images?: Array<{ url?: string } | string>;
  audio?: { url?: string } | null;
  error?: string;
  detail?: string;
  [key: string]: unknown;
};

const TERMINAL = new Set(["completed", "failed", "nsfw", "canceled", "cancelled"]);

export function normalizeHiggsfieldStatus(status: unknown): string {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

export function isHiggsfieldTerminal(status: unknown): boolean {
  return TERMINAL.has(normalizeHiggsfieldStatus(status));
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/** Pull a playable media URL out of the various Higgsfield status shapes. */
export function extractHiggsfieldVideoUrl(
  data: Record<string, unknown> | HiggsfieldStatusResult | null | undefined
): string | null {
  if (!data || typeof data !== "object") return null;

  const video = (data as HiggsfieldStatusResult).video;
  const fromVideo = httpUrl(video) || httpUrl((video as { url?: unknown } | null)?.url);
  if (fromVideo) return fromVideo;

  const audio = (data as HiggsfieldStatusResult).audio;
  const fromAudio = httpUrl(audio) || httpUrl((audio as { url?: unknown } | null)?.url);
  if (fromAudio && /\.(mp4|webm|mov)(\?|$)/i.test(fromAudio)) return fromAudio;

  const images = (data as HiggsfieldStatusResult).images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const url = httpUrl(item) || httpUrl((item as { url?: unknown } | null)?.url);
      if (url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return url;
    }
  }

  for (const key of ["url", "video_url", "output_url", "media_url"]) {
    const url = httpUrl((data as Record<string, unknown>)[key]);
    if (url) return url;
  }

  const output = (data as Record<string, unknown>).output;
  if (output && typeof output === "object") {
    const out = output as Record<string, unknown>;
    const nested =
      httpUrl(out.url) ||
      httpUrl(out.video_url) ||
      (Array.isArray(out.media_url) ? httpUrl(out.media_url[0]) : httpUrl(out.media_url));
    if (nested) return nested;
  }

  return null;
}

/** Pull a generated still image URL from Higgsfield status payloads. */
export function extractHiggsfieldImageUrl(
  data: Record<string, unknown> | HiggsfieldStatusResult | null | undefined
): string | null {
  if (!data || typeof data !== "object") return null;

  const images = (data as HiggsfieldStatusResult).images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const url = httpUrl(item) || httpUrl((item as { url?: unknown } | null)?.url);
      if (url && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return url;
    }
  }

  for (const key of ["url", "image_url", "output_url", "media_url"]) {
    const url = httpUrl((data as Record<string, unknown>)[key]);
    if (url && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return url;
  }

  const output = (data as Record<string, unknown>).output;
  if (output && typeof output === "object") {
    const out = output as Record<string, unknown>;
    const nestedImages = out.images;
    if (Array.isArray(nestedImages)) {
      for (const item of nestedImages) {
        const url =
          httpUrl(item) || httpUrl((item as { url?: unknown } | null)?.url);
        if (url) return url;
      }
    }
    const nested =
      httpUrl(out.url) ||
      httpUrl(out.image_url) ||
      (Array.isArray(out.media_url) ? httpUrl(out.media_url[0]) : httpUrl(out.media_url));
    if (nested && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(nested)) return nested;
  }

  return null;
}

export function higgsfieldErrorMessage(data: Record<string, unknown> | HiggsfieldStatusResult): string | null {
  const rec = data as Record<string, unknown>;
  for (const key of ["error", "detail", "message"]) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function authHeader(creds: HiggsfieldCredentials): string {
  return `Key ${creds.keyId}:${creds.keySecret}`;
}

export async function verifyHiggsfieldCredentials(
  creds: HiggsfieldCredentials
): Promise<void> {
  // Lightweight check: hit status of a fake id — 401 = bad key, 404 = key accepted
  const res = await fetch(
    `${BASE}/requests/00000000-0000-0000-0000-000000000000/status`,
    {
      headers: {
        Authorization: authHeader(creds),
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("Credenciales Higgsfield inválidas");
  }
  // 404/400/etc. still means auth worked
}

const FALLBACK_MODEL = "higgsfield-ai/dop/standard";

function higgsfieldHttpError(
  status: number,
  data: Record<string, unknown>
): string {
  const detail = data.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (status === 404) {
    return "Higgsfield 404: this model is not available on your account.";
  }
  return `Higgsfield error ${status}`;
}

export async function submitHiggsfieldJob(
  creds: HiggsfieldCredentials,
  modelId: string,
  body: Record<string, unknown>,
  opts?: { allowVideoFallback?: boolean }
): Promise<HiggsfieldSubmitResult> {
  const tryOnce = async (path: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/${path.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(creds),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, data };
  };

  let { res, data } = await tryOnce(modelId, body);
  if (
    res.status === 404 &&
    modelId !== FALLBACK_MODEL &&
    opts?.allowVideoFallback !== false
  ) {
    const fallbackBody: Record<string, unknown> = { prompt: body.prompt };
    if (typeof body.image_url === "string" && body.image_url) {
      fallbackBody.image_url = body.image_url;
    }
    ({ res, data } = await tryOnce(FALLBACK_MODEL, fallbackBody));
  }

  if (!res.ok) {
    throw new Error(higgsfieldHttpError(res.status, data));
  }

  return data as unknown as HiggsfieldSubmitResult;
}

export async function getHiggsfieldJobStatus(
  creds: HiggsfieldCredentials,
  requestId: string
): Promise<HiggsfieldStatusResult> {
  const res = await fetch(`${BASE}/requests/${requestId}/status`, {
    headers: {
      Authorization: authHeader(creds),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.message === "string" && data.message) ||
      `No se pudo consultar el job (${res.status})`;
    throw new Error(msg);
  }

  const status = normalizeHiggsfieldStatus(data.status) || "queued";
  const videoUrl = extractHiggsfieldVideoUrl(data);
  const imageUrl = extractHiggsfieldImageUrl(data);
  return {
    ...(data as HiggsfieldStatusResult),
    status,
    request_id:
      (typeof data.request_id === "string" && data.request_id) || requestId,
    video: videoUrl ? { url: videoUrl } : ((data.video as HiggsfieldStatusResult["video"]) ?? null),
    images: imageUrl
      ? [{ url: imageUrl }]
      : ((data.images as HiggsfieldStatusResult["images"]) ?? undefined),
    error: higgsfieldErrorMessage(data) ?? undefined,
  };
}

export async function cancelHiggsfieldJob(
  creds: HiggsfieldCredentials,
  requestId: string
): Promise<void> {
  const res = await fetch(`${BASE}/requests/${requestId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || `Cancel falló (${res.status})`);
  }
}

/**
 * Upload image bytes to Higgsfield CDN and return a public HTTPS URL
 * usable as image_url in generation requests.
 */
export async function uploadHiggsfieldImage(
  creds: HiggsfieldCredentials,
  bytes: ArrayBuffer,
  contentType: string
): Promise<string> {
  const linkRes = await fetch(`${BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
      Accept: "application/json",
      "hf-api-key": creds.keyId,
      "hf-secret": creds.keySecret,
    },
    body: JSON.stringify({ content_type: contentType }),
    cache: "no-store",
  });

  const linkData = (await linkRes.json().catch(() => ({}))) as {
    upload_url?: string;
    public_url?: string;
    error?: string;
    message?: string;
  };

  if (!linkRes.ok || !linkData.upload_url || !linkData.public_url) {
    const msg =
      linkData.error ||
      linkData.message ||
      `No se pudo preparar la subida (${linkRes.status})`;
    throw new Error(msg);
  }

  const putRes = await fetch(linkData.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
    cache: "no-store",
  });

  if (!putRes.ok) {
    throw new Error(`Falló la subida de la imagen (${putRes.status})`);
  }

  return linkData.public_url;
}
