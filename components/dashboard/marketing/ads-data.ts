"use client";

import { useMemo } from "react";
import {
  daysAgo,
  derived,
  isoDay,
  money,
  sumMetrics,
  type AdCampaign,
  type AdCreative,
  type AdMetricRow,
  type AdTotals,
} from "@/lib/marketing/types";
import { useLoad } from "./ui";

export type AdsData = { campaigns: AdCampaign[]; creatives: AdCreative[]; metrics: AdMetricRow[] };

export function useAds(projectId: string) {
  return useLoad<AdsData>(`/api/projects/${projectId}/ads`, { campaigns: [], creatives: [], metrics: [] });
}

/** Rows inside [today - days + 1, today] and the equally long period right before it. */
export function usePeriod(metrics: AdMetricRow[], days: number) {
  return useMemo(() => {
    const start = isoDay(daysAgo(days - 1));
    const prevStart = isoDay(daysAgo(days * 2 - 1));
    const current = metrics.filter((m) => m.day >= start);
    const previous = metrics.filter((m) => m.day >= prevStart && m.day < start);
    return { start, current, previous, totals: sumMetrics(current), prevTotals: sumMetrics(previous) };
  }, [metrics, days]);
}

export function change(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

export function dailySeries(rows: AdMetricRow[], days: number) {
  const byDay = groupTotals(rows, (r) => r.day);
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(daysAgo(days - 1 - i));
    const t = byDay.get(day);
    return { day, bar: t?.spend ?? 0, line: t?.revenue ?? 0 };
  });
}

export function groupTotals(rows: AdMetricRow[], key: (r: AdMetricRow) => string | null) {
  const map = new Map<string, AdMetricRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return new Map([...map].map(([k, list]) => [k, sumMetrics(list)]));
}

export type Insight = { tone: "good" | "bad" | "info"; title: string; text: string };

export function buildInsights(campaigns: AdCampaign[], metrics: AdMetricRow[], days: number): Insight[] {
  const start = isoDay(daysAgo(days - 1));
  const recentStart = isoDay(daysAgo(2));
  const out: Insight[] = [];
  for (const c of campaigns) {
    const rows = metrics.filter((m) => m.campaign_id === c.id && m.day >= start);
    const t = sumMetrics(rows);
    const d = derived(t);
    if (c.status === "active" && !metrics.some((m) => m.campaign_id === c.id && m.day >= recentStart)) {
      out.push({ tone: "info", title: `${c.name}: sin datos recientes`, text: "Está activa pero no tiene métricas de los últimos 3 días. Regístralas o importa el CSV para no decidir a ciegas." });
    }
    if (t.spend < 20) continue;
    if (c.target_cpa && d.cpa != null && d.cpa > c.target_cpa * 1.3) {
      out.push({
        tone: "bad",
        title: `${c.name}: CPA ${Math.round((d.cpa / c.target_cpa - 1) * 100)}% sobre el objetivo`,
        text: `Pagas ${money(d.cpa, c.currency)} por conversión (objetivo ${money(c.target_cpa, c.currency)}). Pausa los creativos con peor CTR y prueba nuevos hooks.`,
      });
    } else if (d.roas != null && d.roas >= 3 && c.status === "active") {
      out.push({
        tone: "good",
        title: `${c.name}: ROAS ${d.roas.toFixed(1)}x`,
        text: `Es rentable. Sube el presupuesto diario un 20% (de ${money(c.daily_budget, c.currency)} a ${money(c.daily_budget * 1.2, c.currency)}) y vigila que el CPA se mantenga.`,
      });
    } else if (d.roas != null && d.roas < 1 && t.spend >= 100) {
      out.push({
        tone: "bad",
        title: `${c.name}: pierde dinero (ROAS ${d.roas.toFixed(2)}x)`,
        text: `Has gastado ${money(t.spend, c.currency)} y recuperado ${money(t.revenue, c.currency)}. Revisa la audiencia y la landing, o pausa hasta tener un creativo ganador.`,
      });
    }
    if (d.ctr != null && t.impressions > 5000 && d.ctr < 0.7) {
      out.push({ tone: "bad", title: `${c.name}: CTR bajo (${d.ctr.toFixed(2)}%)`, text: "Los anuncios no detienen el scroll. Cambia los primeros 3 segundos: hook más directo, texto en pantalla y cara humana." });
    }
    if (c.total_budget && t.spend > 0) {
      const all = sumMetrics(metrics.filter((m) => m.campaign_id === c.id));
      if (all.spend >= c.total_budget * 0.9) {
        out.push({ tone: "info", title: `${c.name}: presupuesto casi agotado`, text: `Lleva ${money(all.spend, c.currency)} de ${money(c.total_budget, c.currency)} (${Math.round((all.spend / c.total_budget) * 100)}%).` });
      }
    }
  }
  return out.slice(0, 6);
}

// ---------- CSV import ----------

const HEADERS: Record<keyof AdTotals | "day", string[]> = {
  day: ["day", "date", "fecha", "dia", "día", "reporting starts", "inicio del informe", "by day"],
  spend: ["spend", "amount spent", "importe gastado", "gasto", "cost", "coste", "costo", "inversión", "inversion"],
  impressions: ["impressions", "impresiones", "impr."],
  clicks: ["clicks", "link clicks", "clics", "clics en el enlace", "clicks (all)"],
  conversions: ["conversions", "results", "resultados", "conversiones", "purchases", "compras", "installs", "instalaciones"],
  revenue: [
    "revenue",
    "purchases conversion value",
    "purchase conversion value",
    "website purchases conversion value",
    "valor de conversión de compras",
    "ingresos",
    "conv. value",
    "conversion value",
    "total purchase value",
    "valor",
  ],
};

/** Exact alias matches win (in priority order); prefix matches skip ratio columns like "cost per result". */
function findColumn(header: string[], aliases: string[]) {
  for (const alias of aliases) {
    const i = header.indexOf(alias);
    if (i >= 0) return i;
  }
  for (const alias of aliases) {
    const i = header.findIndex((h) => h.startsWith(alias) && !/\b(per|por)\b/.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** `decimalComma` is true for semicolon-separated files, which European spreadsheets export with "1.234,50". */
function parseNumber(raw: string, decimalComma: boolean) {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (decimalComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string) {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export type ParsedRow = { day: string } & AdTotals;

export function parseMetricsCsv(text: string): { rows: ParsedRow[]; missing: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], missing: ["cabecera + filas"] };
  const sep = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim());
  const index = {} as Record<keyof typeof HEADERS, number>;
  for (const key of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) {
    index[key] = findColumn(header, HEADERS[key]);
  }
  const missing = (["day", "spend"] as const).filter((k) => index[k] < 0).map((k) => (k === "day" ? "fecha" : "gasto"));
  if (missing.length) return { rows: [], missing };

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep);
    const day = parseDate(cells[index.day] ?? "");
    if (!day) continue;
    const val = (k: keyof AdTotals) => (index[k] >= 0 ? parseNumber(cells[index[k]] ?? "", sep === ";") : 0);
    rows.push({ day, spend: val("spend"), impressions: val("impressions"), clicks: val("clicks"), conversions: val("conversions"), revenue: val("revenue") });
  }
  const merged = new Map<string, ParsedRow>();
  for (const r of rows) {
    const prev = merged.get(r.day);
    merged.set(r.day, prev ? { day: r.day, ...sumMetrics([prev, r]) } : r);
  }
  return { rows: [...merged.values()].sort((a, b) => a.day.localeCompare(b.day)), missing: [] };
}
