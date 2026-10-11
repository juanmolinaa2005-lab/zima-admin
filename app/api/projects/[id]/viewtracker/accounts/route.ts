import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { discoverAccountVideos, type DiscoveredVideo } from "@/lib/viewtracker/account-feed";
import { ingestDiscoveredVideos } from "@/lib/viewtracker/ingest";
import { parseProfileUrl } from "@/lib/viewtracker/profile";
import { isHostedAvatar, persistProfileAvatar } from "@/lib/viewtracker/avatar-cache";
import { fetchPublicAccountStats } from "@/lib/viewtracker/stats";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

type AccountRow = {
  id: string;
  url: string;
  platform: string | null;
  username: string | null;
  avatar_url: string | null;
  display_name?: string | null;
  creator_name?: string | null;
  followers?: number | string | null;
  last_refreshed_at?: string | null;
  created_at: string;
};

function toNum(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? n : 0;
}

function serialize(row: AccountRow) {
  return {
    id: row.id,
    url: row.url,
    platform: row.platform,
    username: row.username,
    avatarUrl: row.avatar_url,
    displayName: row.display_name ?? null,
    creatorName: row.creator_name ?? null,
    followers: toNum(row.followers),
    lastRefreshedAt: row.last_refreshed_at ?? null,
    createdAt: row.created_at,
  };
}

async function dropEmptyStubs(
  // Supabase's query builder is a thenable, not a plain Promise. `any` keeps this helper from unfolding that type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  userId: string,
  accountId: string,
  found: DiscoveredVideo[]
) {
  if (found.length === 0) return;
  const keep = new Set(found.map((item) => item.url));
  const { data } = await supabase
    .from("project_tracked_videos")
    .select("id,url,title,views")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("account_id", accountId);
  const rows = (data ?? []) as { id: string; url: string; title: string | null; views: number | string | null }[];
  const stale = rows.filter((row) => !keep.has(row.url) && !row.title && Number(row.views ?? 0) === 0);
  if (stale.length === 0) return;
  await supabase
    .from("project_tracked_videos")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in(
      "id",
      stale.map((row) => row.id)
    );
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
  const { data, error } = await supabase
    .from("project_tracked_accounts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as AccountRow[] | null) ?? [];
  const items = await Promise.all(rows.map((row) => stabilizeAvatar(supabase, projectId, row)));

  return NextResponse.json(
    { items: items.map(serialize) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function stabilizeAvatar(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  row: AccountRow
): Promise<AccountRow> {
  if (isHostedAvatar(row.avatar_url)) return row;
  try {
    const stats = await fetchPublicAccountStats(row.url, row.platform);
    const hosted = await persistProfileAvatar(supabase, {
      projectId,
      platform: row.platform,
      username: row.username,
      sourceUrl: stats.thumbnailUrl,
      reuse: true,
    });
    if (!hosted) return { ...row, avatar_url: null };
    await supabase
      .from("project_tracked_accounts")
      .update({ avatar_url: hosted })
      .eq("id", row.id)
      .eq("project_id", projectId);
    return { ...row, avatar_url: hosted };
  } catch {
    return { ...row, avatar_url: null };
  }
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
    return NextResponse.json({ error: "Pega al menos un link de cuenta." }, { status: 400 });
  }
  if (urls.length > 5) {
    return NextResponse.json({ error: "Máximo 5 cuentas a la vez." }, { status: 400 });
  }

  const created: ReturnType<typeof serialize>[] = [];
  const skipped: string[] = [];
  let videosIngested = 0;

  async function ingestFor(row: AccountRow) {
    const found = await discoverAccountVideos({
      url: row.url,
      platform: row.platform,
      username: row.username,
    });
    const result = await ingestDiscoveredVideos(supabase, {
      projectId,
      userId: user.id,
      accountId: row.id,
      items: found,
    });
    videosIngested += result.total;
    await dropEmptyStubs(supabase, projectId, user.id, row.id, found);
    return result.total;
  }

  for (const raw of urls) {
    const meta = parseProfileUrl(raw);
    if (!meta) {
      skipped.push(raw);
      continue;
    }
    const stats = await fetchPublicAccountStats(meta.normalizedUrl, meta.platform);
    const hostedAvatar = await persistProfileAvatar(supabase, {
      projectId,
      platform: meta.platform,
      username: meta.username,
      sourceUrl: stats.thumbnailUrl,
      reuse: false,
    });
    const { data, error } = await supabase
      .from("project_tracked_accounts")
      .insert({
        project_id: projectId,
        user_id: user.id,
        url: meta.normalizedUrl,
        platform: meta.platform,
        username: meta.username,
        avatar_url: hostedAvatar,
        display_name: stats.displayName,
        followers: stats.followers ?? 0,
        last_refreshed_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    let row = data as AccountRow | null;
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("project_tracked_accounts")
          .select("*")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .eq("url", meta.normalizedUrl)
          .maybeSingle();
        row = (existing as AccountRow | null) ?? null;
        if (!row) {
          skipped.push(meta.normalizedUrl);
          continue;
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (!row) continue;
    try {
      await ingestFor(row);
    } catch {
      /* keep the account even if public video discovery fails */
    }
    created.push(serialize(row));
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: skipped.length ? "No se pudo guardar esa cuenta." : "No se pudo guardar." },
      { status: 400 }
    );
  }

  return NextResponse.json({ items: created, skipped, videosIngested }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { id?: string; creatorName?: string | null; refresh?: boolean; refreshAll?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  async function refreshRow(row: AccountRow) {
    const stats = await fetchPublicAccountStats(row.url, row.platform);
    const hostedAvatar = await persistProfileAvatar(supabase, {
      projectId,
      platform: row.platform,
      username: row.username,
      sourceUrl: stats.thumbnailUrl,
      reuse: false,
    });
    const { data, error } = await supabase
      .from("project_tracked_accounts")
      .update({
        display_name: stats.displayName || row.display_name,
        followers: stats.followers ?? row.followers ?? 0,
        avatar_url: hostedAvatar || (isHostedAvatar(row.avatar_url) ? row.avatar_url : null),
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    try {
      const found = await discoverAccountVideos({
        url: row.url,
        platform: row.platform,
        username: row.username,
      });
      await ingestDiscoveredVideos(supabase, {
        projectId,
        userId: user.id,
        accountId: row.id,
        items: found,
      });
      await dropEmptyStubs(supabase, projectId, user.id, row.id, found);
    } catch {
      /* keep account refresh even if video ingest fails */
    }
    return data ? serialize(data as AccountRow) : serialize(row);
  }

  if (body.refreshAll) {
    const { data: rows, error } = await supabase
      .from("project_tracked_accounts")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items: ReturnType<typeof serialize>[] = [];
    for (const row of (rows ?? []) as AccountRow[]) {
      items.push(await refreshRow(row));
    }
    return NextResponse.json({ items });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (body.refresh) {
    const { data: existing } = await supabase
      .from("project_tracked_accounts")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item: await refreshRow(existing as AccountRow) });
  }

  const { data, error } = await supabase
    .from("project_tracked_accounts")
    .update({
      creator_name: body.creatorName === undefined ? undefined : (body.creatorName || null),
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: serialize(data as AccountRow) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_tracked_accounts")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
