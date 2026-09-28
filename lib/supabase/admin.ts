import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetch as undiciFetch } from "undici";

const MANAGEMENT_API = "https://api.supabase.com/v1";

let cachedKey: { value: string; expiresAt: number } | null = null;

function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function getAppServiceRoleKey(): Promise<string> {
  const direct = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (direct) return direct;

  if (cachedKey && Date.now() < cachedKey.expiresAt) return cachedKey.value;

  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = projectRefFromUrl(url);
  if (!token || !ref) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ACCESS_TOKEN) para procesar colas en segundo plano."
    );
  }

  const res = await fetch(`${MANAGEMENT_API}/projects/${ref}/api-keys`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener service_role (${res.status})`);
  }
  const keys = (await res.json()) as Array<{ name: string; api_key: string }>;
  const service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!service) {
    throw new Error("No se encontró la service_role key del proyecto.");
  }
  cachedKey = { value: service, expiresAt: Date.now() + 60 * 60 * 1000 };
  return service;
}

export async function createAdminClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  const key = await getAppServiceRoleKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: undiciFetch as unknown as typeof fetch },
  });
}

export async function getServiceRoleAccess(): Promise<{
  url: string;
  serviceKey: string;
  anonKey: string;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan variables de Supabase");
  }
  return {
    url,
    serviceKey: await getAppServiceRoleKey(),
    anonKey,
  };
}
