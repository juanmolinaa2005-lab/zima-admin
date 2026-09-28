import { parseViralResult, type ViralHit } from "@/lib/creator/viral-content";
import type {
  AutopilotPlan,
  AutopilotStage,
  AutopilotStatus,
  AutopilotViralHit,
} from "@/lib/creator/autopilot-types";

export function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export function parseAutopilotCreateBody(raw: unknown): {
  idea: string;
  requestId: string;
  influencerId: string;
  productContext: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError("JSON inválido", 400);
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.idea !== "string") {
    throw httpError('"idea" debe ser texto', 400);
  }
  if (typeof body.requestId !== "string") {
    throw httpError('"requestId" debe ser texto', 400);
  }
  if (typeof body.influencerId !== "string") {
    throw httpError('"influencerId" debe ser texto', 400);
  }
  if (
    "productContext" in body &&
    body.productContext !== undefined &&
    body.productContext !== null &&
    typeof body.productContext !== "string"
  ) {
    throw httpError('"productContext" debe ser texto', 400);
  }
  const idea = body.idea.trim().replace(/\s+/g, " ");
  const requestId = body.requestId.trim();
  const influencerId = parseUuid(body.influencerId, "influencerId");
  const productContext =
    typeof body.productContext === "string"
      ? body.productContext.trim()
      : "";
  if (idea.length < 8) {
    throw httpError("Escribe una idea de al menos 8 caracteres.", 400);
  }
  if (idea.length > 500) {
    throw httpError("La idea no puede superar 500 caracteres.", 400);
  }
  if (requestId.length < 8 || requestId.length > 80) {
    throw httpError('"requestId" debe tener entre 8 y 80 caracteres.', 400);
  }
  if (productContext.length > AUTOPILOT_PRODUCT_CONTEXT_MAX) {
    throw httpError(
      `El producto no puede superar ${AUTOPILOT_PRODUCT_CONTEXT_MAX} caracteres.`,
      400
    );
  }
  return { idea, requestId, influencerId, productContext };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw httpError(`"${field}" debe ser texto`, 400);
  }
  const id = value.trim();
  if (!UUID_RE.test(id)) {
    throw httpError(`"${field}" no es un id válido`, 400);
  }
  return id;
}

export function languageFromProfile(value: unknown): "es" | "en" {
  return value === "en" ? "en" : "es";
}

export function asAutopilotStatus(value: string): AutopilotStatus {
  if (value === "running" || value === "done" || value === "failed") return value;
  return "queued";
}

export function asAutopilotStage(value: string): AutopilotStage {
  if (
    value === "validate" ||
    value === "influencer" ||
    value === "research" ||
    value === "plan" ||
    value === "frames" ||
    value === "clips" ||
    value === "montage" ||
    value === "done"
  ) {
    return value;
  }
  return "queued";
}

export function realViralHits(hits: ViralHit[]): AutopilotViralHit[] {
  const out: AutopilotViralHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const sourceUrl = hit.sourceUrl || hit.videoUrl;
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) continue;
    const key = sourceUrl.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: hit.name,
      structure: hit.structure,
      sourceUrl,
      hooks: hit.hooks.slice(0, 3),
    });
  }
  return out.slice(0, 4);
}

export function parseAutopilotViral(raw: string): AutopilotViralHit[] {
  return realViralHits(parseViralResult(raw).items);
}

export function autopilotViralPrompt(opts: {
  idea: string;
  language: "es" | "en";
  date?: Date;
}): string {
  const lang = opts.language === "en" ? "English" : "español";
  return `Find 3-5 SHORT-FORM UGC formats that are working NOW for consumer mobile apps, relevant to this idea: "${opts.idea}".
Use live web/X search. Language of the JSON values: ${lang}.
Rules:
- Only formats with a REAL https sourceUrl (x.com, tiktok.com, youtube.com, instagram.com).
- Do not invent view counts, accounts, or URLs. If you cannot find a real link, omit the item.
- Prefer a creator demonstrating one concrete app use, with a personal opening and relevant everyday action. Do not assume a gender, gym or food niche.
- If nothing verifiable exists, return {"items":[]}. Never fabricate trends.
Return ONLY JSON: {"items":[{"name":"...","structure":"...","sourceUrl":"https://...","hooks":["...","..."],"videoUrl":"https://... or null"}]}`;
}

