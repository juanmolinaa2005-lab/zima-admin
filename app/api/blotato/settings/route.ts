import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blotatoValidateKey } from "@/lib/blotato/client";
import {
  clearBlotatoApiKey,
  getBlotatoConnectionStatus,
  saveBlotatoApiKey,
} from "@/lib/blotato/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const status = await getBlotatoConnectionStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }

  try {
    await blotatoValidateKey(apiKey);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not validate Blotato API key",
      },
      { status: 400 }
    );
  }

  try {
    await saveBlotatoApiKey(apiKey);
    const status = await getBlotatoConnectionStatus();
    return NextResponse.json({ ok: true, ...status });
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
    await clearBlotatoApiKey();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not disconnect" },
      { status: 500 }
    );
  }
}
