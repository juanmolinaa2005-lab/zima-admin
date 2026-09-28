import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  isAuthorizedImageWorker,
  runEstudioImageWorker,
} from "@/lib/creator/image-queue-worker";
import { runEstudioInfluencerWorker } from "@/lib/creator/influencer-worker";
import { runEstudioInfluencerVideoWorker } from "@/lib/creator/influencer-video-worker";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isAuthorizedImageWorker(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  after(() => runEstudioImageWorker({ budgetMs: 90_000 }));
  after(() => runEstudioInfluencerWorker({ budgetMs: 90_000 }));
  after(() => runEstudioInfluencerVideoWorker({ budgetMs: 90_000 }));
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
