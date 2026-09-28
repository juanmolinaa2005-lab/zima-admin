import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

type CreatorRow = {
  id: string;
  name: string;
  email: string | null;
  labels: string | null;
  status: string;
  created_at: string;
};

function serialize(row: CreatorRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    labels: row.labels,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_tracked_creators")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: (data as CreatorRow[] | null)?.map(serialize) ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { name?: string; email?: string; labels?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_tracked_creators")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      email: (body.email ?? "").trim() || null,
      labels: (body.labels ?? "").trim() || null,
      status: "Not Invited",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: serialize(data as CreatorRow) }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_tracked_creators")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
