import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/launch/playbook";

type Params = { params: Promise<{ id: string }> };

const STATUSES = new Set<string>(FEEDBACK_STATUSES);
const COLUMNS = "id, title, detail, source, votes, status, created_at";

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { title?: string; detail?: string; source?: string };
  const title = (body.title ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "Escribe un título" }, { status: 400 });
  const { data, error } = await gate.supabase
    .from("launch_feedback")
    .insert({
      project_id: projectId,
      title,
      detail: (body.detail ?? "").trim().slice(0, 4000) || null,
      source: (body.source ?? "").trim().slice(0, 40) || null,
    })
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { id?: string; votes?: number; status?: FeedbackStatus };
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.votes === "number" && Number.isFinite(body.votes)) patch.votes = Math.max(0, Math.round(body.votes));
  if (body.status && STATUSES.has(body.status)) patch.status = body.status;
  const { data, error } = await gate.supabase
    .from("launch_feedback")
    .update(patch)
    .eq("project_id", projectId)
    .eq("id", body.id)
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const itemId = new URL(request.url).searchParams.get("item");
  if (!itemId) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const { error } = await gate.supabase.from("launch_feedback").delete().eq("project_id", projectId).eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
