import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { daysAgo, isoDay } from "@/lib/marketing/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { data, error } = await gate.supabase
    .from("project_views_daily")
    .select("day, total_views, videos")
    .eq("project_id", projectId)
    .gte("day", isoDay(daysAgo(60)))
    .order("day", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    items: (data ?? []).map((d) => ({ day: d.day as string, views: Number(d.total_views), videos: Number(d.videos) })),
  });
}
