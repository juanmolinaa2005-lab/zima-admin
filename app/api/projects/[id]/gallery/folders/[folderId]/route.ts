import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  GALLERY_FOLDER_SELECT,
  isSystemGalleryFolder,
  loadFolderRow,
  mapGalleryFolder,
} from "@/lib/gallery/app-demo-folder";

type Params = { params: Promise<{ id: string; folderId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, folderId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const current = await loadFolderRow(supabase, projectId, user.id, folderId);
  if (!current) {
    return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
  }
  if (isSystemGalleryFolder(current)) {
    return NextResponse.json(
      { error: "Esta carpeta es fija y no se puede editar ni mover." },
      { status: 403 }
    );
  }

  let body: { name?: string; parentId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: "Nombre de carpeta inválido" },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  if ("parentId" in body) {
    const parentId =
      body.parentId && body.parentId !== "root" ? body.parentId : null;
    if (parentId === folderId) {
      return NextResponse.json(
        { error: "No se puede mover una carpeta dentro de sí misma" },
        { status: 400 }
      );
    }
    if (parentId) {
      const { data: parent, error: parentErr } = await supabase
        .from("project_gallery_folders")
        .select("id, parent_id, kind")
        .eq("id", parentId)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (parentErr) {
        return NextResponse.json({ error: parentErr.message }, { status: 500 });
      }
      if (!parent) {
        return NextResponse.json(
          { error: "Carpeta de destino no encontrada" },
          { status: 404 }
        );
      }
      if (parent.kind === "carousel") {
        return NextResponse.json(
          { error: "Un carrusel no puede contener carpetas ni otros carruseles" },
          { status: 400 }
        );
      }

      const { data: allFolders, error: allErr } = await supabase
        .from("project_gallery_folders")
        .select("id, parent_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id);
      if (allErr) {
        return NextResponse.json({ error: allErr.message }, { status: 500 });
      }
      const byId = new Map(
        (allFolders ?? []).map((f) => [f.id as string, f.parent_id as string | null])
      );
      let walk: string | null = parentId;
      const seen = new Set<string>();
      while (walk && !seen.has(walk)) {
        if (walk === folderId) {
          return NextResponse.json(
            { error: "No se puede mover una carpeta dentro de sí misma" },
            { status: 400 }
          );
        }
        seen.add(walk);
        walk = byId.get(walk) ?? null;
      }
    }
    patch.parent_id = parentId;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_gallery_folders")
    .update(patch)
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select(GALLERY_FOLDER_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    folder: mapGalleryFolder(data),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, folderId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;

  // Collect all descendant folder ids + assets storage paths to clean storage
  const { data: allFolders, error: foldersErr } = await supabase
    .from("project_gallery_folders")
    .select("id, parent_id, system_key")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (foldersErr) {
    return NextResponse.json({ error: foldersErr.message }, { status: 500 });
  }

  const byParent = new Map<string | null, string[]>();
  for (const f of allFolders ?? []) {
    const key = f.parent_id as string | null;
    const list = byParent.get(key) ?? [];
    list.push(f.id);
    byParent.set(key, list);
  }

  const toDelete = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (toDelete.has(id)) continue;
    toDelete.add(id);
    for (const child of byParent.get(id) ?? []) stack.push(child);
  }

  if (!toDelete.has(folderId)) {
    // Ensure root folder exists for this user/project
    const { data: root } = await supabase
      .from("project_gallery_folders")
      .select("id")
      .eq("id", folderId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!root) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }
    toDelete.add(folderId);
  }

  const folderIds = [...toDelete];
  if (
    (allFolders ?? []).some(
      (f) => folderIds.includes(f.id) && Boolean(f.system_key)
    )
  ) {
    return NextResponse.json(
      { error: "Esta carpeta es fija y no se puede eliminar." },
      { status: 403 }
    );
  }

  const { data: assets, error: assetsErr } = await supabase
    .from("project_gallery_assets")
    .select("id, storage_path")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("folder_id", folderIds);

  if (assetsErr) {
    return NextResponse.json({ error: assetsErr.message }, { status: 500 });
  }

  const paths = (assets ?? []).map((a) => a.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from("gallery").remove(paths);
  }

  const { error: delErr } = await supabase
    .from("project_gallery_folders")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("id", folderIds);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedFolders: folderIds.length });
}
