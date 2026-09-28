import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  ingestFalAutopilotWebhook,
  runVideoAutopilotWorker,
} from "@/lib/creator/autopilot-worker";
import { verifyFalWebhookSignature } from "@/lib/fal/webhook";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  const signed = await verifyFalWebhookSignature(request, raw);
  if (!signed) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }

  after(async () => {
    try {
      const { runId } = await ingestFalAutopilotWebhook(body);
      if (runId) {
        await runVideoAutopilotWorker({ budgetMs: 55_000, runId });
      }
    } catch {
      /* La recuperación programada retoma trabajos pendientes si un callback falla. */
    }
  });

  return NextResponse.json({ ok: true });
}
