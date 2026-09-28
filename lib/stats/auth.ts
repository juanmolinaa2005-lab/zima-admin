import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireStatsUser(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw Object.assign(new Error("No autenticado"), { status: 401 });
  }
  return { supabase, user };
}

export async function requireProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) {
    throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  }
}

export function jsonError(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : fallback;
  const status =
    e && typeof e === "object" && "status" in e && typeof e.status === "number"
      ? e.status
      : 400;
  return { message, status };
}
