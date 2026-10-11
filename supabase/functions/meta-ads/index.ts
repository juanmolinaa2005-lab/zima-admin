import { collectAds, CollectionError } from "./collector.ts";
import { authorizeServiceRole } from "./service-auth.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creation_time",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
].join(",");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function token() {
  return Deno.env.get("META_AD_LIBRARY")?.trim() || "";
}

async function search(url: URL) {
  const accessToken = token();
  if (!accessToken) return json({ error: "Falta el secret META_AD_LIBRARY en Supabase" }, 500);
  const q = url.searchParams.get("q")?.trim() || "";
  const pageId = url.searchParams.get("pageId")?.replace(/\D/g, "") || "";
  const countries = (url.searchParams.get("countries") || "ES")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  const graph = new URL(`${GRAPH}/ads_archive`);
  graph.searchParams.set("access_token", accessToken);
  graph.searchParams.set("ad_type", "ALL");
  graph.searchParams.set("ad_reached_countries", JSON.stringify(countries.length ? countries : ["ES"]));
  graph.searchParams.set("ad_active_status", url.searchParams.get("active") === "0" ? "ALL" : "ACTIVE");
  graph.searchParams.set("fields", FIELDS);
  graph.searchParams.set("limit", "30");
  if (pageId) graph.searchParams.set("search_page_ids", JSON.stringify([pageId]));
  else graph.searchParams.set("search_terms", q);
  const after = url.searchParams.get("after");
  if (after) graph.searchParams.set("after", after);
  const res = await fetch(graph, { signal: AbortSignal.timeout(18000) });
  const data = await res.json().catch(() => ({ error: { message: `Meta respondió ${res.status}` } }));
  return json(data, res.status);
}

async function media(url: URL) {
  const accessToken = token();
  const adId = url.searchParams.get("adId")?.replace(/\D/g, "") || "";
  if (!accessToken || !adId) return json({ video: null, image: null, avatar: null });
  const res = await fetch(
    `https://www.facebook.com/ads/archive/render_ad/?id=${adId}&access_token=${encodeURIComponent(accessToken)}`,
    {
      signal: AbortSignal.timeout(18000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    }
  );
  if (!res.ok) return json({ video: null, image: null, avatar: null });
  const html = await res.text();
  const grab = (key: string) => {
    const match = html.match(new RegExp(`"${key}":"(https:[^"]+)"`));
    return match ? match[1].replace(/\\\//g, "/").replace(/\\u0025/g, "%").replace(/\\u0026/g, "&") : null;
  };
  const video = grab("video_hd_url") || grab("video_sd_url");
  const poster = grab("video_preview_image_url");
  let image = grab("original_image_url") || grab("resized_image_url") || poster;
  if (!video && !image) {
    const tag = html.match(/<img[^>]+src="(https:\/\/scontent[^"]+)"/);
    image = tag ? tag[1].replace(/&amp;/g, "&") : null;
  }
  return json({ video, image, avatar: grab("page_profile_picture_url") });
}

Deno.serve(async (req) => {
  if (!await authorizeServiceRole(req, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "")) return json({ error: "No autorizado" }, 401);
  if (req.method !== "GET") return json({ error: "Método no permitido" }, 405);
  const url = new URL(req.url);
  const op = url.searchParams.get("op") || "search";
  if (op === "status") return json({ configured: Boolean(token()), publicCollector: true, catalogVersion: 1 });
  if (op === "collect") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const pageId = url.searchParams.get("pageId") || "";
    const countries = (url.searchParams.get("countries") || "US").split(",");
    const after = url.searchParams.get("after") || undefined;
    if ((!q && !/^\d+$/.test(pageId)) || (pageId && !/^\d+$/.test(pageId)) || countries.length > 28 ||
      countries.some((c) => !/^(ALL|[A-Z]{2})$/.test(c)) || (after && after.length > 4000)) {
      return json({ error: "Búsqueda no válida", code: "INPUT" }, 400);
    }
    try {
      return json(await collectAds({ q, pageId: pageId || undefined, countries, after, active: url.searchParams.get("active") !== "0" }, token()));
    } catch (error) {
      const known = error instanceof CollectionError;
      return json({ error: known ? error.message : "No se pudo consultar Meta. Se reintentará más tarde.", code: known ? error.code : "META_ERROR" }, 502);
    }
  }
  if (op === "media") return media(url);
  return search(url);
});
