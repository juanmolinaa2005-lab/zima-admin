import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { isContractStatus, sanitizeParams, type ContractParams, type ContractStatus } from "@/lib/influencers/contract";

type Params = { params: Promise<{ id: string }> };

type ContractRow = {
  id: string;
  creator_id: string | null;
  creator_name: string;
  params: ContractParams;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
};

type ContractInput = {
  id?: unknown;
  creatorId?: unknown;
  params?: unknown;
  status?: unknown;
};

function serialize(row: ContractRow) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    params: sanitizeParams(row.params),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function columns(input: ContractInput) {
  const out: Record<string, unknown> = {};
  if ("creatorId" in input) out.creator_id = typeof input.creatorId === "string" && input.creatorId ? input.creatorId : null;
  if ("params" in input) {
    const params = sanitizeParams(input.params);
    out.params = params;
    out.creator_name = params.creatorName.trim();
  }
  if ("status" in input && isContractStatus(input.status)) out.status = input.status;
  return out;
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as ContractInput;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_creator_contracts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data as ContractRow[] | null)?.map(serialize) ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const row = columns({ status: "draft", ...body, params: body.params ?? {} });
  if (!row.creator_name) return NextResponse.json({ error: "Falta el nombre del creador." }, { status: 400 });

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_creator_contracts")
    .insert({ ...row, project_id: projectId, user_id: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: serialize(data as ContractRow) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const changes = columns(body);
  if ("creator_name" in changes && !changes.creator_name) {
    return NextResponse.json({ error: "Falta el nombre del creador." }, { status: 400 });
  }

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_creator_contracts")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: serialize(data as ContractRow) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { supabase, user } = gate;
  const { error } = await supabase
    .from("project_creator_contracts")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
