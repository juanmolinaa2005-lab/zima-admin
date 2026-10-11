import { NextResponse } from "next/server";
import { isAuthorizedImageWorker } from "@/lib/creator/image-queue-worker";
import { refreshDueAdSearches } from "@/lib/market/ad-catalog";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedImageWorker(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { return NextResponse.json({ ok: true, processed: await refreshDueAdSearches() }); }
  catch { return NextResponse.json({ error: "No se pudo actualizar el catálogo de anuncios." }, { status: 500 }); }
}
