import { createHash, createPublicKey, verify } from "crypto";

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
let jwksCache: { keys: { x?: string }[]; at: number } | null = null;

function publicWebhookBase(): string {
  const explicit = (process.env.AUTOPILOT_WEBHOOK_BASE || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

function isLocalHost(base: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base);
}

/**
 * Public callback fal can reach. Never embeds CRON_SECRET / MAIL_ENCRYPTION_KEY.
 * Never uses NEXT_PUBLIC_APP_URL (local .env often points at production).
 * Local/dev only if AUTOPILOT_WEBHOOK_BASE is set to a tunnel that serves this app.
 */
export function falAutopilotWebhookUrl(): string | null {
  const explicit = (process.env.AUTOPILOT_WEBHOOK_BASE || "").trim().replace(/\/$/, "");
  const dev =
    process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
  if (dev && !explicit) return null;
  const base = publicWebhookBase();
  if (!base || isLocalHost(base)) return null;
  return `${base}/api/webhooks/fal-autopilot`;
}

export function falWebhookHasSignatureHeaders(request: Request): boolean {
  return Boolean(
    request.headers.get("x-fal-webhook-request-id") &&
      request.headers.get("x-fal-webhook-user-id") &&
      request.headers.get("x-fal-webhook-timestamp") &&
      request.headers.get("x-fal-webhook-signature")
  );
}

export type FalWebhookBody = {
  request_id?: string;
  gateway_request_id?: string;
  status?: string;
  error?: string;
  payload?: Record<string, unknown>;
};

export function parseFalWebhookBody(raw: unknown): FalWebhookBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as FalWebhookBody;
}

function ed25519Spki(raw: Buffer): Buffer {
  return Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
}

async function jwksKeys(): Promise<Buffer[]> {
  const now = Date.now();
  if (!jwksCache || now - jwksCache.at > 12 * 60 * 60 * 1000) {
    const res = await fetch(JWKS_URL, { cache: "no-store" });
    if (!res.ok) {
      const cached: Buffer[] = [];
      for (const k of jwksCache?.keys || []) {
        if (typeof k.x !== "string") continue;
        try {
          const buf = Buffer.from(k.x, "base64url");
          if (buf.length === 32) cached.push(buf);
        } catch {
          /* skip */
        }
      }
      return cached;
    }
    const data = (await res.json()) as { keys?: { x?: string }[] };
    jwksCache = { keys: data.keys ?? [], at: now };
  }
  const out: Buffer[] = [];
  for (const k of jwksCache.keys || []) {
    if (typeof k.x !== "string") continue;
    try {
      const buf = Buffer.from(k.x, "base64url");
      if (buf.length === 32) out.push(buf);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function verifyFalWebhookSignature(
  request: Request,
  rawBody: Buffer
): Promise<boolean> {
  const requestId = request.headers.get("x-fal-webhook-request-id") || "";
  const userId = request.headers.get("x-fal-webhook-user-id") || "";
  const timestamp = request.headers.get("x-fal-webhook-timestamp") || "";
  const signatureHex = request.headers.get("x-fal-webhook-signature") || "";
  if (!requestId || !userId || !timestamp || !signatureHex) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const message = Buffer.from(
    [requestId, userId, timestamp, createHash("sha256").update(rawBody).digest("hex")].join("\n"),
    "utf8"
  );
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }
  const keys = await jwksKeys();
  for (const raw of keys) {
    try {
      const key = createPublicKey({
        key: ed25519Spki(raw),
        format: "der",
        type: "spki",
      });
      if (verify(null, message, key, signature)) return true;
    } catch {
      /* try next key */
    }
  }
  return false;
}
