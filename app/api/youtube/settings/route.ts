import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultRedirectUri } from "@/lib/redes/oauth";
import {
  clearYouTubeAppCredentials,
  getYouTubeConnectionStatus,
  looksLikeGoogleOAuthClientId,
  saveYouTubeAppCredentials,
  updateYouTubeClientId,
} from "@/lib/youtube/user-key";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const status = await getYouTubeConnectionStatus();
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    ...status,
    redirectUri: defaultRedirectUri(origin),
    origin: origin.replace(/\/$/, ""),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    keyId?: string;
    keySecret?: string;
    clientId?: string;
    clientSecret?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const clientId = (body.clientId || body.keyId || "").trim();
  const clientSecret = (body.clientSecret || body.keySecret || "").trim();

  if (!clientId) {
    return NextResponse.json({ error: "Client ID required" }, { status: 400 });
  }
  if (!looksLikeGoogleOAuthClientId(clientId)) {
    return NextResponse.json(
      {
        error:
          "Use a Google OAuth 2.0 Client ID (…apps.googleusercontent.com), not a YouTube API key.",
      },
      { status: 400 }
    );
  }

  try {
    if (clientSecret) {
      await saveYouTubeAppCredentials(clientId, clientSecret);
    } else {
      await updateYouTubeClientId(clientId);
    }
    const status = await getYouTubeConnectionStatus();
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      ...status,
      redirectUri: defaultRedirectUri(origin),
      origin: origin.replace(/\/$/, ""),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await clearYouTubeAppCredentials();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not disconnect" },
      { status: 500 }
    );
  }
}
