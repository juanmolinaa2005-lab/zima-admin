import {
  GALLERY_FOLDER_SELECT,
  mapGalleryFolder,
  type GalleryFolderRecord,
} from "@/lib/gallery/app-demo-folder";

export const DYNAMICS_FOLDER = "Dynamics";
export const DYNAMICS_FOLDER_KEY = "dynamics";
export const HOOK_APP_DEMO_ID = "hook-app-demo";
export const HOOK_APP_DEMO_FOLDER = "Hook + App Demo";
export const HOOK_APP_DEMO_KEY = "dynamic:hook-app-demo";
export const HOOK_REFERENCE_FOLDER = "Hook Reference";
export const HOOK_REFERENCE_KEY = "dynamic:hook-app-demo:hook-reference";
export const PARTS_ROOT_FOLDER = "Parts";
export const PARTS_ROOT_KEY = "dynamic:parts";
export const MUSIC_FOLDER = "Música";
export const MUSIC_FOLDER_KEY = "dynamic:music";

export function customDynamicKey(id: string) {
  return `dynamic:custom:${id}`;
}

export function customDynamicIdFromKey(systemKey: string | null | undefined) {
  const key = systemKey || "";
  if (!key.startsWith("dynamic:custom:")) return null;
  const id = key.slice("dynamic:custom:".length).trim();
  return id || null;
}

export function isCustomDynamicKey(systemKey: string | null | undefined) {
  return Boolean(customDynamicIdFromKey(systemKey));
}

export function customPartKey(id: string) {
  return `dynamic:part:${id}`;
}

export function customPartIdFromKey(systemKey: string | null | undefined) {
  const key = systemKey || "";
  if (!key.startsWith("dynamic:part:")) return null;
  const id = key.slice("dynamic:part:".length).trim();
  return id || null;
}

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  kind?: string | null;
  system_key?: string | null;
  created_at: string;
};

type Db = {
  from: (table: string) => {
    select: (cols: string) => any;
    insert: (row: Record<string, unknown>) => any;
    update: (row: Record<string, unknown>) => any;
    delete: () => any;
  };
  storage?: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function clipFolderName(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim() || "Dynamic";
  return name.slice(0, 120);
}

async function ensureKeyedGalleryFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  opts: { key: string; name: string; parentId: string | null }
): Promise<GalleryFolderRecord> {
  const { data: keyed, error: keyedErr } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", opts.key)
    .maybeSingle();
  if (keyedErr) throw new Error(keyedErr.message);
  if (keyed) {
    const row = keyed as FolderRow;
    if (row.name !== opts.name || row.parent_id !== opts.parentId) {
      const { data: fixed, error: fixErr } = await supabase
        .from("project_gallery_folders")
        .update({ name: opts.name, parent_id: opts.parentId })
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

  let namedQuery = supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .ilike("name", opts.name)
    .limit(1);
  namedQuery = opts.parentId
    ? namedQuery.eq("parent_id", opts.parentId)
    : namedQuery.is("parent_id", null);

  const { data: namedRows, error: namedErr } = await namedQuery;
  if (namedErr) throw new Error(namedErr.message);
  const named = (Array.isArray(namedRows) ? namedRows[0] : namedRows) as
    | FolderRow
    | undefined;
  if (named && !named.system_key) {
    const { data: stamped, error: stampErr } = await supabase
      .from("project_gallery_folders")
      .update({
        system_key: opts.key,
        name: opts.name,
        parent_id: opts.parentId,
        kind: "folder",
      })
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
      parent_id: opts.parentId,
      name: opts.name,
      kind: "folder",
      system_key: opts.key,
    })
    .select(GALLERY_FOLDER_SELECT)
    .single();
  if (createErr) {
    const { data: raced } = await supabase
      .from("project_gallery_folders")
      .select(GALLERY_FOLDER_SELECT)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("system_key", opts.key)
      .maybeSingle();
    if (raced) return mapGalleryFolder(raced as FolderRow);
    throw new Error(createErr.message);
  }
  if (!created) throw new Error(`No se pudo crear la carpeta ${opts.name}`);
  return mapGalleryFolder(created as FolderRow);
}

export async function ensureDynamicsRootFolder(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<GalleryFolderRecord> {
  return ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: DYNAMICS_FOLDER_KEY,
    name: DYNAMICS_FOLDER,
    parentId: null,
  });
}

export async function ensureHookAppDemoFolders(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<{
  root: GalleryFolderRecord;
  hookAppDemo: GalleryFolderRecord;
  hookReference: GalleryFolderRecord;
}> {
  const root = await ensureDynamicsRootFolder(supabase, projectId, userId);
  const hookAppDemo = await ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: HOOK_APP_DEMO_KEY,
    name: HOOK_APP_DEMO_FOLDER,
    parentId: root.id,
  });
  const hookReference = await ensureKeyedGalleryFolder(
    supabase,
    projectId,
    userId,
    {
      key: HOOK_REFERENCE_KEY,
      name: HOOK_REFERENCE_FOLDER,
      parentId: hookAppDemo.id,
    }
  );
  return { root, hookAppDemo, hookReference };
}

