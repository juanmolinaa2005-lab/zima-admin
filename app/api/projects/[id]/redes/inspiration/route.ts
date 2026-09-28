import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

type InspirationPlatform = "youtube" | "tiktok" | "instagram" | "other";

function detectPlatform(url: string): InspirationPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      return "youtube";
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return "instagram";
    }
  } catch {
    /* ignore */
  }
  return "other";
}

async function enrichLink(url: string): Promise<{
  title: string | null;
  thumbnailUrl: string | null;
}> {
  const platform = detectPlatform(url);
  const oembed =
    platform === "youtube"
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      : platform === "tiktok"
        ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        : null;
  if (!oembed) return { title: null, thumbnailUrl: null };

  try {
    const res = await fetch(oembed, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { title: null, thumbnailUrl: null };
    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title?.trim() || null,
      thumbnailUrl: data.thumbnail_url?.trim() || null,
    };
  } catch {
    return { title: null, thumbnailUrl: null };
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_inspiration_links")
    .select(
      "id, url, title, note, platform, thumbnail_url, created_at"
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    links: (data ?? []).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      note: row.note,
      platform: row.platform,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { url?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.url || "").trim();
  const note = (body.note || "").trim() || null;
  const chunks = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Pega uno o más links de video, separados por ;" },
      { status: 400 }
    );
  }

  const parsedUrls: string[] = [];
  const invalid: string[] = [];
  for (const chunk of chunks.slice(0, 40)) {
    let candidate = chunk;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        invalid.push(chunk);
        continue;
      }
      parsedUrls.push(parsed.toString());
    } catch {
      invalid.push(chunk);
    }
  }

  if (parsedUrls.length === 0) {
    return NextResponse.json(
      { error: "Pega un link válido (https://…)." },
      { status: 400 }
    );
  }

  const unique = [...new Set(parsedUrls)];
  const created: {
    id: string;
    url: string;
    title: string | null;
    note: string | null;
    platform: InspirationPlatform;
    thumbnailUrl: string | null;
    createdAt: string;
  }[] = [];

  for (const url of unique) {
    const platform = detectPlatform(url);
    const extra = await enrichLink(url);
    const { data, error } = await supabase
      .from("project_inspiration_links")
      .insert({
        project_id: projectId,
        user_id: user.id,
        url,
        title: extra.title,
        note,
        platform,
        thumbnail_url: extra.thumbnailUrl,
      })
      .select("id, url, title, note, platform, thumbnail_url, created_at")
      .single();

    if (error || !data) continue;
    created.push({
      id: data.id,
      url: data.url,
      title: data.title,
      note: data.note,
      platform: data.platform,
      thumbnailUrl: data.thumbnail_url,
      createdAt: data.created_at,
    });
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: invalid.length ? `Links inválidos: ${invalid.join(" · ")}` : "No se pudo guardar" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    link: created[0],
    links: created,
    saved: created.length,
    invalid,
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const linkId = new URL(request.url).searchParams.get("id");
  if (!linkId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_inspiration_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
