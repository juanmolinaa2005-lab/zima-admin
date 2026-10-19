import { getServiceRoleAccess } from "@/lib/supabase/admin";

/** Provider credentials kept as Supabase secrets (Edge Functions → Secrets). */
export type SharedSecretName =
  | "TIK_TOK_CLIENT_KEY"
  | "TIK_TOK_CLIENT_SECRET"
  | "TIK_TOK_CLIENT_KEY_SANDBOX"
  | "TIK_TOK_CLIENT_SECRET_SANDBOX"
  | "META_APP_ID"
  | "META_APP_SECRET"
  | "YOUTUBE_CLIENT_ID"
  | "YOUTUBE_CLIENT_SECRET"
  | "X_CLIENT_ID"
  | "X_CLIENT_SECRET"
  | "OPENAI_API_KEY"
  | "OPENAI_ADMIN_KEY"
  | "ANTHROPIC_ADMIN_KEY"
  | "FAL_API_KEY"
  | "REPLICATE_API_TOKEN"
  | "BLOTATO_API_KEY"
  | "SUPERWALL_API_KEY"
  | "HIGGSFIELD_KEY_ID"
  | "HIGGSFIELD_KEY_SECRET";

const FOUND_TTL = 10 * 60 * 1000;
const MISSING_TTL = 60 * 1000;
const cache = new Map<SharedSecretName, { value: string | null; expiresAt: number }>();

export async function getSharedSecrets<N extends SharedSecretName>(names: N[]): Promise<Record<N, string | null>> {
  const now = Date.now();
  const result = {} as Record<N, string | null>;
  const missing: N[] = [];
  for (const name of names) {
    const hit = cache.get(name);
    if (hit && hit.expiresAt > now) result[name] = hit.value;
    else missing.push(name);
  }
  if (!missing.length) return result;

  let fetched: Record<string, string | null> = {};
  try {
    const { url, serviceKey, anonKey } = await getServiceRoleAccess();
    const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/app-secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ names: missing }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) fetched = ((await res.json()) as { secrets?: Record<string, string | null> }).secrets ?? {};
  } catch {
    /* fall back to whatever the caller has */
  }

  for (const name of missing) {
    const value = fetched[name]?.trim() || null;
    cache.set(name, { value, expiresAt: now + (value ? FOUND_TTL : MISSING_TTL) });
    result[name] = value;
  }
  return result;
}

export async function getSharedSecret(name: SharedSecretName): Promise<string | null> {
  return (await getSharedSecrets([name]))[name];
}

export async function getSharedPair(idName: SharedSecretName, secretName: SharedSecretName) {
  const s = await getSharedSecrets([idName, secretName]);
  const id = s[idName];
  const secret = s[secretName];
  return id && secret ? { id, secret } : null;
}
