import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserSupabaseAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("supabase_access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.supabase_access_token ?? null;
}