export function autopilotImprovePrompt(opts: {
  idea: string;
  productContext: string;
  viral: AutopilotViralHit[];
  language: "es" | "en";
}): string {
  const formats = opts.viral
    .map(
      (v) =>
        `- ${v.name} (${v.sourceUrl}): ${v.structure}${v.hooks[0] ? ` Hook: ${v.hooks[0]}` : ""}`
    )
    .join("\n");
  const product = opts.productContext.trim()
    ? `Product (from the project, do not invent features):\n${opts.productContext.slice(0, 8000)}`
    : "No extra product brief; stay inside the idea.";
  return `Rewrite this UGC idea into one tighter spoken hook + proof promise.
Idea: ${opts.idea}
${product}
Verified formats (cite only these; if none, do not invent trends):
${formats || "(none verifiable — write from the idea/product only)"}
Write the improved idea ONLY in ${opts.language === "en" ? "English" : "Spanish"}, regardless of the input language.
Return ONLY JSON: {"improvedIdea":"...max 280 chars..."}`;
}

export function autopilotPlanPrompt(opts: {
  idea: string;
  improvedIdea: string;
  productContext: string;
  viral: AutopilotViralHit[];
  language: "es" | "en";
  totalSec: number;
  repairReason?: string;
}): string {
  const lang = opts.language === "en" ? "English" : "español";
  const product = opts.productContext.trim().slice(0, 8000);
  return `Plan an internal 9:16 UGC montage. Spoken language: ${lang}. Total duration ${opts.totalSec}s.
Idea: ${opts.idea}
Tight version: ${opts.improvedIdea}
Product brief: ${product || "(use the idea only)"}
Formats (only if verified URLs exist): ${opts.viral.map((v) => v.name).join(", ") || "none — do not invent"}
Structure: a close personal opening, early product proof, a wider candid activity, the product result, then a return to the creator. The final edit interleaves three source takes; never write three disconnected pitches. Choose one specific physical activity and a setting that fit the idea; do not assume every product is a fitness or food app.
Write COMPLETE NARRATION, not a title or a short hook. For ${opts.totalSec} seconds write ${Math.ceil(opts.totalSec * 2)}–${Math.floor(opts.totalSec * 2.4)} spoken words: an engaging opening, a concrete experience supported by the product brief/idea, and a natural ending. Do not invent benefits, results or features. The available recording is a separate real example; do not claim its exact text, location, notification or contents unless provided in the product context as capture metadata. No emojis, directions, brackets, headings or timestamps in narration.
The ENTIRE narration must be in ${lang}, even when the idea is in another language. Voice continues across all three shots. The talking clip records the full narration; shot durations only control the visual edit.
${opts.repairReason ? `Previous response was rejected: ${opts.repairReason}. Rewrite the complete narration and count its words before returning JSON.` : ""}
Fill every field with your actual creative decision, never repeat these instructions. No placeholders or descriptions of what should go in a field.
- narration: 30–36 conversational words in ${lang}. No absolute promises such as never forgetting anything. Describe one concrete personal situation, not a list of features.
- talkingAction: a specific delivery and gesture for the opening.
- brollAction: a specific physical action with a named object. No generic "activity relevant to the idea".
- demoAction: a natural way of holding or using the physical phone, keeping the display visible.
- setting: name one concrete place and time of day. This same location is used across the takes.
Return ONLY an object with these keys (replace every empty string):
{"narration":"","talkingAction":"","brollAction":"","demoAction":"","setting":""}`;
}

export function autopilotIdentityPrompt(): string {
  return `${AUTOPILOT_DEFAULT_TRAITS}. Photorealistic iPhone portrait, 9:16, candid, natural skin, gym or casual food-day wardrobe, no text, no extra people, no beauty filter.`;
}

