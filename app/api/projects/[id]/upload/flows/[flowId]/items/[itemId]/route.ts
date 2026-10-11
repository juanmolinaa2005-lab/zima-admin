import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { ensureNextPublish, toItem, type UploadFlowRow, type UploadItemRow } from "@/lib/upload/flows";

type Params = { params: Promise<{ id: string; flowId: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, flowId, itemId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "restore" | "retry";
    caption?: string | null;
  };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (body.caption !== undefined) patch.caption = body.caption === null ? null : body.caption.slice(0, 2200);
  if (body.action === "approve" || body.action === "retry") Object.assign(patch, { status: "approved", reviewed_at: now, rejected_at: null, error: null });
  if (body.action === "reject") Object.assign(patch, { status: "rejected", reviewed_at: now, rejected_at: now });
  if (body.action === "restore") Object.assign(patch, { status: "pending", reviewed_at: null, rejected_at: null });

  const { data, error } = await gate.supabase
    .from("upload_flow_items")
    .update(patch)
    .eq("id", itemId)
    .eq("flow_id", flowId)
    .eq("project_id", projectId)
    .not("status", "in", "(publishing,published)")
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Este video ya se está publicando o ya se publicó." }, { status: 409 });

  if (body.action === "approve" || body.action === "retry") {
    const { data: flow } = await gate.supabase.from("upload_flows").select("*").eq("id", flowId).maybeSingle();
    if (flow) await ensureNextPublish(gate.supabase, flow as UploadFlowRow);
  }
  return NextResponse.json({ item: toItem(data as UploadItemRow) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, flowId, itemId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { error } = await gate.supabase
    .from("upload_flow_items")
    .delete()
    .eq("id", itemId)
    .eq("flow_id", flowId)
    .eq("project_id", projectId)
    .eq("status", "rejected");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
