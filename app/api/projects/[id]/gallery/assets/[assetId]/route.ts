import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  GALLERY_ASSET_SELECT,
  mapGalleryAsset,
  normalizeHashtag,
} from "@/lib/gallery/asset";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, assetId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { name?: string; folderId?: string | null; hashtag?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 255) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    }
    patch.name = name;
  }

  if ("folderId" in body) {
    const folderId =
      body.folderId && body.folderId !== "root" ? body.folderId : null;
    if (folderId) {
      const { data: folder, error } = await supabase
        .from("project_gallery_folders")
        .select("id")
        .eq("id", folderId)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!folder) {
        return NextResponse.json(
          { error: "Carpeta no encontrada" },
          { status: 404 }
        );
      }
    }
    patch.folder_id = folderId;
    if (folderId) {
      const { data: last } = await supabase
        .from("project_gallery_assets")
        .select("sort_order")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("folder_id", folderId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      patch.sort_order = (Number(last?.sort_order) || 0) + 1;
    } else {
      patch.sort_order = 0;
    }
  }

  if ("hashtag" in body) {
    patch.hashtag = normalizeHashtag(body.hashtag);
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_gallery_assets")
    .update(patch)
    .eq("id", assetId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select(GALLERY_ASSET_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    asset: mapGalleryAsset(data),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, assetId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;

  const { data: asset, error } = await supabase
    .from("project_gallery_assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  if (asset.storage_path) {
    await supabase.storage.from("gallery").remove([asset.storage_path]);
  }

  const { error: delErr } = await supabase
    .from("project_gallery_assets")
    .delete()
    .eq("id", assetId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
