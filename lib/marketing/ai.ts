import { openaiChatJson } from "@/lib/openai/chat";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { CREATIVE_ANGLES } from "./types";

export type ProductContext = { name: string; description: string | null; brief?: string };

export type IdeaDraft = {
  title: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
  pillar: string;
  format: string;
};

export type CopyDraft = {
  name: string;
  angle: string;
  hook: string;
  primary_text: string;
  headline: string;
  cta: string;
};

function describe(ctx: ProductContext) {
  return [
    `Producto: ${ctx.name}`,
    ctx.description ? `Descripción: ${ctx.description}` : null,
    ctx.brief ? `Indicaciones extra: ${ctx.brief}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const pick = <T,>(list: readonly T[], i: number) => list[i % list.length];

function templateIdeas(ctx: ProductContext, count: number, platform: string): IdeaDraft[] {
  const p = ctx.name;
  const base: Omit<IdeaDraft, "hashtags" | "format">[] = [
    {
      pillar: "Educativo",
      title: `3 errores que comete todo el mundo antes de usar ${p}`,
      hook: "Si haces esto, estás perdiendo tiempo (y no lo sabes)",
      script: "1. Gancho con el error más común.\n2. Error 1, 2 y 3 en planos rápidos.\n3. Cómo lo resuelve el producto en 5 segundos.\n4. CTA: «Link en la bio».",
      caption: `Guárdalo para no cometerlos. ¿Cuál te ha pasado? 👇`,
    },
    {
      pillar: "Demostración",
      title: `${p} en 15 segundos`,
      hook: "Te enseño algo que te va a ahorrar horas",
      script: "1. Pantalla con el problema.\n2. Abrir el producto.\n3. Resultado final en cámara rápida.\n4. Reacción + CTA.",
      caption: "Así de rápido. Pruébalo gratis 🔗",
    },
    {
      pillar: "Historia",
      title: "Por qué empecé este proyecto",
      hook: "Nadie me creyó cuando dije que lo iba a hacer",
      script: "1. Momento de frustración (el problema real).\n2. La idea.\n3. Primer resultado.\n4. Dónde estamos hoy + invitación.",
      caption: "La historia detrás. Gracias a quienes estáis desde el día 1 🙏",
    },
    {
      pillar: "Prueba social",
      title: "Lo que dicen los usuarios",
      hook: "No esperaba que este mensaje me llegara hoy",
      script: "1. Captura de un mensaje/review real.\n2. Contexto del usuario.\n3. Qué consiguió.\n4. CTA suave.",
      caption: "Mensajes así son la razón de todo ❤️",
    },
    {
      pillar: "Tendencia",
      title: "POV: descubres la herramienta que lo cambia todo",
      hook: "POV: llevas meses haciéndolo a mano y…",
      script: "1. POV con audio en tendencia.\n2. Plano de sufrimiento.\n3. Corte al producto.\n4. Cara de alivio.",
      caption: "Dime que no te ha pasado 😅",
    },
    {
      pillar: "Comparación",
      title: `Antes vs después de ${p}`,
      hook: "Mira la diferencia",
      script: "1. Pantalla dividida: antes / después.\n2. Tiempo o resultado de cada lado.\n3. Conclusión en texto.\n4. CTA.",
      caption: "El cambio se nota. ¿Te animas?",
    },
  ];
  const tag = p.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return Array.from({ length: count }, (_, i) => ({
    ...pick(base, i),
    format: platform === "youtube" && i % 3 === 2 ? "long" : i % 4 === 3 ? "carousel" : "video",
    hashtags: [`#${tag || "marca"}`, "#tips", "#emprendimiento", platform === "tiktok" ? "#fyp" : "#reels"],
  }));
}

