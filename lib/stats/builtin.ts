import type { BuiltinSlug, CredentialField, GuideScope, StatsKind } from "./types";

export type BuiltinDef = {
  slug: BuiltinSlug;
  name: string;
  websiteUrl: string;
  hosts: string[];
  kind: StatsKind;
  summary: string;
  credentials: CredentialField[];
  portalUrl: string;
  portalLabel: string;
  setupSteps: string[];
  keyType: string;
  scopes: GuideScope[];
};

export const BUILTIN_CONNECTORS: BuiltinDef[] = [
  {
    slug: "superwall",
    name: "Superwall",
    websiteUrl: "https://superwall.com",
    hosts: ["superwall.com", "www.superwall.com", "dashboard.superwall.com"],
    kind: "revenue",
    summary: "Ingresos, suscripciones y usuarios nuevos de la app.",
    credentials: [
      {
        id: "apiKey",
        label: "Organization API key",
        type: "secret",
        hint: "Superwall dashboard → API",
        required: true,
      },
    ],
    portalUrl: "https://superwall.com/dashboard",
    portalLabel: "Abrir Superwall",
    keyType: "Organization API key",
    scopes: [
      { name: "Organization", required: true, note: "Lee apps, revenue y users" },
      { name: "Applications · read", required: true, note: "Lista las apps" },
      { name: "Analytics · read", required: true, note: "Gross, net, MRR" },
      { name: "Write / publish", required: false, note: "No hace falta" },
    ],
    setupSteps: [
      "Dashboard Superwall → Settings → API.",
      "Crea Organization API key. No uses una key de una sola app.",
      "Si pide scopes: Organization + Applications read + Analytics read.",
      "Nada de write, webhooks ni publish.",
      "Copia la key y pégala abajo.",
    ],
  },
  {
    slug: "openai",
    name: "OpenAI",
    websiteUrl: "https://platform.openai.com",
    hosts: ["openai.com", "www.openai.com", "platform.openai.com"],
    kind: "cost",
    summary: "Gasto de organización, tokens y coste por request.",
    credentials: [
      {
        id: "apiKey",
        label: "Admin API key",
        type: "secret",
        hint: "sk-admin…",
        required: true,
      },
    ],
    portalUrl:
      "https://platform.openai.com/settings/organization/admin-keys",
    portalLabel: "Crear Admin key",
    keyType: "Admin API key · sk-admin",
    scopes: [
      { name: "Usage · read", required: true, note: "Tokens y requests" },
      { name: "Costs · read", required: true, note: "Gasto facturado" },
      { name: "Organization · read", required: true, note: "Datos de la org" },
      { name: "Write / Keys / Members", required: false, note: "No marques" },
    ],
    setupSteps: [
      "platform.openai.com → Organization → Admin keys.",
      "Create new admin key. Debe empezar por sk-admin. Una sk- normal no sirve.",
      "Permisos: Usage read + Costs read + Organization read.",
      "Deja apagado: Write, API keys, Members, Projects write.",
      "Copia la key una vez y pégala abajo.",
    ],
  },
  {
    slug: "claude",
    name: "Claude",
    websiteUrl: "https://console.anthropic.com",
    hosts: [
      "anthropic.com",
      "www.anthropic.com",
      "console.anthropic.com",
      "claude.ai",
      "www.claude.ai",
    ],
    kind: "cost",
    summary: "Uso y coste de Anthropic (Admin API).",
    credentials: [
      {
        id: "apiKey",
        label: "Admin API key",
        type: "secret",
        hint: "sk-ant-admin…",
        required: true,
      },
    ],
    portalUrl: "https://console.anthropic.com/settings/admin-keys",
    portalLabel: "Crear Admin key",
    keyType: "Admin API key · sk-ant-admin",
    scopes: [
      { name: "Usage · read", required: true, note: "Tokens por modelo" },
      { name: "Cost · read", required: true, note: "Coste Anthropic" },
      { name: "Admin write", required: false, note: "No hace falta" },
    ],
    setupSteps: [
      "console.anthropic.com → Settings → Admin keys.",
      "Crea sk-ant-admin… No uses una key sk-ant-api de chat.",
      "Permisos: Usage read + Cost read.",
      "Nada de admin write ni workspace edit.",
      "Copia y pega abajo.",
    ],
  },
];

export function hostOf(input: string): string {
  try {
    const url = new URL(
      /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`
    );
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProto);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Usa una web http o https.");
  }
  return url.toString();
}

export function candidateHosts(host: string): string[] {
  const clean = host.replace(/^www\./, "").toLowerCase();
  if (!clean) return [];
  const out = new Set([clean]);
  const parts = clean.split(".");
  if (parts.length >= 3) out.add(parts.slice(-2).join("."));
  return [...out];
}

export function aliasesFor(...urls: Array<string | null | undefined>): string[] {
  const hosts = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    for (const h of candidateHosts(hostOf(raw))) hosts.add(h);
  }
  return [...hosts];
}

export function matchBuiltin(input: string): BuiltinDef | null {
  const lower = input.trim().toLowerCase();
  const bySlug = BUILTIN_CONNECTORS.find((b) => b.slug === lower);
  if (bySlug) return bySlug;
  const host = hostOf(input);
  if (!host) return null;
  return (
    BUILTIN_CONNECTORS.find((b) =>
      b.hosts.some((h) => {
        const clean = h.replace(/^www\./, "");
        return host === clean || host.endsWith(`.${clean}`);
      })
    ) ?? null
  );
}
