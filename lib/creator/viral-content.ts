export type ViralPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "other";

export type ViralHit = {
  name: string;
  structure: string;
  why: string;
  hooks: string[];
  sourceUrl: string | null;
  videoUrl: string | null;
  videoNote: string;
  videoDescription: string;
  howToUse: string;
  platform: ViralPlatform;
};

export type ViralResult = {
  report: string;
  items: ViralHit[];
};

export function formatViralDate(date = new Date()): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatViralMonthYear(date = new Date()): string {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function viralPrompt(date = new Date()): string {
  const full = formatViralDate(date);
  const monthYear = formatViralMonthYear(date);
  return `Investiga sobre todo en comunidades de X (Twitter) qué formatos de TikTok están funcionando ahora (${monthYear}) para apps móviles: views + descargas, no solo virales vacíos.
Quiero 10 formatos. Para cada uno usa exactamente esta ficha:
Nombre del formato
Estructura: [pasos claros, tipo: cara de shock → hook “cómo es legal esto” → demo 4–8 s de la UI → CTA suave]
Por qué convierte para apps:
Hooks listos (3):
Fuente de info: link de X (post o hilo)
Video de demostración: tiktok.com/... o x.com/... (si no hay video exacto, cuenta + hashtag + link)
Cómo usarlo para una app consumer (recordatorios, productividad, health, foto, etc.):
Reglas:
Prioriza X: founders de apps, UGC, growth, Spark Ads, CPI.
Complementa poco con web solo si el post de X apunta ahí.
Links reales. Si no existe el video, dilo. No inventes views ni URLs.
Español directo. Sin intro larga. Empieza por el formato 1.
Fecha de corte: ${full}.

Responde SOLO JSON válido con esta forma:
{"report":"el texto completo en español, empieza por el formato 1, las 10 fichas en prosa, sin intro larga","items":[{"name":"...","structure":"...","why":"...","hooks":["...","...","..."],"sourceUrl":"https://x.com/...","videoUrl":"https://www.tiktok.com/... o https://x.com/... o null","videoNote":"si no hay video exacto: cuenta + hashtag + link; si hay video, deja vacío","videoDescription":"qué se ve en el clip / de qué va el video","howToUse":"..."}]}`;
}

export function detectViralPlatform(url: string): ViralPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram")) return "instagram";
    if (host === "youtu.be" || host.includes("youtube")) return "youtube";
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com")) {
      return "x";
    }
  } catch {
    /* ignore */
  }
  return "other";
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/i);
    return m?.[2] || null;
  } catch {
    return null;
  }
}

function tiktokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m?.[1] || null;
}

function instagramCode(url: string): string | null {
  const m = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m?.[1] || null;
}

function tweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m?.[1] || null;
}

export function socialEmbed(url: string): {
  embedUrl: string;
  aspect: "9/16" | "16/9";
  poster: string | null;
} | null {
  const platform = detectViralPlatform(url);
  if (platform === "youtube") {
    const id = youtubeId(url);
    if (!id) return null;
    const shorts = /\/shorts\//i.test(url);
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`,
      aspect: shorts ? "9/16" : "16/9",
      poster: `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
    };
  }
  if (platform === "tiktok") {
    const id = tiktokId(url);
    if (!id) return null;
    return {
      embedUrl: `https://www.tiktok.com/embed/v2/${encodeURIComponent(id)}`,
      aspect: "9/16",
      poster: null,
    };
  }
  if (platform === "instagram") {
    const code = instagramCode(url);
    if (!code) return null;
    const kind = /\/reels?\//i.test(url) ? "reel" : "p";
    return {
      embedUrl: `https://www.instagram.com/${kind}/${encodeURIComponent(code)}/embed`,
      aspect: "9/16",
      poster: null,
    };
  }
  if (platform === "x") {
    const id = tweetId(url);
    if (!id) return null;
    return {
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(id)}&theme=light`,
      aspect: "9/16",
      poster: null,
    };
  }
  return null;
}

function asPlatform(raw: unknown, url: string): ViralPlatform {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    v === "tiktok" ||
    v === "instagram" ||
    v === "youtube" ||
    v === "x" ||
    v === "other"
  ) {
    return v;
  }
  if (v === "twitter") return "x";
  return detectViralPlatform(url);
}

function httpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function textField(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function hookList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((h) => (typeof h === "string" ? h.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function parseJsonBlob(text: string): unknown {
  const trimmed = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Grok no devolvió JSON");
  }
}

function mapItem(raw: unknown): ViralHit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const videoUrl =
    httpUrl(o.videoUrl) ||
    httpUrl(o.video_url) ||
    httpUrl(o.demoUrl) ||
    httpUrl(o.url);
  const sourceUrl =
    httpUrl(o.sourceUrl) ||
    httpUrl(o.source_url) ||
    httpUrl(o.source) ||
    httpUrl(o.xUrl);
  const name =
    textField(o.name) ||
    textField(o.title) ||
    textField(o.hook) ||
    "Formato";
  const media = videoUrl || sourceUrl;
  if (!name && !media) return null;
  return {
    name,
    structure: textField(o.structure) || textField(o.steps),
    why: textField(o.why) || textField(o.reason),
    hooks: hookList(o.hooks),
    sourceUrl,
    videoUrl,
    videoNote: textField(o.videoNote) || textField(o.video_note),
    videoDescription:
      textField(o.videoDescription) ||
      textField(o.video_description) ||
      textField(o.description),
    howToUse: textField(o.howToUse) || textField(o.how_to_use),
    platform: asPlatform(o.platform, media || ""),
  };
}

const URL_RE = /https?:\/\/[^\s)\]"'<>]+/gi;

export function parseViralResult(text: string): ViralResult {
  let report = "";
  const items: ViralHit[] = [];
  const seen = new Set<string>();

  const push = (hit: ViralHit | null) => {
    if (!hit) return;
    const key = (hit.videoUrl || hit.sourceUrl || hit.name)
      .replace(/\/+$/, "")
      .toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(hit);
  };

  try {
    const parsed = parseJsonBlob(text);
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      if (typeof o.report === "string") report = o.report.trim();
      const list = Array.isArray(o.items)
        ? o.items
        : Array.isArray(parsed)
          ? parsed
          : [];
      for (const item of list) push(mapItem(item));
    } else if (Array.isArray(parsed)) {
      for (const item of parsed) push(mapItem(item));
    }
  } catch {
    /* fall through */
  }

  if (items.length === 0) {
    const urls = text.match(URL_RE) ?? [];
    for (const raw of urls) {
      const url = httpUrl(raw.replace(/[.,;]+$/, ""));
      if (!url) continue;
      const platform = detectViralPlatform(url);
      if (platform === "other") continue;
      push({
        name: platform === "x" ? "Fuente en X" : "Video",
        structure: "",
        why: "",
        hooks: [],
        sourceUrl: platform === "x" ? url : null,
        videoUrl: platform === "x" ? null : url,
        videoNote: "",
        videoDescription: "",
        howToUse: "",
        platform,
      });
    }
  }

  if (!report) {
    const stripped = text
      .replace(/```(?:json)?[\s\S]*?```/g, "")
      .trim();
    report = stripped || text.trim();
  }

  return { report, items: items.slice(0, 12) };
}
