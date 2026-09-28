import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  loadStudioDynamics,
  loadStudioParts,
  saveStudioDynamicExtras,
} from "@/lib/creator/dynamics-server";
import {
  createCustomDynamicFolder,
  customDynamicIdFromKey,
} from "@/lib/gallery/dynamics-folder";
import { EMPTY_DYNAMIC_EXTRAS, type StudioDynamic } from "@/lib/creator/dynamics";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  try {
    const [dynamics, partsData] = await Promise.all([
      loadStudioDynamics(gate.supabase, projectId, gate.user.id),
      loadStudioParts(gate.supabase, projectId, gate.user.id),
    ]);
    return NextResponse.json({
      dynamics,
      parts: partsData.parts,
      musicFolderId: partsData.musicFolderId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudieron cargar las dinámicas",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: { name?: string; id?: string } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }
  const preferredId =
    typeof body.id === "string" && /^[a-z0-9-]{8,80}$/i.test(body.id.trim())
      ? body.id.trim()
      : undefined;

  try {
    const folder = await createCustomDynamicFolder(
      gate.supabase,
      projectId,
      gate.user.id,
      name,
      preferredId
    );
    const id = customDynamicIdFromKey(folder.systemKey);
    if (!id) throw new Error("No se pudo crear la dinámica");
    let extras = EMPTY_DYNAMIC_EXTRAS;
    try {
      extras = await saveStudioDynamicExtras(
        gate.supabase,
        projectId,
        gate.user.id,
        id,
        { ...body, name }
      );
    } catch {
      extras = { ...EMPTY_DYNAMIC_EXTRAS, name };
    }
    const created: StudioDynamic = {
      id,
      name: extras.name || folder.name,
      description: "Plantilla: parts, overlay y música.",
      builtin: false,
      folderId: folder.id,
      ...extras,
      slots: [],
    };
    return NextResponse.json({ dynamic: created });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "No se pudo crear la dinámica",
      },
      { status: 400 }
    );
  }
}
