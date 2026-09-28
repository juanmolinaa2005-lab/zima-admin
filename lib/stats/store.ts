import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { aliasesFor, BUILTIN_CONNECTORS, candidateHosts, hostOf } from "./builtin";
import { ensureStatsSchema } from "./schema";
import { parseScopes } from "./guide";
import type {
  BuiltinSlug,
  ConnectorPublic,
  CredentialField,
  FetchSpec,
  GuideScope,
  StatsKind,
  StatsSource,
} from "./types";

const CONNECTOR_COLS =
  "id, slug, name, website_url, host, kind, summary, builtin, credentials_schema, fetch_spec, portal_url, portal_label, setup_steps, alias_hosts, scopes, key_type";

type ConnectorRow = {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  host: string;
  kind: StatsKind;
  summary: string | null;
  builtin: BuiltinSlug | null;
  credentials_schema: CredentialField[] | null;
  fetch_spec: FetchSpec | null;
  portal_url?: string | null;
  portal_label?: string | null;
  setup_steps?: string[] | null;
  alias_hosts?: string[] | null;
  scopes?: GuideScope[] | null;
  key_type?: string | null;
};

type SourceRow = {
  id: string;
  connector_id: string;
  credentials_ciphertext: string | null;
  stats_connectors: ConnectorRow | ConnectorRow[] | null;
};

function asConnector(row: ConnectorRow): ConnectorPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.website_url,
    host: row.host,
    kind: row.kind,
    summary: row.summary,
    builtin: row.builtin,
    credentials: row.credentials_schema ?? [],
    portalUrl: row.portal_url ?? null,
    portalLabel: row.portal_label ?? null,
    setupSteps: Array.isArray(row.setup_steps) ? row.setup_steps : [],
    scopes: parseScopes(row.scopes),
    keyType: row.key_type ?? null,
    cached: true,
  };
}

function joinConnector(row: SourceRow): ConnectorRow | null {
  const joined = row.stats_connectors;
  if (Array.isArray(joined)) return joined[0] ?? null;
  return joined;
}

