import {
  addCosts,
  calculateExactCost,
  formatUsdClaude,
} from "@/lib/claude/pricing";

const ANTHROPIC_VERSION = "2023-06-01";
const BASE = "https://api.anthropic.com";

export type UsageRow = {
  date: string;
  model: string | null;
  serviceTier: string | null;
  workspaceId: string | null;
  uncachedInput: number;
  cacheRead: number;
  cacheCreation5m: number;
  cacheCreation1h: number;
  output: number;
  totalTokens: number;
  /** Anthropic billed estimate when available from cost API (2 dp display). */
  claudeCostUsd: number | null;
  /** Exact cost from published rates × tokens (high precision string). */
  exactCostUsd: string;
  modelLabel: string;
};

export type ClaudeUsageReport = {
  startingAt: string;
  endingAt: string;
  rows: UsageRow[];
  totals: {
    uncachedInput: number;
    cacheRead: number;
    cacheCreation5m: number;
    cacheCreation1h: number;
    output: number;
    totalTokens: number;
    claudeCostUsd: number;
    exactCostUsd: string;
  };
  byModel: {
    model: string;
    label: string;
    tokens: number;
    claudeCostUsd: number;
    exactCostUsd: string;
  }[];
  byDay: {
    date: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    claudeCostUsd: number;
    exactCostUsd: string;
  }[];
};

type UsageBucket = {
  starting_at: string;
  ending_at: string;
  results: {
    model?: string | null;
    service_tier?: string | null;
    workspace_id?: string | null;
    uncached_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_5m_input_tokens?: number;
    cache_creation_1h_input_tokens?: number;
    cache_creation?: {
      ephemeral_5m_input_tokens?: number;
      ephemeral_1h_input_tokens?: number;
    };
    output_tokens?: number;
  }[];
};

type CostBucket = {
  starting_at: string;
  ending_at: string;
  results: {
    amount?: string;
    cost_type?: string;
    description?: string;
    workspace_id?: string | null;
    model?: string | null;
  }[];
};

