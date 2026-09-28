import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  burnImageOverlay,
  burnTopText,
} from "@/lib/creator/overlay-top-text";
import { downloadBinary } from "@/lib/download-binary";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";
import { normalizeHashtag } from "@/lib/gallery/asset";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 200 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "video.mp4"
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    videoUrl?: string;
    imageUrl?: string;
    url?: string;
    folderId?: string;
    name?: string;
    topText?: string;
    overlayY?: "top" | "center" | "bottom";
    textStyle?: "box" | "outline";
    kind?: "image" | "video";
    hashtag?: string;
    sortOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceUrl = (body.imageUrl || body.videoUrl || body.url || "").trim();
  const folderId = (body.folderId || "").trim();
  const asImage =
    body.kind === "image" || Boolean(body.imageUrl && !body.videoUrl);
  const name = sanitizeFileName(
    body.name || (asImage ? "image.jpg" : "video.mp4")
  );
  if (!sourceUrl || !folderId) {
    return NextResponse.json(
      { error: "url and folderId are required." },
      { status: 400 }
    );
  }

  const { data: folder } = await supabase
    .from("project_gallery_folders")
    .select("id")
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  let downloaded: { buffer: Buffer; contentType: string };
  try {
    downloaded = await downloadBinary(sourceUrl, MAX_BYTES);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not download the generated file.",
      },
      { status: 502 }
    );
  }

  const mime = downloaded.contentType;
  if (mime.includes("text/html") || mime.includes("application/json")) {
    return NextResponse.json(
      { error: "Higgsfield did not return a media file." },
      { status: 502 }
    );
  }
  const buf = downloaded.buffer;
  if (!buf.byteLength) {
    return NextResponse.json({ error: "Empty file." }, { status: 400 });
  }

  const looksImage =
    asImage || mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(sourceUrl);
  let contentType = looksImage
    ? mime.startsWith("image/")
      ? mime.split(";")[0]!.trim()
      : "image/jpeg"
    : "video/mp4";
  const kind = looksImage ? "image" : "video";

  let outBuf: Buffer = Buffer.from(buf);
  const topText = (body.topText || "").trim();
  const overlayY =
    body.overlayY === "center" || body.overlayY === "bottom"
      ? body.overlayY
      : "top";
  const textStyle = body.textStyle === "outline" ? "outline" : "box";
  if (topText) {
    try {
      if (kind === "video") {
        outBuf = Buffer.from(await burnTopText(buf, topText));
      } else {
        outBuf = Buffer.from(
          await burnImageOverlay(buf, topText, {
            overlayY,
            textStyle,
            contentType,
          })
        );
        contentType = "image/jpeg";
      }
    } catch {
      outBuf = Buffer.from(buf);
    }
  }

  const storagePath = `${projectId}/${crypto.randomUUID()}-${name}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  try {
    if (supabaseUrl && anonKey && accessToken) {
      await uploadStorageObject({
        supabaseUrl,
        accessToken,
        anonKey,
        bucket: "gallery",
        path: storagePath,
        body: outBuf,
        contentType,
      });
    } else {
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, outBuf, {
          contentType,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
    }
  } catch (e) {
    const { error: upErr } = await supabase.storage
      .from("gallery")
      .upload(storagePath, outBuf, {
        contentType,
        upsert: false,
      });
    if (upErr) {
      return NextResponse.json(
        {
          error:
            (e instanceof Error ? e.message : "Could not upload the file.") +
            (upErr.message ? ` / ${upErr.message}` : ""),
        },
        { status: 500 }
      );
    }
  }

  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(storagePath);
  let sortOrder = 0;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    sortOrder = Math.max(0, Math.round(body.sortOrder));
  } else if (folderId) {
    const { data: last } = await supabase
      .from("project_gallery_assets")
      .select("sort_order")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("folder_id", folderId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (Number(last?.sort_order) || 0) + 1;
  }
  const { data: row, error: dbErr } = await supabase
    .from("project_gallery_assets")
    .insert({
      project_id: projectId,
      user_id: user.id,
      folder_id: folderId,
      name,
      mime_type: contentType,
      size_bytes: outBuf.byteLength,
      kind,
      storage_path: storagePath,
      public_url: pub.publicUrl,
      hashtag: normalizeHashtag(body.hashtag, name.replace(/\.[^.]+$/, "")),
      sort_order: sortOrder,
    })
    .select("id, public_url")
    .single();

  if (dbErr || !row) {
    await supabase.storage.from("gallery").remove([storagePath]);
    return NextResponse.json(
      { error: dbErr?.message || "Could not save to gallery" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    asset: { id: row.id, publicUrl: row.public_url },
  });
}
