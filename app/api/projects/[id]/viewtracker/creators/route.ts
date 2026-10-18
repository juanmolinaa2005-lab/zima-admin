import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { isStage, platformFrom, sanitizeTouches, type CreatorStage, type Touch } from "@/lib/influencers/pipeline";

type Params = { params: Promise<{ id: string }> };

type CreatorRow = {
  id: string;
  name: string;
  email: string | null;
  labels: string | null;
  status: string;
  stage: CreatorStage;
  profile_url: string | null;
  platform: string | null;
  source: string | null;
  notes: string | null;
  touches: Touch[] | null;
  created_at: string;
  updated_at: string;
};

type CreatorInput = {
  name?: unknown;
  email?: unknown;
  labels?: unknown;
  profileUrl?: unknown;
  source?: unknown;
  notes?: unknown;
  stage?: unknown;
  touches?: unknown;
};

const MAX_IMPORT = 500;

function serialize(row: CreatorRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    labels: row.labels,
    status: row.status,
    stage: row.stage,
    profileUrl: row.profile_url,
    platform: row.platform,
    source: row.source,
    notes: row.notes,
    touches: row.touches ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) || null : null;
}

/** Only the fields present in the input, mapped to columns. */
function columns(input: CreatorInput) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = text(input.name, 120);
  if ("email" in input) out.email = text(input.email, 200);
  if ("labels" in input) out.labels = text(input.labels, 200);
  if ("profileUrl" in input) out.profile_url = text(input.profileUrl, 500);
  if ("source" in input) out.source = text(input.source, 60);
  if ("notes" in input) out.notes = text(input.notes, 4000);
  if ("stage" in input && isStage(input.stage)) out.stage = input.stage;
  if ("touches" in input) out.touches = sanitizeTouches(input.touches);
  if ("profileUrl" in input || "source" in input) {
    out.platform = platformFrom((out.profile_url as string | null) ?? null, (out.source as string | null) ?? null);
  }
  return out;
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
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: (data as CreatorRow[] | null)?.map(serialize) ?? [] });
}

/** Body is one creator, or `{ items: [...] }` to import a spreadsheet. */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: CreatorInput & { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bulk = Array.isArray(body.items);
  const inputs = (bulk ? (body.items as CreatorInput[]) : [body]).slice(0, MAX_IMPORT);
  const rows = inputs
    .map((input) => ({ ...columns(input), project_id: projectId, user_id: user.id, status: "Not Invited" }))
    .filter((row) => "name" in row && row.name);
  if (!rows.length) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabase.from("project_tracked_creators").insert(rows).select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data as CreatorRow[]).map(serialize);
  return NextResponse.json(bulk ? { items } : { item: items[0] }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: CreatorInput & { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const changes = columns(body);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if ("name" in changes && !changes.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("project_tracked_creators")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: serialize(data as CreatorRow) });
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
