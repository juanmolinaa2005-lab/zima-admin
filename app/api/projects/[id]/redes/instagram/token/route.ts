import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { getMetaAppCredentials } from "@/lib/meta/user-key";
import { encryptTokenBundle, type OAuthTokenBundle } from "@/lib/redes/oauth";

type Params = { params: Promise<{ id: string }> };

type IgProfile = {
  igUserId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  pageToken: string;
};

type IgNode = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

async function exchangeLongLived(
  appId: string,
  appSecret: string,
  shortToken: string
): Promise<OAuthTokenBundle> {
  const u = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(u.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !data.access_token) {
    return { access_token: shortToken };
  }
  return {
    access_token: data.access_token,
    expires_at: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
  };
}

function fromIgNode(
  ig: IgNode,
  pageToken: string,
  fallbackName?: string
): IgProfile | null {
  if (!ig.id) return null;
  return {
    igUserId: ig.id,
    username: ig.username,
    displayName: ig.name || ig.username || fallbackName,
    avatarUrl: ig.profile_picture_url,
    pageToken,
  };
}

async function fetchIgOnPage(
  pageId: string,
  pageToken: string,
  pageName?: string
): Promise<IgProfile | null> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(pageToken)}`
  );
  const data = (await res.json()) as {
    instagram_business_account?: IgNode;
    error?: { message?: string };
  };
  if (!res.ok || data.error) return null;
  return fromIgNode(data.instagram_business_account ?? {}, pageToken, pageName);
}

async function resolveIgFromToken(accessToken: string): Promise<IgProfile> {
  const notes: string[] = [];

  // A) User token: list Pages, then resolve IG per Page
  // Do NOT request instagram_business_account on /me (User) — that field is Page-only.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(accessToken)}`
  );
  const pagesData = (await pagesRes.json()) as {
    data?: { id?: string; name?: string; access_token?: string }[];
    error?: { message?: string; code?: number; error_subcode?: number };
  };

  if (pagesRes.ok && (pagesData.data?.length ?? 0) > 0) {
    for (const page of pagesData.data ?? []) {
      if (!page.id) continue;
      const pageToken = page.access_token || accessToken;
      const found = await fetchIgOnPage(page.id, pageToken, page.name);
      if (found) return found;
    }
    notes.push(
      `Found ${pagesData.data!.length} Facebook Page(s) but none has an Instagram Business/Creator account linked.`
    );
  } else if (pagesData.error) {
    notes.push(`me/accounts: ${pagesData.error.message}`);
  } else {
    notes.push(
      "me/accounts returned no Pages. Token may lack pages_show_list, or this Facebook user manages no Pages."
    );
  }

  // B) Token might already be a Page access token — /me is the Page
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,category&access_token=${encodeURIComponent(accessToken)}`
  );
  const meData = (await meRes.json()) as {
    id?: string;
    name?: string;
    category?: string;
    error?: { message?: string };
  };

  if (meRes.ok && meData.id && meData.category) {
    // Pages usually have a category; Users do not
    const found = await fetchIgOnPage(meData.id, accessToken, meData.name);
    if (found) return found;
    notes.push(
      `Token looks like a Page token (${meData.name || meData.id}) but has no linked Instagram Business account.`
    );
  }

  // C) Instagram Login / Instagram Graph token (graph.instagram.com)
  for (const base of [
    "https://graph.instagram.com/v21.0/me",
    "https://graph.facebook.com/v21.0/me",
  ]) {
    const igRes = await fetch(
      `${base}?fields=id,user_id,username,name,account_type,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
    );
    const igData = (await igRes.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      name?: string;
      account_type?: string;
      profile_picture_url?: string;
      error?: { message?: string };
    };
    if (igRes.ok && igData.username && (igData.user_id || igData.id)) {
      return {
        igUserId: igData.user_id || igData.id!,
        username: igData.username,
        displayName: igData.name || igData.username,
        avatarUrl: igData.profile_picture_url,
        pageToken: accessToken,
      };
    }
    if (igData.error?.message) {
      notes.push(`${base}: ${igData.error.message}`);
    }
  }

  throw new Error(
    [
      "Could not resolve an Instagram Business account from this token.",
      "Prefer Connect via Instagram Login OAuth (scopes instagram_business_basic + instagram_business_content_publish).",
      "Or paste an Instagram user token from Graph Explorer for your Instagram product app.",
      ...notes.slice(0, 3),
    ].join(" ")
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: { accessToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = (body.accessToken || "").trim();
  if (!rawToken) {
    return NextResponse.json({ error: "Access token required" }, { status: 400 });
  }

  try {
    let tokens: OAuthTokenBundle = { access_token: rawToken };
    const meta = await getMetaAppCredentials();
    if (meta) {
      tokens = await exchangeLongLived(meta.appId, meta.appSecret, rawToken);
    }

    const ig = await resolveIgFromToken(tokens.access_token);
    if (ig.pageToken && ig.pageToken !== tokens.access_token) {
      tokens = {
        ...tokens,
        access_token: ig.pageToken,
        open_id: ig.igUserId,
      };
    } else {
      tokens = { ...tokens, open_id: ig.igUserId };
    }

    const cipher = encryptTokenBundle(tokens);
    const accountPayload = {
      project_id: projectId,
      user_id: user.id,
      platform: "instagram" as const,
      username: ig.username || null,
      display_name: ig.displayName || ig.username || null,
      avatar_url: ig.avatarUrl || null,
      external_id: ig.igUserId,
      auth_method: "oauth" as const,
      status: "active" as const,
      tokens_ciphertext: cipher,
      scopes: [],
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    };

    const { data: existing } = await supabase
      .from("project_social_accounts")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("platform", "instagram")
      .eq("external_id", ig.igUserId)
      .maybeSingle();

    let accountId = existing?.id as string | undefined;
    if (accountId) {
      const { error } = await supabase
        .from("project_social_accounts")
        .update(accountPayload)
        .eq("id", accountId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { data, error } = await supabase
        .from("project_social_accounts")
        .insert(accountPayload)
        .select("id")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      accountId = data.id;
    }

    return NextResponse.json({
      ok: true,
      account: {
        id: accountId,
        username: ig.username,
        displayName: ig.displayName,
        externalId: ig.igUserId,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not connect token" },
      { status: 400 }
    );
  }
}
