import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  clipProductSummary,
} from "@/lib/creator/estudio-v1";
import {
  assertV2NotComposing,
  parseV2Storyboard,
  v2StoryboardPrompt,
} from "@/lib/creator/influencer-v2";
import {
  composeV2Campaign,
  enqueueV2Campaign,
  listV2Jobs,
  loadInfluencerForV2,
  loadV2Campaign,
  loadV2PlanMedia,
  patchCampaignInput,
  retryV2Scene,
  saveV2Campaign,
} from "@/lib/creator/influencer-v2-server";
import { scheduleEstudioInfluencerVideoWorker } from "@/lib/creator/influencer-video-worker";
import { isFalVideoModel } from "@/lib/creator/fal-video-models";
import {
  falWaitForOutput,
  FAL_GROK_MODEL,
  FAL_OPENROUTER,
} from "@/lib/fal/client";
import { getFalApiKey } from "@/lib/fal/user-key";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { openaiChatJson } from "@/lib/openai/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string; campaignId: string }> };

function statusOf(e: unknown, fallback = 500) {
  if (e && typeof e === "object" && "status" in e) {
    const n = Number((e as { status: unknown }).status);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  return fallback;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId, campaignId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  try {
    const campaign = await loadV2Campaign(gate.supabase, projectId, campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    const jobs = await listV2Jobs(gate.supabase, campaign.id);
    if (
      jobs.some(
        (job) =>
          (job.status === "queued" && !job.requestId) ||
          (job.status === "in_progress" && isFalVideoModel(campaign.modelId))
      )
    ) {
      scheduleEstudioInfluencerVideoWorker();
    }
    return NextResponse.json({ campaign, jobs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo cargar" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId, campaignId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const campaign = await loadV2Campaign(gate.supabase, projectId, campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    const patch = await patchCampaignInput(gate.supabase, campaign, raw);
    if (!Object.keys(patch).length) {
      return NextResponse.json({ campaign, jobs: await listV2Jobs(gate.supabase, campaign.id) });
    }
    const next = await saveV2Campaign(gate.supabase, campaign, patch);
    return NextResponse.json({
      campaign: next,
      jobs: await listV2Jobs(gate.supabase, next.id),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo guardar" },
      { status: statusOf(e) }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, campaignId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { error } = await gate.supabase
    .from("estudio_influencer_v2_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("project_id", projectId)
    .eq("user_id", gate.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId, campaignId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const body = raw as {
    action?: unknown;
    sceneId?: unknown;
    sceneIds?: unknown;
    force?: unknown;
    product?: unknown;
  };

  const action = typeof body.action === "string" ? body.action.trim() : "";
  try {
    const campaign = await loadV2Campaign(gate.supabase, projectId, campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    if (action === "plan") {
      assertV2NotComposing(campaign);
      if (body.product !== undefined && typeof body.product !== "string") {
        return NextResponse.json(
          { error: '"product" debe ser texto' },
          { status: 400 }
        );
      }
      const influencer = campaign.influencerId
        ? await loadInfluencerForV2(
            gate.supabase,
            projectId,
            campaign.influencerId
          )
        : null;
      const media = await loadV2PlanMedia(gate.supabase, projectId);
      const product = clipProductSummary(
        typeof body.product === "string" && body.product
          ? body.product
          : campaign.brief
      );
      const prompt = v2StoryboardPrompt({
        brief: campaign.brief,
        objective: campaign.objective,
        product,
        language: campaign.language,
        name: influencer?.name || "",
        traits: influencer?.traits || "",
        hasAppDemo: media.hasAppDemo,
        galleryCount: media.galleryCount,
      });
      const system =
        'Responde SOLO JSON válido con title, continuity y scenes. Sin markdown.';
      const falKey = await getFalApiKey();
      let raw = "";
      if (falKey) {
        raw = await falWaitForOutput(
          falKey,
          FAL_OPENROUTER,
          {
            prompt,
            system_prompt: system,
            model: FAL_GROK_MODEL,
            temperature: 0.7,
            max_tokens: 4000,
          },
          { timeoutMs: 90_000, intervalMs: 2500 }
        );
      } else {
        const openaiKey = await getOpenAIApiKey();
        if (!openaiKey) {
          return NextResponse.json(
            {
              error:
                "Conecta fal.ai o OpenAI en Supabase → Secrets para planificar el storyboard.",
            },
            { status: 403 }
          );
        }
        const json = await openaiChatJson<Record<string, unknown>>(openaiKey, {
          system,
          user: prompt,
          temperature: 0.7,
          maxTokens: 4000,
        });
        raw = JSON.stringify(json);
      }
      const parsed = parseV2Storyboard(raw, {
        brief: campaign.brief,
        objective: campaign.objective,
      });
      if (!parsed) {
        return NextResponse.json(
          { error: "La IA no devolvió un storyboard válido. Inténtalo de nuevo." },
          { status: 422 }
        );
      }
      const next = await saveV2Campaign(gate.supabase, campaign, {
        title: parsed.title,
        continuity: parsed.continuity,
        scenes: parsed.scenes,
        status: "planned",
        final_asset_id: null,
        final_video_url: null,
      });
      return NextResponse.json({
        campaign: next,
        jobs: await listV2Jobs(gate.supabase, next.id),
      });
    }

    if (action === "enqueue") {
      const result = await enqueueV2Campaign({
        supabase: gate.supabase,
        userId: gate.user.id,
        campaign,
        sceneIds: Array.isArray(body.sceneIds)
          ? body.sceneIds.filter((id): id is string => typeof id === "string")
          : undefined,
      });
      return NextResponse.json({
        ok: true,
        queued: result.queued,
        campaign: result.campaign,
        jobs: result.jobs,
      });
    }

    if (action === "retry") {
      const sceneId = typeof body.sceneId === "string" ? body.sceneId.trim() : "";
      if (!sceneId) {
        return NextResponse.json({ error: "Falta la escena" }, { status: 400 });
      }
      const result = await retryV2Scene({
        supabase: gate.supabase,
        campaign,
        sceneId,
      });
      return NextResponse.json({
        ok: true,
        retried: result.retried,
        campaign: result.campaign,
        jobs: result.jobs,
      });
    }

    if (action === "compose") {
      const result = await composeV2Campaign({
        supabase: gate.supabase,
        userId: gate.user.id,
        campaign,
        force: body.force === true,
      });
      return NextResponse.json({
        ok: true,
        campaign: result.campaign,
        jobs: result.jobs,
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo completar" },
      { status: statusOf(e) }
    );
  }
}
