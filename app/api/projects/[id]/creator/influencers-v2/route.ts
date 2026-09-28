import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  defaultV2Scenes,
  emptyContinuity,
  mapCampaignRow,
  parseV2CreateBody,
} from "@/lib/creator/influencer-v2";
import {
  loadInfluencerForV2,
  V2_CAMPAIGN_SELECT,
} from "@/lib/creator/influencer-v2-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function statusOf(e: unknown, fallback = 500) {
  if (e && typeof e === "object" && "status" in e) {
    const n = Number((e as { status: unknown }).status);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  return fallback;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  try {
    const { data, error } = await gate.supabase
      .from("estudio_influencer_v2_campaigns")
      .select(V2_CAMPAIGN_SELECT)
      .eq("project_id", projectId)
      .eq("user_id", gate.user.id)
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      campaigns: (data ?? []).map(mapCampaignRow),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudieron cargar las campañas",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const parsed = parseV2CreateBody(raw);
    if (parsed.influencerId) {
      const influencer = await loadInfluencerForV2(
        gate.supabase,
        projectId,
        parsed.influencerId
      );
      if (!influencer) {
        return NextResponse.json(
          { error: "influencerId no pertenece a este proyecto" },
          { status: 400 }
        );
      }
    }
    const { data, error } = await gate.supabase
      .from("estudio_influencer_v2_campaigns")
      .insert({
        project_id: projectId,
        user_id: gate.user.id,
        influencer_id: parsed.influencerId,
        title: parsed.title,
        brief: parsed.brief,
        objective: parsed.objective,
        language: parsed.language,
        model_id: parsed.modelId,
        status: "draft",
        continuity: emptyContinuity(),
        scenes: defaultV2Scenes(),
      })
      .select(V2_CAMPAIGN_SELECT)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "No se pudo crear la campaña" },
        { status: 500 }
      );
    }
    return NextResponse.json({ campaign: mapCampaignRow(data) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear la campaña" },
      { status: statusOf(e) }
    );
  }
}
