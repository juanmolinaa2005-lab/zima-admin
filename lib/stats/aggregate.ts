import { fetchClaudeUsageReport } from "@/lib/claude/admin";
import { getAnthropicAdminKey, getAnthropicConnectionStatus } from "@/lib/claude/user-key";
import { fetchOpenAIUsageReport } from "@/lib/openai/admin";
import { getOpenAIAdminKey, getOpenAIConnectionStatus } from "@/lib/openai/user-key";
import {
  fetchSuperwallBillingReport,
  listSuperwallApplications,
} from "@/lib/superwall/admin";
import {
  getSuperwallApiKey,
  getSuperwallConnectionStatus,
} from "@/lib/superwall/user-key";
import { executeFetchSpec } from "./execute";
import type {
  AllBreakdown,
  AllDashboard,
  AllMetricCard,
  AllMetricGroup,
  PlatformSnapshot,
  StatsSource,
  UnifiedMetric,
} from "./types";

function metric(
  id: string,
  label: string,
  value: number,
  kind: UnifiedMetric["kind"],
  unit: UnifiedMetric["unit"] = kind === "count" ? "count" : "usd"
): UnifiedMetric {
  return { id, label, value, kind, unit };
}

export async function snapshotBuiltin(
  slug: "superwall" | "openai" | "claude",
  source: StatsSource,
  days: number
): Promise<PlatformSnapshot> {
  try {
    if (slug === "superwall") {
      const status = await getSuperwallConnectionStatus();
      if (!status.connected || !status.orgId) {
        return {
          sourceId: source.id,
          slug,
          name: source.name,
          kind: source.kind,
          builtin: slug,
          metrics: [],
          series: [],
          error: "Conecta Superwall para ver ingresos.",
        };
      }
      const apiKey = await getSuperwallApiKey();
      if (!apiKey) throw new Error("Falta la API key de Superwall.");
      const apps = await listSuperwallApplications(apiKey, status.orgId);
      const applicationId = status.applicationId || apps[0]?.id;
      if (!applicationId) {
        return {
          sourceId: source.id,
          slug,
          name: source.name,
          kind: source.kind,
          builtin: slug,
          metrics: [],
          series: [],
          error: "No hay aplicaciones en esta organización de Superwall.",
        };
      }
      const app = apps.find((a) => a.id === applicationId);
      const report = await fetchSuperwallBillingReport(
        apiKey,
        applicationId,
        days,
        app?.name ?? null
      );
      return {
        sourceId: source.id,
        slug,
        name: source.name,
        kind: "revenue",
        builtin: slug,
        metrics: [
          metric("grossProceeds", "Gross proceeds", report.grossProceeds, "revenue"),
          metric("netProceeds", "Net proceeds", report.netProceeds, "revenue"),
          metric("revenue", "Revenue", report.netProceeds, "revenue"),
          metric("newUsers", "New users", report.newUsers, "count"),
          metric("mrr", "MRR", report.mrr, "revenue"),
          metric("arr", "ARR", report.mrr * 12, "revenue"),
          metric("activeSubscriptions", "Active subs", report.activeSubscriptions, "count"),
          metric("payingUsers", "Paying users", report.activeSubscriptions, "count"),
        ],
        series: report.series.map((p) => ({
          date: p.date,
          value: p.value,
          kind: "revenue" as const,
        })),
      };
    }

    if (slug === "openai") {
      const status = await getOpenAIConnectionStatus();
      if (!status.connected) {
        return {
          sourceId: source.id,
          slug,
          name: source.name,
          kind: source.kind,
          builtin: slug,
          metrics: [],
          series: [],
          error: "Conecta OpenAI Admin para ver el gasto.",
        };
      }
      const key = await getOpenAIAdminKey();
      if (!key) throw new Error("Falta la Admin key de OpenAI.");
      const capped = Math.min(days, 31);
      const ending = new Date();
      ending.setUTCHours(23, 59, 59, 999);
      const starting = new Date(ending.getTime() - capped * 24 * 60 * 60 * 1000);
      starting.setUTCHours(0, 0, 0, 0);
      const report = await fetchOpenAIUsageReport(key, {
        startingAt: starting,
        endingAt: ending,
        days: capped,
      });
      return {
        sourceId: source.id,
        slug,
        name: source.name,
        kind: "cost",
        builtin: slug,
        metrics: [
          metric("spend", "AI spend", report.totals.costUsd, "cost"),
          metric("cost", "Cost", report.totals.costUsd, "cost"),
          metric("requests", "Requests", report.totals.requests, "count"),
          metric("tokens", "Tokens", report.totals.totalTokens, "count"),
        ],
        series: report.byDay.map((d) => ({
          date: d.date,
          value: d.costUsd,
          kind: "cost" as const,
        })),
      };
    }

    const status = await getAnthropicConnectionStatus();
    if (!status.connected) {
      return {
        sourceId: source.id,
        slug,
        name: source.name,
        kind: source.kind,
        builtin: slug,
        metrics: [],
        series: [],
        error: "Conecta Claude Admin para ver el gasto.",
      };
    }
    const key = await getAnthropicAdminKey();
    if (!key) throw new Error("Falta la Admin key de Anthropic.");
    const capped = Math.min(days, 31);
    const ending = new Date();
    ending.setUTCHours(23, 59, 59, 999);
    const starting = new Date(ending.getTime() - capped * 24 * 60 * 60 * 1000);
    starting.setUTCHours(0, 0, 0, 0);
    const report = await fetchClaudeUsageReport(key, {
      startingAt: starting.toISOString(),
      endingAt: ending.toISOString(),
      bucketWidth: "1d",
    });
    return {
      sourceId: source.id,
      slug,
      name: source.name,
      kind: "cost",
      builtin: slug,
      metrics: [
        metric("spend", "AI spend", report.totals.claudeCostUsd, "cost"),
        metric("cost", "Cost", report.totals.claudeCostUsd, "cost"),
        metric("tokens", "Tokens", report.totals.totalTokens, "count"),
      ],
      series: report.byDay.map((d) => ({
        date: d.date,
        value: d.claudeCostUsd,
        kind: "cost" as const,
      })),
    };
  } catch (e) {
    return {
      sourceId: source.id,
      slug,
      name: source.name,
      kind: source.kind,
      builtin: slug,
      metrics: [],
      series: [],
      error: e instanceof Error ? e.message : "No se pudieron cargar las métricas.",
    };
  }
}

