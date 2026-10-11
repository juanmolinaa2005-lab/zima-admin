import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

const KINDS = new Set(["keyword", "my_app", "competitor", "onboarding", "ad", "organic"]);

function kindFrom(raw: unknown) {
  return typeof raw === "string" && KINDS.has(raw) ? raw : null;
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const kinds = (new URL(request.url).searchParams.get("kind") || "")
    .split(",")
    .map(kindFrom)
    .filter((kind): kind is string => Boolean(kind));
  if (!kinds.length) return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
  const { data, error } = await gate.supabase
    .from("market_items")
    .select("id, kind, key, data, created_at, updated_at")
    .eq("project_id", projectId)
    .in("kind", kinds)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; key?: unknown; data?: unknown };
  const kind = kindFrom(body.kind);
  const key = typeof body.key === "string" ? body.key.trim().slice(0, 600) : "";
  if (!kind || !key) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const data = body.data && typeof body.data === "object" ? body.data : {};
  if (JSON.stringify(data).length > 200_000) {
    return NextResponse.json({ error: "Demasiado contenido" }, { status: 413 });
  }
  const { data: row, error } = await gate.supabase
    .from("market_items")
    .upsert(
      { project_id: projectId, user_id: gate.user.id, kind, key, data, updated_at: new Date().toISOString() },
      { onConflict: "project_id,kind,key" }
    )
    .select("id, kind, key, data, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: row });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const kind = kindFrom(url.searchParams.get("kind"));
  const key = url.searchParams.get("key") || "";
  if (!kind || !key) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const { error } = await gate.supabase
    .from("market_items")
    .delete()
    .eq("project_id", projectId)
    .eq("kind", kind)
    .eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
