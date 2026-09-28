import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  GALLERY_ASSET_SELECT,
  hashtagFromFileName,
  mapGalleryAsset,
  normalizeHashtag,
} from "@/lib/gallery/asset";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED_PREFIX = ["image/", "video/", "audio/"];
const ALLOWED_EXACT = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
]);

function assetKind(mime: string): "image" | "video" | "audio" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "file"
  );
}

function isAllowedMime(mime: string) {
  return (
    ALLOWED_EXACT.has(mime) || ALLOWED_PREFIX.some((p) => mime.startsWith(p))
  );
}

type Db = Awaited<ReturnType<typeof requireProjectOwner>> & { ok: true };

async function assertFolder(
  supabase: Db["supabase"],
  projectId: string,
  userId: string,
  folderId: string | null
) {
  if (!folderId) return null;
  const { data: folder, error } = await supabase
    .from("project_gallery_folders")
    .select("id, kind")
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!folder) {
    const err = new Error("Carpeta no encontrada");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  return folderId;
}

async function nextSortOrder(
  supabase: Db["supabase"],
  projectId: string,
  userId: string,
  folderId: string | null
) {
  if (!folderId) return 0;
  const { data } = await supabase
    .from("project_gallery_assets")
    .select("sort_order")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("folder_id", folderId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(data?.sort_order) || 0) + 1;
}

/** Register asset after client-side Storage upload (preferred for large videos). */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const contentType = request.headers.get("content-type") || "";

  // JSON register path
  if (contentType.includes("application/json")) {
    let body: {
      name?: string;
      mimeType?: string;
      sizeBytes?: number;
      storagePath?: string;
      publicUrl?: string;
      folderId?: string | null;
      files?: {
        name: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
        publicUrl: string;
        hashtag?: string | null;
      }[];
      hashtag?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const items =
      Array.isArray(body.files) && body.files.length
        ? body.files
        : body.storagePath
          ? [
              {
                name: body.name || "file",
                mimeType: body.mimeType || "application/octet-stream",
                sizeBytes: body.sizeBytes || 0,
                storagePath: body.storagePath,
                publicUrl: body.publicUrl || "",
                hashtag: body.hashtag,
              },
            ]
          : [];

    if (!items.length) {
      return NextResponse.json({ error: "Faltan archivos" }, { status: 400 });
    }

    let folderId: string | null = null;
    try {
      folderId = await assertFolder(
        supabase,
        projectId,
        user.id,
        body.folderId && body.folderId !== "root" ? body.folderId : null
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const status =
        e instanceof Error && "status" in e
          ? Number((e as { status: number }).status)
          : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const uploaded = [];
    const errors: string[] = [];
    let sortCursor = await nextSortOrder(supabase, projectId, user.id, folderId);

    for (const item of items) {
      const mime = (item.mimeType || "").toLowerCase();
      if (!isAllowedMime(mime)) {
        errors.push(`${item.name}: tipo no permitido`);
        continue;
      }
      if (!item.storagePath?.startsWith(`${projectId}/`)) {
        errors.push(`${item.name}: ruta inválida`);
        continue;
      }
      if (item.sizeBytes < 0 || item.sizeBytes > MAX_BYTES) {
        errors.push(`${item.name}: tamaño inválido`);
        continue;
      }

      const hashtag =
        normalizeHashtag(item.hashtag) || hashtagFromFileName(item.name);

      const { data: row, error: dbErr } = await supabase
        .from("project_gallery_assets")
        .insert({
          project_id: projectId,
          user_id: user.id,
          folder_id: folderId,
          name: sanitizeFileName(item.name),
          mime_type: mime,
          size_bytes: item.sizeBytes,
          kind: assetKind(mime),
          storage_path: item.storagePath,
          public_url:
            item.publicUrl ||
            supabase.storage.from("gallery").getPublicUrl(item.storagePath)
              .data.publicUrl,
          hashtag,
          sort_order: sortCursor++,
        })
        .select(GALLERY_ASSET_SELECT)
        .single();

      if (dbErr || !row) {
        errors.push(`${item.name}: ${dbErr?.message || "No se pudo guardar"}`);
        continue;
      }

      uploaded.push(mapGalleryAsset(row));
    }

    if (!uploaded.length) {
      return NextResponse.json(
        { error: errors[0] || "No se pudo registrar", errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ assets: uploaded, errors });
  }

  // Multipart fallback (small files)
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  if (single instanceof File) files.push(single);

  if (!files.length) {
    return NextResponse.json({ error: "Faltan archivos" }, { status: 400 });
  }

  const folderRaw = form.get("folderId");
  let folderId: string | null = null;
  try {
    folderId = await assertFolder(
      supabase,
      projectId,
      user.id,
      typeof folderRaw === "string" && folderRaw && folderRaw !== "root"
        ? folderRaw
        : null
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof Error && "status" in e
        ? Number((e as { status: number }).status)
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const uploaded = [];
  const errors: string[] = [];
  let sortCursor = await nextSortOrder(supabase, projectId, user.id, folderId);

  for (const file of files) {
    const mime = (file.type || "application/octet-stream").toLowerCase();
    if (!isAllowedMime(mime)) {
      errors.push(`${file.name}: tipo no permitido`);
      continue;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      errors.push(`${file.name}: tamaño inválido (máx 200 MB)`);
      continue;
    }

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("gallery")
      .upload(storagePath, buffer, { contentType: mime, upsert: false });

    if (upErr) {
      errors.push(`${file.name}: ${upErr.message}`);
      continue;
    }

    const { data: pub } = supabase.storage
      .from("gallery")
      .getPublicUrl(storagePath);

    const hashtag = hashtagFromFileName(safeName);

    const { data: row, error: dbErr } = await supabase
      .from("project_gallery_assets")
      .insert({
        project_id: projectId,
        user_id: user.id,
        folder_id: folderId,
        name: safeName,
        mime_type: mime,
        size_bytes: file.size,
        kind: assetKind(mime),
        storage_path: storagePath,
        public_url: pub.publicUrl,
        hashtag,
        sort_order: sortCursor++,
      })
      .select(GALLERY_ASSET_SELECT)
      .single();

    if (dbErr || !row) {
      await supabase.storage.from("gallery").remove([storagePath]);
      errors.push(`${file.name}: ${dbErr?.message || "No se pudo guardar"}`);
      continue;
    }

    uploaded.push(mapGalleryAsset(row));
  }

  if (!uploaded.length) {
    return NextResponse.json(
      { error: errors[0] || "No se pudo subir ningún archivo", errors },
      { status: 400 }
    );
  }

  return NextResponse.json({ assets: uploaded, errors });
}
