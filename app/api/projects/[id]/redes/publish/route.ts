import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { decryptTokenBundle, encryptTokenBundle, refreshYoutubeAccessToken } from "@/lib/redes/oauth";
import { publishVideo } from "@/lib/redes/publish";
import type { AccountRow } from "@/lib/redes/serialize";
import { getYouTubeAppCredentials } from "@/lib/youtube/user-key";
import type { YoutubePrivacy } from "@/lib/youtube/upload";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    accountId?: string;
    videoUrl?: string;
    caption?: string;
    youtubePrivacy?: YoutubePrivacy;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = (body.accountId || "").trim();
  const videoUrl = (body.videoUrl || "").trim();
  const caption = (body.caption || "").trim();
  const youtubePrivacy: YoutubePrivacy =
    body.youtubePrivacy === "unlisted" || body.youtubePrivacy === "private"
      ? body.youtubePrivacy
      : "public";

  if (!accountId || !videoUrl) {
    return NextResponse.json(
      { error: "accountId and videoUrl are required." },
      { status: 400 }
    );
  }
  try {
    // eslint-disable-next-line no-new
    new URL(videoUrl);
  } catch {
    return NextResponse.json(
      { error: "videoUrl must be a public https URL the platform can fetch." },
      { status: 400 }
    );
  }

  const { data: account, error } = await supabase
    .from("project_social_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const row = account as AccountRow;
  if (!row.tokens_ciphertext || row.auth_method !== "oauth") {
    return NextResponse.json(
      {
        error:
          "This account has no OAuth tokens. Connect it via the official API (APIs tab → Connect).",
      },
      { status: 400 }
    );
  }

  let tokens;
  try {
    tokens = decryptTokenBundle(row.tokens_ciphertext);
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt tokens. Reconnect the account." },
      { status: 400 }
    );
  }

  if (row.platform === "youtube") {
    try {
      const yt = await getYouTubeAppCredentials();
      if (yt) {
        const refreshed = await refreshYoutubeAccessToken(
          tokens,
          yt.clientId,
          yt.clientSecret
        );
        if (refreshed.access_token !== tokens.access_token) {
          await supabase
            .from("project_social_accounts")
            .update({
              tokens_ciphertext: encryptTokenBundle(refreshed),
              updated_at: new Date().toISOString(),
            })
            .eq("id", accountId);
        }
        tokens = refreshed;
      }
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "YouTube token expired. Reconnect the channel.",
        },
        { status: 401 }
      );
    }
  }

  const { data: postRow, error: postErr } = await supabase
    .from("project_social_posts")
    .insert({
      project_id: projectId,
      user_id: user.id,
      account_id: accountId,
      platform: row.platform,
      caption: caption || null,
      video_url: videoUrl,
      status: "uploading",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (postErr) {
    return NextResponse.json({ error: postErr.message }, { status: 500 });
  }

  const result = await publishVideo({
    platform: row.platform,
    tokens,
    videoUrl,
    caption,
    youtubePrivacy,
  });

  await supabase
    .from("project_social_posts")
    .update({
      status: result.status === "failed" ? "failed" : result.status,
      external_id: result.externalId || null,
      error: result.status === "failed" ? result.message || "Failed" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postRow.id);

  await supabase
    .from("project_social_accounts")
    .update({
      last_used_at: new Date().toISOString(),
      last_error: result.status === "failed" ? result.message || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (result.status === "failed") {
    return NextResponse.json(
      { error: result.message || "Publish failed", result, post: postRow },
      { status: 502 }
    );
  }

  return NextResponse.json({ result, post: postRow });
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_social_posts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: data ?? [] });
}
