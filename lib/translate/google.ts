export type TranslateResult = {
  translatedText: string;
  detectedSourceLanguage: string | null;
};

const MAX_CHUNK = 4500;

function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= MAX_CHUNK) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", MAX_CHUNK);
    if (cut < MAX_CHUNK * 0.5) cut = rest.lastIndexOf(" ", MAX_CHUNK);
    if (cut < MAX_CHUNK * 0.5) cut = MAX_CHUNK;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return chunks;
}

/** Official Cloud Translation API v2 when GOOGLE_TRANSLATE_API_KEY is set. */
async function translateWithApiKey(
  text: string,
  target: string,
  apiKey: string
): Promise<TranslateResult> {
  const chunks = chunkText(text);
  const translated: string[] = [];
  let detected: string | null = null;

  for (const chunk of chunks) {
    const url = new URL(
      "https://translation.googleapis.com/language/translate/v2"
    );
    url.searchParams.set("key", apiKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: chunk,
        target,
        format: "text",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Translate API: ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      data?: {
        translations?: {
          translatedText: string;
          detectedSourceLanguage?: string;
        }[];
      };
    };
    const t = data.data?.translations?.[0];
    if (!t?.translatedText) throw new Error("Respuesta vacía de Google Translate");
    translated.push(t.translatedText);
    if (t.detectedSourceLanguage) detected = t.detectedSourceLanguage;
  }

  return {
    translatedText: translated.join(""),
    detectedSourceLanguage: detected,
  };
}

/**
 * Fallback público de Google (client=gtx).
 * Útil si aún no hay API key; puede ser inestable.
 */
async function translateWithGtx(
  text: string,
  target: string
): Promise<TranslateResult> {
  const chunks = chunkText(text);
  const translated: string[] = [];
  let detected: string | null = null;

  for (const chunk of chunks) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", chunk);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Google Translate no disponible (${res.status})`);
    }
    const data = (await res.json()) as unknown[];
    const parts = data[0] as [string, string][] | undefined;
    if (!parts?.length) throw new Error("Respuesta vacía de Google Translate");
    translated.push(parts.map((p) => p[0]).join(""));
    if (typeof data[2] === "string") detected = data[2];
  }

  return {
    translatedText: translated.join(""),
    detectedSourceLanguage: detected,
  };
}

export async function translateText(
  text: string,
  target = "es"
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { translatedText: "", detectedSourceLanguage: null };
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (apiKey) {
    return translateWithApiKey(trimmed, target, apiKey);
  }
  return translateWithGtx(trimmed, target);
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const SPANISH_LIKE = new Set(["es", "es-es", "es-mx", "es-ar", "es-419"]);

export function isLikelySpanish(lang: string | null): boolean {
  if (!lang) return false;
  return SPANISH_LIKE.has(lang.toLowerCase());
}
