export type ApiTraceProvider = "replicate" | "fal" | "openai" | "kling";

export type ApiCallTrace = {
  recorded: boolean;
  provider: ApiTraceProvider;
  model: string;
  endpoint: string;
  method: "POST";
  body: Record<string, unknown>;
  sentAt: string;
  outputUrl?: string | null;
};

export type InfluencerApiTrace = {
  frame?: ApiCallTrace;
  video?: ApiCallTrace;
};

const IMAGE_KEYS = new Set([
  "image",
  "image_url",
  "input_image",
  "start_image",
  "start_image_url",
]);

export function parseApiTrace(value: unknown): InfluencerApiTrace | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const frame = parseCall(o.frame);
  const video = parseCall(o.video);
  if (!frame && !video) return null;
  return { frame: frame ?? undefined, video: video ?? undefined };
}

export function mergeApiTrace(
  prev: unknown,
  patch: InfluencerApiTrace
): InfluencerApiTrace {
  const cur = parseApiTrace(prev) || {};
  return {
    frame: patch.frame ?? cur.frame,
    video: patch.video ?? cur.video,
  };
}

export function makeApiCallTrace(opts: {
  provider: ApiTraceProvider;
  model: string;
  endpoint: string;
  body: Record<string, unknown>;
  outputUrl?: string | null;
}): ApiCallTrace {
  return {
    recorded: true,
    provider: opts.provider,
    model: opts.model,
    endpoint: opts.endpoint,
    method: "POST",
    body: opts.body,
    sentAt: new Date().toISOString(),
    outputUrl: opts.outputUrl || null,
  };
}

export function withCallOutput(
  call: ApiCallTrace | null | undefined,
  outputUrl?: string | null
): ApiCallTrace | undefined {
  if (!call) return undefined;
  const url = (call.outputUrl || outputUrl || "").trim();
  return url ? { ...call, outputUrl: url } : call;
}

export function replicatePredictionBody(input: Record<string, unknown>) {
  return { input };
}

export function replicatePredictionEndpoint(model: string) {
  return `https://api.replicate.com/v1/models/${model}/predictions`;
}

export function falQueueEndpoint(model: string) {
  return `https://queue.fal.run/${model}`;
}

export function openaiImageEditsEndpoint() {
  return "https://api.openai.com/v1/images/edits";
}

export function inputFromCall(call: ApiCallTrace | null | undefined): Record<string, unknown> {
  if (!call?.body || typeof call.body !== "object") return {};
  const input = call.body.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return call.body;
}

export function promptFromCall(call: ApiCallTrace | null | undefined): string {
  const input = inputFromCall(call);
  return typeof input.prompt === "string" ? input.prompt : "";
}

export function mediaFromCall(
  call: ApiCallTrace | null | undefined
): { key: string; url: string }[] {
  return mediaFromValue(inputFromCall(call));
}

function parseCall(value: unknown): ApiCallTrace | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const provider =
    o.provider === "replicate" ||
    o.provider === "fal" ||
    o.provider === "openai" ||
    o.provider === "kling"
      ? o.provider
      : null;
  const model = typeof o.model === "string" ? o.model.trim() : "";
  const endpoint = typeof o.endpoint === "string" ? o.endpoint.trim() : "";
  const body =
    o.body && typeof o.body === "object" && !Array.isArray(o.body)
      ? (o.body as Record<string, unknown>)
      : null;
  if (!provider || !model || !body) return null;
  return {
    recorded: o.recorded !== false,
    provider,
    model,
    endpoint:
      endpoint ||
      (provider === "fal"
        ? falQueueEndpoint(model)
        : provider === "kling"
          ? "https://api-singapore.klingai.com/v1/videos/motion-control"
          : provider === "openai"
            ? openaiImageEditsEndpoint()
            : replicatePredictionEndpoint(model)),
    method: "POST",
    body,
    sentAt: typeof o.sentAt === "string" ? o.sentAt : "",
    outputUrl: typeof o.outputUrl === "string" && o.outputUrl.trim() ? o.outputUrl.trim() : null,
  };
}

function mediaFromValue(
  value: unknown,
  prefix = ""
): { key: string; url: string }[] {
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return prefix ? [{ key: prefix, url: value.trim() }] : [];
  }
  if (Array.isArray(value)) {
    const out: { key: string; url: string }[] = [];
    value.forEach((item, i) => {
      const key = prefix ? `${prefix}[${i}]` : String(i);
      out.push(...mediaFromValue(item, key));
    });
    return out;
  }
  if (!value || typeof value !== "object") return [];
  const o = value as Record<string, unknown>;
  const out: { key: string; url: string }[] = [];
  for (const [key, item] of Object.entries(o)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (IMAGE_KEYS.has(key) || key === "image_urls") {
      out.push(...mediaFromValue(item, path));
      continue;
    }
    if (item && typeof item === "object") {
      out.push(...mediaFromValue(item, path));
    }
  }
  return out;
}

export function reconstructApiTrace(opts: {
  prompt?: string | null;
  startImageUrl?: string | null;
  framePrompt?: string | null;
  refUrls?: string[] | null;
  modelId?: string | null;
  videoProvider?: "replicate" | "fal" | "kling" | null;
}): InfluencerApiTrace | null {
  const prompt = (opts.prompt || "").trim();
  const image = (opts.startImageUrl || "").trim();
  const framePrompt = (opts.framePrompt || "").trim();
  const refs = (opts.refUrls || []).map((u) => u.trim()).filter(Boolean);
  const provider: ApiTraceProvider =
    opts.videoProvider === "kling"
      ? "kling"
      : opts.videoProvider === "fal"
        ? "fal"
        : "replicate";
  const model = (opts.modelId || "").trim() || (provider === "fal" ? "fal.ai" : "replicate");

  const frame =
    framePrompt || refs.length || image
      ? {
          recorded: false as const,
          provider: "openai" as const,
          model: "gpt-image-2",
          endpoint: openaiImageEditsEndpoint(),
          method: "POST" as const,
          body: {
            model: "gpt-image-2",
            prompt: framePrompt,
            size: "1024x1536",
            quality: "high",
            image_urls: refs,
          },
          sentAt: "",
          outputUrl: image || null,
        }
      : undefined;

  const videoInput: Record<string, unknown> = {};
  if (prompt) videoInput.prompt = prompt;
  if (image) videoInput.image = image;
  const video =
    prompt || image
      ? {
          recorded: false as const,
          provider,
          model,
          endpoint:
            provider === "fal"
              ? falQueueEndpoint(model)
              : provider === "kling"
                ? "https://api-singapore.klingai.com/v1/videos/motion-control"
                : replicatePredictionEndpoint(model),
          method: "POST" as const,
          body: provider === "replicate" ? { input: videoInput } : videoInput,
          sentAt: "",
        }
      : undefined;

  if (!frame && !video) return null;
  return { frame, video };
}

export function combineApiTrace(
  recorded: InfluencerApiTrace | null | undefined,
  rebuilt: InfluencerApiTrace | null | undefined,
  startImageUrl?: string | null
): InfluencerApiTrace | null {
  const frame = withCallOutput(recorded?.frame ?? rebuilt?.frame, startImageUrl);
  const video = recorded?.video ?? rebuilt?.video;
  if (!frame && !video) return null;
  return { frame, video };
}
