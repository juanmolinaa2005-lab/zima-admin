/**
 * Marketing Studio presets — starting point for video automations.
 * Model IDs follow Higgsfield Platform API docs; tweak as their catalog evolves.
 */

export type DurationSpec =
  | { kind: "range"; min: number; max: number; step?: number }
  | { kind: "enum"; values: number[]; asString?: boolean };

export type VideoPreset = {
  id: string;
  name: string;
  description: string;
  /** Platform model path */
  modelId: string;
  /** Needs a source image URL */
  needsImage: boolean;
  defaultDuration: number;
  duration: DurationSpec | null;
  sendAspectRatio: boolean;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  /** Prompt template; use {{product}}, {{hook}}, {{style}} placeholders */
  promptTemplate: string;
  tags: string[];
  /** Accent for UI cards */
  accent: string;
  accentSoft: string;
  label: string;
  /** Preview thumbnail so the style is obvious */
  coverImage: string;
};

const SEEDANCE_DURATION: DurationSpec = { kind: "range", min: 2, max: 12, step: 1 };
const KLING_DURATION: DurationSpec = { kind: "enum", values: [5, 10] };

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "ugc-product",
    name: "UGC",
    label: "Reels / TikTok",
    description: "Creator casual, producto en mano",
    modelId: "higgsfield-ai/dop/standard",
    needsImage: true,
    defaultDuration: 5,
    duration: null,
    sendAspectRatio: false,
    aspectRatio: "9:16",
    promptTemplate:
      "Handheld UGC-style video of {{product}}. Natural lighting, slight camera shake, authentic social media energy. {{hook}}. {{style}}",
    tags: ["ugc", "reels"],
    accent: "#f97316",
    accentSoft: "#fff7ed",
    coverImage:
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=480&h=720&q=80",
  },
  {
    id: "cinematic-ad",
    name: "Cine",
    label: "Anuncio premium",
    description: "Cámara lenta, look comercial",
    modelId: "kling-video/v2.1/standard/image-to-video",
    needsImage: true,
    defaultDuration: 5,
    duration: KLING_DURATION,
    sendAspectRatio: false,
    aspectRatio: "16:9",
    promptTemplate:
      "Cinematic commercial shot of {{product}}. Slow camera push-in, golden hour lighting, shallow depth of field, luxury brand aesthetic. {{hook}}. {{style}}",
    tags: ["ads", "cine"],
    accent: "#ea580c",
    accentSoft: "#fff7ed",
    coverImage:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&h=450&q=80",
  },
  {
    id: "seedance-pro",
    name: "Seedance",
    label: "Imagen → video",
    description: "Movimiento suave y pro",
    modelId: "bytedance/seedance/v1/lite/image-to-video",
    needsImage: true,
    defaultDuration: 5,
    duration: SEEDANCE_DURATION,
    sendAspectRatio: true,
    aspectRatio: "16:9",
    promptTemplate:
      "Smooth cinematic motion: {{hook}}. Subject: {{product}}. {{style}}",
    tags: ["seedance"],
    accent: "#fb923c",
    accentSoft: "#fff7ed",
    coverImage:
      "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=800&h=450&q=80",
  },
  {
    id: "social-story",
    name: "Story",
    label: "Vertical 9:16",
    description: "Alta energía para Stories",
    modelId: "higgsfield-ai/dop/standard",
    needsImage: true,
    defaultDuration: 5,
    duration: null,
    sendAspectRatio: false,
    aspectRatio: "9:16",
    promptTemplate:
      "Vertical social story of {{product}}. Dynamic camera, punchy motion, high energy for Instagram Stories. {{hook}}. {{style}}",
    tags: ["stories"],
    accent: "#c2410c",
    accentSoft: "#ffedd5",
    coverImage:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=480&h=720&q=80",
  },
  {
    id: "product-spin",
    name: "360°",
    label: "Producto studio",
    description: "Órbita alrededor del producto",
    modelId: "kling-video/v2.1/standard/image-to-video",
    needsImage: true,
    defaultDuration: 5,
    duration: KLING_DURATION,
    sendAspectRatio: false,
    aspectRatio: "1:1",
    promptTemplate:
      "Slow orbital camera move around {{product}} on a clean studio background. Soft reflections, product showcase. {{hook}}. {{style}}",
    tags: ["producto"],
    accent: "#fb923c",
    accentSoft: "#fff7ed",
    coverImage:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=600&q=80",
  },
];

