import { openaiChatJson } from "@/lib/openai/chat";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { assertPublicHttpsUrl } from "./ssrf";
import {
  parseGuide,
  parsePortalUrl,
  parseScopes,
  parseSetupSteps,
  withGuideFallback,
  type ConnectorGuideFields,
} from "./guide";
import type { CredentialField, FetchSpec, GuideScope, StatsKind } from "./types";

export type { ConnectorGuideFields };
export { parseGuide, parseScopes, guideIsThin } from "./guide";

const SYSTEM = `You design a live analytics connector for a SaaS / app platform website.
Return JSON only with this shape:
{
  "name": "string",
  "kind": "revenue" | "cost" | "mixed",
  "summary": "one short Spanish sentence",
  "portalUrl": "https://exact-page-where-the-user-creates-or-copies-the-api-key-or-token",
  "portalLabel": "2-4 Spanish words, e.g. Crear API key",
  "keyType": "exact credential name and prefix if known, e.g. Admin API key · sk-admin",
  "setupSteps": ["Paso concreto", "Paso 2"],
  "scopes": [{"name":"Usage · read","required":true,"note":"Tokens y requests"}],
  "credentials": [{"id":"apiKey","label":"...","type":"secret","hint":"...","required":true}],
  "fetch": {
    "auth": {"type":"bearer"|"header"|"query","credentialId":"apiKey","header?":"x-api-key","param?":"api_key","prefix?":"Bearer "},
    "endpoints": [{"id":"overview","method":"GET"|"POST","url":"https://...","headers?":{},"query?":{"start":"{{startIso}}"},"body?":{}}],
    "metrics": [{"id":"spend","label":"Spend","kind":"revenue"|"cost"|"count","unit":"usd"|"count","from":"overview","path":"$.total","reduce":"sum"|"last"|"first"|"max"}]
  }
}
Rules:
- Prefer official public REST APIs. Use real documented endpoints when you know them.
- Placeholders allowed in urls/query/body: {{startIso}} {{endIso}} {{startUnix}} {{endUnix}} {{startDate}} {{endDate}} {{days}} and credential ids.
- Max 4 endpoints, max 16 metrics. HTTPS only. No localhost.
- kind=revenue for money in (ads, IAP, subs). kind=cost for money out (AI, ads spend, infra). mixed if both.
- Metrics ids for industry rollup when possible: revenue, grossProceeds, netProceeds, refunds, mrr, arr, spend, cost, fixedCosts, variableCosts, marketing, infrastructure, software, paymentFees, newUsers, totalUsers, activeUsers, payingUsers, freeUsers, dau, wau, mau, conversionRate, activationRate, retention, churn, renewalRate, sessionsPerUser, cash, impressions, activeSubscriptions.
- Spanish. Short. No filler words.
- setupSteps: 5 to 8 concrete steps. Exact menu path (Settings → API → Create). Say which key type, prefix if known, what to copy. Last step: pégala abajo.
- scopes MUST answer "which permissions do I enable on the key?". required:true = mark ON. required:false = leave OFF. Include a short note. List every checkbox the dashboard typically shows.
- If the product has no permission UI, still list the access the key needs plus one OFF write/admin scope.
- keyType: the exact name the product uses and the prefix (sk-admin, sk-ant-admin, Bearer, etc.).
- portalUrl MUST be the create/copy-key page, not the marketing homepage.
- credentials.hint should show the prefix or where it lives.`;

const GUIDE_SYSTEM = `You write a key-creation guide for a SaaS API.
Return JSON only:
{
  "portalUrl": "https://exact-page-to-create-the-key",
  "portalLabel": "2-4 Spanish words",
  "keyType": "exact key name and prefix if known",
  "setupSteps": ["Paso concreto"],
  "scopes": [{"name":"...","required":true,"note":"..."}]
}
Rules:
- Spanish. Short. No filler.
- 5-8 setupSteps. Exact menu path. Which key type. Prefix. What to copy. Last: pégala abajo.
- scopes answer "which permissions do I enable?". required true = ON. false = OFF.
- If there are no checkboxes, list the access the key implies and one OFF write scope.
- portalUrl is the create-key page, not marketing home.`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

