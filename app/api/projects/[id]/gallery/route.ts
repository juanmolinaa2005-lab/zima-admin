import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { GALLERY_ASSET_SELECT, mapGalleryAsset } from "@/lib/gallery/asset";
import {
  GALLERY_FOLDER_SELECT,
  ensureAppDemoGalleryFolder,
  mapGalleryFolder,
  type GalleryFolderRecord,
} from "@/lib/gallery/app-demo-folder";
import { syncInfluencerGalleryFolders } from "@/lib/gallery/influencers-folder";
import { ensureDynamicsGalleryFolders } from "@/lib/gallery/dynamics-folder";

type Params = { params: Promise<{ id: string }> };

export type GalleryFolder = GalleryFolderRecord;

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");
  const parentFilter = folderId && folderId !== "root" ? folderId : null;
  const listAll = url.searchParams.get("all") === "1";
  const kindFilter = url.searchParams.get("kind");

  try {
    await ensureAppDemoGalleryFolder(supabase, projectId, user.id);
    await syncInfluencerGalleryFolders(supabase, projectId, user.id);
    await ensureDynamicsGalleryFolders(supabase, projectId, user.id);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudieron crear las carpetas fijas de Galería",
      },
      { status: 500 }
    );
  }

  let foldersQuery = supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  let assetsQuery = supabase
    .from("project_gallery_assets")
    .select(GALLERY_ASSET_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (kindFilter === "image" || kindFilter === "video" || kindFilter === "audio" || kindFilter === "other") {
    assetsQuery = assetsQuery.eq("kind", kindFilter);
  }

  if (listAll) {
    // Flat asset list (picker) — skip folder scoping
  } else if (parentFilter) {
    foldersQuery = foldersQuery.eq("parent_id", parentFilter);
    assetsQuery = assetsQuery.eq("folder_id", parentFilter);
  } else {
    foldersQuery = foldersQuery.is("parent_id", null);
    assetsQuery = assetsQuery.is("folder_id", null);
  }

  const [foldersRes, assetsRes, breadcrumbRes, allFoldersRes] =
    await Promise.all([
      foldersQuery,
      assetsQuery,
      parentFilter
        ? supabase
            .from("project_gallery_folders")
            .select(GALLERY_FOLDER_SELECT)
            .eq("project_id", projectId)
            .eq("user_id", user.id)
            .eq("id", parentFilter)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("project_gallery_folders")
        .select(GALLERY_FOLDER_SELECT)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
    ]);

  if (foldersRes.error) {
    return NextResponse.json({ error: foldersRes.error.message }, { status: 500 });
  }
  if (assetsRes.error) {
    return NextResponse.json({ error: assetsRes.error.message }, { status: 500 });
  }
  if (breadcrumbRes.error) {
    return NextResponse.json(
      { error: breadcrumbRes.error.message },
      { status: 500 }
    );
  }
  if (allFoldersRes.error) {
    return NextResponse.json(
      { error: allFoldersRes.error.message },
      { status: 500 }
    );
  }

  // Build breadcrumb chain (root → current)
  const crumbs: GalleryFolder[] = [];
  let cursor = breadcrumbRes.data;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    crumbs.unshift(mapGalleryFolder(cursor));
    if (!cursor.parent_id) break;
    const { data: parent } = await supabase
      .from("project_gallery_folders")
      .select(GALLERY_FOLDER_SELECT)
      .eq("id", cursor.parent_id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    cursor = parent;
  }

  return NextResponse.json({
    folderId: parentFilter,
    breadcrumbs: crumbs,
    folders: (foldersRes.data ?? []).map(mapGalleryFolder),
    assets: (assetsRes.data ?? []).map(mapGalleryAsset),
    allFolders: (allFoldersRes.data ?? []).map(mapGalleryFolder),
  });
}
