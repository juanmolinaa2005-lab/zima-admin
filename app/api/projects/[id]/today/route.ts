import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { countItems, type UploadFlowRow } from "@/lib/upload/flows";
import { fetchSuperwallBillingReport, listSuperwallApplications } from "@/lib/superwall/admin";
import { getSuperwallApiKey, getSuperwallConnectionStatus } from "@/lib/superwall/user-key";
import type { TodayData, TodayVideo } from "@/lib/today/types";

type Params = { params: Promise<{ id: string }> };

const DAY = 86_400_000;
const REVENUE_DAYS = 7;

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function loadRevenue(): Promise<TodayData["revenue"]> {
  const empty = { connected: false, net: null, newUsers: null, mrr: null, days: REVENUE_DAYS };
  try {
    const status = await getSuperwallConnectionStatus();
    if (!status.connected || !status.orgId) return empty;
    const apiKey = await getSuperwallApiKey();
    if (!apiKey) return empty;
    const appId = status.applicationId || (await listSuperwallApplications(apiKey, status.orgId))[0]?.id;
    if (!appId) return { ...empty, connected: true };
    const report = await fetchSuperwallBillingReport(apiKey, appId, REVENUE_DAYS, null);
    return { connected: true, net: report.netProceeds, newUsers: report.newUsers, mrr: report.mrr, days: REVENUE_DAYS };
  } catch {
    return empty;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const db = gate.supabase;
  const since = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);

  const [videos, accounts, daily, flows, tasks, page, subscribers, profile, revenue] = await Promise.all([
    db
      .from("project_tracked_videos")
      .select("id, url, title, author, platform, thumbnail_url, views, posted_at, created_at")
      .eq("project_id", projectId)
      .limit(5000),
    db.from("project_tracked_accounts").select("platform").eq("project_id", projectId),
    db.from("project_views_daily").select("day, total_views").eq("project_id", projectId).gte("day", since).order("day", { ascending: true }),
    db.from("upload_flows").select("*").eq("project_id", projectId),
    db.from("launch_tasks").select("task_id, done_at").eq("project_id", projectId),
    db.from("product_pages").select("slug, published").eq("project_id", projectId).maybeSingle(),
    db.from("page_subscribers").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    db.from("launch_profiles").select("product_type").eq("project_id", projectId).maybeSingle(),
    loadRevenue(),
  ]);

  const now = Date.now();
  const videoRows = (videos.data ?? []).map((v) => ({
    id: v.id as string,
    url: v.url as string,
    title: (v.title as string | null) ?? null,
    author: (v.author as string | null) ?? null,
    platform: (v.platform as string | null) ?? null,
    thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
    views: num(v.views),
    postedAt: ((v.posted_at as string | null) ?? (v.created_at as string | null)) || null,
  })) satisfies TodayVideo[];

  const recent = videoRows.filter((v) => v.postedAt && now - new Date(v.postedAt).getTime() < 60 * DAY);
  const med = median(recent.map((v) => v.views));
  const hits = med > 0 ? recent.filter((v) => v.views >= med * 10).length : 0;
  const top = [...videoRows.filter((v) => v.postedAt && now - new Date(v.postedAt).getTime() < 30 * DAY)]
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const dailyRows = (daily.data ?? []).map((d) => ({ day: d.day as string, total: num(d.total_views) }));
  const series = dailyRows.slice(1).map((d, i) => ({ day: d.day, views: Math.max(0, d.total - dailyRows[i].total) }));
  const last = dailyRows[dailyRows.length - 1];
  const weekAgo = [...dailyRows].reverse().find((d) => new Date(`${d.day}T00:00:00Z`).getTime() <= now - 7 * DAY);
  const last7d = last && weekAgo ? Math.max(0, last.total - weekAgo.total) : null;

  const flowRows = (flows.data ?? []) as UploadFlowRow[];
  const counts = flowRows.length ? await countItems(db, flowRows.map((f) => f.id)).catch(() => new Map()) : new Map();
  let queued = 0;
  let toReview = 0;
  for (const c of counts.values()) {
    queued += num(c?.approved);
    toReview += num(c?.pending);
  }
  const active = flowRows.filter((f) => f.active);
  const nextAt =
    active
      .map((f) => f.next_publish_at)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;
  const lastError = flowRows.find((f) => f.last_error)?.last_error ?? null;

  const data: TodayData = {
    views: { total: videoRows.reduce((s, v) => s + v.views, 0), last7d, series: series.slice(-14) },
    videos: {
      tracked: videoRows.length,
      posted7d: videoRows.filter((v) => v.postedAt && now - new Date(v.postedAt).getTime() < 7 * DAY).length,
      median: Math.round(med),
      hits,
      top,
    },
    accounts: {
      total: (accounts.data ?? []).length,
      platforms: Array.from(new Set((accounts.data ?? []).map((a) => (a.platform as string | null) ?? "web"))),
    },
    publishing: { flows: flowRows.length, active: active.length, queued, toReview, nextAt, lastError },
    revenue,
    page: { published: Boolean(page.data?.published), slug: (page.data?.slug as string | undefined) ?? null, subscribers: subscribers.count ?? 0 },
    productType: (profile.data?.product_type as TodayData["productType"] | undefined) ?? null,
    plan: Object.fromEntries((tasks.data ?? []).map((t) => [t.task_id as string, t.done_at as string])),
  };
  if (data.page.published && !data.plan["public-page"]) data.plan["public-page"] = new Date().toISOString();
  if (revenue.connected && !data.plan["connect-revenue"]) data.plan["connect-revenue"] = new Date().toISOString();

  return NextResponse.json(data);
}
