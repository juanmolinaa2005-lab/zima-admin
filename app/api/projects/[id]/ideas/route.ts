import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProjectOwner } from "@/lib/mail/access";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { aiIdeas, templateIdeas, type IdeaContext, type NewIdea } from "@/lib/ideas/generate";

type Params = { params: Promise<{ id: string }> };

const COLUMNS = "id, format, platform, hook, beats, caption, hashtags, status, source, variant_of, created_at";

async function contextFor(db: SupabaseClient, projectId: string): Promise<IdeaContext> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [project, profile, hits, hooks] = await Promise.all([
    db.from("projects").select("name, description").eq("id", projectId).maybeSingle(),
    db.from("launch_profiles").select("product_type, pitch, answers").eq("project_id", projectId).maybeSingle(),
    db
      .from("project_tracked_videos")
      .select("title, views")
      .eq("project_id", projectId)
      .gte("created_at", since)
      .order("views", { ascending: false })
      .limit(5),
    db.from("content_ideas").select("hook").eq("project_id", projectId).order("created_at", { ascending: false }).limit(60),
  ]);
  const answers = (profile.data?.answers ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof answers[k] === "string" && answers[k] !== "none" ? (answers[k] as string) : "");
  const name = str("appName").replace(/\s[-–:|].*$/, "") || (project.data?.name as string | undefined) || "tu app";
  return {
    name,
    pitch: (profile.data?.pitch as string | null) || (project.data?.description as string | null) || "",
    description: str("appDescription") || (project.data?.description as string | null) || "",
    genre: str("appGenre"),
    type: profile.data?.product_type === "web" ? "web" : "app",
    audience: str("audience") || null,
    face: str("face") || null,
    platforms: Array.isArray(answers.platforms) ? (answers.platforms as string[]) : [],
    hits: (hits.data ?? [])
      .filter((v) => v.title)
      .map((v) => ({ title: String(v.title).slice(0, 140), views: Number(v.views) || 0 })),
    recentHooks: (hooks.data ?? []).map((h) => h.hook as string),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [ideas, used, key] = await Promise.all([
    gate.supabase.from("content_ideas").select(COLUMNS).eq("project_id", projectId).eq("status", "new").order("created_at", { ascending: false }).limit(12),
    gate.supabase.from("content_ideas").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "used").gte("used_at", weekAgo),
    getOpenAIApiKey().catch(() => null),
  ]);
  if (ideas.error) return NextResponse.json({ error: ideas.error.message }, { status: 500 });
  return NextResponse.json({ ideas: ideas.data ?? [], usedThisWeek: used.count ?? 0, ai: Boolean(key) });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { count?: number; variantOf?: string };
  const count = Math.min(6, Math.max(1, Math.round(Number(body.count) || 3)));
  const variantOf = typeof body.variantOf === "string" && body.variantOf.trim() ? body.variantOf.trim().slice(0, 140) : undefined;

  const ctx = await contextFor(gate.supabase, projectId);
  let ideas: NewIdea[] = [];
  const key = await getOpenAIApiKey().catch(() => null);
  if (key) {
    try {
      ideas = await aiIdeas(key, ctx, count, variantOf);
    } catch {
      ideas = [];
    }
  }
  if (ideas.length < count) ideas = [...ideas, ...templateIdeas(ctx, count - ideas.length, variantOf)];

  const { data, error } = await gate.supabase
    .from("content_ideas")
    .insert(ideas.map((idea) => ({ ...idea, project_id: projectId })))
    .select(COLUMNS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data ?? [] });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!body.id || (body.status !== "used" && body.status !== "discarded" && body.status !== "new")) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const { error } = await gate.supabase
    .from("content_ideas")
    .update({ status: body.status, used_at: body.status === "used" ? new Date().toISOString() : null })
    .eq("project_id", projectId)
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
