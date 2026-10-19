import { getSharedPair } from "@/lib/supabase/shared-secrets";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getMetaAppCredentials(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const shared = await getSharedPair("META_APP_ID", "META_APP_SECRET");
  if (shared) return { appId: shared.id, appSecret: shared.secret };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("meta_app_id, meta_app_secret_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const appId = (data?.meta_app_id as string | null | undefined)?.trim();
  const cipher = data?.meta_app_secret_ciphertext as string | null | undefined;
  if (!appId || !cipher) return null;
  return { appId, appSecret: decryptSecret(cipher) };
}

export async function saveMetaAppCredentials(
  appId: string,
  appSecret: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const id = appId.trim();
  const secret = appSecret.trim();
  if (!id || !secret) throw new Error("App ID and App Secret are required");

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      meta_app_id: id,
      meta_app_secret_ciphertext: encryptSecret(secret),
      meta_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

/** Update App ID only, keep existing secret. */
export async function updateMetaAppId(appId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const id = appId.trim();
  if (!id) throw new Error("App ID is required");

  const { data: existing } = await supabase
    .from("user_settings")
    .select("meta_app_secret_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing?.meta_app_secret_ciphertext) {
    throw new Error("App Secret is required for first connection");
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      meta_app_id: id,
      meta_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearMetaAppCredentials(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      meta_app_id: null,
      meta_app_secret_ciphertext: null,
      meta_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getMetaConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
}> {
  if (await getSharedPair("META_APP_ID", "META_APP_SECRET")) return { connected: true, connectedAt: null, keyHint: "Supabase" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false, connectedAt: null, keyHint: null };

  const { data } = await supabase
    .from("user_settings")
    .select("meta_app_id, meta_app_secret_ciphertext, meta_connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const appId = (data?.meta_app_id as string | null | undefined)?.trim();
  const cipher = data?.meta_app_secret_ciphertext as string | null | undefined;
  if (!appId || !cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  return {
    connected: true,
    connectedAt: (data?.meta_connected_at as string | null) ?? null,
    keyHint: appId.length > 6 ? `${appId.slice(0, 4)}…${appId.slice(-2)}` : appId,
  };
}
