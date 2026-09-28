const API = "https://api.replicate.com/v1";

export const REPLICATE_FLUX_KONTEXT_PRO = "black-forest-labs/flux-kontext-pro";

function replicateHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function replicateErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.detail === "string" && o.detail.trim()) return o.detail;
    if (typeof o.title === "string" && o.title.trim()) return o.title;
    if (typeof o.error === "string" && o.error.trim()) return o.error;
    if (typeof o.detail === "object" && o.detail) {
      const d = o.detail as Record<string, unknown>;
      if (typeof d.msg === "string") return d.msg;
    }
  }
  if (status === 401 || status === 403) return "API token de Replicate inválido";
  if (status === 402) return "Replicate: saldo insuficiente";
  return `Replicate error (${status})`;
}

export async function verifyReplicateApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${API}/account`, {
    headers: replicateHeaders(apiKey),
    cache: "no-store",
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(replicateErrorMessage(data, res.status));
}

export type ReplicatePrediction = {
  id: string;
  status: string;
  error?: string | null;
  output?: unknown;
  urls?: { get?: string; cancel?: string };
};

export async function replicateCreatePrediction(
  apiKey: string,
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const cleaned = model.trim().replace(/^https?:\/\/replicate\.com\//i, "");
  const res = await fetch(`${API}/models/${cleaned}/predictions`, {
    method: "POST",
    headers: replicateHeaders(apiKey),
    body: JSON.stringify({ input }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as ReplicatePrediction &
    Record<string, unknown>;
  if (!res.ok) throw new Error(replicateErrorMessage(data, res.status));
  const id = String(data.id || "").trim();
  if (!id) throw new Error("Replicate no devolvió id de predicción");
  return id;
}

export async function replicateGetPrediction(
  apiKey: string,
  predictionId: string
): Promise<ReplicatePrediction> {
  const res = await fetch(
    `${API}/predictions/${encodeURIComponent(predictionId)}`,
    {
      headers: replicateHeaders(apiKey),
      cache: "no-store",
    }
  );
  const data = (await res.json().catch(() => ({}))) as ReplicatePrediction &
    Record<string, unknown>;
  if (!res.ok) throw new Error(replicateErrorMessage(data, res.status));
  return {
    id: String(data.id || predictionId),
    status: String(data.status || ""),
    error: typeof data.error === "string" ? data.error : null,
    output: data.output,
    urls: data.urls,
  };
}

export function replicateStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "succeeded") return "COMPLETED";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "FAILED";
  if (s === "processing") return "IN_PROGRESS";
  if (s === "starting" || s === "queued") return "IN_QUEUE";
  return status.toUpperCase() || "IN_QUEUE";
}

export function extractReplicateVideoUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output.trim())) {
    return output.trim();
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractReplicateVideoUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    for (const key of ["url", "video", "video_url", "output"]) {
      const url = extractReplicateVideoUrl(o[key]);
      if (url) return url;
    }
  }
  return null;
}

export function extractReplicateImageUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output.trim())) {
    return output.trim();
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractReplicateImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    for (const key of ["url", "image", "output"]) {
      const url = extractReplicateImageUrl(o[key]);
      if (url) return url;
    }
  }
  return null;
}

export async function replicateWaitForImage(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<{ url: string; contentType: string }> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 2_500;
  const id = await replicateCreatePrediction(apiKey, model, input);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const pred = await replicateGetPrediction(apiKey, id);
    const label = replicateStatusLabel(pred.status);
    if (label === "FAILED") {
      throw new Error(pred.error || "Replicate falló al generar la imagen");
    }
    if (label === "COMPLETED") {
      const url = extractReplicateImageUrl(pred.output);
      if (!url) throw new Error("Replicate terminó sin imagen");
      return { url, contentType: "image/jpeg" };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Replicate tardó demasiado en generar la imagen");
}
