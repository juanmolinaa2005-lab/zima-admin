import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { createAutopilotRun, listAutopilotRuns } from "@/lib/creator/autopilot-server";
import { scheduleVideoAutopilotWorker } from "@/lib/creator/autopilot-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function statusOf(e: unknown, fallback = 500) {
  if (e && typeof e === "object" && "status" in e) {
    const n = Number((e as { status: unknown }).status);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  return fallback;
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const influencerId = new URL(request.url).searchParams.get("influencerId");
  if (!influencerId) {
    return NextResponse.json({ error: "Falta influencerId" }, { status: 400 });
  }
  try {
    const runs = await listAutopilotRuns(gate.supabase, projectId, influencerId);
    return NextResponse.json({ runs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron cargar los runs" },
      { status: statusOf(e) }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const { run, created } = await createAutopilotRun({
      supabase: gate.supabase,
      projectId,
      userId: gate.user.id,
      body: raw,
    });
    scheduleVideoAutopilotWorker({ force: true });
    return NextResponse.json({ run }, { status: created ? 201 : 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear el run" },
      { status: statusOf(e) }
    );
  }
}
