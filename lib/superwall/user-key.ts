import { getSharedSecret } from "@/lib/supabase/shared-secrets";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function getSuperwallApiKey(): Promise<string | null> {
  const shared = await getSharedSecret("SUPERWALL_API_KEY");
  if (shared) return shared;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("superwall_api_key_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cipher = data?.superwall_api_key_ciphertext as string | null | undefined;
  if (!cipher) return null;
  return decryptSecret(cipher);
}

export async function saveSuperwallConnection(input: {
  apiKey: string;
  orgId: string;
  applicationId: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ciphertext = encryptSecret(input.apiKey.trim());
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      superwall_api_key_ciphertext: ciphertext,
      superwall_org_id: input.orgId,
      superwall_application_id: input.applicationId,
      superwall_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function updateSuperwallApplicationId(
  applicationId: string | null
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      superwall_application_id: applicationId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function clearSuperwallConnection(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_settings")
    .update({
      superwall_api_key_ciphertext: null,
      superwall_org_id: null,
      superwall_application_id: null,
      superwall_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getSuperwallConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
  orgId: string | null;
  applicationId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      connected: false,
      connectedAt: null,
      keyHint: null,
      orgId: null,
      applicationId: null,
    };
  }

  const { data } = await supabase
    .from("user_settings")
    .select(
      "superwall_api_key_ciphertext, superwall_org_id, superwall_application_id, superwall_connected_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const cipher = data?.superwall_api_key_ciphertext as string | null | undefined;
  if (!cipher) {
    return {
      connected: false,
      connectedAt: null,
      keyHint: null,
      orgId: null,
      applicationId: null,
    };
  }

  let keyHint: string | null = null;
  try {
    const key = decryptSecret(cipher);
    keyHint = `${key.slice(0, 8)}…${key.slice(-4)}`;
  } catch {
    keyHint = "sw_…";
  }

  return {
    connected: true,
    connectedAt: (data?.superwall_connected_at as string | null) ?? null,
    keyHint,
    orgId: (data?.superwall_org_id as string | null) ?? null,
    applicationId: (data?.superwall_application_id as string | null) ?? null,
  };
}
