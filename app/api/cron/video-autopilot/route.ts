import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  isAuthorizedAutopilotWorker,
  runVideoAutopilotWorker,
} from "@/lib/creator/autopilot-worker";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isAuthorizedAutopilotWorker(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  after(() => runVideoAutopilotWorker({ budgetMs: 55_000 }));
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
