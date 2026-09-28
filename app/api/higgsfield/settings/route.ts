import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyHiggsfieldCredentials } from "@/lib/higgsfield/client";
import {
  clearHiggsfieldCredentials,
  getHiggsfieldConnectionStatus,
  saveHiggsfieldCredentials,
} from "@/lib/higgsfield/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const status = await getHiggsfieldConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { keyId?: string; keySecret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const keyId = body.keyId?.trim() ?? "";
  const keySecret = body.keySecret?.trim() ?? "";
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Key ID y Key Secret son obligatorios" },
      { status: 400 }
    );
  }

  try {
    await verifyHiggsfieldCredentials({ keyId, keySecret });
    await saveHiggsfieldCredentials(keyId, keySecret);
    const status = await getHiggsfieldConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo guardar la conexión";
    return NextResponse.json({ error: message }, { status: 400 });
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
    await clearHiggsfieldCredentials();
    return NextResponse.json({
      connected: false,
      connectedAt: null,
      keyHint: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