async function fetchPageText(url: string): Promise<string> {
  const safe = await assertPublicHttpsUrl(url);
  const res = await fetch(safe.toString(), {
    headers: {
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "User-Agent": "ZimaAdmin/1.0 (stats constructor)",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  const text = await res.text();
  if (res.headers.get("content-type")?.includes("json")) {
    return text.slice(0, 12000);
  }
  return stripHtml(text);
}

export type ConstructedSpec = {
  name: string;
  kind: StatsKind;
  summary: string;
  portalUrl: string | null;
  portalLabel: string | null;
  setupSteps: string[];
  scopes: GuideScope[];
  keyType: string | null;
  credentials: CredentialField[];
  fetch: FetchSpec;
};

function isKind(v: unknown): v is StatsKind {
  return v === "revenue" || v === "cost" || v === "mixed";
}

export function parseConstructed(raw: ConstructedSpec): ConstructedSpec {
  if (!raw || typeof raw !== "object") throw new Error("La IA no devolvió un conector válido.");
  if (!raw.name?.trim()) throw new Error("Falta el nombre del servicio.");
  if (!isKind(raw.kind)) throw new Error("Tipo de métrica inválido.");
  if (!raw.fetch?.auth || !Array.isArray(raw.fetch.endpoints) || !Array.isArray(raw.fetch.metrics)) {
    throw new Error("El conector no tiene endpoints o métricas.");
  }
  const credentials = (raw.credentials ?? []).filter((c) => c.id && c.label).slice(0, 6);
  if (credentials.length === 0) {
    credentials.push({
      id: "apiKey",
      label: "API key",
      type: "secret",
      required: true,
    });
  }
  const endpoints = raw.fetch.endpoints
    .filter((e) => e.url && (e.method === "GET" || e.method === "POST"))
    .slice(0, 4);
  const metrics = raw.fetch.metrics
    .filter((m) => m.id && m.path && m.from)
    .slice(0, 16);
  if (endpoints.length === 0 || metrics.length === 0) {
    throw new Error("No se pudo armar una conexión usable para esa web.");
  }
  const guide = withGuideFallback({
    portalUrl: parsePortalUrl(raw.portalUrl),
    portalLabel: raw.portalLabel,
    setupSteps: parseSetupSteps(raw.setupSteps),
    scopes: parseScopes((raw as ConstructedSpec).scopes),
    keyType: raw.keyType,
  });
  return {
    name: raw.name.trim().slice(0, 60),
    kind: raw.kind,
    summary: (raw.summary || "").trim().slice(0, 180),
    ...guide,
    credentials,
    fetch: {
      auth: raw.fetch.auth,
      endpoints,
      metrics,
    },
  };
}

export async function analyzeWebsite(url: string): Promise<ConstructedSpec> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("Conecta OpenAI API (sk-) en Ajustes → API para construir conectores nuevos.");
  }
  const page = await fetchPageText(url).catch(() => "");
  const raw = await openaiChatJson<ConstructedSpec>(apiKey, {
    model: "gpt-4o",
    temperature: 0.2,
    maxTokens: 3500,
    system: SYSTEM,
    user: `Website: ${url}\n\nExtracted page text (may be empty):\n${page || "(no page text)"}`,
  });
  return parseConstructed(raw);
}

export async function enrichConnectorGuide(
  url: string,
  name: string
): Promise<ConnectorGuideFields> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("Conecta OpenAI API (sk-) en Ajustes → API para construir conectores nuevos.");
  }
  const page = await fetchPageText(url).catch(() => "");
  const raw = await openaiChatJson<ConnectorGuideFields>(apiKey, {
    model: "gpt-4o",
    temperature: 0.15,
    maxTokens: 1600,
    system: GUIDE_SYSTEM,
    user: `Service: ${name}\nWebsite: ${url}\n\nPage text:\n${page || "(no page text)"}`,
  });
  return parseGuide(raw);
}

export async function refineWebsite(
  url: string,
  previous: ConstructedSpec,
  errorMessage: string
): Promise<ConstructedSpec> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("Conecta OpenAI API (sk-) en Ajustes → API para construir conectores nuevos.");
  }
  const raw = await openaiChatJson<ConstructedSpec>(apiKey, {
    model: "gpt-4o",
    temperature: 0.1,
    maxTokens: 3500,
    system: SYSTEM,
    user: `The previous connector failed when connecting.\nWebsite: ${url}\nError: ${errorMessage}\nPrevious JSON: ${JSON.stringify(previous)}\nFix auth, URL, path or metrics. Keep a detailed Spanish key guide with scopes. Return a corrected connector.`,
  });
  return parseConstructed(raw);
}
