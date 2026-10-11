import { getServiceRoleAccess, createAdminClient } from "@/lib/supabase/admin";
import type { AdCollection, AdMedia, AdSearchParams } from "./meta-ad-types";
export { META_AD_COUNTRIES } from "./meta-ad-types";
export type { MetaAd } from "./meta-ad-types";

export class MetaAdsError extends Error {
  constructor(message: string, public code = "META_ERROR") { super(message); }
}

async function callFunction<T>(params: Record<string, string>): Promise<T> {
  const { url, serviceKey, anonKey } = await getServiceRoleAccess();
  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/meta-ads?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: anonKey, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new MetaAdsError(typeof data?.code === "string" && typeof data?.error === "string"
      ? data.error : `No se pudo consultar el servicio de anuncios (${res.status}).`, data?.code || "META_ERROR");
  }
  return data as T;
}

export async function metaAdsStatus() {
  return callFunction<{ configured: boolean; publicCollector?: boolean; catalogVersion?: number }>({ op: "status" });
}

export async function searchMetaAds(params: AdSearchParams): Promise<AdCollection> {
  return callFunction<AdCollection>({ op: "collect", countries: params.countries.join(","), active: params.active ? "1" : "0",
    ...(params.pageId ? { pageId: params.pageId } : { q: params.q }), ...(params.after ? { after: params.after } : {}),
  });
}

const mediaRequests = new Map<string, Promise<AdMedia>>();
export async function metaAdMedia(adId: string): Promise<AdMedia> {
  const empty = { video: null, image: null, avatar: null };
  if (!/^\d+$/.test(adId)) return empty;
  const running = mediaRequests.get(adId);
  if (running) return running;
  const request = (async () => {
    try {
      const admin = await createAdminClient();
      const { data: row, error } = await admin.from("market_ad_catalog").select("data").eq("id", adId).maybeSingle();
      if (error || !row) return empty;
      if (row.data?.media) return row.data.media as AdMedia;
      const media = await callFunction<AdMedia>({ op: "media", adId });
      await admin.rpc("cache_market_ad_media", { p_id: adId, p_media: media });
      return media;
    } catch { return empty; }
  })();
  mediaRequests.set(adId, request);
  try { return await request; } finally { mediaRequests.delete(adId); }
}
