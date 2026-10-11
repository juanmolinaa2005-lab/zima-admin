import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { statsPatch } from "@/lib/viewtracker/refresh";
import { parseVideoUrl } from "@/lib/viewtracker/video";

type Params = { params: Promise<{ id: string }> };

export type VideoRow = {
  id: string;
  url: string;
  platform: string | null;
  video_id: string | null;
  title: string | null;
  author: string | null;
  thumbnail_url: string | null;
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  saves?: number | string | null;
  duration_seconds?: number | null;
  posted_at?: string | null;
  last_refreshed_at?: string | null;
  views_prev?: number | string | null;
  account_id?: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
};

function toNum(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? n : 0;
}

export function serializeVideo(row: VideoRow) {
  const views = toNum(row.views);
  const prev = toNum(row.views_prev);
  return {
    id: row.id,
    url: row.url,
    platform: row.platform,
    videoId: row.video_id,
    title: row.title,
    author: row.author,
    thumbnailUrl: row.thumbnail_url,
    views,
    likes: toNum(row.likes),
    comments: toNum(row.comments),
    shares: toNum(row.shares),
    saves: toNum(row.saves),
    durationSeconds: row.duration_seconds ?? null,
    postedAt: row.posted_at ?? null,
    lastRefreshedAt: row.last_refreshed_at ?? null,
    viewsPrev: prev,
    accountId: row.account_id ?? null,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function splitUrls(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const pageSize = 1000;
  const rows: VideoRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("project_tracked_videos")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = (data ?? []) as VideoRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return NextResponse.json(
    { items: rows.map(serializeVideo) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const urls = splitUrls(body.url ?? "");
  if (urls.length === 0) {
    return NextResponse.json({ error: "Pega al menos un link de video." }, { status: 400 });
  }
  if (urls.length > 20) {
    return NextResponse.json({ error: "Máximo 20 links a la vez." }, { status: 400 });
  }

  const created: ReturnType<typeof serializeVideo>[] = [];
  const skipped: string[] = [];

  for (const raw of urls) {
    const parsed = parseVideoUrl(raw);
    if (!parsed) {
      skipped.push(raw);
      continue;
    }
    const stats = await statsPatch(parsed.url, parsed.platform, parsed.videoId, 0);
    const author =
      stats.author || (parsed.username ? `@${parsed.username}` : null);
    const { data, error } = await supabase
      .from("project_tracked_videos")
      .insert({
        project_id: projectId,
        user_id: user.id,
        url: parsed.url,
        platform: parsed.platform,
        video_id: parsed.videoId,
        title: stats.title,
        author,
        thumbnail_url: stats.thumbnail_url,
        views: stats.views,
        views_prev: 0,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        saves: stats.saves,
        duration_seconds: stats.duration_seconds,
        posted_at: stats.posted_at,
        last_refreshed_at: stats.last_refreshed_at,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        skipped.push(parsed.url);
        continue;
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    created.push(serializeVideo(data as VideoRow));
  }

  if (created.length === 0) {
    return NextResponse.json(
      {
        error: skipped.length
          ? "Esos links ya están trackeados o no son válidos."
          : "No se pudo guardar.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ items: created, skipped }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { id?: string; favorite?: boolean; refresh?: boolean; refreshAll?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.refreshAll) {
    const { data: rows, error } = await supabase
      .from("project_tracked_videos")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: true })
      .limit(25);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const items: ReturnType<typeof serializeVideo>[] = [];
    for (const row of (rows ?? []) as VideoRow[]) {
      const patch = await statsPatch(row.url, row.platform, row.video_id, toNum(row.views));
      const { data } = await supabase
        .from("project_tracked_videos")
        .update(patch)
        .eq("id", row.id)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (data) items.push(serializeVideo(data as VideoRow));
    }
    return NextResponse.json({ items });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;

  if (body.refresh) {
    const { data: existing } = await supabase
      .from("project_tracked_videos")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.url) {
      Object.assign(
        patch,
        await statsPatch(
          existing.url,
          existing.platform,
          existing.video_id,
          toNum(existing.views)
        )
      );
    }
  }

  const { data, error } = await supabase
    .from("project_tracked_videos")
    .update(patch)
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: serializeVideo(data as VideoRow) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const vid = url.searchParams.get("id")?.trim();
  if (!vid) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_tracked_videos")
    .delete()
    .eq("id", vid)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
