import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getAyrshareApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("ayrshare_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.ayrshare_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function getAyrshareCredentials(): Promise<{
  apiKey: string | null;
  privateKey: string | null;
  domain: string | null;
  connectedAt: string | null;
  keyHint: string | null;
  hasPrivateKey: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      apiKey: null,
      privateKey: null,
      domain: null,
      connectedAt: null,
      keyHint: null,
      hasPrivateKey: false,
    };
  }

  const { data } = await supabase
    .from("user_settings")
    .select(
      "ayrshare_api_key_ciphertext, ayrshare_private_key_ciphertext, ayrshare_domain, ayrshare_connected_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const apiCipher = data?.ayrshare_api_key_ciphertext as string | null | undefined;
  const privCipher = data?.ayrshare_private_key_ciphertext as
    | string
    | null
    | undefined;

  let apiKey: string | null = null;
  let keyHint: string | null = null;
  if (apiCipher) {
    apiKey = decryptSecret(apiCipher);
    keyHint = apiKey.length > 8 ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : "••••";
  }

  return {
    apiKey,
    privateKey: privCipher ? decryptSecret(privCipher) : null,
    domain: (data?.ayrshare_domain as string | null) || null,
    connectedAt: (data?.ayrshare_connected_at as string | null) || null,
    keyHint,
    hasPrivateKey: Boolean(privCipher),
  };
}

export async function saveAyrshareSettings(input: {
  apiKey?: string;
  privateKey?: string;
  domain?: string;
  clearPrivateKey?: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const patch: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (input.apiKey?.trim()) {
    patch.ayrshare_api_key_ciphertext = encryptSecret(input.apiKey.trim());
    patch.ayrshare_connected_at = new Date().toISOString();
  }
  if (input.privateKey?.trim()) {
    patch.ayrshare_private_key_ciphertext = encryptSecret(
      input.privateKey.trim()
    );
  }
  if (input.clearPrivateKey) {
    patch.ayrshare_private_key_ciphertext = null;
  }
  if (input.domain !== undefined) {
    patch.ayrshare_domain = input.domain.trim() || null;
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(patch, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function clearAyrshareSettings(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      ayrshare_api_key_ciphertext: null,
      ayrshare_private_key_ciphertext: null,
      ayrshare_domain: null,
      ayrshare_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
