import { NextResponse } from "next/server";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { snapshotBuiltin, snapshotCustom } from "@/lib/stats/aggregate";
import { getSourceWithSpec } from "@/lib/stats/store";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireStatsUser();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") || "";
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 7)));
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);
    const full = await getSourceWithSpec(supabase, projectId, id);
    if (!full) {
      return NextResponse.json({ error: "Plataforma no encontrada" }, { status: 404 });
    }
    if (full.source.builtin) {
      const snap = await snapshotBuiltin(full.source.builtin, full.source, days);
      return NextResponse.json(snap);
    }
    if (!full.fetchSpec) {
      return NextResponse.json(
        { error: "Este conector no tiene especificación de métricas." },
        { status: 400 }
      );
    }
    const snap = await snapshotCustom(full.source, full.fetchSpec, full.credentials, days);
    return NextResponse.json(snap);
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudieron cargar las métricas");
    return NextResponse.json({ error: message }, { status });
  }
}