export async function snapshotCustom(
  source: StatsSource,
  spec: Parameters<typeof executeFetchSpec>[0],
  credentials: Record<string, string>,
  days: number
): Promise<PlatformSnapshot> {
  try {
    const { metrics } = await executeFetchSpec(spec, credentials, days);
    return {
      sourceId: source.id,
      slug: source.slug,
      name: source.name,
      kind: source.kind,
      builtin: null,
      metrics,
      series: [],
    };
  } catch (e) {
    return {
      sourceId: source.id,
      slug: source.slug,
      name: source.name,
      kind: source.kind,
      builtin: null,
      metrics: [],
      series: [],
      error: e instanceof Error ? e.message : "No se pudieron cargar las métricas.",
    };
  }
}

function normId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findNamed(metrics: UnifiedMetric[], aliases: string[]): UnifiedMetric | undefined {
  const wanted = new Set(aliases.map(normId));
  return metrics.find((m) => wanted.has(normId(m.id)) || wanted.has(normId(m.label)));
}

function sumNamed(platforms: PlatformSnapshot[], aliases: string[]): number | null {
  let found = false;
  let total = 0;
  for (const p of platforms) {
    const hit = findNamed(p.metrics, aliases);
    if (!hit) continue;
    found = true;
    total += hit.value;
  }
  return found ? total : null;
}

function firstNamed(platforms: PlatformSnapshot[], aliases: string[]): number | null {
  for (const p of platforms) {
    const hit = findNamed(p.metrics, aliases);
    if (hit) return hit.value;
  }
  return null;
}

function asRate(n: number | null): number | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100;
  return null;
}

function ratio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0 || !Number.isFinite(num) || !Number.isFinite(den)) {
    return null;
  }
  return num / den;
}

function moneyTone(n: number | null): "good" | "bad" | undefined {
  if (n == null) return undefined;
  return n >= 0 ? "good" : "bad";
}

