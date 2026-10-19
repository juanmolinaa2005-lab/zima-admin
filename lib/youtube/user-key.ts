import { getSharedPair } from "@/lib/supabase/shared-secrets";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getYouTubeAppCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const shared = await getSharedPair("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET");
  if (shared) return { clientId: shared.id, clientSecret: shared.secret };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("youtube_client_id, youtube_client_secret_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const clientId = (data?.youtube_client_id as string | null | undefined)?.trim();
  const cipher = data?.youtube_client_secret_ciphertext as
    | string
    | null
    | undefined;
  if (!clientId || !cipher) return null;
  return { clientId, clientSecret: decryptSecret(cipher) };
}

export async function saveYouTubeAppCredentials(
  clientId: string,
  clientSecret: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) {
    throw new Error("Client ID and Client Secret are required");
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      youtube_client_id: id,
      youtube_client_secret_ciphertext: encryptSecret(secret),
      youtube_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

/** Update Client ID only, keep existing secret. */
export async function updateYouTubeClientId(clientId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const id = clientId.trim();
  if (!id) throw new Error("Client ID is required");

  const { data: existing } = await supabase
    .from("user_settings")
    .select("youtube_client_secret_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing?.youtube_client_secret_ciphertext) {
    throw new Error("Client Secret is required for first connection");
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      youtube_client_id: id,
      youtube_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function clearYouTubeAppCredentials(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      youtube_client_id: null,
      youtube_client_secret_ciphertext: null,
      youtube_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getYouTubeConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
}> {
  if (await getSharedPair("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")) return { connected: true, connectedAt: null, keyHint: "Supabase" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false, connectedAt: null, keyHint: null };

  const { data } = await supabase
    .from("user_settings")
    .select(
      "youtube_client_id, youtube_client_secret_ciphertext, youtube_connected_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const clientId = (data?.youtube_client_id as string | null | undefined)?.trim();
  const cipher = data?.youtube_client_secret_ciphertext as
    | string
    | null
    | undefined;
  if (!clientId || !cipher) {
    return { connected: false, connectedAt: null, keyHint: null };
  }

  const hint = clientId.includes(".apps.googleusercontent.com")
    ? `${clientId.slice(0, 10)}…apps`
    : clientId.length > 8
      ? `${clientId.slice(0, 6)}…${clientId.slice(-2)}`
      : clientId;

  return {
    connected: true,
    connectedAt: (data?.youtube_connected_at as string | null) ?? null,
    keyHint: hint,
  };
}

export function looksLikeGoogleOAuthClientId(clientId: string): boolean {
  return /\.apps\.googleusercontent\.com$/i.test(clientId.trim());
}
