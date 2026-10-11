import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedImageWorker } from "@/lib/creator/image-queue-worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { runUploadFlowsWorker } from "@/lib/upload/flows";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function handle(request: Request) {
  const admin = await createAdminClient();
  const token = request.headers.get("x-cron-token") || "";
  let authorized = isAuthorizedImageWorker(request);
  if (!authorized && token) {
    const { data } = await admin.from("internal_cron_tokens").select("token").eq("name", "upload-flows").maybeSingle();
    authorized = safeEqual(token, String(data?.token ?? ""));
  }
  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await runUploadFlowsWorker(admin));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
