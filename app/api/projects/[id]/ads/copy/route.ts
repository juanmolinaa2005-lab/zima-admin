import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { generateCopies } from "@/lib/marketing/ai";
import { AD_PLATFORMS } from "@/lib/marketing/types";

type Params = { params: Promise<{ id: string }> };

/** Returns copy drafts without saving; the client decides which ones become creatives. */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { count?: number; platform?: string; angle?: string; brief?: string };
  const platform = AD_PLATFORMS.find((p) => p.id === body.platform)?.label ?? "Meta Ads";
  const count = Math.min(8, Math.max(1, Math.round(Number(body.count) || 4)));

  const { data: project } = await gate.supabase.from("projects").select("name, description").eq("id", projectId).single();

  try {
    const result = await generateCopies(
      { name: project?.name ?? "mi producto", description: project?.description ?? null, brief: body.brief?.slice(0, 500) },
      { count, platform, angle: body.angle?.slice(0, 80) || undefined },
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudieron generar copys" }, { status: 502 });
  }
}
