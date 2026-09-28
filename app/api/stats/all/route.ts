import { NextResponse } from "next/server";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { rollupAll, snapshotBuiltin, snapshotCustom } from "@/lib/stats/aggregate";
import { getSourceWithSpec, listProjectSources } from "@/lib/stats/store";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireStatsUser();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") || "";
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 7)));
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);
    const sources = await listProjectSources(supabase, projectId);
    const platforms = await Promise.all(
      sources.map(async (source) => {
        if (source.builtin) {
          return snapshotBuiltin(source.builtin, source, days);
        }
        const full = await getSourceWithSpec(supabase, projectId, source.id);
        if (!full?.fetchSpec) {
          return {
            sourceId: source.id,
            slug: source.slug,
            name: source.name,
            kind: source.kind,
            builtin: null,
            metrics: [],
            series: [],
            error: "Este conector no tiene especificación de métricas.",
          };
        }
        return snapshotCustom(source, full.fetchSpec, full.credentials, days);
      })
    );
    return NextResponse.json(rollupAll(days, platforms));
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudo armar el resumen");
    return NextResponse.json({ error: message }, { status });
  }
}
