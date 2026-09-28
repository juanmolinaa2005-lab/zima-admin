import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { createClient } from "@/lib/supabase/server";
import {
  assembleImageQueues,
  imageQueueActiveCount,
  scheduleEstudioImageWorker,
  type ImageJobRow,
  type ImageQueueRow,
} from "@/lib/creator/image-queue-worker";
import { getImagePreset } from "@/lib/higgsfield/presets";
import {
  splitImagePrompts,
  type EstudioImageQueue,
} from "@/lib/creator/estudio-v1";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };
type Db = Awaited<ReturnType<typeof createClient>>;

const QUEUE_SELECT =
  "id, project_id, user_id, preset_id, model_id, model_name, folder_id, folder_name, created_at";
const JOB_SELECT =
  "id, queue_id, project_id, user_id, prompt, sort_index, request_id, status, image_url, asset_id, error, created_at, updated_at, locked_at, archived_at";

async function listQueues(supabase: Db, projectId: string) {
  const { data: queues, error } = await supabase
    .from("estudio_image_queues")
    .select(QUEUE_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const list = (queues ?? []) as ImageQueueRow[];
  if (!list.length) return [];
  const { data: jobs, error: jErr } = await supabase
    .from("estudio_image_jobs")
    .select(JOB_SELECT)
    .in(
      "queue_id",
      list.map((q) => q.id)
    )
    .is("archived_at", null)
    .order("sort_index", { ascending: true });
  if (jErr) throw new Error(jErr.message);
  return assembleImageQueues(list, (jobs ?? []) as ImageJobRow[]);
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  try {
    const queues = await listQueues(gate.supabase, projectId);
    const activeCount = imageQueueActiveCount(queues);
    if (activeCount > 0) scheduleEstudioImageWorker();
    return NextResponse.json({
      queues,
      activeCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron cargar las colas" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate;

  let body: {
    presetId?: string;
    folderId?: string;
    prompts?: string[] | string;
    importQueues?: EstudioImageQueue[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (Array.isArray(body.importQueues) && body.importQueues.length) {
      await importLocalQueues(supabase, user.id, projectId, body.importQueues);
      scheduleEstudioImageWorker({ force: true });
      const queues = await listQueues(supabase, projectId);
      return NextResponse.json({
        queues,
        activeCount: imageQueueActiveCount(queues),
      });
    }

    const preset = body.presetId ? getImagePreset(body.presetId) : undefined;
    if (!preset) {
      return NextResponse.json({ error: "Modelo no válido" }, { status: 400 });
    }
    const folderId = (body.folderId || "").trim();
    const prompts = Array.isArray(body.prompts)
      ? body.prompts.map((p) => p.trim()).filter(Boolean)
      : splitImagePrompts(typeof body.prompts === "string" ? body.prompts : "");
    if (!folderId) {
      return NextResponse.json({ error: "Elige una carpeta" }, { status: 400 });
    }
    if (!prompts.length) {
      return NextResponse.json({ error: "Pega al menos un prompt" }, { status: 400 });
    }
    if (prompts.length > 80) {
      return NextResponse.json(
        { error: "Máximo 80 imágenes por cola" },
        { status: 400 }
      );
    }

    const { data: folder } = await supabase
      .from("project_gallery_folders")
      .select("id, name, parent_id")
      .eq("id", folderId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!folder) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }

    const { data: folders } = await supabase
      .from("project_gallery_folders")
      .select("id, name, parent_id")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    const folderName = folderPath(
      (folders ?? []) as Array<{ id: string; name: string; parent_id: string | null }>,
      folderId
    );

    const { data: queue, error: qErr } = await supabase
      .from("estudio_image_queues")
      .insert({
        project_id: projectId,
        user_id: user.id,
        preset_id: preset.id,
        model_id: preset.modelId,
        model_name: preset.name,
        folder_id: folderId,
        folder_name: folderName,
      })
      .select(QUEUE_SELECT)
      .single();
    if (qErr || !queue) {
      return NextResponse.json(
        { error: qErr?.message || "No se pudo crear la cola" },
        { status: 500 }
      );
    }

    const { error: jErr } = await supabase.from("estudio_image_jobs").insert(
      prompts.map((prompt, i) => ({
        queue_id: queue.id,
        project_id: projectId,
        user_id: user.id,
        prompt,
        sort_index: i,
        status: "pending",
      }))
    );
    if (jErr) {
      await supabase.from("estudio_image_queues").delete().eq("id", queue.id);
      return NextResponse.json({ error: jErr.message }, { status: 500 });
    }

    scheduleEstudioImageWorker({ force: true });
    const queues = await listQueues(supabase, projectId);
    return NextResponse.json({
      queues,
      activeCount: imageQueueActiveCount(queues),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo encolar" },
      { status: 500 }
    );
  }
}

function folderPath(
  folders: Array<{ id: string; name: string; parent_id: string | null }>,
  id: string
): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return parts.join(" / ") || "Carpeta";
}

async function importLocalQueues(
  supabase: Db,
  userId: string,
  projectId: string,
  incoming: EstudioImageQueue[]
) {
  for (const queue of incoming.slice(0, 40)) {
    if (!queue.jobs?.length) continue;
    const preset = getImagePreset(queue.presetId);
    const { data: created, error } = await supabase
      .from("estudio_image_queues")
      .insert({
        project_id: projectId,
        user_id: userId,
        preset_id: preset?.id || queue.presetId,
        model_id: preset?.modelId || queue.modelId,
        model_name: preset?.name || queue.modelName,
        folder_id: queue.folderId,
        folder_name: queue.folderName || "Carpeta",
      })
      .select("id")
      .single();
    if (error || !created) continue;
    const { error: jErr } = await supabase.from("estudio_image_jobs").insert(
      queue.jobs.map((job, i) => ({
        queue_id: created.id,
        project_id: projectId,
        user_id: userId,
        prompt: job.prompt,
        sort_index: i,
        request_id: job.requestId,
        status:
          job.status === "saved" && job.assetId
            ? "saved"
            : job.status === "failed" || job.error
              ? "failed"
              : "pending",
        image_url: job.imageUrl,
        asset_id: job.assetId,
        error: job.error,
      }))
    );
    if (jErr) {
      await supabase.from("estudio_image_queues").delete().eq("id", created.id);
    }
  }
}
