import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getFalApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("fal_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.fal_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveFalApiKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      fal_api_key_ciphertext: encryptSecret(plainKey.trim()),
      fal_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearFalApiKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      fal_api_key_ciphertext: null,
      fal_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getFalConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false, connectedAt: null, keyHint: null };

  const { data } = await supabase
    .from("user_settings")
    .select("fal_api_key_ciphertext, fal_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.fal_api_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  try {
    const key = decryptSecret(cipher);
    const keyHint =
      key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "fal…";
    return {
      connected: true,
      connectedAt: (data?.fal_connected_at as string | null) ?? null,
      keyHint,
    };
  } catch {
    return { connected: false, connectedAt: null, keyHint: null };
  }
}
