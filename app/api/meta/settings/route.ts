import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultRedirectUri } from "@/lib/redes/oauth";
import {
  clearMetaAppCredentials,
  getMetaConnectionStatus,
  saveMetaAppCredentials,
  updateMetaAppId,
} from "@/lib/meta/user-key";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const status = await getMetaConnectionStatus();
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    ...status,
    redirectUri: defaultRedirectUri(origin),
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

  let body: { keyId?: string; keySecret?: string; appId?: string; appSecret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const appId = (body.appId || body.keyId || "").trim();
  const appSecret = (body.appSecret || body.keySecret || "").trim();

  if (!appId) {
    return NextResponse.json({ error: "App ID required" }, { status: 400 });
  }

  try {
    if (appSecret) {
      await saveMetaAppCredentials(appId, appSecret);
    } else {
      await updateMetaAppId(appId);
    }
    const status = await getMetaConnectionStatus();
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      ...status,
      redirectUri: defaultRedirectUri(origin),
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
    await clearMetaAppCredentials();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not disconnect" },
      { status: 500 }
    );
  }
}
