import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { folderId?: string; orderedIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const folderId = (body.folderId || "").trim();
  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!folderId || !orderedIds.length) {
    return NextResponse.json(
      { error: "folderId y orderedIds son requeridos" },
      { status: 400 }
    );
  }

  const { data: assets, error } = await supabase
    .from("project_gallery_assets")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("folder_id", folderId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allowed = new Set((assets ?? []).map((a) => a.id as string));
  if (orderedIds.some((id) => !allowed.has(id))) {
    return NextResponse.json(
      { error: "Hay archivos que no están en este carrusel" },
      { status: 400 }
    );
  }

  for (const [i, id] of orderedIds.entries()) {
    const { error: upErr } = await supabase
      .from("project_gallery_assets")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
