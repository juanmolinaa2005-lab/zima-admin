import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchChatMessageHistory,
  fetchChatUsageStats,
} from "@/lib/supabase/chat-usage";
import { getCurrentUserSupabaseAccessToken } from "@/lib/supabase/user-token";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const accessToken = await getCurrentUserSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message:
          "Conecta tu cuenta de Supabase para leer mensajes de la app.",
      },
      { status: 403 }
    );
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, supabase_project_ref, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (!project.supabase_project_ref) {
    return NextResponse.json(
      {
        error: "NOT_LINKED",
        message:
          "Vincula un proyecto Supabase en Clientes para calcular costo por mensaje.",
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(31, Math.max(1, Number(searchParams.get("days") || 7)));
  const withMessages = searchParams.get("messages") !== "0";

  const ending = new Date();
  ending.setUTCHours(23, 59, 59, 999);
  const starting = new Date(ending.getTime() - days * 24 * 60 * 60 * 1000);
  starting.setUTCHours(0, 0, 0, 0);

  try {
    const range = {
      startingAt: starting.toISOString(),
      endingAt: ending.toISOString(),
    };
    const [stats, messages] = await Promise.all([
      fetchChatUsageStats(accessToken, project.supabase_project_ref, range),
      withMessages
        ? fetchChatMessageHistory(accessToken, project.supabase_project_ref, {
            ...range,
            limit: 300,
          })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({
      stats,
      messages,
      supabase_project_ref: project.supabase_project_ref,
      startingAt: range.startingAt,
      endingAt: range.endingAt,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudieron cargar mensajes de la app";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
