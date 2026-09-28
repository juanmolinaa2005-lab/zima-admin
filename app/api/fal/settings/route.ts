import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFalApiKey } from "@/lib/fal/client";
import {
  clearFalApiKey,
  getFalConnectionStatus,
  saveFalApiKey,
} from "@/lib/fal/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const status = await getFalConnectionStatus();
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
    await verifyFalApiKey(apiKey);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "No se pudo validar la API key de fal.ai",
      },
      { status: 400 }
    );
  }

  try {
    await saveFalApiKey(apiKey);
    const status = await getFalConnectionStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo guardar" },
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
    await clearFalApiKey();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo desconectar" },
      { status: 500 }
    );
  }
}
