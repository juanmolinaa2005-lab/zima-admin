/**
 * Message / Claude-request stats from a linked app Supabase project (e.g. Moun).
 * Prefers `user_daily_usage` (1 row per API turn); falls back to counting
 * user messages in `chat_sessions.messages`.
 */

import { fingerprint } from "@/lib/hash";

const MANAGEMENT_API = "https://api.supabase.com/v1";

type Timed<T> = { value: T; expiresAt: number };

const serviceKeyCache = new Map<string, Timed<string>>();
const SERVICE_KEY_TTL_MS = 60 * 60 * 1000;

export type ChatUsageDay = {
  date: string;
  requests: number;
  /** Output tokens tracked by the app (user_daily_usage), when available. */
  outputTokens: number;
};

export type ChatUsageStats = {
  source: "user_daily_usage" | "chat_sessions" | null;
  totalRequests: number;
  byDay: ChatUsageDay[];
  note: string | null;
};

function cacheScope(accessToken: string) {
  return fingerprint(accessToken.trim());
}

function getFresh<T>(entry: Timed<T> | null | undefined): T | null {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value;
}

async function getServiceRoleKey(
  accessToken: string,
  projectRef: string
): Promise<string> {
  const token = accessToken.trim();
  const key = `${cacheScope(token)}:${projectRef}`;
  const cached = getFresh(serviceKeyCache.get(key));
  if (cached) return cached;

  const res = await fetch(`${MANAGEMENT_API}/projects/${projectRef}/api-keys`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron obtener API keys: ${text}`);
  }

  const keys = (await res.json()) as Array<{ name: string; api_key: string }>;
  const service = keys.find((k) => k.name === "service_role");
  if (!service?.api_key) {
    throw new Error("No se encontró service_role para ese proyecto.");
  }

  serviceKeyCache.set(key, {
    value: service.api_key,
    expiresAt: Date.now() + SERVICE_KEY_TTL_MS,
  });

  return service.api_key;
}

function restHeaders(serviceKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    Accept: "application/json",
    Prefer: "count=exact",
  };
}

function toDateKey(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  try {
    return new Date(isoOrDate).toISOString().slice(0, 10);
  } catch {
    return isoOrDate.slice(0, 10);
  }
}

function emptyRange(startingDate: string, endingDate: string): ChatUsageDay[] {
  const out: ChatUsageDay[] = [];
  const cur = new Date(startingDate + "T12:00:00Z");
  const end = new Date(endingDate + "T12:00:00Z");
  while (cur <= end) {
    out.push({
      date: cur.toISOString().slice(0, 10),
      requests: 0,
      outputTokens: 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function mergeByDay(
  days: ChatUsageDay[],
  startingDate: string,
  endingDate: string
): { byDay: ChatUsageDay[]; total: number } {
  const map = new Map(
    emptyRange(startingDate, endingDate).map((d) => [
      d.date,
      { requests: 0, outputTokens: 0 },
    ])
  );
  for (const d of days) {
    const key = toDateKey(d.date);
    const cur = map.get(key);
    if (!cur) continue;
    cur.requests += d.requests;
    cur.outputTokens += d.outputTokens || 0;
  }
  const byDay = [...map.entries()].map(([date, v]) => ({
    date,
    requests: v.requests,
    outputTokens: v.outputTokens,
  }));
  const total = byDay.reduce((s, d) => s + d.requests, 0);
  return { byDay, total };
}

async function fetchAllPages<T>(
  baseUrl: string,
  serviceKey: string,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const res = await fetch(baseUrl, {
      headers: {
        ...restHeaders(serviceKey),
        Range: `${from}-${from + pageSize - 1}`,
      },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 406) return all;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase REST ${res.status}: ${text.slice(0, 200)}`);
    }
    const chunk = (await res.json()) as T[];
    if (!Array.isArray(chunk)) return all;
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 50_000) break;
  }
  return all;
}

