/** Validate the actual server key; a caller-controlled JWT role is not proof of authorization. */
export function isServiceRole(req: Request, expected: string): boolean {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

/** Supabase can issue multiple valid service JWTs; verify alternate keys against PostgREST. */
export async function authorizeServiceRole(req: Request, expected: string, projectUrl: string, anonKey: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (isServiceRole(req, expected)) return true;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  try {
    const payload = token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (claims.role !== "service_role" || !projectUrl || !anonKey) return false;
    // Role claims alone grant nothing. PostgREST verifies the signature; only service_role
    // has SELECT on this table, and limit=0 retrieves no catalog data.
    const response = await fetcher(`${projectUrl.replace(/\/$/, "")}/rest/v1/market_ad_catalog?select=id&limit=0`, {
      method: "HEAD", headers: { Authorization: `Bearer ${token}`, apikey: anonKey }, signal: AbortSignal.timeout(5000),
    });
    return response.status === 200;
  } catch { return false; }
}
