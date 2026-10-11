import { after, NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { META_AD_COUNTRIES, metaAdMedia, MetaAdsError, metaAdsStatus } from "@/lib/market/meta-ads";
import { readAdCatalog, refreshAdSearch } from "@/lib/market/ad-catalog";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

const ALLOWED = new Set<string>(META_AD_COUNTRIES.map((c) => c.code));

function fail(error: unknown) {
  if (error instanceof MetaAdsError) {
    return NextResponse.json({ error: error.message }, { status: error.code === "LIMIT" ? 429 : 502 });
  }
  return NextResponse.json({ error: "No se pudo consultar el catálogo de anuncios." }, { status: 500 });
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "search";
  try {
    if (op === "status") return NextResponse.json(await metaAdsStatus());
    if (op === "media") {
      const adId = (url.searchParams.get("adId") || "").replace(/\D/g, "");
      if (!adId) return NextResponse.json({ error: "Falta el anuncio" }, { status: 400 });
      return NextResponse.json(await metaAdMedia(adId), { headers: { "Cache-Control": "private, max-age=1800" } });
    }
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const pageId = (url.searchParams.get("pageId") || "").replace(/\D/g, "");
    if (!q && !pageId) return NextResponse.json({ ads: [], after: null });
    const countries = (url.searchParams.get("countries") || "US")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (countries.length !== 1 || countries.some((c) => !ALLOWED.has(c)) ||
      (url.searchParams.get("after") || "").length > 4000) {
      return NextResponse.json({ error: "País o paginación no válidos." }, { status: 400 });
    }
    const { result, jobKey } = await readAdCatalog({
      q,
      pageId: pageId || undefined,
      countries,
      active: url.searchParams.get("active") !== "0",
      after: url.searchParams.get("after") || undefined,
    }, gate.user.id);
    if (jobKey) after(async () => {
      try { await refreshAdSearch(jobKey); } catch { console.error("Ad catalog refresh failed; lease will expire for retry."); }
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Copies a Meta CDN creative into project storage so saved ads don't expire. */
export async function PUT(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  let source: URL;
  try {
    source = new URL(body.url || "");
  } catch {
    return NextResponse.json({ error: "URL no válida" }, { status: 400 });
  }
  if (!/(^|\.)fbcdn\.net$|(^|\.)facebook\.com$/.test(source.hostname)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 400 });
  }
  const res = await fetch(source, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "No se pudo descargar" }, { status: 502 });
  const type = res.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 60 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 413 });
  const ext = type.includes("mp4") || type.includes("video") ? "mp4" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const path = `${projectId}/market/ads/meta-${crypto.randomUUID()}.${ext}`;
  const { error } = await gate.supabase.storage.from("gallery").upload(path, bytes, { contentType: type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: gate.supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl });
}
