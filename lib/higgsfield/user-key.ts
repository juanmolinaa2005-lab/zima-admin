import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** Stored format: `keyId:keySecret` encrypted as one blob. */
export async function getHiggsfieldCredentials(): Promise<{
  keyId: string;
  keySecret: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("higgsfield_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.higgsfield_key_ciphertext as string | null | undefined;
  if (!cipher) return null;

  const plain = decryptSecret(cipher);
  const idx = plain.indexOf(":");
  if (idx <= 0) return null;
  return {
    keyId: plain.slice(0, idx),
    keySecret: plain.slice(idx + 1),
  };
}

export async function saveHiggsfieldCredentials(
  keyId: string,
  keySecret: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const combined = `${keyId.trim()}:${keySecret.trim()}`;
  const ciphertext = encryptSecret(combined);
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      higgsfield_key_ciphertext: ciphertext,
      higgsfield_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearHiggsfieldCredentials(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      higgsfield_key_ciphertext: null,
      higgsfield_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getHiggsfieldConnectionStatus(): Promise<{
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
    .select("higgsfield_key_ciphertext, higgsfield_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.higgsfield_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  let keyHint: string | null = null;
  try {
    const plain = decryptSecret(cipher);
    const keyId = plain.split(":")[0] ?? "";
    keyHint = keyId
      ? `${keyId.slice(0, 8)}…${keyId.slice(-4)}`
      : "higgsfield…";
  } catch {
    keyHint = "higgsfield…";
  }

  return {
    connected: true,
    connectedAt: (data?.higgsfield_connected_at as string | null) ?? null,
    keyHint,
  };
}
