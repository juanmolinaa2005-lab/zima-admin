import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getBlotatoApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("blotato_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.blotato_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveBlotatoApiKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      blotato_api_key_ciphertext: encryptSecret(plainKey.trim()),
      blotato_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearBlotatoApiKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      blotato_api_key_ciphertext: null,
      blotato_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getBlotatoConnectionStatus(): Promise<{
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
    .select("blotato_api_key_ciphertext, blotato_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.blotato_api_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  try {
    const plain = decryptSecret(cipher);
    const keyHint =
      plain.length > 8 ? `${plain.slice(0, 4)}…${plain.slice(-4)}` : "••••";
    return {
      connected: true,
      connectedAt: (data?.blotato_connected_at as string | null) ?? null,
      keyHint,
    };
  } catch {
    return { connected: false, connectedAt: null, keyHint: null };
  }
}