async function anthropicGet<T>(
  path: string,
  adminKey: string,
  params: Record<string, string | string[]>
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, item);
    } else if (v) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    headers: {
      "x-api-key": adminKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "User-Agent": "ZimaAdmin/1.0 (https://zima-admin.vercel.app)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Admin API key inválida o sin permisos. Usa una key sk-ant-admin… con scope de usage/cost."
      );
    }
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 240)}`);
  }

  return res.json() as Promise<T>;
}

async function fetchAllPages<T extends { data: unknown[]; has_more?: boolean; next_page?: string | null }>(
  path: string,
  adminKey: string,
  params: Record<string, string | string[]>
): Promise<T["data"]> {
  const all: T["data"] = [];
  let page: string | undefined;
  for (let i = 0; i < 40; i++) {
    const q = { ...params };
    if (page) q.page = page;
    const body = await anthropicGet<T>(path, adminKey, q);
    all.push(...(body.data ?? []));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return all;
}

export async function verifyAdminKey(adminKey: string): Promise<void> {
  const ending = new Date();
  const starting = new Date(ending.getTime() - 24 * 60 * 60 * 1000);
  await anthropicGet(
    "/v1/organizations/usage_report/messages",
    adminKey,
    {
      starting_at: starting.toISOString(),
      ending_at: ending.toISOString(),
      bucket_width: "1d",
      limit: "1",
    }
  );
}

function cache5m(r: UsageBucket["results"][0]): number {
  return (
    r.cache_creation_5m_input_tokens ??
    r.cache_creation?.ephemeral_5m_input_tokens ??
    0
  );
}

function cache1h(r: UsageBucket["results"][0]): number {
  return (
    r.cache_creation_1h_input_tokens ??
    r.cache_creation?.ephemeral_1h_input_tokens ??
    0
  );
}

export async function fetchClaudeUsageReport(
  adminKey: string,
  opts: {
    startingAt: string;
    endingAt: string;
    bucketWidth?: "1d" | "1h";
    models?: string[];
  }
): Promise<ClaudeUsageReport> {
  const bucketWidth = opts.bucketWidth ?? "1d";
  const usageParams: Record<string, string | string[]> = {
    starting_at: opts.startingAt,
    ending_at: opts.endingAt,
    bucket_width: bucketWidth,
    "group_by[]": ["model", "service_tier"],
    limit: bucketWidth === "1h" ? "168" : "31",
  };
  if (opts.models?.length) {
    usageParams["models[]"] = opts.models;
  }

  const usageBuckets = (await fetchAllPages<{
    data: UsageBucket[];
    has_more?: boolean;
    next_page?: string | null;
  }>("/v1/organizations/usage_report/messages", adminKey, usageParams)) as UsageBucket[];

  let costBuckets: CostBucket[] = [];
  try {
    costBuckets = (await fetchAllPages<{
      data: CostBucket[];
      has_more?: boolean;
      next_page?: string | null;
    }>("/v1/organizations/cost_report", adminKey, {
      starting_at: opts.startingAt,
      ending_at: opts.endingAt,
      bucket_width: "1d",
      "group_by[]": ["description"],
      limit: "31",
    })) as CostBucket[];
  } catch {
    // Cost endpoint may fail; we still show exact token costs
  }

  const claudeCostByDay = new Map<string, number>();
  for (const bucket of costBuckets) {
    const day = bucket.starting_at.slice(0, 10);
    let sum = 0;
    for (const r of bucket.results ?? []) {
      // amount is in cents (lowest units) as decimal string
      const cents = Number(r.amount ?? 0);
      if (Number.isFinite(cents)) sum += cents / 100;
    }
    claudeCostByDay.set(day, (claudeCostByDay.get(day) ?? 0) + sum);
  }

  const rows: UsageRow[] = [];

  for (const bucket of usageBuckets) {
    const date = bucket.starting_at.slice(0, 10);
    for (const r of bucket.results ?? []) {
      const uncachedInput = r.uncached_input_tokens ?? 0;
      const cacheRead = r.cache_read_input_tokens ?? 0;
      const c5 = cache5m(r);
      const c1 = cache1h(r);
      const output = r.output_tokens ?? 0;
      const totalTokens = uncachedInput + cacheRead + c5 + c1 + output;
      if (totalTokens === 0) continue;

      const { exact, label } = calculateExactCost(
        r.model ?? null,
        {
          uncachedInput,
          cacheRead,
          cacheCreation5m: c5,
          cacheCreation1h: c1,
          output,
        },
        r.service_tier
      );

      rows.push({
        date,
        model: r.model ?? null,
        serviceTier: r.service_tier ?? null,
        workspaceId: r.workspace_id ?? null,
        uncachedInput,
        cacheRead,
        cacheCreation5m: c5,
        cacheCreation1h: c1,
        output,
        totalTokens,
        claudeCostUsd: null,
        exactCostUsd: exact,
        modelLabel: label,
      });
    }
  }

  // Allocate Claude daily cost proportionally by exact cost within the day
  const exactByDay = new Map<string, number>();
  for (const row of rows) {
    exactByDay.set(
      row.date,
      (exactByDay.get(row.date) ?? 0) + Number(row.exactCostUsd)
    );
  }
  for (const row of rows) {
    const dayClaude = claudeCostByDay.get(row.date);
    const dayExact = exactByDay.get(row.date) ?? 0;
    if (dayClaude != null && dayExact > 0) {
      row.claudeCostUsd =
        (Number(row.exactCostUsd) / dayExact) * dayClaude;
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || (b.model ?? "").localeCompare(a.model ?? ""));

  let tIn = 0,
    tRead = 0,
    t5 = 0,
    t1 = 0,
    tOut = 0,
    tClaude = 0;
  const exactParts: string[] = [];
  for (const r of rows) {
    tIn += r.uncachedInput;
    tRead += r.cacheRead;
    t5 += r.cacheCreation5m;
    t1 += r.cacheCreation1h;
    tOut += r.output;
    tClaude += r.claudeCostUsd ?? 0;
    exactParts.push(r.exactCostUsd);
  }

  const byModelMap = new Map<
    string,
    { model: string; label: string; tokens: number; claude: number; exact: string[] }
  >();
  for (const r of rows) {
    const key = r.model ?? "unknown";
    const cur = byModelMap.get(key) ?? {
      model: key,
      label: r.modelLabel,
      tokens: 0,
      claude: 0,
      exact: [],
    };
    cur.tokens += r.totalTokens;
    cur.claude += r.claudeCostUsd ?? 0;
    cur.exact.push(r.exactCostUsd);
    byModelMap.set(key, cur);
  }

  const byDayMap = new Map<
    string,
    {
      date: string;
      tokens: number;
      inputTokens: number;
      outputTokens: number;
      claude: number;
      exact: string[];
    }
  >();
  for (const r of rows) {
    const inputTokens =
      r.uncachedInput + r.cacheRead + r.cacheCreation5m + r.cacheCreation1h;
    const cur = byDayMap.get(r.date) ?? {
      date: r.date,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      claude: 0,
      exact: [],
    };
    cur.tokens += r.totalTokens;
    cur.inputTokens += inputTokens;
    cur.outputTokens += r.output;
    cur.claude += r.claudeCostUsd ?? 0;
    cur.exact.push(r.exactCostUsd);
    byDayMap.set(r.date, cur);
  }

  return {
    startingAt: opts.startingAt,
    endingAt: opts.endingAt,
    rows,
    totals: {
      uncachedInput: tIn,
      cacheRead: tRead,
      cacheCreation5m: t5,
      cacheCreation1h: t1,
      output: tOut,
      totalTokens: tIn + tRead + t5 + t1 + tOut,
      claudeCostUsd: tClaude,
      exactCostUsd: exactParts.length ? addCosts(...exactParts) : "0.00",
    },
    byModel: [...byModelMap.values()]
      .map((m) => ({
        model: m.model,
        label: m.label,
        tokens: m.tokens,
        claudeCostUsd: m.claude,
        exactCostUsd: addCosts(...m.exact),
      }))
      .sort((a, b) => b.tokens - a.tokens),
    byDay: [...byDayMap.values()]
      .map((d) => ({
        date: d.date,
        tokens: d.tokens,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        claudeCostUsd: d.claude,
        exactCostUsd: addCosts(...d.exact),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export { formatUsdClaude };
