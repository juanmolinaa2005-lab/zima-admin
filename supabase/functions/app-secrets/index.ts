/**
 * Hands provider credentials stored as Supabase secrets to the Next.js server.
 * Only the service role may call it (the gateway verifies the JWT signature),
 * and only names in ALLOWED are ever returned.
 */
const ALLOWED = new Set([
  "TIK_TOK_CLIENT_KEY",
  "TIK_TOK_CLIENT_SECRET",
  "META_APP_ID",
  "META_APP_SECRET",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "OPENAI_ADMIN_KEY",
  "ANTHROPIC_ADMIN_KEY",
  "FAL_API_KEY",
  "REPLICATE_API_TOKEN",
  "BLOTATO_API_KEY",
  "SUPERWALL_API_KEY",
  "HIGGSFIELD_KEY_ID",
  "HIGGSFIELD_KEY_SECRET",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isServiceRole(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isServiceRole(req)) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as { names?: unknown };
  const names = Array.isArray(body.names) ? body.names.filter((n): n is string => typeof n === "string" && ALLOWED.has(n)) : [];

  const secrets: Record<string, string | null> = {};
  for (const name of names) secrets[name] = Deno.env.get(name)?.trim() || null;
  return json({ secrets });
});
