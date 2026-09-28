import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  clipReferenceVideo,
  projectGalleryVideoUrl,
} from "@/lib/creator/video-dynamic";
import {
  MOTION_CLONE_MAX_SEC,
  MOTION_CLONE_MIN_SEC,
  MOTION_CLONE_TRIM_MIN_SEC,
} from "@/lib/creator/motion-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: { videoUrl?: string; startSec?: number; endSec?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const videoUrl = projectGalleryVideoUrl(body.videoUrl, projectId);
  if (!videoUrl) {
    return NextResponse.json(
      { error: "Sube el video al bucket del proyecto." },
      { status: 400 }
    );
  }

  const startSec = Number(body.startSec);
  const endSec = Number(body.endSec);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return NextResponse.json({ error: "Recorte inválido" }, { status: 400 });
  }
  if (endSec - startSec < MOTION_CLONE_TRIM_MIN_SEC - 0.02) {
    return NextResponse.json(
      { error: "El recorte es demasiado corto." },
      { status: 400 }
    );
  }
  if (endSec - startSec > MOTION_CLONE_MAX_SEC + 0.2) {
    return NextResponse.json(
      { error: `El recorte no puede superar ${MOTION_CLONE_MAX_SEC} s.` },
      { status: 400 }
    );
  }

  try {
    const clipped = await clipReferenceVideo(videoUrl, startSec, endSec);
    const storagePath = `${projectId}/dynamics/clips/${crypto.randomUUID()}.mp4`;
    const { error: upErr } = await gate.supabase.storage
      .from("gallery")
      .upload(storagePath, clipped.buffer, {
        contentType: "video/mp4",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
    const clippedUrl = gate.supabase.storage
      .from("gallery")
      .getPublicUrl(storagePath).data.publicUrl;
    const duration = String(
      Math.max(
        MOTION_CLONE_MIN_SEC,
        Math.round(
          Math.min(MOTION_CLONE_MAX_SEC, clipped.durationSec || endSec - startSec)
        )
      )
    );
    return NextResponse.json({
      videoUrl: clippedUrl,
      duration,
      storagePath,
      sizeBytes: clipped.buffer.length,
      mimeType: "video/mp4",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "No se pudo recortar el video",
      },
      { status: 400 }
    );
  }
}