async function fromDailyUsage(
  projectRef: string,
  serviceKey: string,
  startingDate: string,
  endingDate: string
): Promise<ChatUsageStats | null> {
  const url =
    `https://${projectRef}.supabase.co/rest/v1/user_daily_usage` +
    `?select=date,requests_count,output_tokens` +
    `&date=gte.${startingDate}&date=lte.${endingDate}` +
    `&order=date.asc`;

  let rows: Array<{
    date: string;
    requests_count: number | null;
    output_tokens: number | null;
  }>;
  try {
    const probe = await fetch(`${url}&limit=1`, {
      headers: restHeaders(serviceKey),
      cache: "no-store",
    });
    if (probe.status === 404 || probe.status === 406) return null;
    if (!probe.ok) {
      const text = await probe.text();
      if (
        probe.status === 400 ||
        probe.status === 403 ||
        /relation|does not exist|PGRST|column/i.test(text)
      ) {
        return null;
      }
      throw new Error(`user_daily_usage: ${text.slice(0, 200)}`);
    }
    rows = await fetchAllPages(url, serviceKey, 1000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/404|406|does not exist|PGRST|column/i.test(msg)) return null;
    throw e;
  }

  const raw = rows.map((r) => ({
    date: toDateKey(String(r.date)),
    requests: Number(r.requests_count) || 0,
    outputTokens: Number(r.output_tokens) || 0,
  }));
  const { byDay, total } = mergeByDay(raw, startingDate, endingDate);

  return {
    source: "user_daily_usage",
    totalRequests: total,
    byDay,
    note: "Peticiones a Claude registradas por la app (user_daily_usage).",
  };
}

async function fromChatSessions(
  projectRef: string,
  serviceKey: string,
  startingDate: string,
  endingDate: string,
  startingAt: string,
  endingAt: string
): Promise<ChatUsageStats | null> {
  const url =
    `https://${projectRef}.supabase.co/rest/v1/chat_sessions` +
    `?select=messages,updated_at` +
    `&updated_at=gte.${encodeURIComponent(startingAt)}` +
    `&order=updated_at.asc`;

  let rows: Array<{ messages: unknown; updated_at: string }>;
  try {
    rows = await fetchAllPages(url, serviceKey, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/404|406|does not exist|PGRST/i.test(msg)) return null;
    throw e;
  }

  if (rows.length === 0) {
    // Table may exist but empty, or filter excluded all — still valid if table exists
    const probe = await fetch(
      `https://${projectRef}.supabase.co/rest/v1/chat_sessions?select=id&limit=1`,
      { headers: restHeaders(serviceKey), cache: "no-store" }
    );
    if (!probe.ok) return null;
  }

  const startMs = new Date(startingAt).getTime();
  const endMs = new Date(endingAt).getTime();
  const dayMap = new Map<string, number>();

  for (const row of rows) {
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    let countedInSession = 0;
    for (const raw of msgs) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Record<string, unknown>;
      const role = String(m.role ?? "").toLowerCase();
      if (role !== "user" && role !== "human") continue;

      const tsRaw =
        typeof m.timestamp === "string"
          ? m.timestamp
          : typeof m.created_at === "string"
            ? m.created_at
            : null;
      let t = tsRaw ? new Date(tsRaw).getTime() : NaN;
      if (!Number.isFinite(t)) {
        // Mensajes sin timestamp: atribuir a updated_at de la sesión (aproximado)
        t = new Date(row.updated_at).getTime();
      }
      if (t < startMs || t > endMs) continue;

      const day = new Date(t).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      countedInSession += 1;
    }
    void countedInSession;
  }

  const raw = [...dayMap.entries()].map(([date, requests]) => ({
    date,
    requests,
    outputTokens: 0,
  }));
  const { byDay, total } = mergeByDay(raw, startingDate, endingDate);

  return {
    source: "chat_sessions",
    totalRequests: total,
    byDay,
    note: "Conteo de mensajes de usuario en chat_sessions (fallback; menos preciso que user_daily_usage).",
  };
}

export async function fetchChatUsageStats(
  accessToken: string,
  projectRef: string,
  opts: { startingAt: string; endingAt: string }
): Promise<ChatUsageStats> {
  const serviceKey = await getServiceRoleKey(accessToken, projectRef);
  const startingDate = toDateKey(opts.startingAt);
  const endingDate = toDateKey(opts.endingAt);

  const primary = await fromDailyUsage(
    projectRef,
    serviceKey,
    startingDate,
    endingDate
  );
  if (primary) return primary;

  const fallback = await fromChatSessions(
    projectRef,
    serviceKey,
    startingDate,
    endingDate,
    opts.startingAt,
    opts.endingAt
  );
  if (fallback) return fallback;

  return {
    source: null,
    totalRequests: 0,
    byDay: emptyRange(startingDate, endingDate),
    note: "No se encontró user_daily_usage ni chat_sessions en el proyecto Supabase vinculado.",
  };
}

export type ChatMessageUsageItem = {
  id: string;
  sessionId: string;
  date: string;
  timestamp: string;
  preview: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  /** true = tokens reales de Anthropic guardados en el mensaje */
  measured: boolean;
  userPreview: string | null;
};

