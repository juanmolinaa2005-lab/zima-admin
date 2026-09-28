import { GALLERY_ASSET_SELECT, mapGalleryAsset, type GalleryAsset } from "@/lib/gallery/asset";
import {
  GALLERY_FOLDER_SELECT,
  ensureAppDemoGalleryFolder,
  mapGalleryFolder,
  type GalleryFolderRecord,
} from "@/lib/gallery/app-demo-folder";
import {
  HOOK_APP_DEMO_FOLDER,
  HOOK_APP_DEMO_ID,
  MUSIC_FOLDER_KEY,
  PARTS_ROOT_KEY,
  customDynamicIdFromKey,
  customDynamicKey,
  customPartIdFromKey,
  customPartKey,
  ensureHookAppDemoFolders,
  ensureMusicFolder,
  ensurePartsRootFolder,
} from "@/lib/gallery/dynamics-folder";
import { openaiChatJson } from "@/lib/openai/chat";
import {
  normalizeOverlayLanguage,
  overlayLanguageName,
  type OverlayLanguageId,
} from "@/lib/creator/overlay-language";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPTY_DYNAMIC_EXTRAS,
  extrasFromPartial,
  parseDynamicExtras,
  parseDynamicPartKind,
  parseDynamicPartMeta,
  type DynamicPart,
  type DynamicPartMeta,
  type DynamicTemplateExtras,
  type StudioDynamic,
} from "@/lib/creator/dynamics";

const FOLDER_WITH_META = `${GALLERY_FOLDER_SELECT}, meta`;

let metaColumnReady: Promise<void> | null = null;

function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function runSql(sql: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = projectRefFromUrl(url);
  if (!token || !ref) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: sql }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 240));
  }
}

