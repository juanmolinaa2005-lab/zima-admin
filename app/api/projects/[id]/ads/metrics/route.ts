import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { clean } from "@/lib/marketing/crud";

type Params = { params: Promise<{ id: string }> };

type Row = {
  campaign_id: string;
  creative_id: string | null;
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

const uuid = clean.uuid();
const date = clean.date();
const amount = (v: unknown) => Number(clean.number()(v) ?? 0);

/** Saves daily rows; a row for the same campaign, creative and day replaces the previous one. */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

  let body: { rows?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rows: Row[] = [];
  for (const raw of (body.rows ?? []).slice(0, 2000)) {
    const campaign_id = uuid(raw.campaign_id) as string | null;
    const day = date(raw.day) as string | null;
    if (!campaign_id || !day) continue;
    rows.push({
      campaign_id,
      creative_id: (uuid(raw.creative_id) as string | null) ?? null,
      day,
      spend: amount(raw.spend),
      impressions: Math.round(amount(raw.impressions)),
      clicks: Math.round(amount(raw.clicks)),
      conversions: amount(raw.conversions),
      revenue: amount(raw.revenue),
    });
  }
  if (!rows.length) return NextResponse.json({ error: "No hay filas válidas (revisa campaña y fecha)." }, { status: 400 });

  const campaignIds = [...new Set(rows.map((r) => r.campaign_id))];
  const { data: owned, error: ownedError } = await supabase
    .from("ad_campaigns")
    .select("id")
    .eq("project_id", projectId)
    .in("id", campaignIds);
  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
  const ownedIds = new Set((owned ?? []).map((c) => c.id as string));
  const valid = rows.filter((r) => ownedIds.has(r.campaign_id));
  if (!valid.length) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const unique = new Map<string, Row>();
  for (const r of valid) unique.set(`${r.campaign_id}|${r.creative_id ?? ""}|${r.day}`, r);

  const groups = new Map<string, Row[]>();
  for (const r of unique.values()) {
    const key = `${r.campaign_id}|${r.creative_id ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const group of groups.values()) {
    const { campaign_id, creative_id } = group[0];
    let del = supabase
      .from("ad_metrics_daily")
      .delete()
      .eq("project_id", projectId)
      .eq("campaign_id", campaign_id)
      .in("day", group.map((r) => r.day));
    del = creative_id ? del.eq("creative_id", creative_id) : del.is("creative_id", null);
    const { error } = await del;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("ad_metrics_daily")
    .insert([...unique.values()].map((r) => ({ ...r, project_id: projectId })))
    .select("id, campaign_id, creative_id, day, spend, impressions, clicks, conversions, revenue");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: data?.length ?? 0, skipped: (body.rows?.length ?? 0) - (data?.length ?? 0) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const id = uuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { error } = await gate.supabase.from("ad_metrics_daily").delete().eq("id", id).eq("project_id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
