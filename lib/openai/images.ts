const BASE = "https://api.openai.com/v1";

export async function verifyOpenAIApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      data.error?.message ||
        "API key de OpenAI inválida. Usa una key sk- de platform.openai.com (no la Admin key)."
    );
  }
  throw new Error(data.error?.message || `OpenAI API ${res.status}`);
}

function sizeForAspect(aspect: string): string {
  const ar = aspect.trim();
  if (
    ar === "square_hd" ||
    ar === "square" ||
    ar === "1:1"
  ) {
    return "1024x1024";
  }
  if (
    ar === "16:9" ||
    ar === "4:3" ||
    ar === "landscape_4_3" ||
    ar === "landscape_16_9"
  ) {
    return "1536x1024";
  }
  if (
    ar === "9:16" ||
    ar === "3:4" ||
    ar === "4:5" ||
    ar === "portrait_4_3" ||
    ar === "portrait_16_9"
  ) {
    return "1024x1536";
  }
  if (/^\d+x\d+$/.test(ar)) return ar;
  return "1024x1024";
}

const RETIRED_OPENAI_IMAGE: Record<string, string> = {
  "dall-e-2": "gpt-image-2",
  "dall-e-3": "gpt-image-2",
};

export const OPENAI_IMAGE_MODEL = "gpt-image-2";

export async function generateOpenAIImage(
  apiKey: string,
  opts: {
    model: string;
    prompt: string;
    aspectRatio?: string;
    quality?: "low" | "medium" | "high";
  }
): Promise<{ buffer: Buffer; contentType: string }> {
  const model =
    RETIRED_OPENAI_IMAGE[opts.model.trim()] || opts.model.trim() || OPENAI_IMAGE_MODEL;
  const size = sizeForAspect(opts.aspectRatio || "9:16");
  const body: Record<string, unknown> = {
    model,
    prompt: opts.prompt,
    size,
    quality: opts.quality || "medium",
  };

  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message || `No se pudo generar la imagen (${res.status})`
    );
  }

  const item = data.data?.[0];
  if (item?.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, "base64"),
      contentType: "image/png",
    };
  }

  const url = item?.url?.trim();
  if (!url) {
    throw new Error("OpenAI no devolvió la imagen");
  }

  const imgRes = await fetch(url, { cache: "no-store" });
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar la imagen de OpenAI (${imgRes.status})`);
  }
  const mime =
    imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (!buf.byteLength) throw new Error("Imagen vacía de OpenAI");
  return { buffer: buf, contentType: mime };
}

function toImageFile(
  buffer: Buffer,
  contentType: string,
  filename: string
): File {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return new File([bytes], filename, { type: contentType });
}

export type OpenAIImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  output_tokens_details?: { image_tokens?: number };
};

export type OpenAIImageResult = {
  buffer: Buffer;
  contentType: string;
  usage: OpenAIImageUsage | null;
};

async function decodeOpenAIImage(
  item: { b64_json?: string; url?: string } | undefined,
  usage: OpenAIImageUsage | null
): Promise<OpenAIImageResult> {
  if (item?.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, "base64"),
      contentType: "image/png",
      usage,
    };
  }
  const url = item?.url?.trim();
  if (!url) {
    throw new Error("OpenAI no devolvió la imagen editada");
  }
  const imgRes = await fetch(url, { cache: "no-store" });
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar la imagen de OpenAI (${imgRes.status})`);
  }
  const outMime =
    imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (!buf.byteLength) throw new Error("Imagen vacía de OpenAI");
  return { buffer: buf, contentType: outMime, usage };
}

export async function editOpenAIImages(
  apiKey: string,
  opts: {
    model?: string;
    prompt: string;
    images: Array<{ buffer: Buffer; contentType?: string }>;
    aspectRatio?: string;
    quality?: "low" | "medium" | "high";
  }
): Promise<OpenAIImageResult> {
  const images = opts.images.filter((img) => img.buffer.byteLength > 0);
  if (!images.length) {
    throw new Error("Faltan fotos de referencia del personaje");
  }
  const model =
    RETIRED_OPENAI_IMAGE[(opts.model || "").trim()] ||
    opts.model?.trim() ||
    OPENAI_IMAGE_MODEL;
  const size = sizeForAspect(opts.aspectRatio || "9:16");
  const quality = opts.quality || "medium";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", opts.prompt);
  form.append("size", size);
  form.append("quality", quality);
  images.forEach((img, i) => {
    const mime = img.contentType?.startsWith("image/")
      ? img.contentType.split(";")[0]!.trim()
      : "image/png";
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const field = images.length > 1 ? "image[]" : "image";
    form.append(field, toImageFile(img.buffer, mime, `reference-${i}.${ext}`));
  });

  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: form,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: Array<{ b64_json?: string; url?: string }>;
    usage?: OpenAIImageUsage;
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message || `No se pudo editar la imagen (${res.status})`
    );
  }

  return decodeOpenAIImage(data.data?.[0], data.usage ?? null);
}

export async function editOpenAIImage(
  apiKey: string,
  opts: {
    model?: string;
    prompt: string;
    image: Buffer;
    imageType?: string;
    aspectRatio?: string;
    quality?: "low" | "medium" | "high";
  }
): Promise<OpenAIImageResult> {
  return editOpenAIImages(apiKey, {
    model: opts.model,
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    quality: opts.quality,
    images: [{ buffer: opts.image, contentType: opts.imageType }],
  });
}
