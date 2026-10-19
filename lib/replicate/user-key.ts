import { getSharedSecret } from "@/lib/supabase/shared-secrets";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getReplicateApiKey(): Promise<string | null> {
  const shared = await getSharedSecret("REPLICATE_API_TOKEN");
  if (shared) return shared;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("replicate_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.replicate_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveReplicateApiKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      replicate_api_key_ciphertext: encryptSecret(plainKey.trim()),
      replicate_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearReplicateApiKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      replicate_api_key_ciphertext: null,
      replicate_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getReplicateConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
}> {
  if (await getSharedSecret("REPLICATE_API_TOKEN")) return { connected: true, connectedAt: null, keyHint: "Supabase" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false, connectedAt: null, keyHint: null };

  const { data } = await supabase
    .from("user_settings")
    .select("replicate_api_key_ciphertext, replicate_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.replicate_api_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  try {
    const key = decryptSecret(cipher);
    const keyHint =
      key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "r8_…";
    return {
      connected: true,
      connectedAt: (data?.replicate_connected_at as string | null) ?? null,
      keyHint,
    };
  } catch {
    return { connected: false, connectedAt: null, keyHint: null };
  }
}