export function fillPromptTemplate(
  template: string,
  vars: { product: string; hook: string; style: string }
): string {
  return template
    .replace(/\{\{product\}\}/g, vars.product.trim() || "the product")
    .replace(/\{\{hook\}\}/g, vars.hook.trim() || "engaging motion")
    .replace(/\{\{style\}\}/g, vars.style.trim() || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPreset(id: string): VideoPreset | undefined {
  return VIDEO_PRESETS.find((p) => p.id === id);
}

export type ImagePreset = {
  id: string;
  name: string;
  description: string;
  modelId: string;
  provider: "higgsfield" | "openai";
  sendAspectRatio: boolean;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
};

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: "openai-gpt-image-2",
    name: "GPT Image 2",
    description: "OpenAI API · gpt-image-2",
    modelId: "gpt-image-2",
    provider: "openai",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "openai-gpt-image-1",
    name: "GPT Image 1",
    description: "OpenAI API · gpt-image-1",
    modelId: "gpt-image-1",
    provider: "openai",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "soul-2",
    name: "Soul 2",
    description: "Higgsfield Soul, look editorial",
    modelId: "higgsfield-ai/soul/v2/standard",
    provider: "higgsfield",
    sendAspectRatio: false,
    aspectRatio: "9:16",
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Rápido, texto a imagen",
    modelId: "nano-banana-2/text-to-image",
    provider: "higgsfield",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Más detalle y control",
    modelId: "nano-banana-pro",
    provider: "higgsfield",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "flux-2",
    name: "Flux 2",
    description: "Alta fidelidad al prompt",
    modelId: "flux-2-pro",
    provider: "higgsfield",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2 (Higgsfield)",
    description: "OpenAI vía Higgsfield",
    modelId: "openai/gpt-image-2",
    provider: "higgsfield",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
  {
    id: "z-image-turbo",
    name: "Z-Image Turbo",
    description: "Generación rápida",
    modelId: "z-image/turbo",
    provider: "higgsfield",
    sendAspectRatio: true,
    aspectRatio: "9:16",
  },
];

export function getImagePreset(id: string): ImagePreset | undefined {
  if (id === "openai-dall-e-3") {
    return IMAGE_PRESETS.find((p) => p.id === "openai-gpt-image-2");
  }
  return IMAGE_PRESETS.find((p) => p.id === id);
}

export function isImageModelId(modelId: string): boolean {
  return IMAGE_PRESETS.some((p) => p.modelId === modelId);
}

export function clampDurationSeconds(
  seconds: number,
  spec: DurationSpec
): number {
  const fallback = spec.kind === "enum" ? spec.values[0]! : spec.min;
  const n = Number.isFinite(seconds) ? Math.round(seconds) : fallback;
  if (spec.kind === "enum") {
    return spec.values.reduce(
      (best, value) =>
        Math.abs(value - n) < Math.abs(best - n) ? value : best,
      spec.values[0]!
    );
  }
  const step = spec.step ?? 1;
  const clamped = Math.min(spec.max, Math.max(spec.min, n));
  return Math.round(clamped / step) * step;
}

export function durationPayloadValue(
  seconds: number,
  spec: DurationSpec
): number | string {
  const value = clampDurationSeconds(seconds, spec);
  return spec.kind === "enum" && spec.asString ? String(value) : value;
}
