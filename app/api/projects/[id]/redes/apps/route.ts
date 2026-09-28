import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { requireProjectOwner } from "@/lib/mail/access";
import { PLATFORM_API } from "@/lib/redes/platforms";
import { defaultRedirectUri } from "@/lib/redes/oauth";
import { isSocialPlatform, type SocialPlatform } from "@/lib/redes/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const origin = new URL(request.url).origin;
  const redirectUri = defaultRedirectUri(origin);

  const { data, error } = await supabase
    .from("project_social_apps")
    .select(
      "id, platform, client_id, redirect_uri, scopes, connected_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const configured = new Set(
    ((data ?? []) as { platform: SocialPlatform }[]).map((r) => r.platform)
  );

  return NextResponse.json({
    redirectUri,
    apps: data ?? [],
    platforms: Object.entries(PLATFORM_API).map(([id, meta]) => ({
      id,
      ...meta,
      configured: configured.has(id as SocialPlatform),
    })),
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    platform?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.platform || !isSocialPlatform(body.platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  const clientId = (body.clientId || "").trim();
  const clientSecret = (body.clientSecret || "").trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Client ID is required." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri =
    (body.redirectUri || "").trim() || defaultRedirectUri(origin);
  const scopes = PLATFORM_API[body.platform].oauthScopes;

  const { data: existing } = await supabase
    .from("project_social_apps")
    .select("id, client_secret_ciphertext")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("platform", body.platform)
    .maybeSingle();

  if (!clientSecret && !existing) {
    return NextResponse.json(
      { error: "Client ID and Client Secret are required." },
      { status: 400 }
    );
  }

  const secretCipher = clientSecret
    ? encryptSecret(clientSecret)
    : (existing!.client_secret_ciphertext as string);

  const { data, error } = await supabase
    .from("project_social_apps")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        platform: body.platform,
        client_id: clientId,
        client_secret_ciphertext: secretCipher,
        redirect_uri: redirectUri,
        scopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,platform" }
    )
    .select("id, platform, client_id, redirect_uri, scopes, connected_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ app: data, redirectUri });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const platform = new URL(request.url).searchParams.get("platform");
  if (!platform || !isSocialPlatform(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_social_apps")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
