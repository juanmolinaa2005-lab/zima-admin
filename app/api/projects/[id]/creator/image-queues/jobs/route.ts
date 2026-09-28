import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  assembleImageQueues,
  imageQueueActiveCount,
  scheduleEstudioImageWorker,
  type ImageJobRow,
  type ImageQueueRow,
} from "@/lib/creator/image-queue-worker";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const QUEUE_SELECT =
  "id, project_id, user_id, preset_id, model_id, model_name, folder_id, folder_name, created_at";
const JOB_SELECT =
  "id, queue_id, project_id, user_id, prompt, sort_index, request_id, status, image_url, asset_id, error, created_at, updated_at, locked_at, archived_at";

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate;

  let body: { action?: string; jobIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = (body.action || "").trim();
  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds.filter((id) => typeof id === "string" && id)
    : [];
  if (
    !jobIds.length ||
    (action !== "retry" && action !== "delete" && action !== "archive")
  ) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (action === "delete") {
    const { error } = await supabase
      .from("estudio_image_jobs")
      .delete()
      .in("id", jobIds)
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: queues } = await supabase
      .from("estudio_image_queues")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    const ids = (queues ?? []).map((q) => q.id as string);
    if (ids.length) {
      const { data: remaining } = await supabase
        .from("estudio_image_jobs")
        .select("queue_id")
        .in("queue_id", ids);
      const used = new Set((remaining ?? []).map((r) => r.queue_id as string));
      const empty = ids.filter((id) => !used.has(id));
      if (empty.length) {
        await supabase.from("estudio_image_queues").delete().in("id", empty);
      }
    }
  } else if (action === "archive") {
    const { error } = await supabase
      .from("estudio_image_jobs")
      .update({
        archived_at: new Date().toISOString(),
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", jobIds)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "saved");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("estudio_image_jobs")
      .update({
        request_id: null,
        status: "pending",
        asset_id: null,
        error: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", jobIds)
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    scheduleEstudioImageWorker({ force: true });
  }

  const { data: queues, error: qErr } = await gate.supabase
    .from("estudio_image_queues")
    .select(QUEUE_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  const list = (queues ?? []) as ImageQueueRow[];
  const { data: jobs } = list.length
    ? await supabase
        .from("estudio_image_jobs")
        .select(JOB_SELECT)
        .in(
          "queue_id",
          list.map((q) => q.id)
        )
        .is("archived_at", null)
    : { data: [] as ImageJobRow[] };
  const assembled = assembleImageQueues(list, (jobs ?? []) as ImageJobRow[]);
  return NextResponse.json({
    queues: assembled,
    activeCount: imageQueueActiveCount(assembled),
  });
}
