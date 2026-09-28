import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getAnthropicAdminKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("anthropic_admin_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.anthropic_admin_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveAnthropicAdminKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ciphertext = encryptSecret(plainKey.trim());
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      anthropic_admin_key_ciphertext: ciphertext,
      anthropic_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearAnthropicAdminKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      anthropic_admin_key_ciphertext: null,
      anthropic_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getAnthropicConnectionStatus(): Promise<{
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
    .select("anthropic_admin_key_ciphertext, anthropic_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.anthropic_admin_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  let keyHint: string | null = null;
  try {
    const key = decryptSecret(cipher);
    keyHint = `${key.slice(0, 14)}…${key.slice(-4)}`;
  } catch {
    keyHint = "sk-ant-admin…";
  }

  return {
    connected: true,
    connectedAt: (data?.anthropic_connected_at as string | null) ?? null,
    keyHint,
  };
}
