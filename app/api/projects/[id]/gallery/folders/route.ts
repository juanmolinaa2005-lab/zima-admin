import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { mapGalleryFolder, GALLERY_FOLDER_SELECT } from "@/lib/gallery/app-demo-folder";
import { APP_DEMO_FOLDER } from "@/lib/creator/app-demo";
import { INFLUENCERS_FOLDER } from "@/lib/gallery/influencers-folder";
import {
  DYNAMICS_FOLDER,
  DYNAMICS_FOLDER_KEY,
  HOOK_APP_DEMO_FOLDER,
  HOOK_APP_DEMO_KEY,
  HOOK_REFERENCE_FOLDER,
} from "@/lib/gallery/dynamics-folder";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { name?: string; parentId?: string | null; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Nombre inválido" },
      { status: 400 }
    );
  }
  const kind = body.kind === "carousel" ? "carousel" : "folder";

  const parentId =
    body.parentId && body.parentId !== "root" ? body.parentId : null;

  if (
    !parentId &&
    (name === APP_DEMO_FOLDER ||
      name.toLowerCase() === INFLUENCERS_FOLDER.toLowerCase() ||
      name.toLowerCase() === DYNAMICS_FOLDER.toLowerCase())
  ) {
    return NextResponse.json(
      { error: "Esa carpeta es fija y no se puede crear de nuevo." },
      { status: 400 }
    );
  }

  if (parentId) {
    const { data: parent, error } = await supabase
      .from("project_gallery_folders")
      .select("id, kind, system_key")
      .eq("id", parentId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!parent) {
      return NextResponse.json(
        { error: "Carpeta padre no encontrada" },
        { status: 404 }
      );
    }
    if (parent.kind === "carousel") {
      return NextResponse.json(
        { error: "Un carrusel no puede contener carpetas ni otros carruseles" },
        { status: 400 }
      );
    }
    const parentKey = (parent.system_key as string | null) || "";
    if (
      (parentKey === DYNAMICS_FOLDER_KEY &&
        name.toLowerCase() === HOOK_APP_DEMO_FOLDER.toLowerCase()) ||
      (parentKey === HOOK_APP_DEMO_KEY &&
        name.toLowerCase() === HOOK_REFERENCE_FOLDER.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Esa carpeta es fija y no se puede crear de nuevo." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("project_gallery_folders")
    .insert({
      project_id: projectId,
      user_id: user.id,
      parent_id: parentId,
      name,
      kind,
    })
    .select(GALLERY_FOLDER_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    folder: mapGalleryFolder(data),
  });
}