async function folderMetaColumnExists() {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from("project_gallery_folders").select("meta").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function ensureFolderMetaColumn() {
  if (!metaColumnReady) {
    metaColumnReady = (async () => {
      if (await folderMetaColumnExists()) return;
      await runSql(
        "alter table public.project_gallery_folders add column if not exists meta jsonb not null default '{}'::jsonb"
      );
    })().catch((err) => {
      metaColumnReady = null;
      throw err;
    });
  }
  try {
    await metaColumnReady;
  } catch {
    /* GET can still return folders without extras */
  }
}

type Db = {
  from: (table: string) => {
    select: (cols: string) => any;
    insert: (row: Record<string, unknown>) => any;
    update: (row: Record<string, unknown>) => any;
    delete: () => any;
  };
};

export async function loadStudioDynamics(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<StudioDynamic[]> {
  const appDemo = await ensureAppDemoGalleryFolder(supabase, projectId, userId);
  const folders = await ensureHookAppDemoFolders(supabase, projectId, userId);
  await ensureFolderMetaColumn();
  const withMeta = await supabase
    .from("project_gallery_folders")
    .select(FOLDER_WITH_META)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("parent_id", folders.root.id)
    .order("created_at", { ascending: true });
  const children = withMeta.error
    ? await supabase
        .from("project_gallery_folders")
        .select(GALLERY_FOLDER_SELECT)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("parent_id", folders.root.id)
        .order("created_at", { ascending: true })
    : withMeta;
  if (children.error) throw new Error(children.error.message);

  const builtin: StudioDynamic = {
    id: HOOK_APP_DEMO_ID,
    name: HOOK_APP_DEMO_FOLDER,
    description:
      "Un hook y después la demo de la app, unidos en un solo video.",
    builtin: true,
    folderId: folders.hookAppDemo.id,
    ...EMPTY_DYNAMIC_EXTRAS,
    slots: [
      {
        id: "hook-reference",
        name: "Hook",
        description:
          "Clips de hook. Viven en Galería › Dynamics › Hook + App Demo.",
        folderId: folders.hookReference.id,
        allowTrim: true,
      },
      {
        id: "app-demo",
        name: "App Demo",
        description:
          "Videos de la carpeta nativa de App Demo. Los mismos del estudio.",
        folderId: appDemo.id,
        allowTrim: false,
      },
    ],
  };

  const custom: StudioDynamic[] = ((children.data ?? []) as {
    id: string;
    name: string;
    parent_id: string | null;
    kind?: string | null;
    system_key?: string | null;
    created_at: string;
    meta?: unknown;
  }[])
    .flatMap((row) => {
      const folder = mapGalleryFolder(row);
      if (
        folder.systemKey === PARTS_ROOT_KEY ||
        folder.systemKey === MUSIC_FOLDER_KEY
      ) {
        return [];
      }
      const id = customDynamicIdFromKey(folder.systemKey);
      if (!id) return [];
      const extras = parseDynamicExtras(row.meta);
      return [
        {
          id,
          name: extras.name || folder.name,
          description: "Plantilla: parts, overlay y música.",
          builtin: false,
          folderId: folder.id,
          ...EMPTY_DYNAMIC_EXTRAS,
          ...extras,
          slots: [],
        } satisfies StudioDynamic,
      ];
    });

  return [builtin, ...custom];
}

export async function loadStudioParts(
  supabase: Db,
  projectId: string,
  userId: string
): Promise<{ parts: DynamicPart[]; musicFolderId: string }> {
  const parent = await ensurePartsRootFolder(supabase, projectId, userId);
  const music = await ensureMusicFolder(supabase, projectId, userId);
  await ensureFolderMetaColumn();
  const withMeta = await supabase
    .from("project_gallery_folders")
    .select(FOLDER_WITH_META)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  const children = withMeta.error
    ? await supabase
        .from("project_gallery_folders")
        .select(GALLERY_FOLDER_SELECT)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("parent_id", parent.id)
        .order("created_at", { ascending: true })
    : withMeta;
  if (children.error) throw new Error(children.error.message);

  const folders = ((children.data ?? []) as {
    id: string;
    name: string;
    parent_id: string | null;
    kind?: string | null;
    system_key?: string | null;
    created_at: string;
    meta?: unknown;
  }[])
    .flatMap((row) => {
      const folder = mapGalleryFolder(row);
      const id = customPartIdFromKey(folder.systemKey);
      if (!id) return [];
      return [{ id, folder, meta: parseDynamicPartMeta(row.meta) }];
    });

  const parts: DynamicPart[] = [];
  for (const item of folders) {
    const videos = await listFolderAssetsByKind(
      supabase,
      projectId,
      userId,
      item.folder.id,
      "video"
    );
    const audios = await listFolderAssetsByKind(
      supabase,
      projectId,
      userId,
      item.folder.id,
      "audio"
    );
    parts.push({
      id: item.id,
      name: item.folder.name,
      kind: item.meta.kind || "video",
      folderId: item.folder.id,
      prompts: item.meta.prompts,
      videoCount: videos.length,
      previewUrl: videos[0]?.publicUrl || null,
      audioCount: audios.length,
      audioUrl: audios[0]?.publicUrl || null,
      overlayStyle: item.meta.overlayStyle,
      overlayPosition: item.meta.overlayPosition,
      overlayPrompt: item.meta.overlayPrompt || "",
      overlayLanguage:
        item.meta.kind === "overlay"
          ? normalizeOverlayLanguage(item.meta.overlayLanguage)
          : undefined,
    });
  }

  return { parts, musicFolderId: music.id };
}

export async function listFolderVideoAssets(
  supabase: Db,
  projectId: string,
  userId: string,
  folderId: string
): Promise<GalleryAsset[]> {
  return listFolderAssetsByKind(supabase, projectId, userId, folderId, "video");
}

async function loadVideoAssetById(
  supabase: Db,
  projectId: string,
  userId: string,
  assetId: string
): Promise<GalleryAsset | null> {
  const { data, error } = await supabase
    .from("project_gallery_assets")
    .select(GALLERY_ASSET_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  if (error || !data) return null;
  const asset = mapGalleryAsset(data);
  return asset.kind === "video" && asset.publicUrl ? asset : null;
}

export async function listFolderAssetsByKind(
  supabase: Db,
  projectId: string,
  userId: string,
  folderId: string,
  kind: "video" | "audio"
): Promise<GalleryAsset[]> {
  const { data, error } = await supabase
    .from("project_gallery_assets")
    .select(GALLERY_ASSET_SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("folder_id", folderId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row: Parameters<typeof mapGalleryAsset>[0]) => mapGalleryAsset(row))
    .filter((asset: GalleryAsset) => Boolean(asset.publicUrl));
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export async function resolveOverlayCaption(opts: {
  apiKey: string | null;
  mode: DynamicTemplateExtras["overlayMode"];
  lines: string[];
  prompt: string;
  fallback: string;
  language?: OverlayLanguageId | string | null;
}): Promise<string> {
  const lines = opts.lines.map((line) => line.trim()).filter(Boolean);
  const fallback = (lines[0] || opts.fallback || "").trim().slice(0, 140);
  if (opts.mode === "prompt" && opts.prompt.trim() && opts.apiKey) {
    const language = overlayLanguageName(opts.language);
    try {
      const data = await openaiChatJson<{ text?: string }>(opts.apiKey, {
        model: "gpt-4o-mini",
        temperature: 0.9,
        maxTokens: 80,
        system: `Write one short on-screen caption for a vertical social video. Return JSON {"text":"..."}. Max 80 characters. Write the caption in ${language}, even if the prompt is in another language. No hashtags and no quotation marks.`,
        user: opts.prompt.trim().slice(0, 800),
      });
      const text = (data.text || "").replace(/^["']|["']$/g, "").trim().slice(0, 140);
      if (text) return text;
    } catch {
      /* use the list or the saved line */
    }
  }
  if (opts.mode === "list" && lines.length) return pickOne(lines).slice(0, 140);
  return fallback;
}

export function pickHookAppDemoClips(opts: {
  mode: "random" | "manual";
  hookVideos: GalleryAsset[];
  demoVideos: GalleryAsset[];
  hookAssetId?: string;
  demoAssetId?: string;
}): { hook: GalleryAsset; demo: GalleryAsset } {
  if (!opts.hookVideos.length) {
    throw new Error(
      "No hay videos de hook. Súbelos en Dynamics › Hook + App Demo."
    );
  }
  if (!opts.demoVideos.length) {
    throw new Error(
      "No hay videos de demo. Créalos en App Demo o súbelos en Dynamics."
    );
  }

  if (opts.mode === "manual") {
    const hook =
      opts.hookVideos.find((item) => item.id === opts.hookAssetId) ?? null;
    const demo =
      opts.demoVideos.find((item) => item.id === opts.demoAssetId) ?? null;
    if (!hook) throw new Error("Elige un video de hook.");
    if (!demo) throw new Error("Elige un video de demo.");
    return { hook, demo };
  }

  return {
    hook: pickOne(opts.hookVideos),
    demo: pickOne(opts.demoVideos),
  };
}

export type DynamicRenderClip = {
  url: string;
  durationSec: number;
  trimStart: number;
};

export type DynamicRenderPlan = {
  name: string;
  mimic: DynamicRenderClip;
  tails: DynamicRenderClip[];
  overlayText: string;
  overlayEnabled: boolean;
  overlayMode: DynamicTemplateExtras["overlayMode"];
  overlayLines: string[];
  overlayPrompt: string;
  overlayLanguage: OverlayLanguageId;
  overlayStyle?: DynamicPart["overlayStyle"];
  overlayPosition?: DynamicPart["overlayPosition"];
};

export async function resolveCustomDynamicPlan(
  supabase: Db,
  projectId: string,
  userId: string,
  dynamic: StudioDynamic,
  parts: DynamicPart[],
  mode: "random" | "manual"
): Promise<DynamicRenderPlan> {
  const extras = extrasFromPartial(dynamic);
  const partIds = extras.videoPartIds.length
    ? extras.videoPartIds
    : [extras.partAId, extras.partBId].filter(
        (id): id is string => typeof id === "string" && Boolean(id)
      );
  const ordered = partIds
    .map((id, i) => ({ id, i }))
    .sort((a, b) => {
      const mimicA = parts.find((item) => item.id === a.id)?.kind === "mimic" ? 0 : 1;
      const mimicB = parts.find((item) => item.id === b.id)?.kind === "mimic" ? 0 : 1;
      return mimicA - mimicB || a.i - b.i;
    });
  if (!ordered.length) {
    throw new Error(
      "Esta dinámica no tiene clips. Ábrela, añade Mimic Motion y el otro video del editor."
    );
  }

  const clips: DynamicRenderClip[] = [];
  for (const item of ordered) {
    const part = parts.find((entry) => entry.id === item.id);
    if (!part?.folderId) continue;
    const videos = part.folderId
      ? await listFolderVideoAssets(supabase, projectId, userId, part.folderId)
      : [];
    const preferredId = extras.videoAssetIds[item.i];
    const picked =
      (preferredId && videos.find((entry) => entry.id === preferredId)) ||
      (preferredId
        ? await loadVideoAssetById(supabase, projectId, userId, preferredId)
        : null) ||
      (videos.length
        ? mode === "manual"
          ? videos[0]
          : pickOne(videos)
        : null);
    if (!picked?.publicUrl) continue;
    const durationSec =
      extras.videoDurations[item.i] && extras.videoDurations[item.i]! > 0
        ? extras.videoDurations[item.i]!
        : 0;
    const trimStart =
      extras.videoTrimStarts[item.i] && extras.videoTrimStarts[item.i]! > 0
        ? extras.videoTrimStarts[item.i]!
        : 0;
    clips.push({
      url: picked.publicUrl,
      durationSec,
      trimStart,
    });
  }

  if (!clips[0]) {
    throw new Error(
      "Falta el video de Mimic Motion. Ábrela y súbelo en esa part."
    );
  }

  const overlayPart = parts.find((item) => item.id === extras.overlayPartId);
  const overlayLines = (overlayPart?.prompts || [])
    .map((item) => item.text.trim().slice(0, 140))
    .filter(Boolean);
  const overlayPrompt = (overlayPart?.overlayPrompt || "").trim().slice(0, 800);
  const overlayText =
    extras.overlayEnabled && extras.overlayText.trim()
      ? extras.overlayText.trim()
      : overlayLines[0] || "";
  return {
    name: extras.name || dynamic.name,
    mimic: clips[0],
    tails: clips.slice(1),
    overlayText,
    overlayEnabled: extras.overlayEnabled,
    overlayMode: extras.overlayMode === "prompt" ? "prompt" : "list",
    overlayLines,
    overlayPrompt,
    overlayLanguage: normalizeOverlayLanguage(overlayPart?.overlayLanguage),
    overlayStyle: overlayPart?.overlayStyle || extras.overlayStyle,
    overlayPosition: overlayPart?.overlayPosition || extras.overlayPosition,
  };
}


async function updateFolderByKey(
  supabase: Db,
  projectId: string,
  userId: string,
  systemKey: string,
  row: Record<string, unknown>
) {
  await ensureFolderMetaColumn();
  const { data, error } = await supabase
    .from("project_gallery_folders")
    .update(row)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", systemKey)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No encontrado");
}

export async function saveStudioDynamicExtras(
  supabase: Db,
  projectId: string,
  userId: string,
  dynamicId: string,
  raw: unknown
) {
  const extras = extrasFromPartial(parseDynamicExtras(raw));
  await updateFolderByKey(supabase, projectId, userId, customDynamicKey(dynamicId), {
    ...(extras.name ? { name: extras.name } : {}),
    meta: { extras },
  });
  return extras;
}

export async function saveStudioPartMeta(
  supabase: Db,
  projectId: string,
  userId: string,
  partId: string,
  raw: unknown
) {
  await ensureFolderMetaColumn();
  const { data: current } = await supabase
    .from("project_gallery_folders")
    .select("meta")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("system_key", customPartKey(partId))
    .maybeSingle();
  const prev = parseDynamicPartMeta((current as { meta?: unknown } | null)?.meta);
  const incoming = parseDynamicPartMeta(raw);
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const text = typeof o.text === "string" ? o.text.slice(0, 140) : undefined;
  const kind = o.kind !== undefined ? parseDynamicPartKind(o.kind) : prev.kind;
  const meta: DynamicPartMeta = {
    kind,
    prompts:
      text !== undefined
        ? [{ id: prev.prompts[0]?.id || incoming.prompts[0]?.id || `prompt-${Date.now()}`, text }]
        : o.prompts !== undefined
          ? incoming.prompts
          : prev.prompts,
    overlayStyle: incoming.overlayStyle ?? prev.overlayStyle,
    overlayPosition: incoming.overlayPosition ?? prev.overlayPosition,
    overlayPrompt:
      typeof o.overlayPrompt === "string"
        ? o.overlayPrompt.slice(0, 800)
        : prev.overlayPrompt || "",
    overlayLanguage:
      kind === "overlay"
        ? o.overlayLanguage !== undefined
          ? normalizeOverlayLanguage(o.overlayLanguage)
          : prev.overlayLanguage || "es"
        : undefined,
  };
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  await updateFolderByKey(supabase, projectId, userId, customPartKey(partId), {
    ...(name ? { name } : {}),
    meta: { part: meta },
  });
  return meta;
}
