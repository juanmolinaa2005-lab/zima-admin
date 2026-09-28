const KLING_API = "https://api-singapore.klingai.com";
const MOTION_PATH = "/v1/videos/motion-control";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isServiceRole(req: Request) {
  const token = (req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const payload = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwt(accessKey: string, secretKey: string) {
  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: accessKey,
        exp: now + 1800,
        nbf: now - 5,
      })
    )
  );
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
  );
  return `${data}.${bytesToBase64Url(sig)}`;
}

async function authorizationHeader(raw: string) {
  const key = raw.trim();
  const splitAt = key.includes(":") ? key.indexOf(":") : key.includes("|") ? key.indexOf("|") : -1;
  if (splitAt > 0) {
    const accessKey = key.slice(0, splitAt).trim();
    const secretKey = key.slice(splitAt + 1).trim();
    if (accessKey && secretKey && !accessKey.startsWith("http")) {
      return `Bearer ${await signJwt(accessKey, secretKey)}`;
    }
  }
  return `Bearer ${key}`;
}

async function kling(path: string, body?: unknown) {
  const apiKey = Deno.env.get("KLING_API_KEY")?.trim();
  if (!apiKey) return json({ code: 1, message: "Falta KLING_API_KEY" }, 500);
  const res = await fetch(`${KLING_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: await authorizationHeader(apiKey),
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ message: `Kling respondió ${res.status}` }));
  return json(data, res.status);
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return json({ message: "No autorizado" }, 401);
  const url = new URL(req.url);
  if (req.method === "GET") {
    const taskId = url.searchParams.get("taskId")?.trim() || "";
    if (!taskId) return json({ message: "Falta la tarea" }, 400);
    return kling(`${MOTION_PATH}/${encodeURIComponent(taskId)}`);
  }
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ message: "Cuerpo inválido" }, 400);
    return kling(MOTION_PATH, body);
  }
  return json({ message: "Método no permitido" }, 405);
});
