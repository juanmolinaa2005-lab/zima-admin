import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOpenAIApiKey } from "@/lib/openai/images";
import {
  clearOpenAIApiKey,
  getOpenAIApiConnectionStatus,
  saveOpenAIApiKey,
} from "@/lib/openai/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const status = await getOpenAIApiConnectionStatus();
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
  if (!apiKey.startsWith("sk-") || apiKey.startsWith("sk-admin")) {
    return NextResponse.json(
      {
        error:
          "Usa una API key normal de OpenAI (sk- o sk-proj-). La Admin key (sk-admin…) es otra fila.",
      },
      { status: 400 }
    );
  }

  try {
    await verifyOpenAIApiKey(apiKey);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo validar la API key";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await saveOpenAIApiKey(apiKey);
    const status = await getOpenAIApiConnectionStatus();
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
    await clearOpenAIApiKey();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
