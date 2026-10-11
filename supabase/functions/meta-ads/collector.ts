import type { AdCollection, AdSearchParams, MetaAd } from "../../../lib/market/meta-ad-types.ts";

export class CollectionError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const OFFICIAL_COUNTRIES = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB".split(" "));
const FIELDS = "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_creative_link_captions,ad_delivery_start_time,ad_delivery_stop_time,ad_creation_time,publisher_platforms,languages,eu_total_reach";
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown) => typeof v === "string" ? v : "";
const strings = (v: unknown) => [...new Set(list(v).map(str).filter(Boolean))];
const text = (v: unknown) => str(v) || str(obj(v).text);
const unique = (v: unknown[]) => [...new Set(v.map(text).filter((s) => s && !s.includes("{{")))];
function date(v: unknown) {
  if (!v) return null;
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(str(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function mediaUrl(value: unknown): string | null {
  try {
    const url = new URL(str(value));
    return url.protocol === "https:" && !url.username && !url.password &&
      /(^|\.)(fbcdn\.net|facebook\.com)$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function normalizePublicAd(value: unknown): MetaAd | null {
  const raw = obj(value);
  const id = str(raw.ad_archive_id);
  if (!/^\d+$/.test(id)) return null;
  const snapshot = obj(raw.snapshot);
  const cards = list(snapshot.cards).map(obj);
  const videos = [...list(snapshot.videos).map(obj), ...cards];
  const images = [...list(snapshot.images).map(obj), ...cards];
  const video = videos.map((v) => mediaUrl(v.video_hd_url) || mediaUrl(v.video_sd_url)).find(Boolean) ?? null;
  const image = (video ? videos.map((v) => mediaUrl(v.video_preview_image_url)).find(Boolean) : null)
    || images.map((v) => mediaUrl(v.original_image_url) || mediaUrl(v.resized_image_url)).find(Boolean) || null;
  const active = typeof raw.is_active === "boolean" ? raw.is_active : undefined;
  return {
    id, pageId: str(raw.page_id) || str(snapshot.page_id),
    pageName: str(raw.page_name) || str(snapshot.page_name),
    bodies: unique([snapshot.body, ...cards.map((c) => c.body)]),
    titles: unique([snapshot.title, ...cards.map((c) => c.title)]),
    descriptions: unique([snapshot.link_description, ...cards.map((c) => c.link_description)]),
    captions: unique([snapshot.caption, ...cards.map((c) => c.caption)]),
    startedAt: date(raw.start_date), stoppedAt: active === true ? null : date(raw.end_date), createdAt: null,
    platforms: strings(raw.publisher_platform), languages: strings(raw.languages), reach: null,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`, active,
    media: { video, image, avatar: mediaUrl(snapshot.page_profile_picture_url) },
  };
}

/** Read only embedded, public search results. Never execute page scripts or verification challenges. */
export function parsePublicPage(html: string): AdCollection {
  if (/__rd_verify|executeChallenge|id=["'](?:login_form|captcha[^"']*)["']/i.test(html)) {
    throw new CollectionError("PUBLIC_BLOCKED", "Meta pide una verificación para consultar esta región. La búsqueda automática no está disponible; puedes abrirla en Meta.");
  }
  const ads = new Map<string, MetaAd>();
  let foundConnection = false;
  let hasMore = false;
  let hadEdges = false;
  const walkAds = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 80) return;
    const ad = normalizePublicAd(value);
    if (ad) ads.set(ad.id, ad);
    for (const child of Object.values(value)) walkAds(child, depth + 1);
  };
  const walk = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 80) return;
    const connection = obj(obj(value).search_results_connection);
    if (Array.isArray(connection.edges)) {
      foundConnection = true;
      hadEdges ||= connection.edges.length > 0;
      hasMore ||= obj(connection.page_info).has_next_page === true;
      walkAds(connection.edges);
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  };
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = match[1].trim();
    if (!content.startsWith("{") && !content.startsWith("[")) continue;
    try { walk(JSON.parse(content)); } catch { /* Other script types are not data. */ }
  }
  if (!foundConnection) throw new CollectionError("PUBLIC_UNAVAILABLE", "Meta no ha entregado resultados públicos legibles. No podemos confirmar que no existan anuncios para esta búsqueda.");
  if (hadEdges && !ads.size) throw new CollectionError("PUBLIC_UNAVAILABLE", "El formato de los anuncios de Meta ha cambiado. No podemos confirmar los resultados de esta búsqueda.");
  // Public HTML is only a snapshot. No unsupported pagination parameters are invented.
  return { ads: [...ads.values()].slice(0, 100), after: null, source: "meta_public", partial: hasMore || ads.size > 100 };
}

export async function readBounded(response: Response, limit = 8_000_000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) throw new CollectionError("RESPONSE_TOO_LARGE", "La respuesta de Meta supera el tamaño permitido.");
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}

async function official(params: AdSearchParams, token: string, fetcher: typeof fetch): Promise<AdCollection> {
  if (!token) throw new CollectionError("META_TOKEN", "Falta configurar el acceso a Meta Ad Library API.");
  const url = new URL("https://graph.facebook.com/v21.0/ads_archive");
  url.search = new URLSearchParams({ ad_type: "ALL", fields: FIELDS, limit: "30",
    ad_reached_countries: JSON.stringify(params.countries), ad_active_status: params.active ? "ACTIVE" : "ALL",
    ...(params.pageId ? { search_page_ids: JSON.stringify([params.pageId]) } : { search_terms: params.q }),
    ...(params.after ? { after: params.after } : {}),
  }).toString();
  const res = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(18000) });
  const body = obj(JSON.parse(await readBounded(res)));
  if (!res.ok || body.error) {
    const code = obj(body.error).code;
    if (code === 190) throw new CollectionError("META_TOKEN", "El acceso de Meta ha caducado o no es válido. Renueva el token de la cuenta autorizada para Ad Library.");
    if (code === 10 || code === 200) throw new CollectionError("META_PERMISSION", "Meta no ha autorizado esta cuenta para Ad Library API. Completa el acceso en facebook.com/ads/library/api con la misma cuenta del token.");
    throw new CollectionError("META_ERROR", `Meta no pudo completar la búsqueda (${res.status}). Se reintentará más tarde.`);
  }
  if (!Array.isArray(body.data)) throw new CollectionError("META_SCHEMA", "Meta devolvió una respuesta sin resultados verificables.");
  const ads: MetaAd[] = body.data.map(obj).filter((r) => /^\d+$/.test(str(r.id))).map((r) => ({
    id: str(r.id), pageId: str(r.page_id), pageName: str(r.page_name),
    bodies: strings(r.ad_creative_bodies), titles: strings(r.ad_creative_link_titles),
    descriptions: strings(r.ad_creative_link_descriptions), captions: strings(r.ad_creative_link_captions),
    startedAt: date(r.ad_delivery_start_time), stoppedAt: date(r.ad_delivery_stop_time), createdAt: date(r.ad_creation_time),
    platforms: strings(r.publisher_platforms), languages: strings(r.languages),
    reach: typeof r.eu_total_reach === "number" ? r.eu_total_reach : null,
    ...(params.active ? { active: true } : {}),
    libraryUrl: `https://www.facebook.com/ads/library/?id=${r.id}`,
  }));
  const paging = obj(body.paging);
  return { ads, after: paging.next ? str(obj(paging.cursors).after) || null : null, source: "meta_api", partial: false };
}

async function publicSearch(params: AdSearchParams, fetcher: typeof fetch): Promise<AdCollection> {
  if (params.after) throw new CollectionError("CURSOR_EXPIRED", "Vuelve a buscar para actualizar los resultados de Meta.");
  const url = new URL("https://www.facebook.com/ads/library/");
  url.search = new URLSearchParams({ active_status: params.active ? "active" : "all", ad_type: "all",
    country: params.countries[0] || "US", media_type: "all",
    ...(params.pageId ? { view_all_page_id: params.pageId, search_type: "page" } : { q: params.q, search_type: "keyword_unordered" }),
  }).toString();
  const res = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "VantkoAdCatalog/1.0" }, signal: AbortSignal.timeout(18000) });
  if (res.status === 403 || res.status === 429 || new URL(res.url || url).pathname.includes("login")) {
    throw new CollectionError("PUBLIC_BLOCKED", "Meta ha limitado la consulta automática de esta región. Conservamos los datos disponibles; puedes abrir la búsqueda en Meta.");
  }
  if (!res.ok) throw new CollectionError("META_ERROR", `La biblioteca pública no está disponible (${res.status}).`);
  return parsePublicPage(await readBounded(res));
}

export async function collectAds(params: AdSearchParams, token: string, fetcher: typeof fetch = fetch): Promise<AdCollection> {
  // Never relabel EU results as US/global commercial coverage.
  if (params.countries.length && params.countries.every((c) => OFFICIAL_COUNTRIES.has(c))) {
    try { return await official(params, token, fetcher); }
    catch (error) {
      if (!(error instanceof CollectionError) || !["META_TOKEN", "META_PERMISSION"].includes(error.code) || params.after) throw error;
      // A public single-country snapshot may still be accessible. Keep the official error if both fail.
      if (params.countries.length === 1) {
        try { return await publicSearch(params, fetcher); } catch { /* Report the actionable API setup failure. */ }
      }
      throw error;
    }
  }
  if (params.countries.length !== 1) throw new CollectionError("COUNTRY", "Selecciona un país o Todo el mundo.");
  return publicSearch(params, fetcher);
}