export function autopilotTalkingFramePrompt(opts: {
  name: string;
  traits: string;
  action: string;
  extra: string;
  script: string;
}): string {
  return [
    `Photorealistic 9:16 iPhone still of ${opts.name}, the adult creator in the identity references, speaking naturally to a friend. Close head-and-shoulders framing at eye level, phone camera at arm length.`,
    opts.traits ? `Look: ${opts.traits}.` : "",
    `Action: ${opts.action || "talks to camera, handheld energy, iPhone-in-hand vibe"}.`,
    opts.extra ? `Setting: ${opts.extra}.` : "",
    `Keep identity locked to any reference photos. Available daylight, visible natural skin texture, ordinary phone-camera depth of field, believable surroundings. Relaxed mouth, no dramatic expression, no fashion-ad lighting or cinematic bokeh. This is a raw camera frame: absolutely no writing, quotations, subtitles, letters, graphics, captions or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function autopilotBrollFramePrompt(opts: {
  name: string;
  traits: string;
  action: string;
  extra: string;
}): string {
  return [
    `Photorealistic 9:16 iPhone still of ${opts.name} in a candid everyday moment. Medium-wide side-angle framing that clearly shows the physical activity, unlike the close opening shot.`,
    opts.traits ? `Look: ${opts.traits}.` : "",
    `Action: ${opts.action}. Occupied with the activity, not looking at camera.`,
    opts.extra ? `Setting: ${opts.extra}.` : "",
    `If a phone appears it is a real object in her hand, screen not invented. Keep identity locked. No captions or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function autopilotDemoFramePrompt(opts: {
  name: string;
  traits: string;
  extra: string;
}): string {
  return [
    `Photorealistic 9:16 over-the-shoulder close-up of ${opts.name} using a phone. Camera looks OVER her shoulder at the FRONT DISPLAY, never at the back or rear cameras. Her recognizable profile is visible at the side of the frame; the phone display occupies the center.`,
    opts.traits ? `Look: ${opts.traits}.` : "",
    `CRITICAL VFX PLATE: The FRONT DISPLAY must be a perfectly flat, bright saturated MAGENTA (#ff00ff), edge to edge inside the physical bezel. No UI, letters, icons, gradients or reflections on the magenta display. The real app will be inserted afterward. Keep face and hands photorealistic. No other magenta objects or clothing.`,
    `The entire INNER DISPLAY and its four corners are clearly visible and unobstructed. Hold the phone by its edges, fingers behind the bezel, no fingers across the display. A natural pause between taps. Minimal perspective angle, display mostly parallel to camera. The magenta surface is ONLY the front display, NEVER the back of the phone.`,
    opts.extra ? `Setting: ${opts.extra}.` : "",
    `Keep identity locked. No extra people, captions, or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function autopilotTalkingClipPrompt(opts: {
  name: string;
  script: string;
  product: string;
  language: "es" | "en";
  action: string;
  extra: string;
}): string {
  const spoken =
    opts.language === "en"
      ? `The creator SPEAKS this full script in English for the ENTIRE clip, continuous voice, no silent gaps: "${opts.script}"`
      : `The creator SPEAKS this full script ONLY in Spanish for the ENTIRE clip, continuous voice, no silent gaps. Never translate the speech to English: "${opts.script}"`;
  return [
    `Photorealistic handheld iPhone vertical video (9:16) of ${opts.name}, the exact person in the first-frame still.`,
    `The selected creator talks to camera like a real TikTok. Natural mouth, eyes, and head motion matching the spoken audio.`,
    opts.action ? `Energy: ${opts.action}.` : "",
    opts.extra ? `Setting: ${opts.extra}.` : "",
    spoken,
    `Product context, not additional spoken words: ${opts.product}.`,
    `Keep identity locked. No extra people, captions, or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function autopilotBrollPrompt(opts: {
  name: string;
  action: string;
  extra: string;
}): string {
  return [
    `Photorealistic handheld iPhone vertical B-roll (9:16) of ${opts.name}, the exact person in the first-frame still.`,
    `One continuous physical action, filmed candidly from the side. Action: ${opts.action}.`,
    opts.extra ? `Setting: ${opts.extra}.` : "",
    `If a phone appears it can be in her hand as a real object. Do not invent app UI. Keep identity locked. No captions or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function autopilotDemoClipPrompt(opts: {
  name: string;
  action: string;
  rawPlate?: boolean;
}): string {
  if (opts.rawPlate) return [
    `Natural handheld close-up of the physical phone from the first frame. Same creator and setting.`,
    `A small, slow wrist movement and subtle breathing, no camera cuts. Keep the front display fully visible and large enough to read. Fingers remain on the bezel.`,
    `VFX requirement: preserve the uniform saturated magenta front display throughout every frame. No UI, no text, no reflections, no new objects on the display. The app recording is inserted AFTER this animation, not by you.`,
    `Do not turn the phone over or swing it. Keep its rigid rectangular shape. No subtitles, captions or watermarks.`,
  ].join(" ");
  return [
    `Photorealistic handheld iPhone vertical video (9:16) of ${opts.name}, the exact person in the first-frame still.`,
    opts.action,
    `CRITICAL: She is USING a real phone. Keep the phone SCREEN CONTENT as close as possible to the first frame, which already contains a real product capture. Do not invent a different app UI.`,
    `After video generation, pixel-perfect UI is not claimed — avoid rewriting the screen. Slight natural handheld motion only. No extra people, captions, or watermarks.`,
  ].join(" ");
}

export function autopilotProductOnScreenPrompt(): string {
  return [
    "Image 1 is a photorealistic still of one woman holding a real iPhone. Image 2 is a REAL product screenshot/capture.",
    "Replace ONLY the phone screen of image 1 with the screenshot from image 2.",
    "Keep her face, hair, hands, body, and the phone bezel unchanged. Do not cover the face with the screenshot.",
    "Do not invent UI pixels. The screen content must come from image 2.",
  ].join(" ");
}

function clampDur(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(8, Math.max(3, Math.round(n)));
}

export function parseAutopilotPlan(
  raw: unknown,
  totalSec: number
): AutopilotPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const narration = typeof o.narration === "string" ? o.narration : o.hook;
  const hook = typeof narration === "string" ? narration.trim().replace(/\s+/g, " ") : "";
  const words = hook.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length || 0;
  if (!Number.isFinite(totalSec) || totalSec < 9 || totalSec > 24) return null;
  if (words < Math.ceil(totalSec * 1.8) || words > Math.floor(totalSec * 3) || hook.length > 700) return null;
  let talking = clampDur(o.talkingDurationSec, 5);
  let broll = clampDur(o.brollDurationSec, 5);
  let demo = clampDur(o.demoDurationSec, 5);
  const sum = talking + broll + demo;
  if (sum !== totalSec) {
    talking = Math.min(talking, totalSec - 6);
    broll = 5;
    demo = totalSec - talking - broll;
    if (demo < 3) {
      demo = 3;
      broll = Math.max(3, totalSec - talking - demo);
    }
  }
  return {
    hook: hook.slice(0, 700),
    talkingDurationSec: talking,
    brollDurationSec: broll,
    demoDurationSec: demo,
    talkingAction:
      typeof o.talkingAction === "string"
        ? o.talkingAction.trim().slice(0, 220)
        : "Close natural conversation, relaxed adult creator, eye-level handheld camera",
    brollAction:
      typeof o.brollAction === "string"
        ? o.brollAction.trim().slice(0, 220)
        : "An everyday physical action relevant to the product, wider side view, not looking at camera",
    demoAction:
      typeof o.demoAction === "string"
        ? o.demoAction.trim().slice(0, 220)
        : "Uses a real iPhone; the screen shows the real app UI, readable",
    setting:
      typeof o.setting === "string"
        ? o.setting.trim().slice(0, 180)
        : "a believable everyday location appropriate to the product",
  };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(cleaned.slice(start, end + 1));
  return null;
}

export const AUTOPILOT_TOTAL_SEC = 15;
export const AUTOPILOT_MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";
export const AUTOPILOT_PRODUCT_CONTEXT_MAX = 8000;

export const AUTOPILOT_DEFAULT_TRAITS =
  "Young woman 24-30, natural UGC look, real skin texture, athletic-casual gym or food-day clothes, not a celebrity, no beauty filter";

/** A production plan must contain creative decisions, not copied field instructions. */
export function parseAutopilotProductionPlan(raw: unknown): AutopilotPlan | null {
  const plan = parseAutopilotPlan(raw, AUTOPILOT_TOTAL_SEC);
  if (!plan || !raw || typeof raw !== "object") return null;
  const words = plan.hook.split(/\s+/).length;
  if (words < 30 || words > 36) return null;
  const fields = raw as Record<string, unknown>;
  const placeholders = /specific everyday|one specific physical|supported by the idea|appropriate to this product|specific close conversational|action relevant to|replace every|\.\.\.|<[^>]+>/i;
  for (const key of ["talkingAction", "brollAction", "demoAction", "setting"]) {
    if (typeof fields[key] !== "string" || fields[key].trim().length < 12 || placeholders.test(fields[key])) return null;
  }
  return {...plan, talkingDurationSec: 5, brollDurationSec: 3, demoDurationSec: 7};
}
