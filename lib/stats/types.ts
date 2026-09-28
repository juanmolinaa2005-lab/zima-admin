export type StatsKind = "revenue" | "cost" | "mixed";

export type BuiltinSlug = "superwall" | "openai" | "claude";

export type CredentialField = {
  id: string;
  label: string;
  type: "secret" | "text";
  hint?: string;
  required?: boolean;
};

export type GuideScope = {
  name: string;
  required: boolean;
  note?: string;
};

export type ConnectorGuide = {
  portalUrl: string | null;
  portalLabel: string | null;
  setupSteps: string[];
  scopes: GuideScope[];
  keyType: string | null;
};

export type FetchAuth =
  | { type: "bearer"; credentialId: string; prefix?: string }
  | { type: "header"; credentialId: string; header: string; prefix?: string }
  | { type: "query"; credentialId: string; param: string };

export type FetchEndpoint = {
  id: string;
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

export type FetchMetric = {
  id: string;
  label: string;
  kind: "revenue" | "cost" | "count";
  unit?: "usd" | "count";
  from: string;
  path: string;
  reduce?: "sum" | "last" | "first" | "max";
};

export type FetchSpec = {
  auth: FetchAuth;
  endpoints: FetchEndpoint[];
  metrics: FetchMetric[];
};

export type ConnectorPublic = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  host: string;
  kind: StatsKind;
  summary: string | null;
  builtin: BuiltinSlug | null;
  credentials: CredentialField[];
  portalUrl: string | null;
  portalLabel: string | null;
  setupSteps: string[];
  scopes: GuideScope[];
  keyType: string | null;
  cached: boolean;
};

export type StatsSource = {
  id: string;
  connectorId: string;
  slug: string;
  name: string;
  websiteUrl: string;
  kind: StatsKind;
  builtin: BuiltinSlug | null;
  summary: string | null;
  connected: boolean;
};

export type UnifiedMetric = {
  id: string;
  label: string;
  value: number;
  kind: "revenue" | "cost" | "count";
  unit: "usd" | "count";
};

export type PlatformSnapshot = {
  sourceId: string;
  slug: string;
  name: string;
  kind: StatsKind;
  builtin: BuiltinSlug | null;
  metrics: UnifiedMetric[];
  series: { date: string; value: number; kind: "revenue" | "cost" }[];
  error?: string;
};

export type AllMetricFormat = "money" | "count" | "pct" | "ratio" | "months" | "decimal";

export type AllMetricCard = {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  format: AllMetricFormat;
  tone?: "good" | "bad";
};

export type AllMetricGroup = {
  id: string;
  title: string;
  metrics: AllMetricCard[];
};

export type AllBreakdown = {
  id: string;
  title: string;
  hint?: string;
  format: "money" | "count";
  showShare: boolean;
  rows: { name: string; value: number; share: number | null }[];
};

export type AllDashboard = {
  days: number;
  revenue: number;
  cost: number;
  profit: number;
  groups: AllMetricGroup[];
  breakdowns: AllBreakdown[];
  platforms: PlatformSnapshot[];
};

export type ConstructPreview = {
  cached: boolean;
  alreadyAdded: boolean;
  alreadyConnected: boolean;
  connector: ConnectorPublic;
  spec?: FetchSpec | null;
};
