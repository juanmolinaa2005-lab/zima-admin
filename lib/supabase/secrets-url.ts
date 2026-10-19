/** Supabase dashboard page where provider keys are stored (Edge Functions → Secrets). */
export function supabaseSecretsUrl(): string {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0];
    return ref ? `https://supabase.com/dashboard/project/${ref}/functions/secrets` : "https://supabase.com/dashboard";
  } catch {
    return "https://supabase.com/dashboard";
  }
}