export async function ensurePartsRootFolder(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<GalleryFolderRecord> {
  const root = await ensureDynamicsRootFolder(supabase, projectId, userId);
  return ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: PARTS_ROOT_KEY,
    name: PARTS_ROOT_FOLDER,
    parentId: root.id,
  });
}

export async function ensureMusicFolder(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<GalleryFolderRecord> {
  const root = await ensureDynamicsRootFolder(supabase, projectId, userId);
  return ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: MUSIC_FOLDER_KEY,
    name: MUSIC_FOLDER,
    parentId: root.id,
  });
}

export async function ensureDynamicsGalleryFolders(
  supabase: Db,
  projectId: string,
  userId: string
) {
  await ensureHookAppDemoFolders(supabase, projectId, userId);
  await ensurePartsRootFolder(supabase, projectId, userId);
  await ensureMusicFolder(supabase, projectId, userId);
}

function isReusableDynamicId(id: string) {
  return /^[a-z0-9-]{8,80}$/i.test(id);
}

export async function createCustomDynamicFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  rawName: string,
  preferredId?: string
): Promise<GalleryFolderRecord> {
  const name = clipFolderName(rawName);
  const lower = name.toLowerCase();
  if (
    lower === DYNAMICS_FOLDER.toLowerCase() ||
    lower === HOOK_APP_DEMO_FOLDER.toLowerCase() ||
    lower === HOOK_REFERENCE_FOLDER.toLowerCase() ||
    lower === PARTS_ROOT_FOLDER.toLowerCase() ||
    lower === MUSIC_FOLDER.toLowerCase()
  ) {
    throw new Error("Ese nombre ya está reservado para una dinámica nativa.");
  }

  const root = await ensureDynamicsRootFolder(supabase, projectId, userId);
  const { data: siblings, error } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("parent_id", root.id);
  if (error) throw new Error(error.message);
  const id =
    preferredId && isReusableDynamicId(preferredId)
      ? preferredId
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dyn-${Date.now()}`;
  const existingKey = (siblings ?? []).some(
    (row: FolderRow) => row.system_key === customDynamicKey(id)
  );
  const taken = (siblings ?? []).some(
    (row: FolderRow) => (row.name || "").toLowerCase() === lower
  );
  if (taken && !existingKey) {
    if (preferredId) {
      return ensureKeyedGalleryFolder(supabase, projectId, userId, {
        key: customDynamicKey(id),
        name: clipFolderName(`${name} ${id.slice(0, 6)}`),
        parentId: root.id,
      });
    }
    throw new Error("Ya existe una dinámica con ese nombre.");
  }

  return ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: customDynamicKey(id),
    name,
    parentId: root.id,
  });
}

export async function createCustomPartFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  rawName: string
): Promise<{ id: string; folder: GalleryFolderRecord }> {
  const name = clipFolderName(rawName);
  const lower = name.toLowerCase();
  const parent = await ensurePartsRootFolder(supabase, projectId, userId);
  const { data: siblings, error } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("parent_id", parent.id);
  if (error) throw new Error(error.message);
  const taken = (siblings ?? []).some(
    (row: FolderRow) => (row.name || "").toLowerCase() === lower
  );
  if (taken) {
    throw new Error("Ya existe una part con ese nombre.");
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `part-${Date.now()}`;
  const folder = await ensureKeyedGalleryFolder(supabase, projectId, userId, {
    key: customPartKey(id),
    name,
    parentId: parent.id,
  });
  return { id, folder };
}

async function deleteFolderBySystemKey(
  supabase: Db,
  projectId: string,
  userId: string,
  systemKey: string
) {
  const { data, error } = await supabase
    .from("project_gallery_folders")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", systemKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const folderId = (data as { id?: string } | null)?.id;
  if (!folderId) throw new Error("No encontrado");

  const { data: assets, error: assetsErr } = await supabase
    .from("project_gallery_assets")
    .select("storage_path")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("folder_id", folderId);
  if (assetsErr) throw new Error(assetsErr.message);
  const paths = ((assets ?? []) as { storage_path?: string }[])
    .map((a) => a.storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length && supabase.storage) {
    await supabase.storage.from("gallery").remove(paths);
  }

  const { error: delErr } = await supabase
    .from("project_gallery_folders")
    .delete()
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
}

export async function deleteCustomDynamicFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  id: string
) {
  await deleteFolderBySystemKey(supabase, projectId, userId, customDynamicKey(id));
}

export async function deleteCustomPartFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  id: string
) {
  await deleteFolderBySystemKey(supabase, projectId, userId, customPartKey(id));
}
