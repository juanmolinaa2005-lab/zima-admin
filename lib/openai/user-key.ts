import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getOpenAIAdminKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("openai_admin_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.openai_admin_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveOpenAIAdminKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ciphertext = encryptSecret(plainKey.trim());
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      openai_admin_key_ciphertext: ciphertext,
      openai_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearOpenAIAdminKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      openai_admin_key_ciphertext: null,
      openai_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getOpenAIConnectionStatus(): Promise<{
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
    .select("openai_admin_key_ciphertext, openai_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.openai_admin_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  let keyHint: string | null = null;
  try {
    const key = decryptSecret(cipher);
    keyHint = `${key.slice(0, 12)}…${key.slice(-4)}`;
  } catch {
    keyHint = "sk-admin…";
  }

  return {
    connected: true,
    connectedAt: (data?.openai_connected_at as string | null) ?? null,
    keyHint,
  };
}

export async function getOpenAIApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("openai_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.openai_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveOpenAIApiKey(plainKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ciphertext = encryptSecret(plainKey.trim());
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      openai_api_key_ciphertext: ciphertext,
      openai_api_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearOpenAIApiKey(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      openai_api_key_ciphertext: null,
      openai_api_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getOpenAIApiConnectionStatus(): Promise<{
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
    .select("openai_api_key_ciphertext, openai_api_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.openai_api_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  let keyHint: string | null = null;
  try {
    const key = decryptSecret(cipher);
    keyHint = `${key.slice(0, 7)}…${key.slice(-4)}`;
  } catch {
    keyHint = "sk-…";
  }

  return {
    connected: true,
    connectedAt: (data?.openai_api_connected_at as string | null) ?? null,
    keyHint,
  };
}
