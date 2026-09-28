export function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2,
  }).format(n);
}

export function formatCount(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatRatio(n: number | null, suffix = "x") {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(n >= 10 ? 1 : 2)}${suffix}`;
}

export function formatPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function formatMonths(n: number | null) {
  if (n == null) return "—";
  if (!Number.isFinite(n) || n >= 600) return "∞";
  return `${n.toFixed(n >= 10 ? 0 : 1)} meses`;
}

export function formatMetricValue(
  value: number | null,
  format: "money" | "count" | "pct" | "ratio" | "months" | "decimal"
) {
  if (value == null) return "—";
  if (format === "months") return formatMonths(value);
  if (!Number.isFinite(value)) return "—";
  if (format === "money") return formatMoney(value);
  if (format === "count") return formatCount(value);
  if (format === "pct") return formatPct(value);
  if (format === "ratio") return formatRatio(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--foreground)]";
  return (
    <div className="rounded-xl bg-white p-4">
      <p className="text-[12px] font-medium text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold tracking-tight ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--muted-soft)]">{hint}</p> : null}
    </div>
  );
}

export function Sparkline({
  points,
  stroke = "var(--accent)",
}: {
  points: { date: string; value: number }[];
  stroke?: string;
}) {
  const w = 560;
  const h = 160;
  const pad = 8;
  const vals = points.map((p) => p.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = Math.max(max - min, 1);

  if (points.length < 2) {
    return (
      <div className="flex h-[160px] items-center justify-center text-[13px] text-[var(--muted-soft)]">
        Sin datos de gráfica para este periodo
      </div>
    );
  }

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[160px] w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

export function kindLabel(kind: "revenue" | "cost" | "mixed") {
  if (kind === "revenue") return "Ingresos";
  if (kind === "cost") return "Gastos";
  return "Mixto";
}
