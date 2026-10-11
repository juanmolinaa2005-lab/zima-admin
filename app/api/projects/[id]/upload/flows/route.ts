import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { countItems, toFlow, type UploadFlowRow } from "@/lib/upload/flows";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { data, error } = await gate.supabase
    .from("upload_flows")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as UploadFlowRow[];
  try {
    const counts = await countItems(gate.supabase, rows.map((r) => r.id));
    return NextResponse.json({ flows: rows.map((row) => toFlow(row, counts.get(row.id))) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const { data, error } = await gate.supabase
    .from("upload_flows")
    .insert({ project_id: projectId, user_id: gate.user.id, name: (body.name || "").trim().slice(0, 80) || "Nuevo flujo" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flow: toFlow(data as UploadFlowRow) });
}
