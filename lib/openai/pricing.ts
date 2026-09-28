export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatUsdPrecise(n: number | string, digits = 6): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return `$${v.toFixed(digits)}`;
}

export function divideCost(total: number, count: number): number | null {
  if (!count || !Number.isFinite(total)) return null;
  return total / count;
}

export type TokenRates = { in: number; out: number };

/** List prices ($/1M tokens). Fallback when Costs API no split in/out. */
const RATES: { match: RegExp; rates: TokenRates }[] = [
  { match: /gpt-5(?!\.|-)|gpt-5\./i, rates: { in: 1.25, out: 10 } },
  { match: /gpt-4\.1-nano/i, rates: { in: 0.1, out: 0.4 } },
  { match: /gpt-4\.1-mini/i, rates: { in: 0.4, out: 1.6 } },
  { match: /gpt-4\.1/i, rates: { in: 2, out: 8 } },
  { match: /gpt-4o-mini/i, rates: { in: 0.15, out: 0.6 } },
  { match: /gpt-4o/i, rates: { in: 2.5, out: 10 } },
  { match: /o4-mini/i, rates: { in: 1.1, out: 4.4 } },
  { match: /o3-mini/i, rates: { in: 1.1, out: 4.4 } },
  { match: /\bo3\b/i, rates: { in: 10, out: 40 } },
  { match: /o1-mini/i, rates: { in: 1.1, out: 4.4 } },
  { match: /\bo1\b/i, rates: { in: 15, out: 60 } },
];

const DEFAULT_RATES: TokenRates = { in: 2.5, out: 10 };

export function ratesForModel(model: string | null): TokenRates {
  if (!model) return DEFAULT_RATES;
  for (const row of RATES) {
    if (row.match.test(model)) return row.rates;
  }
  return DEFAULT_RATES;
}

export function estimateCostUsd(
  model: string | null,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = ratesForModel(model);
  return (inputTokens * rate.in + outputTokens * rate.out) / 1_000_000;
}

export type EffectivePerMillion = {
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  inputTokens: number;
  outputTokens: number;
  costInputUsd: number;
  costOutputUsd: number;
  totalCostUsd: number;
};

/**
 * Coste efectivo $/1M entrada y $/1M salida del periodo.
 * Reparte el gasto facturado según el peso lista in/out de cada modelo.
 */
export function effectivePerMillionFromUsage(opts: {
  totalCostUsd: number;
  rows: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
  }[];
  inputTokens: number;
  outputTokens: number;
}): EffectivePerMillion {
  const { totalCostUsd, rows, inputTokens, outputTokens } = opts;

  let estIn = 0;
  let estOut = 0;
  for (const row of rows) {
    const rate = ratesForModel(row.model);
    estIn += (row.inputTokens * rate.in) / 1_000_000;
    estOut += (row.outputTokens * rate.out) / 1_000_000;
  }

  const estTotal = estIn + estOut;
  let costInputUsd = 0;
  let costOutputUsd = 0;
  if (estTotal > 0 && totalCostUsd > 0) {
    costInputUsd = totalCostUsd * (estIn / estTotal);
    costOutputUsd = totalCostUsd * (estOut / estTotal);
  } else if (totalCostUsd > 0 && inputTokens + outputTokens > 0) {
    // Sin tarifas: reparte por volumen de tokens
    const t = inputTokens + outputTokens;
    costInputUsd = totalCostUsd * (inputTokens / t);
    costOutputUsd = totalCostUsd * (outputTokens / t);
  }

  return {
    inputPerMillion:
      inputTokens > 0 ? costInputUsd / (inputTokens / 1_000_000) : null,
    outputPerMillion:
      outputTokens > 0 ? costOutputUsd / (outputTokens / 1_000_000) : null,
    inputTokens,
    outputTokens,
    costInputUsd,
    costOutputUsd,
    totalCostUsd,
  };
}
