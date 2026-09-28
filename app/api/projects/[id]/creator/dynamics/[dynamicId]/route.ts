import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { saveStudioDynamicExtras } from "@/lib/creator/dynamics-server";
import { deleteCustomDynamicFolder } from "@/lib/gallery/dynamics-folder";

type Params = { params: Promise<{ id: string; dynamicId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, dynamicId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const id = (dynamicId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta la dinámica" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const extras = await saveStudioDynamicExtras(
      gate.supabase,
      projectId,
      gate.user.id,
      id,
      body
    );
    return NextResponse.json({ extras });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo guardar la dinámica";
    const status = message === "No encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, dynamicId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const id = (dynamicId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta la dinámica" }, { status: 400 });
  }

  try {
    await deleteCustomDynamicFolder(gate.supabase, projectId, gate.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar la dinámica";
    const status = message === "No encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
