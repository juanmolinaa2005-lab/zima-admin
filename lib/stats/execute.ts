import { assertPublicHttpsUrl } from "./ssrf";
import { extractPath, reduceNumbers } from "./json-path";
import type { FetchSpec, UnifiedMetric } from "./types";

const MAX_BODY = 1_500_000;

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

function periodVars(days: number): Record<string, string> {
  const ending = new Date();
  const starting = new Date(ending.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    days: String(days),
    startIso: starting.toISOString(),
    endIso: ending.toISOString(),
    startUnix: String(Math.floor(starting.getTime() / 1000)),
    endUnix: String(Math.floor(ending.getTime() / 1000)),
    startDate: starting.toISOString().slice(0, 10),
    endDate: ending.toISOString().slice(0, 10),
  };
}

function applyAuth(
  spec: FetchSpec,
  credentials: Record<string, string>,
  headers: Record<string, string>,
  url: URL
) {
  const auth = spec.auth;
  const value = credentials[auth.credentialId]?.trim() ?? "";
  if (!value) throw new Error("Falta una credencial requerida.");
  if (auth.type === "bearer") {
    headers.Authorization = `${auth.prefix || "Bearer "}${value}`;
  } else if (auth.type === "header") {
    headers[auth.header] = `${auth.prefix || ""}${value}`;
  } else if (auth.type === "query") {
    url.searchParams.set(auth.param, value);
  }
}

export async function executeFetchSpec(
  spec: FetchSpec,
  credentials: Record<string, string>,
  days: number
): Promise<{ metrics: UnifiedMetric[]; raw: Record<string, unknown> }> {
  const vars = { ...periodVars(days), ...credentials };
  const raw: Record<string, unknown> = {};

  for (const endpoint of spec.endpoints.slice(0, 6)) {
    const url = new URL(fill(endpoint.url, vars));
    await assertPublicHttpsUrl(url.toString());
    if (endpoint.query) {
      for (const [k, v] of Object.entries(endpoint.query)) {
        url.searchParams.set(k, fill(v, vars));
      }
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (endpoint.headers) {
      for (const [k, v] of Object.entries(endpoint.headers)) {
        headers[k] = fill(v, vars);
      }
    }
    applyAuth(spec, credentials, headers, url);

    const init: RequestInit = {
      method: endpoint.method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    };
    if (endpoint.method === "POST" && endpoint.body != null) {
      headers["Content-Type"] = "application/json";
      init.body = fill(JSON.stringify(endpoint.body), vars);
    }

    const res = await fetch(url.toString(), init);
    const text = await res.text();
    if (text.length > MAX_BODY) {
      throw new Error("La respuesta de la API es demasiado grande.");
    }
    if (!res.ok) {
      throw new Error(
        `${endpoint.id || url.hostname} respondió ${res.status}: ${text.slice(0, 180)}`
      );
    }
    try {
      raw[endpoint.id] = JSON.parse(text) as unknown;
    } catch {
      raw[endpoint.id] = { text: text.slice(0, 4000) };
    }
  }

  const metrics: UnifiedMetric[] = spec.metrics.slice(0, 16).map((m) => {
    const payload = raw[m.from];
    const values = extractPath(payload, m.path);
    return {
      id: m.id,
      label: m.label,
      value: reduceNumbers(values, m.reduce ?? "sum"),
      kind: m.kind,
      unit: m.unit ?? (m.kind === "count" ? "count" : "usd"),
    };
  });

  return { metrics, raw };
}