function growthTone(n: number | null): "good" | "bad" | undefined {
  if (n == null) return undefined;
  return n >= 0 ? "good" : "bad";
}

function platformRevenue(p: PlatformSnapshot): number {
  const exact = findNamed(p.metrics, [
    "revenue",
    "totalRevenue",
    "ingresos",
    "ingresosTotales",
    "netProceeds",
    "netRevenue",
    "ingresosNetos",
  ]);
  if (exact) return exact.value;
  const gross = findNamed(p.metrics, ["grossProceeds", "grossRevenue", "ingresosBrutos", "gross"]);
  if (gross) return gross.value;
  const skip = new Set(["mrr", "arr", "ltv", "arpu", "arppu"]);
  const revs = p.metrics.filter((m) => m.kind === "revenue" && !skip.has(normId(m.id)));
  if (revs.length === 0) return 0;
  return Math.max(...revs.map((m) => m.value));
}

function platformCost(p: PlatformSnapshot): number {
  const exact = findNamed(p.metrics, ["cost", "spend", "totalCost", "costos", "costosTotales"]);
  if (exact) return exact.value;
  const costs = p.metrics.filter((m) => m.kind === "cost");
  if (costs.length === 0) return 0;
  const unique = [...new Set(costs.map((c) => c.value.toFixed(4)))];
  if (unique.length === 1) return costs[0].value;
  return costs.reduce((a, b) => a + b.value, 0);
}

function classifyCostBucket(
  p: PlatformSnapshot
): "marketing" | "infra" | "software" | "payments" | "other" {
  const key = `${p.slug} ${p.name} ${p.builtin ?? ""}`.toLowerCase();
  if (p.builtin === "openai" || p.builtin === "claude") return "software";
  if (/openai|anthropic|claude|replicate|fal|higgsfield|kling|eleven/.test(key)) return "software";
  if (/meta|facebook|googleads|admob|tiktok|applovin|unityads|ironsource|marketing|ads/.test(key)) {
    return "marketing";
  }
  if (/vercel|aws|amazon|gcp|cloudflare|railway|render|digitalocean|hetzner|supabase|infra/.test(key)) {
    return "infra";
  }
  if (/stripe|paypal|adyen|braintree|checkout|payment/.test(key)) return "payments";
  return "other";
}

