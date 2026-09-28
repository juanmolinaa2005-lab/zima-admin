"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listRemoteSupabaseProjects,
  validateSupabaseAccessToken,
} from "@/lib/supabase/management";
import { getCurrentUserSupabaseAccessToken } from "@/lib/supabase/user-token";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, user };
}

export async function getSupabaseConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
}> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_settings")
    .select("supabase_access_token, supabase_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    connected: Boolean(data?.supabase_access_token),
    connectedAt: data?.supabase_connected_at ?? null,
  };
}

export async function getUserSupabaseAccessToken(): Promise<string | null> {
  return getCurrentUserSupabaseAccessToken();
}

export async function connectSupabaseAccount(accessToken: string) {
  const { supabase, user } = await requireUser();
  const token = accessToken.trim();
  if (!token) throw new Error("Pega tu Access Token de Supabase.");

  await validateSupabaseAccessToken(token);

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      supabase_access_token: token,
      supabase_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return { connected: true };
}

export async function disconnectSupabaseAccount() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      supabase_access_token: null,
      supabase_connected_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return { connected: false };
}

export async function fetchRemoteSupabaseProjectsForUser() {
  const token = await getCurrentUserSupabaseAccessToken();
  if (!token) {
    throw new Error("NOT_CONNECTED");
  }
  return listRemoteSupabaseProjects(token);
}
