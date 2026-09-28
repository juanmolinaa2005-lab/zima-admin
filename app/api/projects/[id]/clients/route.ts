import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAuthUsers } from "@/lib/supabase/management";
import { getCurrentUserSupabaseAccessToken } from "@/lib/supabase/user-token";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";
  const knownFingerprint = searchParams.get("fp");

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
          "Conecta tu cuenta de Supabase para leer clientes de tus proyectos.",
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
        error:
          "Este proyecto no tiene un proyecto Supabase vinculado para Clientes.",
        users: [],
      },
      { status: 400 }
    );
  }

  try {
    const result = await listAuthUsers(
      accessToken,
      project.supabase_project_ref,
      {
        force,
        knownFingerprint,
      }
    );

    if (result.unchanged) {
      return NextResponse.json({
        unchanged: true,
        fingerprint: result.fingerprint,
        supabase_project_ref: project.supabase_project_ref,
        cached: result.cached,
      });
    }

    return NextResponse.json({
      users: result.users,
      fingerprint: result.fingerprint,
      unchanged: false,
      cached: result.cached,
      supabase_project_ref: project.supabase_project_ref,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
