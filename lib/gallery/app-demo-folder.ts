import { APP_DEMO_FOLDER } from "@/lib/creator/app-demo";

export const APP_DEMO_FOLDER_KEY = "app-demo";

export const GALLERY_FOLDER_SELECT =
  "id, name, parent_id, kind, system_key, created_at";

export type GalleryFolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "folder" | "carousel";
  systemKey: string | null;
  createdAt: string;
};

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  kind?: string | null;
  system_key?: string | null;
  created_at: string;
};

type GalleryDb = {
  from: (table: string) => {
    select: (cols: string) => any;
    insert: (row: Record<string, unknown>) => any;
    update: (row: Record<string, unknown>) => any;
  };
};

export function mapGalleryFolder(row: FolderRow): GalleryFolderRecord {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    kind: row.kind === "carousel" ? "carousel" : "folder",
    systemKey: row.system_key ?? null,
    createdAt: row.created_at,
  };
}

export function isSystemGalleryFolder(folder: {
  systemKey?: string | null;
} | null | undefined): boolean {
  return Boolean(folder?.systemKey);
}

export async function loadFolderRow(
  supabase: GalleryDb,
  projectId: string,
  userId: string,
  folderId: string
): Promise<GalleryFolderRecord | null> {
  const { data, error } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapGalleryFolder(data as FolderRow) : null;
}

export async function ensureAppDemoGalleryFolder(
  supabase: GalleryDb,
  projectId: string,
  userId: string
): Promise<GalleryFolderRecord> {
  const { data: keyed, error: keyedErr } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", APP_DEMO_FOLDER_KEY)
    .maybeSingle();
  if (keyedErr) throw new Error(keyedErr.message);
  if (keyed) {
    const row = keyed as FolderRow;
    if (row.name !== APP_DEMO_FOLDER || row.parent_id !== null) {
      const { data: fixed, error: fixErr } = await supabase
        .from("project_gallery_folders")
        .update({ name: APP_DEMO_FOLDER, parent_id: null })
        .eq("id", row.id)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .select(GALLERY_FOLDER_SELECT)
        .single();
      if (fixErr) throw new Error(fixErr.message);
      if (fixed) return mapGalleryFolder(fixed as FolderRow);
    }
    return mapGalleryFolder(row);
  }

  const { data: namedRows, error: namedErr } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("name", APP_DEMO_FOLDER)
    .is("parent_id", null)
    .limit(1);
  if (namedErr) throw new Error(namedErr.message);
  const named = (Array.isArray(namedRows) ? namedRows[0] : namedRows) as
    | FolderRow
    | undefined;
  if (named) {
    const { data: stamped, error: stampErr } = await supabase
      .from("project_gallery_folders")
      .update({ system_key: APP_DEMO_FOLDER_KEY })
      .eq("id", named.id)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .select(GALLERY_FOLDER_SELECT)
      .single();
    if (stampErr) throw new Error(stampErr.message);
    return mapGalleryFolder((stamped as FolderRow) ?? named);
  }

  const { data: created, error: createErr } = await supabase
    .from("project_gallery_folders")
    .insert({
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      name: APP_DEMO_FOLDER,
      kind: "folder",
      system_key: APP_DEMO_FOLDER_KEY,
    })
    .select(GALLERY_FOLDER_SELECT)
    .single();
  if (createErr) {
    const { data: raced } = await supabase
      .from("project_gallery_folders")
      .select(GALLERY_FOLDER_SELECT)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("system_key", APP_DEMO_FOLDER_KEY)
      .maybeSingle();
    if (raced) return mapGalleryFolder(raced as FolderRow);
    throw new Error(createErr.message);
  }
  if (!created) throw new Error("No se pudo crear la carpeta App Demo");
  return mapGalleryFolder(created as FolderRow);
}
