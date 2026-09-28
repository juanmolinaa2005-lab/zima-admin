import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOpenAIAdminKey } from "@/lib/openai/admin";
import {
  clearOpenAIAdminKey,
  getOpenAIConnectionStatus,
  saveOpenAIAdminKey,
} from "@/lib/openai/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const status = await getOpenAIConnectionStatus();
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
  if (!apiKey.startsWith("sk-admin")) {
    return NextResponse.json(
      {
        error:
          "Usa una Admin API key de OpenAI (sk-admin…). Créala en Organization → Admin keys.",
      },
      { status: 400 }
    );
  }

  try {
    await verifyOpenAIAdminKey(apiKey);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo validar la Admin API key";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await saveOpenAIAdminKey(apiKey);
    const status = await getOpenAIConnectionStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo guardar";
    return NextResponse.json({ error: message }, { status: 500 });
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
    await clearOpenAIAdminKey();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
