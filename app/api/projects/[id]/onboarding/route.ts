import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { cleanAnswers, type BuildType } from "@/lib/onboarding/questions";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { type?: string; pitch?: string; answers?: unknown };
  if (body.type !== "app" && body.type !== "web") {
    return NextResponse.json({ error: "Elige app o web" }, { status: 400 });
  }
  const type: BuildType = body.type;
  const pitch = typeof body.pitch === "string" ? body.pitch.trim().slice(0, 280) || null : null;

  const { error } = await gate.supabase.from("launch_profiles").upsert(
    {
      project_id: projectId,
      product_type: type,
      pitch,
      answers: cleanAnswers(type, body.answers),
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
