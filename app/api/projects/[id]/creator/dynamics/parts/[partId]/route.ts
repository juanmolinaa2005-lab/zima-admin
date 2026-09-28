import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { saveStudioPartMeta } from "@/lib/creator/dynamics-server";
import { deleteCustomPartFolder } from "@/lib/gallery/dynamics-folder";

type Params = { params: Promise<{ id: string; partId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, partId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const id = (partId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta la part" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const meta = await saveStudioPartMeta(
      gate.supabase,
      projectId,
      gate.user.id,
      id,
      body
    );
    return NextResponse.json({ meta });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo guardar la part";
    const status = message === "No encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, partId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const id = (partId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta la part" }, { status: 400 });
  }

  try {
    await deleteCustomPartFolder(gate.supabase, projectId, gate.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar la part";
    const status = message === "No encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
