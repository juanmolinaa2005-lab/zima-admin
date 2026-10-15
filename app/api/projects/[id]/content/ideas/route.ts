import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { generateIdeas } from "@/lib/marketing/ai";
import { CONTENT_PLATFORMS } from "@/lib/marketing/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

  const body = (await request.json().catch(() => ({}))) as { count?: number; platform?: string; brief?: string };
  const platform = CONTENT_PLATFORMS.some((p) => p.id === body.platform) ? body.platform! : "tiktok";
  const count = Math.min(10, Math.max(1, Math.round(Number(body.count) || 6)));

  const { data: project } = await supabase.from("projects").select("name, description").eq("id", projectId).single();

  try {
    const { ideas, source } = await generateIdeas(
      { name: project?.name ?? "mi producto", description: project?.description ?? null, brief: body.brief?.slice(0, 500) },
      { count, platform },
    );
    const { data, error } = await supabase
      .from("content_posts")
      .insert(
        ideas.map((idea) => ({
          project_id: projectId,
          title: idea.title,
          platform,
          format: idea.format,
          pillar: idea.pillar || null,
          hook: idea.hook || null,
          script: idea.script || null,
          caption: idea.caption || null,
          hashtags: idea.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
          status: "idea",
          source: "ai",
        })),
      )
      .select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [], source });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudieron generar ideas" }, { status: 502 });
  }
}
