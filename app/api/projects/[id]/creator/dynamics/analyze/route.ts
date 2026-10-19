import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import {
  analyzeVideoDynamic,
  projectGalleryVideoUrl,
} from "@/lib/creator/video-dynamic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta OpenAI en Supabase → Secrets para analizar el video.",
      },
      { status: 403 }
    );
  }

  let body: { videoUrl?: string };
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

  try {
    const draft = await analyzeVideoDynamic(apiKey, videoUrl);
    return NextResponse.json(draft);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "No se pudo analizar el video",
      },
      { status: 400 }
    );
  }
}