function seriesByKind(
  platforms: PlatformSnapshot[],
  kind: "revenue" | "cost"
): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const p of platforms) {
    for (const point of p.series) {
      if (point.kind !== kind) continue;
      map.set(point.date, (map.get(point.date) ?? 0) + point.value);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function halfGrowth(points: { value: number }[]): number | null {
  if (points.length < 4) return null;
  const mid = Math.floor(points.length / 2);
  const first = points.slice(0, mid).reduce((a, b) => a + b.value, 0);
  const second = points.slice(mid).reduce((a, b) => a + b.value, 0);
  if (first === 0) return second > 0 ? 1 : null;
  return (second - first) / first;
}

function windowGrowth(points: { date: string; value: number }[], windowDays: number): number | null {
  if (points.length < windowDays * 2 * 0.7) return null;
  const last = points.slice(-windowDays);
  const prev = points.slice(-windowDays * 2, -windowDays);
  if (last.length < windowDays * 0.6 || prev.length < windowDays * 0.6) return null;
  const a = prev.reduce((s, p) => s + p.value, 0);
  const b = last.reduce((s, p) => s + p.value, 0);
  if (a === 0) return b > 0 ? 1 : null;
  return (b - a) / a;
}

function breakdownRows(
  items: { name: string; value: number }[],
  total: number
): AllBreakdown["rows"] {
  return items
    .filter((row) => row.value !== 0)
    .sort((a, b) => b.value - a.value)
    .map((row) => ({
      name: row.name,
      value: row.value,
      share: total > 0 ? row.value / total : null,
    }));
}

function card(
  id: string,
  label: string,
  value: number | null,
  format: AllMetricCard["format"],
  hint?: string,
  tone?: AllMetricCard["tone"]
): AllMetricCard {
  return { id, label, value, format, hint, tone };
}

export function rollupAll(days: number, platforms: PlatformSnapshot[]): AllDashboard {
  const revenue = platforms.reduce((a, p) => a + platformRevenue(p), 0);
  const cost = platforms.reduce((a, p) => a + platformCost(p), 0);
  const profit = revenue - cost;
  const monthFactor = days > 0 ? 30 / days : 1;
  const monthlyRevenue = revenue * monthFactor;
  const monthlyCost = cost * monthFactor;

  const namedGross = sumNamed(platforms, ["grossProceeds", "grossRevenue", "ingresosBrutos", "gross"]);
  const namedNet = sumNamed(platforms, ["netProceeds", "netRevenue", "ingresosNetos"]);
  const refunds = sumNamed(platforms, ["refunds", "refund", "reembolsos"]);
  const mrr = sumNamed(platforms, ["mrr"]) ?? 0;
  const namedArr = sumNamed(platforms, ["arr"]);
  const arr = namedArr ?? (mrr > 0 ? mrr * 12 : null);
  const fixedCosts = sumNamed(platforms, ["fixedCosts", "costosFijos", "opex"]);
  const variableCosts = sumNamed(platforms, ["variableCosts", "costosVariables", "cogs"]);
  const namedMarketing = sumNamed(platforms, ["marketing", "adSpend", "ads", "marketingSpend", "gastoMarketing"]);
  const namedInfra = sumNamed(platforms, ["infrastructure", "infra", "hosting", "aws"]);
  const namedSoftware = sumNamed(platforms, ["software", "vendors", "saas", "vendorCost"]);
  const namedFees = sumNamed(platforms, ["paymentFees", "processingFees", "stripeFees", "fees"]);

  const bucketCost = {
    marketing: 0,
    infra: 0,
    software: 0,
    payments: 0,
    other: 0,
  };
  for (const p of platforms) {
    const amount = platformCost(p);
    if (amount <= 0) continue;
    bucketCost[classifyCostBucket(p)] += amount;
  }

  const marketing = namedMarketing ?? (bucketCost.marketing > 0 ? bucketCost.marketing : null);
  const infraCost = namedInfra ?? (bucketCost.infra > 0 ? bucketCost.infra : null);
  const softwareCost = namedSoftware ?? (bucketCost.software > 0 ? bucketCost.software : null);
  const paymentFees = namedFees ?? (bucketCost.payments > 0 ? bucketCost.payments : null);

  const totalUsers = sumNamed(platforms, ["totalUsers", "users", "usuarios", "usuariosTotales"]);
  const activeUsers = sumNamed(platforms, ["activeUsers", "usuariosActivos"]);
  const payingUsers = sumNamed(platforms, [
    "payingUsers",
    "subscribers",
    "activeSubscriptions",
    "usuariosPago",
    "usuariosdepago",
  ]);
  const namedFree = sumNamed(platforms, ["freeUsers", "usuariosGratuitos"]);
  const newUsers = sumNamed(platforms, ["newUsers", "installs", "nuevosUsuarios"]) ?? 0;
  const dau = sumNamed(platforms, ["dau"]);
  const wau = sumNamed(platforms, ["wau"]);
  const mau = sumNamed(platforms, ["mau"]);
  const sessionsPerUser = firstNamed(platforms, ["sessionsPerUser", "sesionesPorUsuario"]);
  const usageFrequency = firstNamed(platforms, ["usageFrequency", "frequency", "frecuenciaDeUso"]);
  const cash = sumNamed(platforms, ["cash", "cashBalance", "balance"]);
  const namedRunway = firstNamed(platforms, ["runway"]);

  const freeUsers =
    namedFree ??
    (totalUsers != null && payingUsers != null ? Math.max(0, totalUsers - payingUsers) : null);
  const usersForArpu = totalUsers || activeUsers || payingUsers || (newUsers > 0 ? newUsers : null);
  const usersActive = activeUsers ?? mau ?? wau ?? dau ?? payingUsers;
  const conversion =
    asRate(firstNamed(platforms, ["conversionRate", "conversion", "tasaDeConversion"])) ??
    ratio(payingUsers, totalUsers) ??
    ratio(payingUsers, newUsers > 0 ? newUsers : null);
  const activation = asRate(
    firstNamed(platforms, ["activationRate", "activation", "tasaDeActivacion"])
  );
  const retention = asRate(firstNamed(platforms, ["retention", "retentionRate", "retencion"]));
  const churn =
    asRate(firstNamed(platforms, ["churn", "churnRate"])) ??
    (retention != null ? Math.max(0, 1 - retention) : null);
  const renewal =
    asRate(firstNamed(platforms, ["renewalRate", "renewal", "tasaDeRenovacion"])) ??
    (churn != null ? Math.max(0, 1 - churn) : null);
  const userGrowth =
    asRate(firstNamed(platforms, ["userGrowth", "crecimientoUsuarios"])) ??
    ratio(newUsers > 0 ? newUsers : null, totalUsers);

  const grossRevenue = namedGross ?? revenue;
  const netRevenue = namedNet ?? (refunds != null ? Math.max(0, grossRevenue - refunds) : revenue);
  const cogs = variableCosts ?? cost;
  const grossProfit = grossRevenue - cogs;
  const netProfit = netRevenue - cost;
  const operatingProfit =
    fixedCosts != null ? netRevenue - (variableCosts ?? 0) - fixedCosts : netProfit;
  const contribution = netRevenue - (variableCosts ?? cost);
  const contributionMargin = ratio(contribution, netRevenue);
  const grossMargin = ratio(grossProfit, grossRevenue);
  const netMargin = ratio(netProfit, netRevenue);
  const operatingMargin = ratio(operatingProfit, netRevenue);

  const revenueSeries = seriesByKind(platforms, "revenue");
  const revenueGrowth =
    asRate(firstNamed(platforms, ["revenueGrowth", "crecimientoIngresos"])) ??
    halfGrowth(revenueSeries);
  const growthMom =
    asRate(firstNamed(platforms, ["mom", "growthMom", "crecimientoMoM"])) ??
    windowGrowth(revenueSeries, 30);
  const growthYoy =
    asRate(firstNamed(platforms, ["yoy", "growthYoy", "crecimientoYoY"])) ??
    windowGrowth(revenueSeries, 365);

  const arpu = ratio(netRevenue, usersForArpu);
  const arppu = ratio(netRevenue, payingUsers);
  const revenuePerActive = ratio(netRevenue, usersActive);
  const costPerUser = ratio(cost, usersForArpu);
  const costPerActive = ratio(cost, usersActive);
  const costPerPaying = ratio(cost, payingUsers);
  const costPerAcquisition = marketing != null && newUsers > 0 ? marketing / newUsers : ratio(cost, newUsers > 0 ? newUsers : null);
  const cac = marketing != null && newUsers > 0 ? marketing / newUsers : null;
  const ltv =
    firstNamed(platforms, ["ltv"]) ??
    (payingUsers != null && mrr > 0
      ? mrr / payingUsers
      : churn != null && churn > 0 && arppu != null
        ? arppu / churn
        : null);
  const ltvCac = ratio(ltv, cac);
  const profitPerUser = ratio(netProfit, usersForArpu);
  const profitPerPaying = ratio(netProfit, payingUsers);
  const contributionPerUser = ratio(contribution, usersForArpu);
  const marginPerUser = profitPerUser;
  const burnRate = monthlyCost - monthlyRevenue;
  const monthlyBurnOut = Math.max(0, burnRate);
  const runway =
    namedRunway ??
    (cash != null && monthlyBurnOut > 0
      ? cash / monthlyBurnOut
      : cash != null && monthlyBurnOut === 0
        ? 9999
        : null);
  const roi =
    marketing != null && marketing > 0
      ? (netRevenue - marketing) / marketing
      : ratio(netProfit, cost);
  const roas = marketing != null && marketing > 0 ? netRevenue / marketing : null;
  const breakEvenRevenue = fixedCosts != null && contributionMargin && contributionMargin > 0
    ? fixedCosts / contributionMargin
    : monthlyCost;
  const breakEvenUsers = arpu && arpu > 0 ? monthlyCost / arpu : null;
  const breakEvenMrr = monthlyCost;

  const groups: AllMetricGroup[] = [
    {
      id: "ingresos",
      title: "Ingresos",
      metrics: [
        card("mrr", "MRR", mrr || null, "money", "Ingreso recurrente mensual"),
        card("arr", "ARR", arr, "money", "MRR × 12"),
        card("ingresosTotales", "Ingresos totales", revenue || null, "money", `${days}d · todas las fuentes`),
        card("ingresosBrutos", "Ingresos brutos", namedGross ?? (revenue ? grossRevenue : null), "money"),
        card("ingresosNetos", "Ingresos netos", namedNet ?? (revenue ? netRevenue : null), "money", "Tras reembolsos y fees si hay dato"),
        card("crecimientoIngresos", "Crecimiento de ingresos", revenueGrowth, "pct", "Primera vs segunda mitad del periodo", growthTone(revenueGrowth)),
        card("crecimientoMoM", "Crecimiento MoM", growthMom, "pct", "Últimos 30d vs 30d anteriores", growthTone(growthMom)),
        card("crecimientoYoY", "Crecimiento YoY", growthYoy, "pct", "Últimos 365d vs año anterior", growthTone(growthYoy)),
      ],
    },
    {
      id: "beneficio",
      title: "Beneficio y márgenes",
      metrics: [
        card("beneficioBruto", "Beneficio bruto", revenue || cost ? grossProfit : null, "money", "Ingresos brutos − costos variables", moneyTone(grossProfit)),
        card("beneficioNeto", "Beneficio neto", revenue || cost ? netProfit : null, "money", "Ingresos netos − costos", moneyTone(netProfit)),
        card("margenBruto", "Margen bruto", grossMargin, "pct", "Beneficio bruto / ingresos brutos", moneyTone(grossMargin)),
        card("margenNeto", "Margen neto", netMargin, "pct", "Beneficio neto / ingresos netos", moneyTone(netMargin)),
        card("margenOperativo", "Margen operativo", operatingMargin, "pct", moneyTone(operatingMargin)),
        card("margenContribucion", "Margen de contribución", contributionMargin, "pct", "(Ingresos − variables) / ingresos", moneyTone(contributionMargin)),
        card("margenPorUsuario", "Margen por usuario", marginPerUser, "money", "Beneficio neto / usuarios"),
        card("beneficioPorUsuario", "Beneficio por usuario", profitPerUser, "money"),
        card("beneficioPorPago", "Beneficio por usuario de pago", profitPerPaying, "money"),
        card("netContributionPerUser", "Net contribution per user", contributionPerUser, "money"),
        card("breakEvenPoint", "Break-even point", monthlyCost > 0 || fixedCosts != null ? breakEvenRevenue : null, "money", "Ingreso mensual para cubrir costos"),
        card("breakEvenUsers", "Break-even users", breakEvenUsers, "count", "Usuarios para cubrir costos mensuales"),
        card("breakEvenMrr", "Break-even MRR", monthlyCost > 0 ? breakEvenMrr : null, "money", "MRR que cubre el gasto mensual"),
      ],
    },
    {
      id: "costos",
      title: "Costos",
      metrics: [
        card("costosTotales", "Costos totales", cost || null, "money", "AI, ads y demás gastos"),
        card("costosFijos", "Costos fijos", fixedCosts, "money"),
        card("costosVariables", "Costos variables", variableCosts, "money"),
        card("costoPorUsuario", "Costo por usuario", costPerUser, "money"),
        card("costoPorActivo", "Costo por usuario activo", costPerActive, "money"),
        card("costoPorPago", "Costo por usuario de pago", costPerPaying, "money"),
        card("costoPorCliente", "Costo por cliente", costPerPaying, "money", "Costo / usuarios de pago"),
        card("costoPorAdquisicion", "Costo por adquisición", costPerAcquisition, "money", "Marketing o costo / nuevos"),
        card("costoInfra", "Costo de infraestructura", infraCost, "money"),
        card("costoSoftware", "Costo de software/proveedores", softwareCost, "money"),
        card("costoPagos", "Costo de procesamiento de pagos", paymentFees, "money"),
        card("reembolsos", "Reembolsos", refunds, "money"),
      ],
    },
    {
      id: "usuarios",
      title: "Usuarios",
      metrics: [
        card("usuariosTotales", "Usuarios totales", totalUsers, "count"),
        card("usuariosActivos", "Usuarios activos", usersActive, "count"),
        card("usuariosPago", "Usuarios de pago", payingUsers, "count"),
        card("usuariosGratuitos", "Usuarios gratuitos", freeUsers, "count"),
        card("nuevosUsuarios", "Nuevos usuarios", newUsers || null, "count"),
        card("dau", "DAU", dau, "count", "Daily active users"),
        card("wau", "WAU", wau, "count", "Weekly active users"),
        card("mau", "MAU", mau, "count", "Monthly active users"),
        card("crecimientoUsuarios", "Crecimiento de usuarios", userGrowth, "pct", growthTone(userGrowth)),
        card("conversion", "Tasa de conversión", conversion, "pct"),
        card("activacion", "Tasa de activación", activation, "pct"),
        card("retencion", "Retención", retention, "pct"),
        card("churn", "Churn", churn, "pct"),
        card("renovacion", "Tasa de renovación", renewal, "pct"),
        card("sesiones", "Sesiones por usuario", sessionsPerUser, "decimal"),
        card("frecuencia", "Frecuencia de uso", usageFrequency, "decimal"),
      ],
    },
    {
      id: "unit",
      title: "Unit economics",
      metrics: [
        card("arpu", "ARPU", arpu, "money", "Revenue / users"),
        card("arppu", "ARPPU", arppu, "money", "Revenue / usuarios de pago"),
        card("cac", "CAC", cac, "money", "Gasto en marketing / nuevos"),
        card("ltv", "LTV", ltv, "money", "MRR / usuarios de pago, o ARPPU / churn"),
        card("ltvCac", "LTV/CAC", ltvCac, "ratio"),
        card("rpu", "Revenue per user", arpu, "money"),
        card("rpau", "Revenue per active user", revenuePerActive, "money"),
      ],
    },
    {
      id: "cash",
      title: "Cash y marketing",
      metrics: [
        card("burn", "Burn rate", cost || revenue ? monthlyBurnOut : null, "money", "Quema neta mensual"),
        card("runway", "Runway", runway, "months", "Cash / burn mensual"),
        card("cash", "Cash balance", cash, "money"),
        card("marketing", "Gasto en marketing", marketing, "money"),
        card("roi", "ROI", roi, "ratio", "Retorno sobre marketing o sobre costo"),
        card("roas", "ROAS", roas, "ratio", "Ingresos / gasto en marketing"),
      ],
    },
  ];

  const revenueByPlatform = breakdownRows(
    platforms.map((p) => ({ name: p.name, value: platformRevenue(p) })),
    revenue
  );
  const costByVendor = breakdownRows(
    platforms.map((p) => ({ name: p.name, value: platformCost(p) })),
    cost
  );
  const revenueByPlan = breakdownRows(
    platforms.flatMap((p) =>
      p.metrics
        .filter((m) => /^(plan|producto|product)[:_-]/i.test(m.id) || /plan|producto/i.test(m.label))
        .filter((m) => m.kind === "revenue")
        .map((m) => ({ name: m.label || m.id, value: m.value }))
    ),
    revenue
  );
  const revenueByCountry = breakdownRows(
    platforms.flatMap((p) =>
      p.metrics
        .filter((m) => /^(country|pais|país|geo)[:_-]/i.test(m.id) || /país|pais|country/i.test(m.label))
        .map((m) => ({ name: m.label || m.id, value: m.value }))
    ),
    revenue
  );

  const breakdowns: AllBreakdown[] = [
    {
      id: "porPlataforma",
      title: "Ingresos por plataforma",
      format: "money",
      showShare: true,
      rows: revenueByPlatform,
    },
    {
      id: "porPlan",
      title: "Ingresos por plan",
      hint: "Si el conector envía métricas plan:…",
      format: "money",
      showShare: true,
      rows: revenueByPlan,
    },
    {
      id: "porPais",
      title: "Ingresos por país",
      hint: "Si el conector envía métricas country:…",
      format: "money",
      showShare: true,
      rows: revenueByCountry,
    },
    {
      id: "proveedores",
      title: "Gasto por proveedor",
      hint: "Costo y porcentaje del gasto",
      format: "money",
      showShare: true,
      rows: costByVendor,
    },
  ];

  return {
    days,
    revenue,
    cost,
    profit,
    groups,
    breakdowns,
    platforms,
  };
}
