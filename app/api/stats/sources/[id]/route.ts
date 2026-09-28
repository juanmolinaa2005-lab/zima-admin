import { NextResponse } from "next/server";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { deleteSource } from "@/lib/stats/store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireStatsUser();
    const projectId = new URL(request.url).searchParams.get("projectId") || "";
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);
    await deleteSource(supabase, projectId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudo quitar la plataforma");
    return NextResponse.json({ error: message }, { status });
  }
}
