import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { decryptTokenBundle, encryptTokenBundle, refreshYoutubeAccessToken } from "@/lib/redes/oauth";
import { publishVideo } from "@/lib/redes/publish";
import type { SocialPlatform } from "@/lib/redes/types";

export const TRASH_DAYS = 30;
const DONE_VIDEO_STATUSES = ["completed", "saved"];

export type UploadItemStatus = "pending" | "approved" | "rejected" | "publishing" | "published" | "failed";

export type UploadFlowRow = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  influencer_id: string | null;
  dynamic_id: string | null;
  account_id: string | null;
  every_hours: number;
  caption: string;
  active: boolean;
  next_publish_at: string | null;
  last_published_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadItemRow = {
  id: string;
  flow_id: string;
  project_id: string;
  user_id: string;
  video_id: string | null;
  video_url: string;
  overlay: string | null;
  caption: string | null;
  status: UploadItemStatus;
  error: string | null;
  post_id: string | null;
  external_id: string | null;
  reviewed_at: string | null;
  rejected_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadFlow = {
  id: string;
  name: string;
  influencerId: string | null;
  dynamicId: string | null;
  accountId: string | null;
  everyHours: number;
  caption: string;
  active: boolean;
  nextPublishAt: string | null;
  lastPublishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  counts: Record<UploadItemStatus, number>;
};

export type UploadItem = {
  id: string;
  videoId: string | null;
  videoUrl: string;
  overlay: string | null;
  caption: string | null;
  status: UploadItemStatus;
  error: string | null;
  reviewedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export const EMPTY_COUNTS: Record<UploadItemStatus, number> = {
  pending: 0,
  approved: 0,
  rejected: 0,
  publishing: 0,
  published: 0,
  failed: 0,
};

export function toFlow(row: UploadFlowRow, counts: Record<UploadItemStatus, number> = EMPTY_COUNTS): UploadFlow {
  return {
    id: row.id,
    name: row.name,
    influencerId: row.influencer_id,
    dynamicId: row.dynamic_id,
    accountId: row.account_id,
    everyHours: row.every_hours,
    caption: row.caption,
    active: row.active,
    nextPublishAt: row.next_publish_at,
    lastPublishedAt: row.last_published_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    counts,
  };
}

export function toItem(row: UploadItemRow): UploadItem {
  return {
    id: row.id,
    videoId: row.video_id,
    videoUrl: row.video_url,
    overlay: row.overlay,
    caption: row.caption,
    status: row.status,
    error: row.error,
    reviewedAt: row.reviewed_at,
    rejectedAt: row.rejected_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export async function countItems(db: SupabaseClient, flowIds: string[]) {
  const out = new Map<string, Record<UploadItemStatus, number>>();
  if (!flowIds.length) return out;
  const { data, error } = await db.from("upload_flow_items").select("flow_id, status").in("flow_id", flowIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { flow_id: string; status: UploadItemStatus }[]) {
    const counts = out.get(row.flow_id) ?? { ...EMPTY_COUNTS };
    counts[row.status] += 1;
    out.set(row.flow_id, counts);
  }
  return out;
}

/** Adds finished videos of the flow's influencer + dynamic to the review queue. */
export async function syncFlowItems(db: SupabaseClient, flow: UploadFlowRow) {
  if (!flow.influencer_id || !flow.dynamic_id) return 0;
  const { data: videos, error } = await db
    .from("estudio_influencer_videos")
    .select("id, video_url, overlay")
    .eq("project_id", flow.project_id)
    .eq("influencer_id", flow.influencer_id)
    .eq("action", flow.dynamic_id)
    .in("status", DONE_VIDEO_STATUSES)
    .not("video_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = ((videos ?? []) as { id: string; video_url: string; overlay: string | null }[]).map((video) => ({
    flow_id: flow.id,
    project_id: flow.project_id,
    user_id: flow.user_id,
    video_id: video.id,
    video_url: video.video_url,
    overlay: video.overlay,
  }));
  if (!rows.length) return 0;
  const { data: inserted, error: insertError } = await db
    .from("upload_flow_items")
    .upsert(rows, { onConflict: "flow_id,video_id", ignoreDuplicates: true })
    .select("id");
  if (insertError) throw new Error(insertError.message);
  return inserted?.length ?? 0;
}

/** When the queue was empty, the first approved video goes out on the next worker tick. */
export async function ensureNextPublish(db: SupabaseClient, flow: UploadFlowRow) {
  if (!flow.active || flow.next_publish_at) return;
  await db
    .from("upload_flows")
    .update({ next_publish_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", flow.id);
}

type AccountRow = {
  id: string;
  platform: SocialPlatform;
  auth_method: string;
  tokens_ciphertext: string | null;
};

async function accountTokens(admin: SupabaseClient, account: AccountRow, userId: string) {
  if (!account.tokens_ciphertext || account.auth_method !== "oauth") {
    throw new Error("La cuenta no tiene acceso por API. Conéctala en Redes → APIs.");
  }
  let tokens = decryptTokenBundle(account.tokens_ciphertext);
  if (account.platform === "youtube") {
    const { data } = await admin
      .from("user_settings")
      .select("youtube_client_id, youtube_client_secret_ciphertext")
      .eq("user_id", userId)
      .maybeSingle();
    const clientId = (data?.youtube_client_id as string | null)?.trim();
    const cipher = data?.youtube_client_secret_ciphertext as string | null;
    if (clientId && cipher) {
      const refreshed = await refreshYoutubeAccessToken(tokens, clientId, decryptSecret(cipher));
      if (refreshed.access_token !== tokens.access_token) {
        await admin
          .from("project_social_accounts")
          .update({ tokens_ciphertext: encryptTokenBundle(refreshed), updated_at: new Date().toISOString() })
          .eq("id", account.id);
      }
      tokens = refreshed;
    }
  }
  return tokens;
}

function buildCaption(flow: UploadFlowRow, item: UploadItemRow) {
  return (item.caption ?? flow.caption ?? "").trim().slice(0, 2200);
}

async function publishNext(admin: SupabaseClient, flow: UploadFlowRow) {
  const now = new Date();
  const nextAt = new Date(now.getTime() + flow.every_hours * 3_600_000).toISOString();

  const { data: candidates } = await admin
    .from("upload_flow_items")
    .select("*")
    .eq("flow_id", flow.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .limit(1);
  const candidate = (candidates?.[0] ?? null) as UploadItemRow | null;
  if (!candidate) {
    await admin.from("upload_flows").update({ next_publish_at: null, updated_at: now.toISOString() }).eq("id", flow.id);
    return "empty" as const;
  }

  const { data: claimed } = await admin
    .from("upload_flow_items")
    .update({ status: "publishing", updated_at: now.toISOString() })
    .eq("id", candidate.id)
    .eq("status", "approved")
    .select("id");
  if (!claimed?.length) return "skipped" as const;

  const fail = async (message: string) => {
    await admin
      .from("upload_flow_items")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", candidate.id);
    await admin
      .from("upload_flows")
      .update({ last_error: message, next_publish_at: nextAt, updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    return "failed" as const;
  };

  if (!flow.account_id) return fail("El flujo no tiene red para publicar.");
  const { data: accountData } = await admin
    .from("project_social_accounts")
    .select("id, platform, auth_method, tokens_ciphertext")
    .eq("id", flow.account_id)
    .maybeSingle();
  const account = accountData as AccountRow | null;
  if (!account) return fail("La cuenta de la red ya no existe.");

  let tokens;
  try {
    tokens = await accountTokens(admin, account, flow.user_id);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo leer el acceso a la cuenta.");
  }

  const caption = buildCaption(flow, candidate);
  const { data: post } = await admin
    .from("project_social_posts")
    .insert({
      project_id: flow.project_id,
      user_id: flow.user_id,
      account_id: account.id,
      platform: account.platform,
      caption: caption || null,
      video_url: candidate.video_url,
      status: "uploading",
      updated_at: now.toISOString(),
    })
    .select("id")
    .single();

  let result;
  try {
    result = await publishVideo({ platform: account.platform, tokens, videoUrl: candidate.video_url, caption });
  } catch (err) {
    result = { status: "failed" as const, message: err instanceof Error ? err.message : "Error al publicar" };
  }

  if (post?.id) {
    await admin
      .from("project_social_posts")
      .update({
        status: result.status,
        external_id: result.externalId ?? null,
        error: result.status === "failed" ? result.message ?? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
  }
  if (result.status === "failed") return fail(result.message || "La red rechazó el video.");

  await admin
    .from("upload_flow_items")
    .update({
      status: "published",
      error: null,
      post_id: post?.id ?? null,
      external_id: result.externalId ?? null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id);
  await admin
    .from("upload_flows")
    .update({ last_published_at: now.toISOString(), last_error: null, next_publish_at: nextAt, updated_at: new Date().toISOString() })
    .eq("id", flow.id);
  await admin.from("project_social_accounts").update({ last_used_at: now.toISOString() }).eq("id", account.id);
  return "published" as const;
}

export async function purgeTrash(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("upload_flow_items")
    .delete()
    .eq("status", "rejected")
    .lt("rejected_at", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function runUploadFlowsWorker(admin: SupabaseClient, budgetMs = 240_000) {
  const started = Date.now();
  const { data, error } = await admin
    .from("upload_flows")
    .select("*")
    .eq("active", true)
    .not("next_publish_at", "is", null)
    .lte("next_publish_at", new Date().toISOString())
    .order("next_publish_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);
  const results: Record<string, number> = {};
  for (const flow of (data ?? []) as UploadFlowRow[]) {
    if (Date.now() - started > budgetMs) break;
    const outcome = await publishNext(admin, flow);
    results[outcome] = (results[outcome] ?? 0) + 1;
  }
  const purged = await purgeTrash(admin);
  return { flows: data?.length ?? 0, results, purged };
}
