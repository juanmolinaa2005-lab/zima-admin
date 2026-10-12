import { openaiChatJson } from "@/lib/openai/chat";
import type { ContentIdea, IdeaFormat } from "./types";

export { FORMAT_LABEL, type ContentIdea, type IdeaFormat } from "./types";

export type NewIdea = Omit<ContentIdea, "id" | "status" | "created_at">;

export type IdeaContext = {
  name: string;
  pitch: string;
  description: string;
  genre: string;
  type: "app" | "web";
  audience: string | null;
  face: string | null;
  platforms: string[];
  hits: { title: string; views: number }[];
  recentHooks: string[];
};

const APP_FORMATS: IdeaFormat[] = ["slideshow", "pov", "reaction", "listicle", "talking"];
const WEB_B2C_FORMATS: IdeaFormat[] = ["demo", "slideshow", "pov", "talking"];
const WEB_B2B_FORMATS: IdeaFormat[] = ["founder-post", "demo", "founder-post", "talking"];

export function formatsFor(ctx: IdeaContext): IdeaFormat[] {
  if (ctx.type === "app") return APP_FORMATS;
  return ctx.audience === "b2b" || ctx.audience === "dev" ? WEB_B2B_FORMATS : WEB_B2C_FORMATS;
}

function detectLang(text: string): "es" | "en" {
  const t = ` ${text.toLowerCase()} `;
  const en = (t.match(/ (the|and|your|with|you|to|of|for) /g) ?? []).length;
  const es = (t.match(/ (el|la|los|tu|con|para|de|que|una|y) /g) ?? []).length;
  return en > es ? "en" : "es";
}

