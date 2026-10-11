import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  countItems,
  ensureNextPublish,
  syncFlowItems,
  toFlow,
  toItem,
  type UploadFlowRow,
  type UploadItemRow,
} from "@/lib/upload/flows";

type Params = { params: Promise<{ id: string; flowId: string }> };

async function loadFlow(gate: Extract<Awaited<ReturnType<typeof requireProjectOwner>>, { ok: true }>, projectId: string, flowId: string) {
  const { data, error } = await gate.supabase
    .from("upload_flows")
    .select("*")
    .eq("id", flowId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as UploadFlowRow | null;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId, flowId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  try {
    const flow = await loadFlow(gate, projectId, flowId);
    if (!flow) return NextResponse.json({ error: "Flujo no encontrado" }, { status: 404 });
    await syncFlowItems(gate.supabase, flow);
    const { data, error } = await gate.supabase
      .from("upload_flow_items")
      .select("*")
      .eq("flow_id", flowId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const counts = await countItems(gate.supabase, [flowId]);
    return NextResponse.json({
      flow: toFlow(flow, counts.get(flowId)),
      items: ((data ?? []) as UploadItemRow[]).map(toItem),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, flowId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    influencerId?: string | null;
    dynamicId?: string | null;
    accountId?: string | null;
    everyHours?: number;
    caption?: string;
    active?: boolean;
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 80) || "Nuevo flujo";
  if (body.influencerId !== undefined) patch.influencer_id = body.influencerId || null;
  if (body.dynamicId !== undefined) patch.dynamic_id = body.dynamicId || null;
  if (body.accountId !== undefined) patch.account_id = body.accountId || null;
  if (typeof body.everyHours === "number") patch.every_hours = Math.min(336, Math.max(1, Math.round(body.everyHours)));
  if (typeof body.caption === "string") patch.caption = body.caption.slice(0, 2200);
  if (typeof body.active === "boolean") {
    patch.active = body.active;
    if (!body.active) patch.next_publish_at = null;
  }

  try {
    const current = await loadFlow(gate, projectId, flowId);
    if (!current) return NextResponse.json({ error: "Flujo no encontrado" }, { status: 404 });
    const next = { ...current, ...patch } as UploadFlowRow;
    if (body.active === true && (!next.influencer_id || !next.dynamic_id || !next.account_id)) {
      return NextResponse.json({ error: "Completa influencer, dinámica y red antes de activar el flujo." }, { status: 400 });
    }
    const { data, error } = await gate.supabase.from("upload_flows").update(patch).eq("id", flowId).select("*").single();
    if (error) throw new Error(error.message);
    const flow = data as UploadFlowRow;
    if (body.active === true) {
      const { count } = await gate.supabase
        .from("upload_flow_items")
        .select("id", { count: "exact", head: true })
        .eq("flow_id", flowId)
        .eq("status", "approved");
      if (count) await ensureNextPublish(gate.supabase, flow);
    }
    const counts = await countItems(gate.supabase, [flowId]);
    return NextResponse.json({ flow: toFlow(flow, counts.get(flowId)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, flowId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { error } = await gate.supabase.from("upload_flows").delete().eq("id", flowId).eq("project_id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
