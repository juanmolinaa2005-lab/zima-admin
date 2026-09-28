/**
 * Official Claude API list prices (USD per million tokens).
 * Used to compute exact costs from token usage (Admin Usage API).
 * Cache: write 5m = 1.25× input, write 1h = 2× input, read = 0.1× input.
 */

export type ModelRates = {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
};

/** Rates as of 2026-08 — keep in sync with platform.claude.com/docs/en/about-claude/pricing */
const RATES: { match: RegExp; rates: ModelRates; label: string }[] = [
  {
    match: /fable-5|mythos/i,
    label: "Fable / Mythos 5",
    rates: {
      input: 10,
      output: 50,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
      cacheRead: 1,
    },
  },
  {
    match: /opus-4|opus-5|claude-opus/i,
    label: "Opus",
    rates: {
      input: 5,
      output: 25,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      cacheRead: 0.5,
    },
  },
  {
    match: /sonnet-5(?!-)/i,
    label: "Sonnet 5 (intro)",
    rates: {
      input: 2,
      output: 10,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
      cacheRead: 0.2,
    },
  },
  {
    match: /sonnet-4|claude-sonnet/i,
    label: "Sonnet 4.x",
    rates: {
      input: 3,
      output: 15,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      cacheRead: 0.3,
    },
  },
  {
    match: /haiku-4\.5|haiku-4-5|claude-haiku-4/i,
    label: "Haiku 4.5",
    rates: {
      input: 1,
      output: 5,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
      cacheRead: 0.1,
    },
  },
  {
    match: /haiku-3\.5|haiku-3-5|claude-3-5-haiku/i,
    label: "Haiku 3.5",
    rates: {
      input: 0.8,
      output: 4,
      cacheWrite5m: 1,
      cacheWrite1h: 1.6,
      cacheRead: 0.08,
    },
  },
  {
    match: /haiku/i,
    label: "Haiku",
    rates: {
      input: 1,
      output: 5,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
      cacheRead: 0.1,
    },
  },
];

const FALLBACK: ModelRates = {
  input: 3,
  output: 15,
  cacheWrite5m: 3.75,
  cacheWrite1h: 6,
  cacheRead: 0.3,
};

export function ratesForModel(model: string | null | undefined): {
  label: string;
  rates: ModelRates;
} {
  if (!model) return { label: "Desconocido", rates: FALLBACK };
  for (const row of RATES) {
    if (row.match.test(model)) return { label: row.label, rates: row.rates };
  }
  return { label: model, rates: FALLBACK };
}

/** Batch tier is 50% of standard. */
export function applyServiceTier(
  rates: ModelRates,
  serviceTier: string | null | undefined
): ModelRates {
  if (serviceTier === "batch") {
    return {
      input: rates.input * 0.5,
      output: rates.output * 0.5,
      cacheWrite5m: rates.cacheWrite5m * 0.5,
      cacheWrite1h: rates.cacheWrite1h * 0.5,
      cacheRead: rates.cacheRead * 0.5,
    };
  }
  return rates;
}

/**
 * Exact USD cost from tokens: cost = tokens * $/MTok / 1e6
 * Returns a string with up to `decimals` places (default 20), no scientific notation.
 */
export function costFromTokens(
  tokens: number,
  usdPerMillion: number,
  decimals = 20
): string {
  if (!Number.isFinite(tokens) || tokens <= 0 || !Number.isFinite(usdPerMillion)) {
    return (0).toFixed(Math.min(decimals, 2));
  }
  // price scaled to 12 decimal places
  const priceScaled = BigInt(Math.round(usdPerMillion * 1e12));
  // dollars * 1e12 = tokens * priceScaled / 1e6
  const dollarsE12 =
    (BigInt(Math.trunc(tokens)) * priceScaled) / BigInt(1_000_000);
  return formatScaled(dollarsE12, 12, decimals);
}

function formatScaled(
  value: bigint,
  scale: number,
  decimals: number
): string {
  const neg = value < BigInt(0);
  const abs = neg ? -value : value;
  const str = abs.toString().padStart(scale + 1, "0");
  const whole = str.slice(0, -scale) || "0";
  let frac = str.slice(-scale);
  if (decimals < scale) {
    frac = frac.slice(0, decimals);
  } else if (decimals > scale) {
    frac = frac + "0".repeat(decimals - scale);
  }
  // Keep up to `decimals` places; ensure at least 2 digits for tiny amounts.
  const trimmed = frac.replace(/0+$/, "");
  const shown =
    trimmed.length < 2 ? frac.slice(0, Math.max(2, decimals)) : frac;
  return `${neg ? "-" : ""}${whole}.${shown.slice(0, decimals)}`;
}

export function addCosts(...amounts: string[]): string {
  const scale = 20;
  let total = BigInt(0);
  for (const a of amounts) {
    total += parseToScaled(a, scale);
  }
  return formatScaled(total, scale, scale);
}

/** Exact USD ÷ count (e.g. cost per message), high-precision string. */
export function divideCost(
  amount: string,
  divisor: number,
  decimals = 20
): string {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return (0).toFixed(Math.min(decimals, 2));
  }
  const scale = 20;
  const extra = 8;
  const total = parseToScaled(amount, scale);
  const expanded = total * BigInt(10) ** BigInt(extra);
  const quot = expanded / BigInt(Math.trunc(divisor));
  return formatScaled(quot, scale + extra, decimals);
}

function parseToScaled(s: string, scale: number): bigint {
  const t = s.trim();
  if (!t) return BigInt(0);
  const neg = t.startsWith("-");
  const raw = neg ? t.slice(1) : t;
  const [w, f = ""] = raw.split(".");
  const frac = (f + "0".repeat(scale)).slice(0, scale);
  const v =
    BigInt(w || "0") * BigInt(10) ** BigInt(scale) + BigInt(frac || "0");
  return neg ? -v : v;
}

export function formatUsdClaude(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function formatUsdPrecise(amount: string, maxDecimals = 20): string {
  const cleaned = amount.replace(/0+$/, "").replace(/\.$/, "");
  const [w, f = ""] = cleaned.split(".");
  if (!f) return `$${w}.00`;
  const frac = f.slice(0, maxDecimals);
  return `$${w}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}

export type TokenBreakdown = {
  uncachedInput: number;
  cacheRead: number;
  cacheCreation5m: number;
  cacheCreation1h: number;
  output: number;
};

export function calculateExactCost(
  model: string | null,
  tokens: TokenBreakdown,
  serviceTier?: string | null
): { exact: string; rates: ModelRates; label: string } {
  const { label, rates: base } = ratesForModel(model);
  const rates = applyServiceTier(base, serviceTier);
  const parts = [
    costFromTokens(tokens.uncachedInput, rates.input),
    costFromTokens(tokens.cacheRead, rates.cacheRead),
    costFromTokens(tokens.cacheCreation5m, rates.cacheWrite5m),
    costFromTokens(tokens.cacheCreation1h, rates.cacheWrite1h),
    costFromTokens(tokens.output, rates.output),
  ];
  return { exact: addCosts(...parts), rates, label };
}
