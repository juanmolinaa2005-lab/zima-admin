import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

function toPublic(row: {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_creator_flows")
    .select("id, name, created_at, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    flows: (data ?? []).map(toPublic),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  const name = (body.name || "").trim() || "Untitled flow";

  const { data, error } = await supabase
    .from("project_creator_flows")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ flow: toPublic(data) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const flowId = (body.id || "").trim();
  const name = (body.name || "").trim();
  if (!flowId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_creator_flows")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", flowId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("id, name, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ flow: toPublic(data) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const flowId = new URL(request.url).searchParams.get("id");
  if (!flowId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_creator_flows")
    .delete()
    .eq("id", flowId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
