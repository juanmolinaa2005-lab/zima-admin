import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  CHANNEL_IDS,
  TASK_IDS,
  type ChannelState,
  type ChannelStatus,
  type FeedbackItem,
  type LaunchProfile,
  type LaunchState,
  type MetricWeek,
  type ProductType,
} from "@/lib/launch/playbook";

type Params = { params: Promise<{ id: string }> };

const PRODUCT_TYPES = new Set<ProductType>(["app", "web", "both"]);
const CHANNEL_STATUSES = new Set<ChannelStatus>(["todo", "planned", "launched", "skipped"]);

function dateOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function textOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const db = gate.supabase;

  const [profile, tasks, channels, feedback, metrics] = await Promise.all([
    db.from("launch_profiles").select("product_type, launch_date, goal_mrr, pitch").eq("project_id", projectId).maybeSingle(),
    db.from("launch_tasks").select("task_id, done_at").eq("project_id", projectId),
    db.from("launch_channels").select("channel_id, status, planned_for, url, result").eq("project_id", projectId),
    db
      .from("launch_feedback")
      .select("id, title, detail, source, votes, status, created_at")
      .eq("project_id", projectId)
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false }),
    db
      .from("launch_metrics")
      .select("week_start, visitors, signups, active_users, paying, mrr")
      .eq("project_id", projectId)
      .order("week_start", { ascending: true }),
  ]);

  const failed = [profile, tasks, channels, feedback, metrics].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const p = profile.data as (LaunchProfile & { goal_mrr: number | string | null }) | null;
  const state: LaunchState = {
    profile: {
      product_type: p?.product_type ?? null,
      launch_date: p?.launch_date ?? null,
      goal_mrr: p?.goal_mrr != null ? Number(p.goal_mrr) : null,
      pitch: p?.pitch ?? null,
    },
    tasks: Object.fromEntries((tasks.data ?? []).map((t) => [t.task_id as string, t.done_at as string])),
    channels: Object.fromEntries(
      (channels.data ?? []).map((c) => [
        c.channel_id as string,
        { status: c.status, planned_for: c.planned_for, url: c.url, result: c.result } as ChannelState,
      ])
    ),
    feedback: (feedback.data ?? []) as FeedbackItem[],
    metrics: ((metrics.data ?? []) as MetricWeek[]).map((m) => ({ ...m, mrr: m.mrr != null ? Number(m.mrr) : null })),
  };
  return NextResponse.json(state);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const db = gate.supabase;
  const body = (await request.json().catch(() => ({}))) as {
    profile?: Partial<LaunchProfile>;
    task?: { id?: string; done?: boolean };
    channel?: Partial<ChannelState> & { id?: string };
  };

  if (body.profile) {
    const input = body.profile;
    const goal = Number(input.goal_mrr);
    const row = {
      project_id: projectId,
      product_type: input.product_type && PRODUCT_TYPES.has(input.product_type) ? input.product_type : null,
      launch_date: dateOrNull(input.launch_date),
      goal_mrr: input.goal_mrr != null && Number.isFinite(goal) && goal >= 0 ? goal : null,
      pitch: textOrNull(input.pitch, 280),
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("launch_profiles").upsert(row, { onConflict: "project_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (row.launch_date) {
      await db.from("launch_tasks").upsert({ project_id: projectId, task_id: "launch-date" }, { onConflict: "project_id,task_id", ignoreDuplicates: true });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.task) {
    const taskId = body.task.id ?? "";
    if (!TASK_IDS.has(taskId)) return NextResponse.json({ error: "Tarea desconocida" }, { status: 400 });
    const { error } = body.task.done
      ? await db.from("launch_tasks").upsert({ project_id: projectId, task_id: taskId }, { onConflict: "project_id,task_id" })
      : await db.from("launch_tasks").delete().eq("project_id", projectId).eq("task_id", taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.channel) {
    const channelId = body.channel.id ?? "";
    if (!CHANNEL_IDS.has(channelId)) return NextResponse.json({ error: "Canal desconocido" }, { status: 400 });
    const status = body.channel.status && CHANNEL_STATUSES.has(body.channel.status) ? body.channel.status : "todo";
    const { error } = await db.from("launch_channels").upsert(
      {
        project_id: projectId,
        channel_id: channelId,
        status,
        planned_for: dateOrNull(body.channel.planned_for),
        url: textOrNull(body.channel.url, 500),
        result: textOrNull(body.channel.result, 1000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,channel_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
}
