import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const item = new URL(request.url).searchParams.get("item");
  if (!item) return NextResponse.json({ error: "Falta item" }, { status: 400 });
  const { error } = await gate.supabase.from("page_subscribers").delete().eq("project_id", projectId).eq("id", item);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
