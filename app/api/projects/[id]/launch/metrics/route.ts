import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

function count(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const week = typeof body.week_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.week_start) ? body.week_start : null;
  if (!week) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  const int = (v: unknown) => {
    const n = count(v);
    return n == null ? null : Math.round(n);
  };
  const row = {
    project_id: projectId,
    week_start: week,
    visitors: int(body.visitors),
    signups: int(body.signups),
    active_users: int(body.active_users),
    paying: int(body.paying),
    mrr: count(body.mrr),
    updated_at: new Date().toISOString(),
  };
  const { error } = await gate.supabase.from("launch_metrics").upsert(row, { onConflict: "project_id,week_start" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const week = new URL(request.url).searchParams.get("week");
  if (!week) return NextResponse.json({ error: "Falta semana" }, { status: 400 });
  const { error } = await gate.supabase.from("launch_metrics").delete().eq("project_id", projectId).eq("week_start", week);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
