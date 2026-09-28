import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractHiggsfieldImageUrl,
  extractHiggsfieldVideoUrl,
  cancelHiggsfieldJob,
  getHiggsfieldJobStatus,
} from "@/lib/higgsfield/client";
import { getHiggsfieldCredentials } from "@/lib/higgsfield/user-key";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const creds = await getHiggsfieldCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "NOT_CONNECTED", message: "Conecta Higgsfield primero." },
      { status: 403 }
    );
  }

  try {
    const status = await getHiggsfieldJobStatus(creds, id);
    const videoUrl =
      typeof status.video === "string"
        ? status.video
        : status.video?.url || extractHiggsfieldVideoUrl(status) || null;
    const imageUrl = extractHiggsfieldImageUrl(status);
    return NextResponse.json({
      status,
      videoUrl,
      imageUrl,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo consultar el estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const creds = await getHiggsfieldCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "NOT_CONNECTED", message: "Conecta Higgsfield primero." },
      { status: 403 }
    );
  }

  try {
    await cancelHiggsfieldJob(creds, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo cancelar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