function templateCopies(ctx: ProductContext, count: number): CopyDraft[] {
  const p = ctx.name;
  const items: CopyDraft[] = [
    { name: "", angle: "Problema → solución", hook: "¿Sigues perdiendo horas en esto?", primary_text: `Deja de hacerlo a mano. ${p} lo resuelve en minutos para que te centres en lo importante.`, headline: `Prueba ${p} gratis`, cta: "Más información" },
    { name: "", angle: "Prueba social", hook: "Miles de personas ya lo usan cada día", primary_text: `Únete a quienes ya ahorran tiempo con ${p}. Valoraciones de 5 estrellas y resultados desde el primer día.`, headline: "Lo recomiendan miles", cta: "Descargar" },
    { name: "", angle: "Oferta / urgencia", hook: "Solo esta semana", primary_text: `Empieza hoy con ${p} y consigue tu primer resultado en menos de 10 minutos. Oferta por tiempo limitado.`, headline: "Oferta de lanzamiento", cta: "Comprar ahora" },
    { name: "", angle: "Curiosidad", hook: "Nadie te cuenta este truco", primary_text: `El método que usan los mejores, ahora en una app. Descubre por qué todos hablan de ${p}.`, headline: "Descubre el truco", cta: "Más información" },
    { name: "", angle: "Antes / después", hook: "De 2 horas a 5 minutos", primary_text: `Antes: tareas eternas. Después: ${p} lo hace por ti. Mira la diferencia tú mismo.`, headline: "Mira la diferencia", cta: "Probar gratis" },
    { name: "", angle: "Demostración", hook: "Mira cómo funciona en 10 segundos", primary_text: `Abre ${p}, toca un botón y listo. Así de simple.`, headline: "Así de fácil", cta: "Descargar" },
  ];
  return Array.from({ length: count }, (_, i) => {
    const c = pick(items, i);
    return { ...c, name: `${c.angle} · ${i + 1}` };
  });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function generateIdeas(
  ctx: ProductContext,
  opts: { count: number; platform: string },
): Promise<{ ideas: IdeaDraft[]; source: "ai" | "template" }> {
  const key = await getOpenAIApiKey().catch(() => null);
  if (!key) return { ideas: templateIdeas(ctx, opts.count, opts.platform), source: "template" };

  const raw = await openaiChatJson<{ ideas?: Record<string, unknown>[] }>(key, {
    model: "gpt-4o",
    temperature: 0.9,
    system:
      "Eres estratega de contenido orgánico para redes sociales. Escribes en español neutro, con ganchos fuertes de los primeros 2 segundos. Responde SOLO JSON.",
    user: `${describe(ctx)}\nPlataforma: ${opts.platform}\n\nGenera ${opts.count} ideas de contenido variadas (mezcla pilares: Educativo, Demostración, Historia, Prueba social, Tendencia, Comparación, Detrás de cámaras).\nDevuelve {"ideas":[{"title":"","pillar":"","format":"video|carousel|image|story|long|text","hook":"frase de gancho","script":"guion en pasos numerados, 4-6 líneas","caption":"","hashtags":["#a","#b"]}]}`,
  });

  const ideas = (raw.ideas ?? [])
    .map((i) => ({
      title: str(i.title, 200),
      pillar: str(i.pillar, 80),
      format: ["video", "carousel", "image", "story", "long", "text"].includes(String(i.format)) ? String(i.format) : "video",
      hook: str(i.hook, 300),
      script: str(i.script, 6000),
      caption: str(i.caption, 2200),
      hashtags: Array.isArray(i.hashtags) ? i.hashtags.map((h) => str(h, 60)).filter(Boolean).slice(0, 12) : [],
    }))
    .filter((i) => i.title)
    .slice(0, opts.count);
  return ideas.length ? { ideas, source: "ai" } : { ideas: templateIdeas(ctx, opts.count, opts.platform), source: "template" };
}

export async function generateCopies(
  ctx: ProductContext,
  opts: { count: number; platform: string; angle?: string },
): Promise<{ copies: CopyDraft[]; source: "ai" | "template" }> {
  const key = await getOpenAIApiKey().catch(() => null);
  if (!key) return { copies: templateCopies(ctx, opts.count), source: "template" };

  const angles = opts.angle ? opts.angle : CREATIVE_ANGLES.join(", ");
  const raw = await openaiChatJson<{ copies?: Record<string, unknown>[] }>(key, {
    model: "gpt-4o",
    temperature: 0.85,
    system:
      "Eres media buyer y copywriter de respuesta directa. Escribes anuncios en español que cumplen las políticas de la plataforma (sin promesas falsas ni datos inventados). Responde SOLO JSON.",
    user: `${describe(ctx)}\nPlataforma de anuncios: ${opts.platform}\nÁngulos a usar: ${angles}\n\nGenera ${opts.count} variantes de anuncio distintas para test A/B.\nDevuelve {"copies":[{"name":"nombre corto interno","angle":"","hook":"primera frase / primeros 3 segundos del video","primary_text":"texto principal, máx 280 caracteres","headline":"titular, máx 40 caracteres","cta":"Más información|Descargar|Comprar ahora|Registrarse|Probar gratis"}]}`,
  });

  const copies = (raw.copies ?? [])
    .map((c, i) => ({
      name: str(c.name, 160) || `Variante ${i + 1}`,
      angle: str(c.angle, 80),
      hook: str(c.hook, 300),
      primary_text: str(c.primary_text, 2000),
      headline: str(c.headline, 200),
      cta: str(c.cta, 60),
    }))
    .filter((c) => c.primary_text || c.hook)
    .slice(0, opts.count);
  return copies.length ? { copies, source: "ai" } : { copies: templateCopies(ctx, opts.count), source: "template" };
}
