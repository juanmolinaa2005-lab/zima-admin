import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import {
  assembleInfluencers,
  buildInfluencerShotInserts,
  influencerActiveCount,
  scheduleEstudioInfluencerWorker,
  storeInfluencerShotImage,
  type InfluencerRow,
  type InfluencerShotRow,
} from "@/lib/creator/influencer-worker";
import { type EstudioInfluencer } from "@/lib/creator/estudio-v1";
import { syncInfluencerGalleryFolders } from "@/lib/gallery/influencers-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };
type Db = Awaited<ReturnType<typeof createClient>>;

const INF_SELECT =
  "id, project_id, user_id, name, traits, language, folder_id, created_at, active";
const SHOT_SELECT =
  "id, influencer_id, project_id, user_id, shot_key, label, sort_index, prompt, image_size, reference_url, request_id, status, image_url, error, created_at, updated_at, locked_at";

const FACE_REF_MAX_BYTES = 8 * 1024 * 1024;
const FACE_REF_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function ownGalleryPublicUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/storage/v1/object/public/gallery/`)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return url;
}

function httpError(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function statusOf(e: unknown, fallback = 500) {
  if (e && typeof e === "object" && "status" in e) {
    const n = Number((e as { status: unknown }).status);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  return fallback;
}

async function listInfluencers(
  supabase: Db,
  projectId: string
): Promise<EstudioInfluencer[]> {
  const { data: rows, error } = await supabase
    .from("estudio_influencers")
    .select(INF_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const list = (rows ?? []) as InfluencerRow[];
  if (!list.length) return [];
  const { data: shots, error: sErr } = await supabase
    .from("estudio_influencer_shots")
    .select(SHOT_SELECT)
    .in(
      "influencer_id",
      list.map((r) => r.id)
    )
    .order("sort_index", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  return assembleInfluencers(list, (shots ?? []) as InfluencerShotRow[]);
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  try {
    await syncInfluencerGalleryFolders(gate.supabase, projectId, gate.user.id);
    const influencers = await listInfluencers(gate.supabase, projectId);
    const activeCount = influencerActiveCount(influencers);
    if (activeCount > 0) scheduleEstudioInfluencerWorker();
    return NextResponse.json({ influencers, activeCount });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudieron cargar los influencers",
      },
      { status: 500 }
    );
  }
}

async function readCreatePayload(request: Request): Promise<{
  name: string;
  traits: string;
  language: "es" | "en";
  importInfluencers?: EstudioInfluencer[];
  reference?: { buffer: Buffer; contentType: string };
  referenceUrl?: string;
}> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const languageRaw = String(form.get("language") || "es");
    if (languageRaw !== "es" && languageRaw !== "en") {
      throw httpError("Elige Español o English como idioma.", 400);
    }
    const file = form.get("reference");
    let reference: { buffer: Buffer; contentType: string } | undefined;
    if (file instanceof File && file.size > 0) {
      const mime = (file.type || "").toLowerCase();
      if (!FACE_REF_MIMES.has(mime)) {
        throw httpError("La referencia debe ser JPG, PNG o WEBP.", 400);
      }
      if (file.size > FACE_REF_MAX_BYTES) {
        throw httpError("La foto de referencia no puede superar 8 MB.", 400);
      }
      reference = {
        buffer: Buffer.from(await file.arrayBuffer()),
        contentType: mime,
      };
    }
    return {
      name: String(form.get("name") || "").trim(),
      traits: String(form.get("traits") || "").trim(),
      language: languageRaw,
      reference,
    };
  }

  let body: {
    name?: string;
    traits?: string;
    language?: "es" | "en";
    importInfluencers?: EstudioInfluencer[];
    referenceImageUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    throw httpError("JSON inválido", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError("JSON inválido", 400);
  }
  if (body.language !== undefined && body.language !== "es" && body.language !== "en") {
    throw httpError("Elige Español o English como idioma.", 400);
  }
  let referenceUrl: string | undefined;
  if (typeof body.referenceImageUrl === "string" && body.referenceImageUrl.trim()) {
    const url = ownGalleryPublicUrl(body.referenceImageUrl);
    if (!url) throw httpError("La foto de referencia no es válida.", 400);
    referenceUrl = url;
  }
  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    traits: typeof body.traits === "string" ? body.traits.trim() : "",
    language: body.language || "es",
    importInfluencers: Array.isArray(body.importInfluencers)
      ? body.importInfluencers
      : undefined,
    referenceUrl,
  };
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate;

  let payload: Awaited<ReturnType<typeof readCreatePayload>>;
  try {
    payload = await readCreatePayload(request);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "JSON inválido" },
      { status: statusOf(e, 400) }
    );
  }

  try {
    if (payload.importInfluencers?.length) {
      for (const item of payload.importInfluencers.slice(0, 40)) {
        if (!item?.name?.trim()) continue;
        const { data: created, error } = await supabase
          .from("estudio_influencers")
          .insert({
            project_id: projectId,
            user_id: user.id,
            name: item.name.trim(),
            traits: item.traits?.trim() || "",
            language: item.language === "en" ? "en" : "es",
          })
          .select("id")
          .single();
        if (error || !created) continue;
        const { error: sErr } = await supabase
          .from("estudio_influencer_shots")
          .insert(
            buildInfluencerShotInserts({
              influencerId: created.id,
              projectId,
              userId: user.id,
              name: item.name.trim(),
              traits: item.traits?.trim() || "",
              existing: item.images,
            })
          );
        if (sErr) {
          await supabase.from("estudio_influencers").delete().eq("id", created.id);
        }
      }
      scheduleEstudioInfluencerWorker({ force: true });
      await syncInfluencerGalleryFolders(supabase, projectId, user.id);
      const influencers = await listInfluencers(supabase, projectId);
      return NextResponse.json({
        influencers,
        activeCount: influencerActiveCount(influencers),
      });
    }

    const { name, traits, language } = payload;
    if (!name) {
      return NextResponse.json(
        { error: "Ponle un nombre al influencer" },
        { status: 400 }
      );
    }
    const hasReference = Boolean(payload.reference || payload.referenceUrl);
    if (!hasReference && traits.length < 12) {
      return NextResponse.json(
        {
          error:
            "Describe el look o sube una foto de referencia.",
        },
        { status: 400 }
      );
    }

    const openaiKey = await getOpenAIApiKey();
    if (!openaiKey) {
      return NextResponse.json(
        {
          error: "NOT_CONNECTED",
          message: "Conecta OpenAI en Supabase → Secrets para generar el look.",
        },
        { status: 403 }
      );
    }

    const { data: created, error } = await supabase
      .from("estudio_influencers")
      .insert({
        project_id: projectId,
        user_id: user.id,
        name,
        traits,
        language,
      })
      .select(INF_SELECT)
      .single();
    if (error || !created) {
      return NextResponse.json(
        { error: error?.message || "No se pudo crear el influencer" },
        { status: 500 }
      );
    }

    let faceReferenceUrl: string | null = payload.referenceUrl || null;
    if (payload.reference) {
      try {
        faceReferenceUrl = await storeInfluencerShotImage({
          projectId,
          influencerId: created.id,
          shotKey: "face-reference",
          buffer: payload.reference.buffer,
          contentType: payload.reference.contentType,
        });
      } catch (e) {
        await supabase.from("estudio_influencers").delete().eq("id", created.id);
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : "No se pudo guardar la foto de referencia",
          },
          { status: 500 }
        );
      }
    }

    const { error: sErr } = await supabase.from("estudio_influencer_shots").insert(
      buildInfluencerShotInserts({
        influencerId: created.id,
        projectId,
        userId: user.id,
        name,
        traits,
        faceReferenceUrl,
      })
    );
    if (sErr) {
      await supabase.from("estudio_influencers").delete().eq("id", created.id);
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    scheduleEstudioInfluencerWorker({ force: true });
    await syncInfluencerGalleryFolders(supabase, projectId, user.id);
    const influencers = await listInfluencers(supabase, projectId);
    return NextResponse.json({
      influencers,
      activeCount: influencerActiveCount(influencers),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear" },
      { status: statusOf(e) }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: {
    influencerId?: string;
    folderId?: string | null;
    language?: "es" | "en";
    active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"JSON inválido"},{status:400});
  if (body.language !== undefined && body.language !== "es" && body.language !== "en") return NextResponse.json({error:"Idioma inválido"},{status:400});
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const influencerId = typeof body.influencerId === "string" ? body.influencerId.trim() : "";
  if (!influencerId) {
    return NextResponse.json({ error: "Falta influencerId" }, { status: 400 });
  }

  const folderId =
    typeof body.folderId === "string" && body.folderId.trim()
      ? body.folderId.trim()
      : null;

  if (folderId) {
    const { data: folder } = await gate.supabase
      .from("project_gallery_folders")
      .select("id")
      .eq("id", folderId)
      .eq("project_id", projectId)
      .eq("user_id", gate.user.id)
      .maybeSingle();
    if (!folder) {
      return NextResponse.json(
        { error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }
  }

  const patch: Record<string, unknown> = {
    ...(body.folderId !== undefined ? { folder_id: folderId } : {}),
    ...(body.language ? { language: body.language } : {}),
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
  };
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await gate.supabase
    .from("estudio_influencers")
    .update(patch)
    .eq("id", influencerId)
    .eq("project_id", projectId)
    .eq("user_id", gate.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const influencers = await listInfluencers(gate.supabase, projectId);
  return NextResponse.json({
    influencers,
    activeCount: influencerActiveCount(influencers),
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencerId")?.trim() || "";
  if (!influencerId) {
    return NextResponse.json({ error: "Falta influencerId" }, { status: 400 });
  }

  const { error } = await gate.supabase
    .from("estudio_influencers")
    .delete()
    .eq("id", influencerId)
    .eq("project_id", projectId)
    .eq("user_id", gate.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const influencers = await listInfluencers(gate.supabase, projectId);
  return NextResponse.json({
    influencers,
    activeCount: influencerActiveCount(influencers),
  });
}
