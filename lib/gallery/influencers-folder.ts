import {
  GALLERY_FOLDER_SELECT,
  mapGalleryFolder,
  type GalleryFolderRecord,
} from "@/lib/gallery/app-demo-folder";

export const INFLUENCERS_FOLDER = "Influencers";
export const INFLUENCERS_FOLDER_KEY = "influencers";

export function influencerFolderKey(influencerId: string) {
  return `influencer:${influencerId}`;
}

export function isInfluencerFolderKey(systemKey: string | null | undefined) {
  return (systemKey || "").startsWith("influencer:");
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
  };
};

function clipFolderName(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim() || "Influencer";
  return name.slice(0, 120);
}

export async function ensureInfluencersGalleryFolder(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<GalleryFolderRecord> {
  const { data: keyed, error: keyedErr } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", INFLUENCERS_FOLDER_KEY)
    .maybeSingle();
  if (keyedErr) throw new Error(keyedErr.message);
  if (keyed) {
    const row = keyed as FolderRow;
    if (row.name !== INFLUENCERS_FOLDER || row.parent_id !== null) {
      const { data: fixed, error: fixErr } = await supabase
        .from("project_gallery_folders")
        .update({ name: INFLUENCERS_FOLDER, parent_id: null })
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
    .ilike("name", INFLUENCERS_FOLDER)
    .is("parent_id", null)
    .limit(1);
  if (namedErr) throw new Error(namedErr.message);
  const named = (Array.isArray(namedRows) ? namedRows[0] : namedRows) as
    | FolderRow
    | undefined;
  if (named) {
    const { data: stamped, error: stampErr } = await supabase
      .from("project_gallery_folders")
      .update({
        system_key: INFLUENCERS_FOLDER_KEY,
        name: INFLUENCERS_FOLDER,
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
      parent_id: null,
      name: INFLUENCERS_FOLDER,
      kind: "folder",
      system_key: INFLUENCERS_FOLDER_KEY,
    })
    .select(GALLERY_FOLDER_SELECT)
    .single();
  if (createErr) {
    const { data: raced } = await supabase
      .from("project_gallery_folders")
      .select(GALLERY_FOLDER_SELECT)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("system_key", INFLUENCERS_FOLDER_KEY)
      .maybeSingle();
    if (raced) return mapGalleryFolder(raced as FolderRow);
    throw new Error(createErr.message);
  }
  if (!created) throw new Error("No se pudo crear la carpeta Influencers");
  return mapGalleryFolder(created as FolderRow);
}

async function moveInfluencerAssets(
  supabase: Db,
  opts: {
    projectId: string;
    userId: string;
    influencerId: string;
    folderId: string;
  }
) {
  const { data: videos } = await supabase
    .from("estudio_influencer_videos")
    .select("asset_id")
    .eq("influencer_id", opts.influencerId)
    .eq("project_id", opts.projectId);
  const ids = [
    ...new Set(
      (videos ?? [])
        .map((row: { asset_id?: string | null }) => row.asset_id)
        .filter((id: string | null | undefined): id is string => Boolean(id))
    ),
  ];
  if (!ids.length) return;
  await supabase
    .from("project_gallery_assets")
    .update({ folder_id: opts.folderId })
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .in("id", ids);
}

export async function ensureInfluencerPersonFolder(
  supabase: Db,
  projectId: string,
  userId: string,
  influencer: { id: string; name: string; folderId?: string | null }
): Promise<GalleryFolderRecord> {
  const parent = await ensureInfluencersGalleryFolder(supabase, projectId, userId);
  const key = influencerFolderKey(influencer.id);
  const name = clipFolderName(influencer.name);

  const { data: keyed, error: keyedErr } = await supabase
    .from("project_gallery_folders")
    .select(GALLERY_FOLDER_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", key)
    .maybeSingle();
  if (keyedErr) throw new Error(keyedErr.message);

  let folder: GalleryFolderRecord | null = keyed
    ? mapGalleryFolder(keyed as FolderRow)
    : null;

  if (!folder && influencer.folderId) {
    const { data: existing } = await supabase
      .from("project_gallery_folders")
      .select(GALLERY_FOLDER_SELECT)
      .eq("id", influencer.folderId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    const row = existing as FolderRow | null;
    if (row && (row.parent_id === parent.id || !row.system_key)) {
      const { data: stamped, error: stampErr } = await supabase
        .from("project_gallery_folders")
        .update({
          system_key: key,
          parent_id: parent.id,
          name,
          kind: "folder",
        })
        .eq("id", row.id)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .select(GALLERY_FOLDER_SELECT)
        .single();
      if (stampErr) throw new Error(stampErr.message);
      folder = mapGalleryFolder((stamped as FolderRow) ?? row);
    }
  }

  if (!folder) {
    const { data: created, error: createErr } = await supabase
      .from("project_gallery_folders")
      .insert({
        project_id: projectId,
        user_id: userId,
        parent_id: parent.id,
        name,
        kind: "folder",
        system_key: key,
      })
      .select(GALLERY_FOLDER_SELECT)
      .single();
    if (createErr) {
      const { data: raced } = await supabase
        .from("project_gallery_folders")
        .select(GALLERY_FOLDER_SELECT)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("system_key", key)
        .maybeSingle();
      if (!raced) throw new Error(createErr.message);
      folder = mapGalleryFolder(raced as FolderRow);
    } else {
      if (!created) throw new Error("No se pudo crear la carpeta del influencer");
      folder = mapGalleryFolder(created as FolderRow);
    }
  } else if (folder.name !== name || folder.parentId !== parent.id) {
    const { data: fixed, error: fixErr } = await supabase
      .from("project_gallery_folders")
      .update({ name, parent_id: parent.id })
      .eq("id", folder.id)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .select(GALLERY_FOLDER_SELECT)
      .single();
    if (fixErr) throw new Error(fixErr.message);
    if (fixed) folder = mapGalleryFolder(fixed as FolderRow);
  }

  if (influencer.folderId !== folder.id) {
    await supabase
      .from("estudio_influencers")
      .update({ folder_id: folder.id })
      .eq("id", influencer.id)
      .eq("project_id", projectId)
      .eq("user_id", userId);
    await moveInfluencerAssets(supabase, {
      projectId,
      userId,
      influencerId: influencer.id,
      folderId: folder.id,
    });
  }

  return folder;
}

export async function syncInfluencerGalleryFolders(
  supabase: Db,
  projectId: string,
  userId: string
) {
  await ensureInfluencersGalleryFolder(supabase, projectId, userId);
  const { data: rows, error } = await supabase
    .from("estudio_influencers")
    .select("id, name, folder_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .limit(40);
  if (error) throw new Error(error.message);
  for (const row of (rows ?? []) as {
    id: string;
    name: string;
    folder_id?: string | null;
  }[]) {
    await ensureInfluencerPersonFolder(supabase, projectId, userId, {
      id: row.id,
      name: row.name,
      folderId: row.folder_id ?? null,
    });
  }
}
