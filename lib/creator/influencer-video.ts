import type { EstudioInfluencer } from "@/lib/creator/estudio-v1";

const REF_ORDER = [
  "face-front",
  "face-three-quarter",
  "waist-up",
  "full-front",
  "full-three-quarter",
  "over-shoulder",
] as const;

const MOTION_BODY_ORDER = [
  "full-front",
  "waist-up",
  "full-three-quarter",
  "over-shoulder",
] as const;

const MOTION_FACE_ORDER = ["face-front", "face-three-quarter"] as const;

export function influencerVideoReferenceUrl(
  item: Pick<EstudioInfluencer, "images">
): string | null {
  return influencerVideoRefUrls(item)[0] ?? null;
}

export function influencerVideoRefUrls(
  item: Pick<EstudioInfluencer, "images">
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of REF_ORDER) {
    const url = item.images.find((s) => s.id === id && s.imageUrl)?.imageUrl;
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  for (const shot of item.images) {
    const url = shot.imageUrl;
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out.slice(0, 6);
}

export function influencerMotionRefs(item: Pick<EstudioInfluencer, "images">): {
  bodyUrl: string | null;
  faceUrl: string | null;
  extraFaceUrls: string[];
} {
  const shotUrl = (id: string) =>
    item.images.find((s) => s.id === id && s.imageUrl)?.imageUrl || null;
  const bodyUrl =
    MOTION_BODY_ORDER.map(shotUrl).find(Boolean) ||
    influencerVideoRefUrls(item)[0] ||
    null;
  const faceUrl = MOTION_FACE_ORDER.map(shotUrl).find(Boolean) || null;
  const extraFaceUrls = MOTION_FACE_ORDER.map(shotUrl).filter(
    (url): url is string => Boolean(url && url !== faceUrl)
  );
  return { bodyUrl, faceUrl, extraFaceUrls };
}

export function influencerStartFramePrompt(opts: {
  name: string;
  traits?: string;
  action?: string;
  extra?: string;
  script?: string;
  speak?: boolean;
  matchVideo?: boolean;
}): string {
  const who = clip(opts.name, 60) || "this person";
  const look = clip(opts.traits || "", 400);
  const action = clip(opts.action || "", 420);
  const extra = clip(opts.extra || "", 220);
  const script = clip(opts.script || "", 420);
  if (opts.matchVideo) {
    return [
      `The last image(s) are stills from the FIRST MOMENT of a reference video. Copy that pose, body orientation, camera distance, framing, lighting, and setting as closely as possible.`,
      `The other photos are identity references of ONE real person named ${who}.`,
      look ? `Look notes: ${look}` : "",
      `Generate a brand-new photorealistic 9:16 vertical still of THIS person in that exact first moment of the video.`,
      `Replace only the person. Do not copy the video subject's face, body, age, hair, or clothing. Keep THIS person's identity from the identity photos.`,
      `Do not collage or grid. Do not copy any identity photo as the output.`,
      extra ? `If the video still has a clear setting, keep it. Otherwise: ${extra}.` : "",
      `Photorealistic iPhone photo, natural skin texture, no extra people, text, logos, or watermarks.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  const scene =
    opts.speak === false
      ? action || script
        ? `${who} in a natural silent moment: ${action || script}. Mouth closed, not talking, occupied with what they are doing`
        : `${who} in a real everyday silent moment, occupied with what they are doing, not posing, not talking`
      : script
        ? `${who} in a natural moment that matches this spoken line: ${script}`
        : `${who} in a real everyday moment, occupied with what they are doing, not posing`;
  const structure = action
    ? `Video structure (camera, pacing, energy — a guide, not a different person): ${action}. Apply this structure to THIS person. Do not copy another face, body, outfit, or identity from a reference clip.`
    : "";
  const place = extra
    ? `Setting/atmosphere: ${extra}. Infer a plausible location and lighting. Do not copy another person's look.`
    : `Infer a plausible location, lighting, camera angle, and background for the scene. Replace the reference background if it does not match.`;
  return [
    `These photos are identity references of ONE real person named ${who}.`,
    look ? `Look notes: ${look}` : "",
    `Do not collage, grid, or combine the photos. Do not copy any reference as the output. Generate a brand-new photorealistic still of this exact person.`,
    `IMPORTANT ABOUT POSE AND CAMERA: The person does NOT need to look at the camera or show their face front-on. Their gaze, head, and body must be oriented naturally toward what they are doing. They may appear in profile, three-quarter, looking down, looking at a screen, partly from behind, or with part of the face out of frame if that is natural for the scene. Do not artificially turn the head toward the camera to show identity. The photo should feel like an everyday moment captured spontaneously by someone else or by a phone set down nearby.`,
    `Generate a brand-new 9:16 vertical iPhone still of THIS person: "${scene}"`,
    structure,
    `Keep identity locked to the photos. Structure may change camera distance, energy, and activity type, but never replace who they are.`,
    place,
    `Vary the framing naturally: the person does not have to be centered, and the face does not have to be the focal point. Allow imperfect compositions typical of casual phone-recorded content.`,
    `Keep the exact face, hair, age, and identity from the references when they are visible, without forcing the face to be frontal or fully exposed.`,
    `Photorealistic iPhone photo, natural skin texture, everyday lighting, spontaneous composition, no photoshoot look, no influencer pose, no forced eye contact with the camera, no extra people, text, logos, or watermarks.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export const FAL_KLING_PROMPT_MAX = 2500;

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  if (max < 2) return "";
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function isKlingPromptError(error: string | null | undefined): boolean {
  const t = (error || "").toLowerCase();
  return (
    t.includes("2500") ||
    t.includes("at most 2500") ||
    (t.includes("string should have") && t.includes("character"))
  );
}

/** Jobs still generating cannot be removed; failed and finished videos can. */
export function canDeleteInfluencerVideo(job: {
  status?: string | null;
  error?: string | null;
  providerStatus?: string | null;
}): boolean {
  const s = (job.status || "").toLowerCase();
  const fal = (job.providerStatus || "").toUpperCase();
  if (job.error) return true;
  if (fal === "GENERATING_FRAME") return false;
  return s !== "in_progress" && s !== "saving" && s !== "composing";
}

export function clipKlingPrompt(prompt: string): string {
  return clip(prompt, FAL_KLING_PROMPT_MAX);
}

/** Split bulk scripts by `;`, ignoring semicolons inside `[overlay]`. */
export function splitInfluencerScripts(raw: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of raw) {
    if (ch === "[") depth += 1;
    else if (ch === "]" && depth > 0) depth -= 1;
    if (ch === ";" && depth === 0) {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const t = buf.trim();
  if (t) parts.push(t);
  return parts.slice(0, 20);
}

/** Spoken line vs on-screen `[caption]`. The caption is never sent to Kling. */
export function parseInfluencerScript(raw: string): {
  spoken: string;
  overlay: string;
} {
  const overlays: string[] = [];
  const spoken = raw
    .replace(/\[([^[\]]*)\]/g, (_, inner: string) => {
      const t = String(inner || "").trim();
      if (t) overlays.push(t);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  const overlay = overlays.join(" · ").replace(/\s+/g, " ").trim().slice(0, 140);
  return {
    spoken: spoken || overlay,
    overlay,
  };
}

export function formatScriptWithOverlay(spoken: string, overlay?: string | null) {
  const line = spoken.trim();
  const cap = (overlay || "").trim();
  return cap ? `${line} [${cap}]` : line;
}

function klingSpokenLine(
  language?: "es" | "en",
  klingVoice?: "en" | "translated"
): string {
  if (klingVoice === "en") {
    return "They speak English naturally. For English speech use lowercase letters; acronyms or proper nouns in uppercase.";
  }
  if (klingVoice === "translated") {
    return "Deliver the script as written for lip motion and intent. Do not require Spanish spoken audio: Kling native voice is Chinese or English, and other languages may be auto-translated to English.";
  }
  const spoken = language === "en" ? "English" : "Spanish";
  return `They speak ${spoken} naturally.`;
}

export function influencerIphoneVideoPrompt(opts: {
  name: string;
  traits?: string;
  script: string;
  product: string;
  language?: "es" | "en";
  action?: string;
  extra?: string;
  /**
   * Kling 3.0 Pro native audio is Chinese/English; other languages are
   * auto-translated to English. V1 omits this and keeps the old line.
   */
  klingVoice?: "en" | "translated";
}): string {
  const who = clip(opts.name, 60) || "this person";
  const script = clip(opts.script, 700);
  const action = clip(opts.action || "", 360);
  const extra = clip(opts.extra || "", 200);
  const head = [
    `Photorealistic handheld iPhone vertical video (9:16) of ${who}, the exact person in the first-frame still.`,
    `Looks like a real iPhone front-camera clip they recorded themselves: slight handheld shake, natural skin texture and pores, flyaway hair, imperfect indoor light, no beauty filter, no CGI, no plastic skin.`,
    action
      ? `Video structure (pacing, camera, energy). Keep THIS person's identity; do not copy another face or body: ${action}.`
      : `They talk to camera like a real TikTok, with natural mouth, eyes, and head motion matching the spoken audio.`,
    extra ? `Setting/atmosphere: ${extra}.` : "",
    klingSpokenLine(opts.language, opts.klingVoice),
  ]
    .filter(Boolean)
    .join(" ");
  const product = clip(opts.product || "", 900);
  const tail = product
    ? [
        `They are talking about: ${product}.`,
        `They deliver this script naturally: "${script}"`,
        `Keep identity locked to the first frame. Photorealistic. No extra people, on-screen text, logos, or watermarks.`,
      ]
    : [
        `Follow this direction exactly: "${script}"`,
        `Do not invent a product, brand, pitch, or other topic. Do not add lines they did not write.`,
        `Keep identity locked to the first frame. Photorealistic. No extra people, on-screen text, logos, or watermarks.`,
      ];
  return clip([head, ...tail].filter(Boolean).join(" "), FAL_KLING_PROMPT_MAX);
}

export function isSilentInfluencerPrompt(prompt?: string | null): boolean {
  const t = (prompt || "").toLowerCase();
  return (
    t.includes("action / b-roll") ||
    t.includes("not a talking-head") ||
    t.includes("do not invent spoken") ||
    t.includes("no dialogue")
  );
}

export function influencerClipPrompt(opts: {
  name: string;
  traits?: string;
  script: string;
  product: string;
  language?: "es" | "en";
  action?: string;
  extra?: string;
  speak?: boolean;
  klingVoice?: "en" | "translated";
}): string {
  if (opts.speak === false) {
    const visual = [opts.action, opts.script].filter(Boolean).join(". ");
    return influencerActionVideoPrompt({
      name: opts.name,
      traits: opts.traits,
      action: visual,
      extra: opts.extra,
      language: opts.language,
    });
  }
  return influencerIphoneVideoPrompt(opts);
}

export function influencerActionVideoPrompt(opts: {
  name: string;
  traits?: string;
  action: string;
  extra?: string;
  framing?: string;
  continuity?: string;
  language?: "es" | "en";
}): string {
  const who = clip(opts.name, 60) || "this person";
  const action = clip(opts.action || "", 420);
  const extra = clip(opts.extra || "", 180);
  const framing = clip(opts.framing || "", 120);
  const continuity = clip(opts.continuity || "", 280);
  const ambient = opts.language === "en" ? "natural ambient sound" : "sonido ambiente natural";
  return clip(
    [
      `Photorealistic handheld iPhone vertical B-roll (9:16) of ${who}, the exact person in the first-frame still.`,
      `This is ACTION / B-roll, not a talking-head ad. They are occupied with the activity, not pitching to camera.`,
      action ? `Action: ${action}.` : "",
      framing ? `Camera/framing: ${framing}.` : "",
      extra ? `Setting/details: ${extra}.` : "",
      continuity ? `Continuity (keep identical): ${continuity}.` : "",
      `IMPORTANT: Do not render a readable app UI, fake screenshot, invented product screen, or branded overlay on any phone. If a phone appears, keep the screen off, blurred, or facing away.`,
      `Looks like a real iPhone clip: slight handheld shake, natural skin, imperfect light, no beauty filter, no CGI.`,
      `They may be silent or only have ${ambient}. Do not invent spoken product lines.`,
      `Keep identity locked to the first frame. Photorealistic. No extra people, on-screen text, logos, or watermarks.`,
    ]
      .filter(Boolean)
      .join(" "),
    FAL_KLING_PROMPT_MAX
  );
}

export function influencerScriptsPrompt(opts: {
  name: string;
  traits: string;
  product: string;
  count: number;
  language?: "es" | "en";
  action?: string;
  extra?: string;
  durationSec?: number;
  withOverlay?: boolean;
  speak?: boolean;
}): string {
  const n = Math.min(20, Math.max(1, opts.count));
  const who = opts.name.trim() || "el influencer";
  const look = opts.traits.trim() || "creador UGC natural";
  const product = opts.product.trim() || "una app consumer";
  const seconds = Math.min(15, Math.max(3, Math.round(opts.durationSec || 10)));
  const action = opts.action?.trim();
  const extra = opts.extra?.trim();
  const lang =
    opts.language === "en"
      ? "English"
      : "español";
  const actionLine = action
    ? opts.language === "en"
      ? `Video structure (camera, pacing, beats — keep this character's identity, do not copy another person): ${action}.`
      : `Estructura del video (cámara, ritmo, beats). Mantén la identidad de este personaje; no copies a otra persona: ${action}.`
    : "";
  const extraLine = extra
    ? opts.language === "en"
      ? `Setting/atmosphere: ${extra}.`
      : `Ambiente: ${extra}.`
    : "";
  const overlayLine =
    opts.language === "en"
      ? opts.withOverlay
        ? `At the END of each item add ONE short on-screen caption in square brackets. It is NOT spoken. TikTok POV style, 4-8 words. Example: [Pov: you love jumping in puddles]`
        : `Do not use square brackets or on-screen captions.`
      : opts.withOverlay
        ? `Al FINAL de cada uno añade UN texto en pantalla entre corchetes. No se habla. Estilo TikTok POV, 4-8 palabras. Ejemplo: [Pov: te encanta saltar en los charcos]`
        : `No uses corchetes ni texto en pantalla.`;
  if (opts.speak === false) {
    if (opts.language === "en") {
      return `Write ${n} distinct SILENT visual beats in ${lang} for a vertical iPhone UGC video. The person does NOT speak. No dialogue, no lip-sync lines.
Character: ${who}. Look: ${look}.
Product/context: ${product}.
${actionLine}
${extraLine}
Each beat lasts about ${seconds} seconds: what they do, where they look, camera energy. Friend-shot, not an ad.
Do not number. Do not write spoken words except the optional bracket caption.
${overlayLine}
Reply ONLY JSON: {"scripts":["...","..."]}`;
    }
    return `Escribe ${n} beats visuales MUDOS, en ${lang}, para un video vertical UGC. La persona NO habla. Sin diálogo ni frases para lip-sync.
Personaje: ${who}. Look: ${look}.
Producto/contexto: ${product}.
${actionLine}
${extraLine}
Cada beat dura unos ${seconds} segundos: qué hace, a dónde mira, energía de cámara. Tono de amigo, no anuncio.
No numeres. No escribas palabras habladas salvo el texto opcional entre corchetes.
${overlayLine}
Responde SOLO JSON: {"scripts":["...","..."]}`;
  }
  if (opts.language === "en") {
    return `Write ${n} distinct spoken scripts in ${lang} for a vertical iPhone UGC video.
Character: ${who}. Look: ${look}.
Product/context: ${product}.
${actionLine}
${extraLine}
Each script lasts about ${seconds} seconds when spoken: strong hook in the first line, benefit or demo, soft CTA. Friend tone, not an ad.
Do not number. Do not add camera directions.
${overlayLine}
Reply ONLY JSON: {"scripts":["...","..."]}`;
  }
  return `Escribe ${n} guiones hablados distintos, en ${lang}, para un video vertical grabado con iPhone (UGC).
Personaje: ${who}. Look: ${look}.
Producto/contexto: ${product}.
${actionLine}
${extraLine}
Cada guion dura unos ${seconds} segundos al hablar: hook fuerte en la primera frase, demo o beneficio, CTA suave. Tono de amigo, no anuncio.
No numeres. No pongas acotaciones de cámara.
${overlayLine}
Responde SOLO JSON: {"scripts":["...","..."]}`;
}

export function influencerAppDemoScriptsPrompt(opts: {
  name: string;
  traits: string;
  product: string;
  count: number;
  language?: "es" | "en";
  action?: string;
  extra?: string;
  durationSec?: number;
  withOverlay?: boolean;
  speak?: boolean;
  variables: { key: string; type: string; value: string }[];
  codeSnippet?: string;
}): string {
  const n = Math.min(20, Math.max(1, opts.count));
  const who = opts.name.trim() || "el influencer";
  const look = opts.traits.trim() || "creador UGC natural";
  const product = opts.product.trim() || "una app consumer";
  const seconds = Math.min(15, Math.max(3, Math.round(opts.durationSec || 10)));
  const action = opts.action?.trim();
  const extra = opts.extra?.trim();
  const schema = opts.variables
    .map((v) =>
      v.type === "image"
        ? `- ${v.key} (image): keep the current photo URL, never invent one`
        : `- ${v.key} (${v.type}): ${clip(v.value, 80) || "(empty)"}`
    )
    .join("\n");
  const code = clip(opts.codeSnippet || "", 1600);
  const keys = opts.variables
    .filter((v) => v.type !== "image")
    .map((v) => v.key)
    .join(", ");

  if (opts.language === "en") {
    const part1 =
      opts.speak === false
        ? `1) The person is SILENT on camera for about ${seconds} seconds (no dialogue).`
        : `1) The person talks to camera for about ${seconds} seconds.`;
    const each =
      opts.speak === false
        ? `Each item: a silent visual beat, what the app does, invite them to look at the screen. Friend tone, not an ad. Do not describe pixels or layouts. Do not write spoken lines except the optional bracket caption.`
        : `Each spoken script: strong hook, what the app does, invite them to look at the screen, soft CTA. Friend tone, not an ad. Do not describe pixels or layouts.`;
    return `Write ${n} distinct ${opts.speak === false ? "silent visual beats" : "spoken scripts"} in English for a vertical UGC video that has TWO parts:
${part1}
2) Then a silent in-app demo plays, driven by the variables below.

Character: ${who}. Look: ${look}.
Product/context: ${product}.
${action ? `Video structure (camera, pacing — keep this character, do not copy another person): ${action}.` : ""}
${extra ? `Setting/atmosphere: ${extra}.` : ""}

App demo variables (ONLY these keys, keep types, do not add keys, do not invent image URLs):
${schema || "(none)"}
${code ? `Demo composition (excerpt):\n${code}` : ""}

${each}
${
  opts.withOverlay
    ? `At the END of each item add ONE short on-screen caption in square brackets. It is NOT spoken. TikTok POV style, 4-8 words. Example: [Pov: this app actually gets it]`
    : `Do not use square brackets or on-screen captions.`
}
Fill variables so the demo matches THIS product (name, copy, CTA, colors).
Reply ONLY JSON:
{"items":[{"script":"...","variables":{${keys ? `"${opts.variables.find((v) => v.type !== "image")?.key || "appName"}":"..."` : ""}}}]}`;
  }

  const part1Es =
    opts.speak === false
      ? `1) La persona está MUDA a cámara unos ${seconds} segundos (sin diálogo).`
      : `1) La persona habla a cámara unos ${seconds} segundos.`;
  const eachEs =
    opts.speak === false
      ? `Cada item: un beat visual mudo, qué hace la app, invita a mirar la pantalla. Tono de amigo, no anuncio. No describas píxeles ni layouts. No escribas frases habladas salvo el texto opcional entre corchetes.`
      : `Cada guion: hook fuerte, qué hace la app, invita a mirar la pantalla, CTA suave. Tono de amigo, no anuncio. No describas píxeles ni layouts.`;
  return `Escribe ${n} ${opts.speak === false ? "beats visuales mudos" : "guiones hablados"} distintos, en español, para un video vertical UGC de DOS partes:
${part1Es}
2) Después se ve una demo muda de la app, controlada por las variables de abajo.

Personaje: ${who}. Look: ${look}.
Producto/contexto: ${product}.
${action ? `Estructura del video (cámara, ritmo). Mantén la identidad de este personaje; no copies a otra persona: ${action}.` : ""}
${extra ? `Ambiente: ${extra}.` : ""}

Variables de la demo (SOLO estas keys, respeta el tipo, no inventes keys ni URLs de foto):
${schema || "(ninguna)"}
${code ? `Composición de la demo (extracto):\n${code}` : ""}

${eachEs}
${
  opts.withOverlay
    ? `Al FINAL de cada uno añade UN texto en pantalla entre corchetes. No se habla. Estilo TikTok POV, 4-8 palabras. Ejemplo: [Pov: esta app sí lo pilla]`
    : `No uses corchetes ni texto en pantalla.`
}
Rellena las variables para que la demo coincida con ESTE producto (nombre, copy, CTA, colores).
Responde SOLO JSON:
{"items":[{"script":"...","variables":{${keys ? `"${opts.variables.find((v) => v.type !== "image")?.key || "appName"}":"..."` : ""}}}]}`;
}

export function parseAppDemoScriptItems(
  text: string,
  count: number
): { script: string; variables: Record<string, unknown> }[] {
  const n = Math.min(20, Math.max(1, count));
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const take = (raw: unknown): { script: string; variables: Record<string, unknown> }[] => {
    if (!raw || typeof raw !== "object") return [];
    const o = raw as Record<string, unknown>;
    const items = Array.isArray(o.items) ? o.items : [];
    const fromItems = items
      .map((item) => {
        if (typeof item === "string") {
          const script = item.trim();
          return script.length >= 8
            ? { script, variables: {} as Record<string, unknown> }
            : null;
        }
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const script =
          typeof row.script === "string"
            ? row.script.trim()
            : typeof row.text === "string"
              ? row.text.trim()
              : "";
        if (script.length < 8) return null;
        const variables =
          row.variables &&
          typeof row.variables === "object" &&
          !Array.isArray(row.variables)
            ? (row.variables as Record<string, unknown>)
            : {};
        return { script, variables };
      })
      .filter((v): v is { script: string; variables: Record<string, unknown> } =>
        Boolean(v)
      );
    if (fromItems.length) return fromItems.slice(0, n);
    const scripts = Array.isArray(o.scripts) ? o.scripts : [];
    return scripts
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length >= 8)
      .slice(0, n)
      .map((script) => ({ script, variables: {} as Record<string, unknown> }));
  };
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const items = take(parsed);
    if (items.length) return items;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const items = take(JSON.parse(cleaned.slice(start, end + 1)));
        if (items.length) return items;
      } catch {
        /* fall through */
      }
    }
  }
  return parseScriptList(text, n).map((script) => ({ script, variables: {} }));
}

export function parseScriptList(text: string, count: number): string[] {
  const n = Math.min(20, Math.max(1, count));
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as { scripts?: unknown };
    const list = Array.isArray(parsed.scripts) ? parsed.scripts : [];
    const scripts = list
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length >= 8);
    if (scripts.length) return scripts.slice(0, n);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
          scripts?: unknown;
        };
        const list = Array.isArray(parsed.scripts) ? parsed.scripts : [];
        const scripts = list
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter((s) => s.length >= 8);
        if (scripts.length) return scripts.slice(0, n);
      } catch {
        /* fall through */
      }
    }
  }
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^\d+[.)-]\s*/, "").trim())
    .filter((s) => s.length >= 8)
    .slice(0, n);
}
