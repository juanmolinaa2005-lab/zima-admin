import { NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireProjectOwner } from "@/lib/mail/access";
import { getMetaAppCredentials } from "@/lib/meta/user-key";
import { PLATFORM_API } from "@/lib/redes/platforms";
import {
  buildAuthorizeUrl,
  buildOAuthState,
  defaultRedirectUri,
  newNonce,
  type SocialAppRow,
} from "@/lib/redes/oauth";
import { isSocialPlatform } from "@/lib/redes/types";
import {
  getYouTubeAppCredentials,
  looksLikeGoogleOAuthClientId,
} from "@/lib/youtube/user-key";

type Params = { params: Promise<{ id: string; platform: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: projectId, platform: platformRaw } = await params;
  if (!isSocialPlatform(platformRaw)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const origin = new URL(request.url).origin;
  const redirectUri = defaultRedirectUri(origin);

  let clientId = "";
  let clientSecret = "";

  // Instagram/Facebook: always prefer Settings → API (Meta) so stale
  // project_social_apps rows don't break OAuth.
  if (platformRaw === "instagram" || platformRaw === "facebook") {
    const meta = await getMetaAppCredentials();
    if (!meta) {
      return NextResponse.json(
        {
          error:
            platformRaw === "instagram"
              ? "Configure Meta in Settings → API first. For Instagram Login use the Instagram App ID + Secret from the Instagram product panel (not only the Facebook App ID in the URL)."
              : "Configure Meta App ID + App Secret in Settings → API first.",
        },
        { status: 400 }
      );
    }
    clientId = meta.appId.trim();
    clientSecret = meta.appSecret.trim();

    if (!/^\d{5,}$/.test(clientId)) {
      return NextResponse.json(
        {
          error:
            "Meta App ID looks invalid. Paste the numeric App ID from Meta (Instagram product App ID for Instagram Login).",
        },
        { status: 400 }
      );
    }

    await supabase.from("project_social_apps").upsert(
      {
        project_id: projectId,
        user_id: user.id,
        platform: platformRaw,
        client_id: clientId,
        client_secret_ciphertext: encryptSecret(clientSecret),
        redirect_uri: redirectUri,
        scopes: PLATFORM_API[platformRaw].oauthScopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,platform" }
    );
  } else if (platformRaw === "youtube") {
    const yt = await getYouTubeAppCredentials();
    if (!yt) {
      return NextResponse.json(
        {
          error:
            "Configure YouTube in Settings → API first. Paste the Google OAuth 2.0 Client ID + Secret (Web application), not an API key.",
        },
        { status: 400 }
      );
    }
    clientId = yt.clientId.trim();
    clientSecret = yt.clientSecret.trim();

    if (!looksLikeGoogleOAuthClientId(clientId)) {
      return NextResponse.json(
        {
          error:
            "YouTube Client ID looks invalid. Use the OAuth 2.0 Client ID ending in .apps.googleusercontent.com.",
        },
        { status: 400 }
      );
    }

    await supabase.from("project_social_apps").upsert(
      {
        project_id: projectId,
        user_id: user.id,
        platform: "youtube",
        client_id: clientId,
        client_secret_ciphertext: encryptSecret(clientSecret),
        redirect_uri: redirectUri,
        scopes: PLATFORM_API.youtube.oauthScopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,platform" }
    );
  } else {
    const { data: app, error } = await supabase
      .from("project_social_apps")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("platform", platformRaw)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!app) {
      return NextResponse.json(
        {
          error:
            "Configure the API app credentials first (Client ID + Secret).",
        },
        { status: 400 }
      );
    }
    const row = app as SocialAppRow;
    clientId = row.client_id;
    clientSecret = decryptSecret(row.client_secret_ciphertext);
  }

  const state = buildOAuthState({
    projectId,
    userId: user.id,
    platform: platformRaw,
    nonce: newNonce(),
  });

  const url = buildAuthorizeUrl({
    platform: platformRaw,
    clientId,
    redirectUri,
    state,
    scopes: PLATFORM_API[platformRaw].oauthScopes,
  });

  return NextResponse.redirect(url);
}
