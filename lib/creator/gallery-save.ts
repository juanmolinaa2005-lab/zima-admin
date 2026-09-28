import { downloadBinary } from "@/lib/download-binary";
import { normalizeHashtag } from "@/lib/gallery/asset";
import { createClient } from "@/lib/supabase/server";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";

type Db = Awaited<ReturnType<typeof createClient>>;

const MAX_BYTES = 200 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "video.mp4"
  );
}

export async function saveScratchBuffer(opts: {
  supabase: Db;
  projectId: string;
  buffer: Buffer;
  contentType: string;
  name: string;
}): Promise<{ publicUrl: string }> {
  const name = sanitizeFileName(opts.name);
  if (!opts.buffer.byteLength) {
    throw new Error("Archivo vacío.");
  }
  const mime = (opts.contentType || "").toLowerCase();
  const contentType = mime.startsWith("video/")
    ? mime.split(";")[0]!.trim()
    : "video/mp4";
  const storagePath = `${opts.projectId}/scratch/${crypto.randomUUID()}-${name}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const {
    data: { session },
  } = await opts.supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (supabaseUrl && anonKey && accessToken) {
    await uploadStorageObject({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: "gallery",
      path: storagePath,
      body: opts.buffer,
      contentType,
    });
  } else {
    const { error: upErr } = await opts.supabase.storage
      .from("gallery")
      .upload(storagePath, opts.buffer, {
        contentType,
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
  }

  const { data: pub } = opts.supabase.storage
    .from("gallery")
    .getPublicUrl(storagePath);
  if (!pub.publicUrl) throw new Error("No se pudo publicar el recorte.");
  return { publicUrl: pub.publicUrl };
}

export async function saveBufferToGallery(opts: {
  supabase: Db;
  userId: string;
  projectId: string;
  buffer: Buffer;
  contentType: string;
  folderId: string;
  name: string;
  kind?: "image" | "video";
}): Promise<{ id: string; publicUrl: string }> {
  const name = sanitizeFileName(opts.name);
  if (!opts.buffer.byteLength) {
    throw new Error("Archivo vacío.");
  }
  const mime = (opts.contentType || "").toLowerCase();
  const looksImage =
    opts.kind === "image" || mime.startsWith("image/");
  const contentType = looksImage
    ? mime.startsWith("image/")
      ? mime.split(";")[0]!.trim()
      : "image/jpeg"
    : mime.startsWith("video/")
      ? mime.split(";")[0]!.trim()
      : "video/mp4";
  const kind = looksImage ? "image" : "video";
  const storagePath = `${opts.projectId}/${crypto.randomUUID()}-${name}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const {
    data: { session },
  } = await opts.supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (supabaseUrl && anonKey && accessToken) {
    await uploadStorageObject({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: "gallery",
      path: storagePath,
      body: opts.buffer,
      contentType,
    });
  } else {
    const { error: upErr } = await opts.supabase.storage
      .from("gallery")
      .upload(storagePath, opts.buffer, {
        contentType,
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
  }

  const { data: pub } = opts.supabase.storage
    .from("gallery")
    .getPublicUrl(storagePath);

  const { data: last } = await opts.supabase
    .from("project_gallery_assets")
    .select("sort_order")
    .eq("project_id", opts.projectId)
    .eq("user_id", opts.userId)
    .eq("folder_id", opts.folderId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (Number(last?.sort_order) || 0) + 1;

  const { data: row, error: dbErr } = await opts.supabase
    .from("project_gallery_assets")
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      folder_id: opts.folderId,
      name,
      mime_type: contentType,
      size_bytes: opts.buffer.byteLength,
      kind,
      storage_path: storagePath,
      public_url: pub.publicUrl,
      hashtag: normalizeHashtag(name.replace(/\.[^.]+$/, "")),
      sort_order: sortOrder,
    })
    .select("id, public_url")
    .single();

  if (dbErr || !row) {
    await opts.supabase.storage.from("gallery").remove([storagePath]);
    throw new Error(dbErr?.message || "No se pudo guardar en galería");
  }

  return { id: row.id as string, publicUrl: row.public_url as string };
}

export async function replaceGalleryAssetVideo(opts: {
  supabase: Db;
  assetId: string;
  projectId: string;
  buffer: Buffer;
  name?: string;
}): Promise<string> {
  const { data: asset, error: loadErr } = await opts.supabase
    .from("project_gallery_assets")
    .select("id, storage_path, name")
    .eq("id", opts.assetId)
    .eq("project_id", opts.projectId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!asset) throw new Error("No está en Galería");
  const name = sanitizeFileName(opts.name || String(asset.name || "video.mp4"));
  const storagePath = `${opts.projectId}/${crypto.randomUUID()}-${name}`;
  const { error: upErr } = await opts.supabase.storage
    .from("gallery")
    .upload(storagePath, opts.buffer, {
      contentType: "video/mp4",
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);
  const { data: pub } = opts.supabase.storage
    .from("gallery")
    .getPublicUrl(storagePath);
  const { error: updErr } = await opts.supabase
    .from("project_gallery_assets")
    .update({
      storage_path: storagePath,
      public_url: pub.publicUrl,
      size_bytes: opts.buffer.byteLength,
      mime_type: "video/mp4",
    })
    .eq("id", opts.assetId)
    .eq("project_id", opts.projectId);
  if (updErr) throw new Error(updErr.message);
  const oldPath = String(asset.storage_path || "");
  if (oldPath && oldPath !== storagePath) {
    await opts.supabase.storage.from("gallery").remove([oldPath]).catch(() => undefined);
  }
  return pub.publicUrl;
}

export async function saveRemoteMediaToGallery(opts: {
  supabase: Db;
  userId: string;
  projectId: string;
  sourceUrl: string;
  folderId: string;
  name: string;
  kind?: "image" | "video";
}): Promise<{ id: string; publicUrl: string }> {
  const downloaded = await downloadBinary(opts.sourceUrl, MAX_BYTES);
  const mime = downloaded.contentType;
  if (mime.includes("text/html") || mime.includes("application/json")) {
    throw new Error("La URL no devolvió un archivo de media.");
  }
  const looksImage =
    opts.kind === "image" ||
    mime.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(opts.sourceUrl);
  const contentType = looksImage
    ? mime.startsWith("image/")
      ? mime.split(";")[0]!.trim()
      : "image/jpeg"
    : mime.startsWith("video/")
      ? mime.split(";")[0]!.trim()
      : "video/mp4";
  return saveBufferToGallery({
    supabase: opts.supabase,
    userId: opts.userId,
    projectId: opts.projectId,
    buffer: downloaded.buffer,
    contentType,
    folderId: opts.folderId,
    name: opts.name,
    kind: looksImage ? "image" : "video",
  });
}
