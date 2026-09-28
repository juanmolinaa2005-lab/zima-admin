import { estimateCostUsd } from "@/lib/openai/pricing";

const BASE = "https://api.openai.com/v1";

export type OpenAIUsageRow = {
  date: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costUsd: number;
  estimated: boolean;
};

export type OpenAIUsageReport = {
  startingAt: string;
  endingAt: string;
  rows: OpenAIUsageRow[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requests: number;
    costUsd: number;
  };
  byModel: {
    model: string;
    tokens: number;
    requests: number;
    costUsd: number;
  }[];
  byDay: {
    date: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    costUsd: number;
  }[];
};

type Bucket = {
  object?: string;
  start_time?: number;
  end_time?: number;
  start_time_str?: string;
  results?: Array<{
    object?: string;
    input_tokens?: number;
    output_tokens?: number;
    input_cached_tokens?: number;
    num_model_requests?: number;
    model?: string | null;
    project_id?: string | null;
  }>;
};

type CostBucket = {
  object?: string;
  start_time?: number;
  end_time?: number;
  results?: Array<{
    object?: string;
    amount?: { value?: number; currency?: string };
    line_item?: string | null;
    project_id?: string | null;
  }>;
};

async function openaiGetPages(
  path: string,
  adminKey: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page: string | undefined;
  for (let i = 0; i < 40; i++) {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: unknown[];
      next_page?: string | null;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg =
        data.error?.message ||
        (res.status === 401 || res.status === 403
          ? "Admin API key inválida. Usa una key sk-admin… de Organization → Admin keys."
          : `OpenAI API ${res.status}`);
      throw new Error(msg);
    }

    if (Array.isArray(data.data)) all.push(...data.data);
    page = data.next_page || undefined;
    if (!page) break;
  }
  return all;
}

function dayFromUnix(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

export async function verifyOpenAIAdminKey(adminKey: string): Promise<void> {
  const start = Math.floor(Date.now() / 1000) - 2 * 24 * 3600;
  await openaiGetPages("/organization/costs", adminKey, {
    start_time: start,
    bucket_width: "1d",
    limit: 2,
  });
}

export async function fetchOpenAIUsageReport(
  adminKey: string,
  opts: { startingAt: Date; endingAt: Date; days: number }
): Promise<OpenAIUsageReport> {
  const startTime = Math.floor(opts.startingAt.getTime() / 1000);
  const endTime = Math.floor(opts.endingAt.getTime() / 1000);
  const limit = Math.min(180, Math.max(1, opts.days));

  const [usageBuckets, costBuckets] = await Promise.all([
    openaiGetPages("/organization/usage/completions", adminKey, {
      start_time: startTime,
      end_time: endTime,
      bucket_width: "1d",
      group_by: ["model"],
      limit,
    }) as Promise<Bucket[]>,
    openaiGetPages("/organization/costs", adminKey, {
      start_time: startTime,
      end_time: endTime,
      bucket_width: "1d",
      limit,
    }) as Promise<CostBucket[]>,
  ]);

  const costByDay = new Map<string, number>();
  for (const bucket of costBuckets) {
    if (typeof bucket.start_time !== "number") continue;
    const date = dayFromUnix(bucket.start_time);
    let sum = 0;
    for (const r of bucket.results ?? []) {
      const v = r.amount?.value;
      if (typeof v === "number" && Number.isFinite(v)) sum += v;
    }
    costByDay.set(date, (costByDay.get(date) ?? 0) + sum);
  }

  const rows: OpenAIUsageRow[] = [];
  const dayAgg = new Map<
    string,
    {
      tokens: number;
      inputTokens: number;
      outputTokens: number;
      requests: number;
      estimatedCost: number;
    }
  >();
  const modelAgg = new Map<
    string,
    { tokens: number; requests: number; estimatedCost: number }
  >();

  for (const bucket of usageBuckets) {
    if (typeof bucket.start_time !== "number") continue;
    const date = dayFromUnix(bucket.start_time);
    for (const r of bucket.results ?? []) {
      const input = r.input_tokens ?? 0;
      const output = r.output_tokens ?? 0;
      const total = input + output;
      const requests = r.num_model_requests ?? 0;
      const model = r.model ?? null;
      const estimated = estimateCostUsd(model, input, output);

      rows.push({
        date,
        model,
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
        requests,
        costUsd: estimated,
        estimated: true,
      });

      const d = dayAgg.get(date) ?? {
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        estimatedCost: 0,
      };
      d.tokens += total;
      d.inputTokens += input;
      d.outputTokens += output;
      d.requests += requests;
      d.estimatedCost += estimated;
      dayAgg.set(date, d);

      if (model) {
        const m = modelAgg.get(model) ?? {
          tokens: 0,
          requests: 0,
          estimatedCost: 0,
        };
        m.tokens += total;
        m.requests += requests;
        m.estimatedCost += estimated;
        modelAgg.set(model, m);
      }
    }
  }

  // Prefer billed costs per day when available; distribute across models by estimated share
  const byDay = [...dayAgg.entries()]
    .map(([date, d]) => {
      const billed = costByDay.get(date);
      const costUsd =
        billed != null && billed > 0 ? billed : d.estimatedCost;
      return {
        date,
        tokens: d.tokens,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        requests: d.requests,
        costUsd,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Scale row/model costs to match billed day totals when present
  for (const row of rows) {
    const day = dayAgg.get(row.date);
    const billed = costByDay.get(row.date);
    if (day && billed != null && billed > 0 && day.estimatedCost > 0) {
      row.costUsd = (row.costUsd / day.estimatedCost) * billed;
      row.estimated = false;
    }
  }

  const byModel = [...modelAgg.entries()]
    .map(([model, m]) => {
      // Recompute cost from scaled rows
      const costUsd = rows
        .filter((r) => r.model === model)
        .reduce((s, r) => s + r.costUsd, 0);
      return {
        model,
        tokens: m.tokens,
        requests: m.requests,
        costUsd,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  const totals = byDay.reduce(
    (acc, d) => {
      acc.inputTokens += d.inputTokens;
      acc.outputTokens += d.outputTokens;
      acc.totalTokens += d.tokens;
      acc.requests += d.requests;
      acc.costUsd += d.costUsd;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requests: 0,
      costUsd: 0,
    }
  );

  return {
    startingAt: opts.startingAt.toISOString(),
    endingAt: opts.endingAt.toISOString(),
    rows,
    totals,
    byModel,
    byDay,
  };
}