function contentToPreview(content: unknown, max = 80): string {
  let text = "";
  if (typeof content === "string") text = content;
  else if (content != null) {
    try {
      text = JSON.stringify(content);
    } catch {
      text = String(content);
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "(sin texto)";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function estimateTokensFromText(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // ~4 chars/token approx for mixed ES/EN
  return Math.max(1, Math.ceil(t.length / 4));
}

/**
 * Lista turnos assistant en el periodo (uno ≈ un mensaje de la app).
 * Si el mensaje trae `usage` (Moun nuevo), usa tokens reales; si no, estima por longitud.
 */
export async function fetchChatMessageHistory(
  accessToken: string,
  projectRef: string,
  opts: { startingAt: string; endingAt: string; limit?: number }
): Promise<ChatMessageUsageItem[]> {
  const serviceKey = await getServiceRoleKey(accessToken, projectRef);
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  const startMs = new Date(opts.startingAt).getTime();
  const endMs = new Date(opts.endingAt).getTime();

  const url =
    `https://${projectRef}.supabase.co/rest/v1/chat_sessions` +
    `?select=id,messages,updated_at,user_id` +
    `&updated_at=gte.${encodeURIComponent(opts.startingAt)}` +
    `&order=updated_at.desc`;

  let rows: Array<{
    id: string;
    messages: unknown;
    updated_at: string;
    user_id?: string;
  }>;
  try {
    rows = await fetchAllPages(url, serviceKey, 100);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/404|406|does not exist|PGRST/i.test(msg)) return [];
    throw e;
  }

  const items: ChatMessageUsageItem[] = [];

  for (const row of rows) {
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    for (let i = 0; i < msgs.length; i++) {
      const raw = msgs[i];
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Record<string, unknown>;
      const role = String(m.role ?? "").toLowerCase();
      if (role !== "assistant" && role !== "model" && role !== "bot") continue;

      const tsRaw =
        typeof m.timestamp === "string"
          ? m.timestamp
          : typeof m.created_at === "string"
            ? m.created_at
            : row.updated_at;
      const t = new Date(tsRaw).getTime();
      if (!Number.isFinite(t) || t < startMs || t > endMs) continue;

      const contentStr =
        typeof m.content === "string"
          ? m.content
          : contentToPreview(m.content, 2000);
      const usage =
        m.usage && typeof m.usage === "object"
          ? (m.usage as Record<string, unknown>)
          : null;

      const measured = Boolean(
        usage &&
          (Number(usage.input_tokens) > 0 || Number(usage.output_tokens) > 0)
      );

      let inputTokens = 0;
      let outputTokens = 0;
      let cacheRead = 0;
      let cacheWrite = 0;
      let model: string | null = null;

      if (measured && usage) {
        inputTokens = Number(usage.input_tokens) || 0;
        outputTokens = Number(usage.output_tokens) || 0;
        cacheRead = Number(usage.cache_read_input_tokens) || 0;
        cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
        model = typeof usage.model === "string" ? usage.model : null;
      } else {
        // Estimación para mensajes viejos sin usage guardado
        const prev = i > 0 && msgs[i - 1] && typeof msgs[i - 1] === "object"
          ? (msgs[i - 1] as Record<string, unknown>)
          : null;
        const userText =
          prev &&
          ["user", "human"].includes(String(prev.role ?? "").toLowerCase())
            ? typeof prev.content === "string"
              ? prev.content
              : contentToPreview(prev.content, 2000)
            : "";
        outputTokens = estimateTokensFromText(contentStr);
        inputTokens = estimateTokensFromText(userText) + 800; // prompt/sistema aprox.
        model = null;
      }

      const prevUser =
        i > 0 && msgs[i - 1] && typeof msgs[i - 1] === "object"
          ? (msgs[i - 1] as Record<string, unknown>)
          : null;
      const userPreview =
        prevUser &&
        ["user", "human"].includes(String(prevUser.role ?? "").toLowerCase())
          ? contentToPreview(prevUser.content, 60)
          : null;

      items.push({
        id:
          typeof m.id === "string"
            ? m.id
            : `${row.id}-${i}-${t}`,
        sessionId: row.id,
        date: new Date(t).toISOString().slice(0, 10),
        timestamp: new Date(t).toISOString(),
        preview: contentToPreview(contentStr, 90),
        model,
        inputTokens,
        outputTokens,
        cacheRead,
        cacheWrite,
        measured,
        userPreview,
      });
    }
  }

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items.slice(0, limit);
}

