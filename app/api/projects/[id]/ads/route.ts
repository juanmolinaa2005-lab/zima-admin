import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { daysAgo, isoDay } from "@/lib/marketing/types";

type Params = { params: Promise<{ id: string }> };

/** Everything the paid ads views need in one round trip: campaigns, creatives and the last 180 days of metrics. */
export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

  const [campaigns, creatives, metrics] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("ad_creatives").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase
      .from("ad_metrics_daily")
      .select("id, campaign_id, creative_id, day, spend, impressions, clicks, conversions, revenue")
      .eq("project_id", projectId)
      .gte("day", isoDay(daysAgo(180)))
      .order("day", { ascending: true })
      .limit(10000),
  ]);

  const error = campaigns.error || creatives.error || metrics.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Postgres numeric columns arrive as strings.
  const toNum = (row: Record<string, unknown>, keys: string[], nullable: string[] = []) => {
    const out: Record<string, unknown> = { ...row };
    for (const k of keys) out[k] = Number(row[k] ?? 0);
    for (const k of nullable) out[k] = row[k] == null ? null : Number(row[k]);
    return out;
  };

  return NextResponse.json({
    campaigns: (campaigns.data ?? []).map((c) => toNum(c, ["daily_budget"], ["total_budget", "target_cpa"])),
    creatives: creatives.data ?? [],
    metrics: (metrics.data ?? []).map((m) => toNum(m, ["spend", "impressions", "clicks", "conversions", "revenue"])),
  });
}