export async function seedBuiltins(admin: SupabaseClient): Promise<void> {
  await ensureStatsSchema();
  for (const b of BUILTIN_CONNECTORS) {
    await admin.from("stats_connectors").upsert(
      {
        slug: b.slug,
        name: b.name,
        website_url: b.websiteUrl,
        host: hostOf(b.websiteUrl),
        kind: b.kind,
        summary: b.summary,
        builtin: b.slug,
        credentials_schema: b.credentials,
        portal_url: b.portalUrl,
        portal_label: b.portalLabel,
        setup_steps: b.setupSteps,
        scopes: b.scopes,
        key_type: b.keyType,
        alias_hosts: aliasesFor(b.websiteUrl, b.portalUrl, ...b.hosts),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );
  }
}

export async function findConnectorByHost(
  supabase: SupabaseClient,
  host: string
): Promise<(ConnectorPublic & { fetchSpec: FetchSpec | null }) | null> {
  await ensureStatsSchema();
  const hosts = candidateHosts(host);
  if (hosts.length === 0) return null;
  const { data } = await supabase
    .from("stats_connectors")
    .select(CONNECTOR_COLS)
    .in("host", hosts)
    .limit(1)
    .maybeSingle();
  if (data) {
    const row = data as ConnectorRow;
    return { ...asConnector(row), fetchSpec: row.fetch_spec };
  }
  const { data: aliased } = await supabase
    .from("stats_connectors")
    .select(CONNECTOR_COLS)
    .overlaps("alias_hosts", hosts)
    .limit(1)
    .maybeSingle();
  if (!aliased) return null;
  const row = aliased as ConnectorRow;
  return { ...asConnector(row), fetchSpec: row.fetch_spec };
}

export async function findConnectorBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<(ConnectorPublic & { fetchSpec: FetchSpec | null }) | null> {
  await ensureStatsSchema();
  const { data } = await supabase
    .from("stats_connectors")
    .select(CONNECTOR_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as ConnectorRow;
  return { ...asConnector(row), fetchSpec: row.fetch_spec };
}

export async function saveSharedConnector(
  admin: SupabaseClient,
  userId: string,
  input: {
    slug: string;
    name: string;
    websiteUrl: string;
    host: string;
    kind: StatsKind;
    summary: string;
    credentials: CredentialField[];
    fetchSpec: FetchSpec;
    portalUrl?: string | null;
    portalLabel?: string | null;
    setupSteps?: string[];
    scopes?: GuideScope[];
    keyType?: string | null;
  }
): Promise<ConnectorPublic> {
  await ensureStatsSchema();
  const existing = await findConnectorByHost(admin, input.host);
  if (existing) return existing;
  const clash = await findConnectorBySlug(admin, input.slug);
  const slug = clash ? `${input.slug}-${Date.now().toString(36)}` : input.slug;
  const { data, error } = await admin
    .from("stats_connectors")
    .insert({
      slug,
      name: input.name,
      website_url: input.websiteUrl,
      host: input.host,
      kind: input.kind,
      summary: input.summary,
      builtin: null,
      credentials_schema: input.credentials,
      fetch_spec: input.fetchSpec,
      portal_url: input.portalUrl ?? null,
      portal_label: input.portalLabel ?? null,
      setup_steps: input.setupSteps ?? [],
      scopes: input.scopes ?? [],
      key_type: input.keyType ?? null,
      alias_hosts: aliasesFor(input.websiteUrl, input.portalUrl, input.host),
      created_by: userId,
    })
    .select(CONNECTOR_COLS)
    .single();
  if (error) {
    const again = await findConnectorByHost(admin, input.host);
    if (again) return again;
    throw new Error(error.message);
  }
  return asConnector(data as ConnectorRow);
}

export async function updateSharedConnector(
  admin: SupabaseClient,
  connectorId: string,
  input: {
    fetchSpec?: FetchSpec;
    credentials?: CredentialField[];
    portalUrl?: string | null;
    portalLabel?: string | null;
    setupSteps?: string[];
    scopes?: GuideScope[];
    keyType?: string | null;
  }
): Promise<void> {
  await ensureStatsSchema();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.fetchSpec) patch.fetch_spec = input.fetchSpec;
  if (input.credentials) patch.credentials_schema = input.credentials;
  if (input.portalUrl !== undefined) patch.portal_url = input.portalUrl;
  if (input.portalLabel !== undefined) patch.portal_label = input.portalLabel;
  if (input.setupSteps) patch.setup_steps = input.setupSteps;
  if (input.scopes) patch.scopes = input.scopes;
  if (input.keyType !== undefined) patch.key_type = input.keyType;
  const { error } = await admin
    .from("stats_connectors")
    .update(patch)
    .eq("id", connectorId);
  if (error) throw new Error(error.message);
}

export async function saveConnector(
  supabase: SupabaseClient,
  userId: string,
  input: {
    slug: string;
    name: string;
    websiteUrl: string;
    host: string;
    kind: StatsKind;
    summary: string;
    credentials: CredentialField[];
    fetchSpec: FetchSpec;
    portalUrl?: string | null;
    portalLabel?: string | null;
    setupSteps?: string[];
    scopes?: GuideScope[];
    keyType?: string | null;
  }
): Promise<ConnectorPublic> {
  return saveSharedConnector(supabase, userId, input);
}

export async function listProjectSources(
  supabase: SupabaseClient,
  projectId: string
): Promise<StatsSource[]> {
  await ensureStatsSchema();
  const { data, error } = await supabase
    .from("stats_sources")
    .select(
      "id, connector_id, credentials_ciphertext, stats_connectors ( id, slug, name, website_url, host, kind, summary, builtin, credentials_schema )"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SourceRow[]).flatMap((row) => {
    const c = joinConnector(row);
    if (!c) return [];
    return [
      {
        id: row.id,
        connectorId: c.id,
        slug: c.slug,
        name: c.name,
        websiteUrl: c.website_url,
        kind: c.kind,
        builtin: c.builtin,
        summary: c.summary,
        connected: Boolean(row.credentials_ciphertext) || Boolean(c.builtin),
      },
    ];
  });
}

export async function getSourceWithSpec(
  supabase: SupabaseClient,
  projectId: string,
  sourceId: string
): Promise<{
  source: StatsSource;
  fetchSpec: FetchSpec | null;
  credentials: Record<string, string>;
} | null> {
  await ensureStatsSchema();
  const { data, error } = await supabase
    .from("stats_sources")
    .select(
      "id, connector_id, credentials_ciphertext, stats_connectors ( id, slug, name, website_url, host, kind, summary, builtin, credentials_schema, fetch_spec )"
    )
    .eq("id", sourceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as SourceRow;
  const c = joinConnector(row);
  if (!c) return null;
  let credentials: Record<string, string> = {};
  if (row.credentials_ciphertext) {
    try {
      credentials = JSON.parse(decryptSecret(row.credentials_ciphertext)) as Record<
        string,
        string
      >;
    } catch {
      credentials = {};
    }
  }
  return {
    source: {
      id: row.id,
      connectorId: c.id,
      slug: c.slug,
      name: c.name,
      websiteUrl: c.website_url,
      kind: c.kind,
      builtin: c.builtin,
      summary: c.summary,
      connected: Boolean(row.credentials_ciphertext) || Boolean(c.builtin),
    },
    fetchSpec: c.fetch_spec,
    credentials,
  };
}

export async function addSource(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    userId: string;
    connectorId: string;
    credentials?: Record<string, string>;
  }
): Promise<string> {
  await ensureStatsSchema();
  const cipher = input.credentials
    ? encryptSecret(JSON.stringify(input.credentials))
    : null;
  const { data, error } = await supabase
    .from("stats_sources")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      connector_id: input.connectorId,
      credentials_ciphertext: cipher,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Esa plataforma ya está en este proyecto.");
    }
    throw new Error(error.message);
  }
  return data.id as string;
}

export async function deleteSource(
  supabase: SupabaseClient,
  projectId: string,
  sourceId: string
): Promise<void> {
  await ensureStatsSchema();
  const { error } = await supabase
    .from("stats_sources")
    .delete()
    .eq("id", sourceId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
}

export function slugFromHost(host: string): string {
  const base = host
    .replace(/^www\./, "")
    .split(".")
    .slice(0, -1)
    .join("-")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return (base || host.replace(/\./g, "-")).slice(0, 40);
}
