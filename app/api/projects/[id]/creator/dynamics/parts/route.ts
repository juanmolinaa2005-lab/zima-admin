import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { loadStudioParts, saveStudioPartMeta } from "@/lib/creator/dynamics-server";
import { createCustomPartFolder } from "@/lib/gallery/dynamics-folder";
import { parseDynamicPartKind, type DynamicPart } from "@/lib/creator/dynamics";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  try {
    const data = await loadStudioParts(gate.supabase, projectId, gate.user.id);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "No se pudieron cargar las parts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: { name?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }
  const kind = parseDynamicPartKind(body.kind);

  try {
    const created = await createCustomPartFolder(
      gate.supabase,
      projectId,
      gate.user.id,
      name
    );
    const meta = await saveStudioPartMeta(
      gate.supabase,
      projectId,
      gate.user.id,
      created.id,
      {
        kind,
        prompts:
          kind === "overlay"
            ? [{ id: `prompt-${Date.now()}`, text: name }]
            : [],
        overlayStyle: kind === "overlay" ? "snapchat" : undefined,
        overlayPosition: kind === "overlay" ? "upper" : undefined,
        overlayLanguage: kind === "overlay" ? "es" : undefined,
      }
    );
    const part: DynamicPart = {
      id: created.id,
      name: created.folder.name,
      kind: meta.kind,
      folderId: created.folder.id,
      prompts: meta.prompts,
      videoCount: 0,
      previewUrl: null,
      audioCount: 0,
      audioUrl: null,
      overlayStyle: meta.overlayStyle,
      overlayPosition: meta.overlayPosition,
      overlayLanguage: meta.overlayLanguage,
    };
    return NextResponse.json({ part });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "No se pudo crear la part",
      },
      { status: 400 }
    );
  }
}