function benefitOf(pitch: string, name: string): string {
  const clean = pitch.replace(/[.!…]+$/, "").trim();
  if (!clean) return name;
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function tag(text: string) {
  return `#${text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")}`;
}

type Tpl = (v: { name: string; benefit: string; genre: string }) => string;

const HOOKS: Record<"es" | "en", { app: Tpl[]; web: Tpl[]; founder: Tpl[] }> = {
  es: {
    app: [
      (v) => `POV: descubres una app que ${v.benefit}`,
      () => `Ojalá alguien me hubiera enseñado esta app antes`,
      () => `La app que uso en secreto y nadie conoce`,
      () => `3 apps que parecen ilegales de lo útiles que son`,
      (v) => `Mi amiga no se creía que una app ${v.benefit}`,
      (v) => `Probé ${v.name} 7 días. Esto pasó`,
      (v) => `Nadie habla de esta app de ${v.genre.toLowerCase()}`,
      (v) => `Borra todas tus apps de ${v.genre.toLowerCase()} y descarga esta`,
      (v) => `Cosas que hago distinto desde que uso ${v.name}`,
      () => `Esto es lo que hago cuando no tengo tiempo para nada`,
    ],
    web: [
      () => `Llevo meses haciendo esto a mano. Ahora tardo 2 minutos`,
      (v) => `La herramienta que ${v.benefit}`,
      () => `Deja de pagar por 5 herramientas: usa esta`,
      (v) => `Así es como ${v.benefit} sin complicarte`,
      (v) => `Probé ${v.name} una semana. Mi opinión honesta`,
      () => `El truco que usan los equipos pequeños para ir más rápido`,
    ],
    founder: [
      (v) => `Hace unos meses lancé ${v.name}. Esto es lo que nadie te cuenta`,
      (v) => `El error que casi mata ${v.name}`,
      (v) => `Construí ${v.name} porque estaba harto de un problema`,
      () => `Nuestros primeros clientes llegaron así (no fue con anuncios)`,
      (v) => `Lo que aprendí hablando con 50 usuarios de ${v.name}`,
    ],
  },
  en: {
    app: [
      (v) => `POV: you find an app that ${v.benefit}`,
      () => `I wish someone told me about this app sooner`,
      () => `The app I use in secret that nobody knows about`,
      () => `3 apps that feel illegal to know about`,
      (v) => `My friend didn't believe an app could ${v.benefit}`,
      (v) => `I tried ${v.name} for 7 days. Here's what happened`,
      (v) => `Nobody talks about this ${v.genre.toLowerCase()} app`,
      (v) => `Delete your ${v.genre.toLowerCase()} apps and get this one`,
      (v) => `Things I do differently since I started using ${v.name}`,
      () => `What I do when I have zero time`,
    ],
    web: [
      () => `I did this by hand for months. Now it takes 2 minutes`,
      (v) => `The tool that ${v.benefit}`,
      () => `Stop paying for 5 tools. Use this one`,
      (v) => `How to ${v.benefit} without the headache`,
      (v) => `I tried ${v.name} for a week. Honest review`,
      () => `The trick small teams use to move faster`,
    ],
    founder: [
      (v) => `A few months ago I launched ${v.name}. Here's what nobody tells you`,
      (v) => `The mistake that almost killed ${v.name}`,
      (v) => `I built ${v.name} because I was tired of one problem`,
      () => `Our first customers came from here (not ads)`,
      (v) => `What I learned talking to 50 ${v.name} users`,
    ],
  },
};

const BEATS: Record<"es" | "en", Record<IdeaFormat, (name: string) => string[]>> = {
  es: {
    slideshow: (n) => [
      "Slide 1: el gancho en texto grande sobre una foto llamativa",
      "Slides 2–4: el problema contado en primera persona, una frase por slide",
      `Slide 5: captura de ${n} resolviéndolo`,
      `Última: “Se llama ${n}” y que lo busquen en la App Store`,
    ],
    pov: (n) => [
      "0–2 s: el gancho escrito en pantalla",
      "2–6 s: cara de sorpresa o reacción",
      `6–15 s: grabación de pantalla de ${n} haciendo lo principal`,
      "Final: el resultado y “link en la bio”",
    ],
    reaction: (n) => [
      "0–2 s: el gancho y una cara de incredulidad",
      `2–12 s: pantalla de ${n} en una esquina, reacción en grande`,
      "12–18 s: muestra el resultado concreto",
      "Final: pregunta a la audiencia para generar comentarios",
    ],
    talking: (n) => [
      "0–2 s: mira a cámara y di el gancho sin saludar",
      "2–10 s: cuenta el problema como si se lo dijeras a un amigo",
      `10–20 s: enseña ${n} en el móvil`,
      "Final: una frase con el resultado",
    ],
    listicle: (n) => [
      "0–2 s: el gancho con “la 3 es la mejor”",
      "App 1 y 2: apps conocidas de otras categorías, 3 s cada una",
      `App 3: ${n}, más tiempo y con demo`,
      "Final: “guárdalo para luego”",
    ],
    "founder-post": (n) => [
      "Primera línea: el gancho, sin emojis",
      "3–5 líneas cortas con la historia y una cifra real",
      `Qué hace ${n} y para quién, en una frase`,
      "Cierre con una pregunta para generar comentarios",
    ],
    demo: (n) => [
      "0–2 s: el resultado final primero",
      `2–15 s: cómo se consigue con ${n}, en 3 pasos rápidos`,
      "15–20 s: comparación con hacerlo a mano",
      "Final: dónde probarlo gratis",
    ],
  },
  en: {
    slideshow: (n) => [
      "Slide 1: the hook in big text over an eye-catching photo",
      "Slides 2–4: the problem told in first person, one line per slide",
      `Slide 5: a screenshot of ${n} solving it`,
      `Last: “It's called ${n}”, search it on the App Store`,
    ],
    pov: (n) => [
      "0–2s: the hook written on screen",
      "2–6s: surprised face or reaction",
      `6–15s: screen recording of ${n} doing the main thing`,
      "End: the result and “link in bio”",
    ],
    reaction: (n) => [
      "0–2s: the hook and a disbelief face",
      `2–12s: ${n} on screen in a corner, big reaction`,
      "12–18s: show the concrete result",
      "End: ask the audience a question to drive comments",
    ],
    talking: (n) => [
      "0–2s: look at the camera and say the hook, no greeting",
      "2–10s: tell the problem like you'd tell a friend",
      `10–20s: show ${n} on your phone`,
      "End: one line with the result",
    ],
    listicle: (n) => [
      "0–2s: the hook with “number 3 is the best”",
      "Apps 1 and 2: well-known apps from other categories, 3s each",
      `App 3: ${n}, longer and with a demo`,
      "End: “save this for later”",
    ],
    "founder-post": (n) => [
      "First line: the hook, no emojis",
      "3–5 short lines with the story and a real number",
      `What ${n} does and who it's for, in one sentence`,
      "Close with a question to drive comments",
    ],
    demo: (n) => [
      "0–2s: show the end result first",
      `2–15s: how to get it with ${n}, in 3 quick steps`,
      "15–20s: compare with doing it by hand",
      "End: where to try it for free",
    ],
  },
};

function platformFor(format: IdeaFormat, platforms: string[], i: number): string | null {
  if (format === "founder-post") return platforms.find((p) => p === "linkedin" || p === "x") ?? "linkedin";
  const video = platforms.filter((p) => p === "tiktok" || p === "instagram" || p === "youtube");
  if (video.length) return video[i % video.length];
  return platforms[0] ?? "tiktok";
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function templateIdeas(ctx: IdeaContext, count: number, variantOf?: string): NewIdea[] {
  const lang = detectLang(`${ctx.pitch} ${ctx.description}`);
  const vars = { name: ctx.name, benefit: benefitOf(ctx.pitch, ctx.name), genre: ctx.genre || (lang === "en" ? "productivity" : "productividad") };
  const formats = formatsFor(ctx);
  const used = new Set(ctx.recentHooks.map((h) => h.toLowerCase()));
  const pools = HOOKS[lang];
  const out: NewIdea[] = [];
  const usableBenefit = vars.benefit.length <= 55 && !/^(if|si|we|our|the|nosotros|el|la|los|las)\b/i.test(vars.benefit);
  const freshFrom = (pool: Tpl[]) => {
    const fits = pool.filter((t) => usableBenefit || !t({ ...vars, benefit: "\u0000" }).includes("\u0000"));
    const all = shuffle(fits.map((t) => t(vars)));
    return all.filter((h) => !used.has(h.toLowerCase())).concat(all);
  };
  const appOrWeb = freshFrom(ctx.type === "app" ? pools.app : pools.web);
  const founder = freshFrom(pools.founder);
  for (let i = 0; i < count; i++) {
    const format = formats[i % formats.length];
    const hook = (format === "founder-post" ? founder : appOrWeb).shift() ?? vars.name;
    used.add(hook.toLowerCase());
    const platform = platformFor(format, ctx.platforms, i);
    out.push({
      format,
      platform,
      hook,
      beats: variantOf
        ? [lang === "en" ? `Same format and length as “${variantOf}”` : `Mismo formato y duración que “${variantOf}”`, ...BEATS[lang][format](ctx.name).slice(1)]
        : BEATS[lang][format](ctx.name),
      caption: format === "founder-post" ? null : `${hook} ${lang === "en" ? "👀 app in bio" : "👀 app en la bio"}`,
      hashtags: format === "founder-post" ? [] : [tag(ctx.name), tag(vars.genre), lang === "en" ? "#appsyouneed" : "#appsquenecesitas", "#fyp"],
      source: "template",
      variant_of: variantOf ?? null,
    });
  }
  return out;
}

type AiIdea = { format?: string; platform?: string; hook?: string; beats?: unknown; caption?: string; hashtags?: unknown };

export async function aiIdeas(apiKey: string, ctx: IdeaContext, count: number, variantOf?: string): Promise<NewIdea[]> {
  const formats = formatsFor(ctx);
  const system = `Eres el estratega de contenido de una startup. Escribes ideas de contenido orgánico que consiguen vistas y descargas con el método actual: muchos videos cortos, ganchos fuertes en los 2 primeros segundos, formatos probados (slideshows, POV + demo, reacción, listas de apps, a cámara) y, para B2B, posts del fundador en LinkedIn/X.
Reglas:
- Escribe en el idioma de la descripción del producto.
- El gancho: máximo 12 palabras, concreto, sin hashtags ni emojis, que genere curiosidad.
- 3–5 "beats": pasos de grabación con tiempos o slides, muy concretos.
- Nunca repitas un gancho de la lista "ya usados".
- Formatos permitidos: ${formats.join(", ")}.
Devuelve JSON: {"ideas":[{"format":"...","platform":"tiktok|instagram|youtube|linkedin|x","hook":"...","beats":["..."],"caption":"...","hashtags":["#..."]}]}`;
  const user = [
    `Producto: ${ctx.name} (${ctx.type === "app" ? "app móvil" : "producto web"}${ctx.genre ? `, ${ctx.genre}` : ""})`,
    `Qué hace: ${ctx.pitch}`,
    ctx.description ? `Descripción: ${ctx.description.slice(0, 1200)}` : "",
    ctx.audience ? `Vende a: ${ctx.audience}` : "",
    ctx.face ? `Quién sale en los videos: ${ctx.face}` : "",
    `Plataformas: ${ctx.platforms.join(", ") || "tiktok, instagram"}`,
    ctx.hits.length ? `Sus videos que mejor han funcionado:\n${ctx.hits.map((h) => `- "${h.title}" (${h.views} vistas)`).join("\n")}` : "",
    ctx.recentHooks.length ? `Ganchos ya usados:\n${ctx.recentHooks.slice(0, 30).map((h) => `- ${h}`).join("\n")}` : "",
    variantOf
      ? `Escribe ${count} variantes del video "${variantOf}": mismo formato y estructura, cambia solo el gancho.`
      : `Escribe ${count} ideas distintas entre sí.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await openaiChatJson<{ ideas?: AiIdea[] }>(apiKey, { model: "gpt-4o-mini", system, user, temperature: 0.9, maxTokens: 2500 });
  const allowed = new Set<string>(formats);
  return (res.ideas ?? [])
    .filter((i) => typeof i.hook === "string" && i.hook.trim())
    .slice(0, count)
    .map((i, n) => {
      const format = (allowed.has(i.format ?? "") ? i.format : formats[n % formats.length]) as IdeaFormat;
      return {
        format,
        platform: typeof i.platform === "string" ? i.platform.slice(0, 20) : platformFor(format, ctx.platforms, n),
        hook: i.hook!.trim().slice(0, 300),
        beats: Array.isArray(i.beats) ? i.beats.filter((b): b is string => typeof b === "string").map((b) => b.slice(0, 300)).slice(0, 6) : [],
        caption: typeof i.caption === "string" ? i.caption.slice(0, 600) : null,
        hashtags: Array.isArray(i.hashtags) ? i.hashtags.filter((h): h is string => typeof h === "string").map((h) => h.slice(0, 40)).slice(0, 8) : [],
        source: "ai" as const,
        variant_of: variantOf ?? null,
      };
    });
}
