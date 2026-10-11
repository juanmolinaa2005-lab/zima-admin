import { NextResponse } from "next/server";
import { isAuthorizedImageWorker } from "@/lib/creator/image-queue-worker";
import { chartIds, type MarketChart } from "@/lib/market/appstore";
import { captureApps, saveChartSnapshot, SNAPSHOT_COUNTRIES } from "@/lib/market/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARTS: MarketChart[] = ["free", "paid", "grossing"];

async function handle(request: Request) {
  if (!isAuthorizedImageWorker(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let charts = 0;
  for (const country of SNAPSHOT_COUNTRIES) {
    await Promise.all(
      CHARTS.map(async (chart) => {
        const entries = await chartIds(chart, country, null, 100);
        await saveChartSnapshot(chart, country, null, entries.map((entry) => entry.id));
        if (entries.length) charts += 1;
      })
    );
  }

  const admin = await createAdminClient();
  const { data } = await admin
    .from("market_items")
    .select("key, data")
    .in("kind", ["my_app", "competitor"]);
  const byCountry = new Map<string, string[]>();
  for (const row of data ?? []) {
    const country = typeof row.data?.country === "string" ? row.data.country : "us";
    byCountry.set(country, [...(byCountry.get(country) ?? []), String(row.key)]);
  }
  let apps = 0;
  for (const [country, ids] of byCountry) {
    const history = await captureApps(ids, country);
    apps += history.size;
  }
  return NextResponse.json({ ok: true, charts, apps });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
