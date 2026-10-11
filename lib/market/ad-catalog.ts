import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetaAdsError, searchMetaAds } from "./meta-ads";
import type { AdSearchParams, AdSearchResult, MetaAd } from "./meta-ad-types";

type Job = {
  key: string; params: AdSearchParams; state: AdSearchResult["state"]; ad_ids: string[];
  next_cursor: string | null; source: AdSearchResult["source"]; partial: boolean;
  fetched_at: string | null; refresh_after: string; lease_token: string | null;
  error_message: string | null;
};

export function canonicalSearch(params: AdSearchParams): AdSearchParams {
  return {
    q: params.pageId ? "" : params.q.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
    countries: [...new Set(params.countries)].sort(), active: params.active,
    ...(params.pageId ? { pageId: params.pageId } : {}), ...(params.after ? { after: params.after } : {}),
  };
}
export function adSearchKey(params: AdSearchParams) {
  return createHash("sha256").update(JSON.stringify({ version: 1, ...canonicalSearch(params) })).digest("hex");
}

export async function readAdCatalog(params: AdSearchParams, userId: string): Promise<{ result: AdSearchResult; jobKey: string | null }> {
  const admin = await createAdminClient();
  const canonical = canonicalSearch(params);
  const key = adSearchKey(canonical);
  const { data, error } = await admin.rpc("request_market_ad_search", { p_key: key, p_params: canonical, p_user: userId });
  if (error) throw new MetaAdsError("El catálogo compartido no está disponible. Revisa que su migración esté aplicada.", "CATALOG");
  if (data?.limited) throw new MetaAdsError("Has solicitado muchas búsquedas nuevas. Puedes volver a consultar las ya disponibles o esperar a la próxima hora.", "LIMIT");
  const job = data as Job;
  let ads: MetaAd[] = [];
  let source = job.source;
  let partial = job.partial;
  let fetchedAt = job.fetched_at;
  if (job.ad_ids.length) {
    const { data: rows, error } = await admin.from("market_ad_catalog").select("id, data").in("id", job.ad_ids);
    if (error) throw new MetaAdsError("No se pudo leer el catálogo de anuncios.", "CATALOG");
    const byId = new Map((rows ?? []).map((row) => [row.id, row.data as MetaAd]));
    ads = job.ad_ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  } else if (!job.fetched_at && !params.after) {
    // Reuse already-observed public ads while a new query is being collected.
    let query = admin.from("market_ad_catalog").select("data, observed_at").order("observed_at", { ascending: false }).limit(30);
    if (params.pageId) query = query.eq("page_id", params.pageId);
    else query = query.textSearch("search_vector", canonical.q, { type: "plain", config: "simple" });
    if (!params.countries.includes("ALL")) query = query.overlaps("countries", params.countries);
    if (params.active) query = query.eq("data->>active", "true");
    const { data: rows, error } = await query;
    if (error) throw new MetaAdsError("No se pudo buscar en el catálogo de anuncios.", "CATALOG");
    ads = (rows ?? []).map((row) => row.data as MetaAd);
    if (ads.length) { source = "catalog"; partial = true; fetchedAt = rows?.at(-1)?.observed_at ?? null; }
  }
  return {
    jobKey: job.state === "queued" || job.state === "running" ? key : null,
    result: {
      ads, after: job.state === "ready" ? job.next_cursor : null, state: job.state,
      fetchedAt, stale: (!!job.fetched_at && Date.parse(job.refresh_after) <= Date.now()) || job.state !== "ready",
      source, partial,
      notice: job.state === "error" ? job.error_message : source === "catalog" ? "Coincidencias del catálogo existente; estamos comprobando esta búsqueda." : null,
    },
  };
}

export async function refreshAdSearch(key: string): Promise<boolean> {
  const admin = await createAdminClient();
  const { data, error } = await admin.rpc("claim_market_ad_search", { p_key: key });
  if (error) throw new Error("No se pudo reservar la actualización de anuncios.");
  if (!data) return false;
  const job = data as Job;
  let result = null, errorCode: string | null = null, message: string | null = null;
  try {
    result = await searchMetaAds(job.params);
    if (!Array.isArray(result.ads) || !["meta_api", "meta_public"].includes(result.source)) {
      throw new MetaAdsError("El servicio de anuncios necesita la nueva versión del recolector.", "COLLECTOR_VERSION");
    }
  } catch (error) {
    errorCode = error instanceof MetaAdsError ? error.code : "META_ERROR";
    message = error instanceof MetaAdsError ? error.message : "La fuente de anuncios no respondió. Conservamos los datos anteriores y reintentaremos más tarde.";
  }
  const { error: saveError } = await admin.rpc("finish_market_ad_search", {
    p_key: key, p_lease: job.lease_token, p_result: result, p_error_code: errorCode, p_error_message: message,
  });
  if (saveError) throw new Error("No se pudo guardar la actualización de anuncios.");
  return true;
}

export async function refreshDueAdSearches(limit = 4) {
  const admin = await createAdminClient();
  const { data, error } = await admin.from("market_ad_searches").select("key")
    .lte("refresh_after", new Date().toISOString())
    .gte("last_requested_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("refresh_after").limit(limit);
  if (error) throw new Error("No se pudo leer la cola de anuncios.");
  let processed = 0;
  for (const row of data ?? []) if (await refreshAdSearch(row.key)) processed++;
  await admin.from("market_ad_request_limits").delete().lt("hour", new Date(Date.now() - 7 * 86400000).toISOString());
  return processed;
}
