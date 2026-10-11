import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedImageWorker } from "@/lib/creator/image-queue-worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { statsPatch } from "@/lib/viewtracker/refresh";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDGET_MS = 240_000;
const STALE_MS = 12 * 3_600_000;
const BATCH = 200;
const CONCURRENCY = 6;

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

type Row = { id: string; project_id: string; url: string; platform: string | null; video_id: string | null; views: number | string | null };

async function handle(request: Request) {
  const started = Date.now();
  const admin = await createAdminClient();
  const token = request.headers.get("x-cron-token") || "";
  let authorized = isAuthorizedImageWorker(request);
  if (!authorized && token) {
    const { data } = await admin.from("internal_cron_tokens").select("token").eq("name", "viewtracker-refresh").maybeSingle();
    authorized = safeEqual(token, String(data?.token ?? ""));
  }
  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const { data, error } = await admin
    .from("project_tracked_videos")
    .select("id, project_id, url, platform, video_id, views")
    .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${staleBefore}`)
    .order("last_refreshed_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const queue = [...((data ?? []) as Row[])];
  const touched = new Set<string>();
  let refreshed = 0;
  let failed = 0;

  async function worker() {
    while (queue.length && Date.now() - started < BUDGET_MS) {
      const row = queue.shift()!;
      try {
        const patch = await statsPatch(row.url, row.platform, row.video_id, Number(row.views ?? 0));
        await admin.from("project_tracked_videos").update(patch).eq("id", row.id);
        refreshed++;
      } catch {
        await admin.from("project_tracked_videos").update({ last_refreshed_at: new Date().toISOString() }).eq("id", row.id);
        failed++;
      }
      touched.add(row.project_id);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const today = new Date().toISOString().slice(0, 10);
  for (const projectId of touched) {
    const { data: rows } = await admin.from("project_tracked_videos").select("views").eq("project_id", projectId);
    const list = rows ?? [];
    const total = list.reduce((sum, r) => sum + Number(r.views ?? 0), 0);
    await admin
      .from("project_views_daily")
      .upsert({ project_id: projectId, day: today, total_views: total, videos: list.length, updated_at: new Date().toISOString() }, { onConflict: "project_id,day" });
  }

  return NextResponse.json({ refreshed, failed, projects: touched.size, pending: queue.length });
}

export const GET = handle;
export const POST = handle;
