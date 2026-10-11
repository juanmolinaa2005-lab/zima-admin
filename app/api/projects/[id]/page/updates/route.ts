import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { cleanText, type PageUpdate } from "@/lib/page/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
  const title = cleanText(body?.title, 120);
  if (!title) return NextResponse.json({ error: "Escribe un título" }, { status: 400 });

  const { data, error } = await gate.supabase
    .from("page_updates")
    .insert({ project_id: projectId, title, body: cleanText(body?.body, 4000) })
    .select("id, title, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data as PageUpdate });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const item = new URL(request.url).searchParams.get("item");
  if (!item) return NextResponse.json({ error: "Falta item" }, { status: 400 });
  const { error } = await gate.supabase.from("page_updates").delete().eq("project_id", projectId).eq("id", item);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
