import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

/**
 * Re-check the signed-in user's password without mutating the cookie session.
 * Uses a throwaway anon client (no cookies).
 */
export async function verifyLoginPassword(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const trimmed = password.trim();
  if (!trimmed) {
    return { ok: false, message: "Password required." };
  }

  const client = createSupabaseJsClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: trimmed,
  });

  if (error) {
    return {
      ok: false,
      message: "Incorrect login password.",
    };
  }
  return { ok: true };
}
