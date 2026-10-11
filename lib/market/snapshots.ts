import { createAdminClient } from "@/lib/supabase/admin";
import { appDetail, chartIds, MARKET_COUNTRIES, type MarketAppDetail, type MarketChart } from "./appstore";

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/* ---------------- charts ---------------- */

export async function saveChartSnapshot(chart: MarketChart, country: string, genre: string | null, ids: string[]) {
  if (ids.length === 0) return;
  try {
    const admin = await createAdminClient();
    await admin
      .from("market_chart_snapshots")
      .upsert({ country, genre: genre ?? "", chart, day: today(), ids }, { onConflict: "country,genre,chart,day" });
  } catch {
    /* snapshots are best-effort */
  }
}

export type ChartHistory = { day: string; ids: string[] }[];

export async function chartHistory(chart: MarketChart, country: string, genre: string | null, days = 30): Promise<ChartHistory> {
  try {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("market_chart_snapshots")
      .select("day, ids")
      .eq("country", country)
      .eq("genre", genre ?? "")
      .eq("chart", chart)
      .gte("day", daysAgo(days))
      .order("day", { ascending: true });
    return (data ?? []) as ChartHistory;
  } catch {
    return [];
  }
}

/** Movement vs the previous day on record and the daily rank series for each app. */
export function chartMovement(currentIds: string[], history: ChartHistory) {
  const day = today();
  const past = history.filter((row) => row.day !== day);
  const previous = past.at(-1) ?? null;
  const series = [...past, { day, ids: currentIds }];
  const result: Record<string, { change: number | null; isNew: boolean; trend: (number | null)[] }> = {};
  currentIds.forEach((id, index) => {
    const before = previous ? previous.ids.indexOf(id) : -2;
    result[id] = {
      change: before >= 0 ? before - index : null,
      isNew: before === -1,
      trend: series.map((row) => {
        const position = row.ids.indexOf(id);
        return position >= 0 ? position + 1 : null;
      }),
    };
  });
  return { movement: result, previousDay: previous?.day ?? null, days: series.length };
}

/* ---------------- apps ---------------- */

export type AppSnapshot = {
  name: string;
  version: string;
  releaseNotes: string;
  updatedAt: string | null;
  rating: number | null;
  ratingCount: number;
  price: number;
  icon: string | null;
  screenshots: string[];
  description: string;
  freeRank: number | null;
  grossingRank: number | null;
};

async function chartRankMap(country: string) {
  const [free, grossing] = await Promise.all([
    chartIds("free", country, null, 100),
    chartIds("grossing", country, null, 100),
  ]);
  return {
    free: new Map(free.map((entry, index) => [entry.id, index + 1])),
    grossing: new Map(grossing.map((entry, index) => [entry.id, index + 1])),
  };
}

function toSnapshot(app: MarketAppDetail, ranks: Awaited<ReturnType<typeof chartRankMap>>): AppSnapshot {
  return {
    name: app.name,
    version: app.version,
    releaseNotes: app.releaseNotes.slice(0, 4000),
    updatedAt: app.updatedAt,
    rating: app.rating,
    ratingCount: app.ratingCount,
    price: app.price,
    icon: app.icon,
    screenshots: app.screenshots,
    description: app.description.slice(0, 6000),
    freeRank: ranks.free.get(app.id) ?? null,
    grossingRank: ranks.grossing.get(app.id) ?? null,
  };
}

/** Captures today's state for each app (once per day) and returns the stored history. */
export async function captureApps(appIds: string[], country: string) {
  const ids = [...new Set(appIds)].slice(0, 60);
  if (ids.length === 0) return new Map<string, { day: string; data: AppSnapshot }[]>();
  const admin = await createAdminClient();
  const { data: existing } = await admin
    .from("market_app_snapshots")
    .select("app_id")
    .eq("country", country)
    .eq("day", today())
    .in("app_id", ids);
  const done = new Set((existing ?? []).map((row) => row.app_id as string));
  const missing = ids.filter((id) => !done.has(id));
  if (missing.length) {
    const ranks = await chartRankMap(country);
    const details = await Promise.all(missing.map((id) => appDetail(id, country)));
    const rows = details
      .filter((detail): detail is MarketAppDetail => Boolean(detail))
      .map((detail) => ({ app_id: detail.id, country, day: today(), data: toSnapshot(detail, ranks) }));
    if (rows.length) await admin.from("market_app_snapshots").upsert(rows, { onConflict: "app_id,country,day" });
  }
  const { data: history } = await admin
    .from("market_app_snapshots")
    .select("app_id, day, data")
    .eq("country", country)
    .in("app_id", ids)
    .gte("day", daysAgo(120))
    .order("day", { ascending: true });
  const byApp = new Map<string, { day: string; data: AppSnapshot }[]>();
  for (const row of history ?? []) {
    const list = byApp.get(row.app_id as string) ?? [];
    list.push({ day: row.day as string, data: row.data as AppSnapshot });
    byApp.set(row.app_id as string, list);
  }
  return byApp;
}

export type TimelineEvent = {
  appId: string;
  day: string;
  type: "launch" | "version" | "rating" | "ratings" | "price" | "name" | "icon" | "screenshots" | "description" | "rank";
  title: string;
  detail?: string;
  tone: "neutral" | "up" | "down";
};

function priceLabel(value: number) {
  return value ? `$${value.toFixed(2)}` : "Gratis";
}

export function buildTimeline(appId: string, history: { day: string; data: AppSnapshot }[], releasedAt: string | null) {
  const events: TimelineEvent[] = [];
  if (releasedAt) {
    events.push({ appId, day: releasedAt.slice(0, 10), type: "launch", title: "Lanzamiento en la App Store", tone: "neutral" });
  }
  const first = history[0]?.data;
  if (first?.updatedAt && first.version) {
    events.push({
      appId,
      day: first.updatedAt.slice(0, 10),
      type: "version",
      title: `Versión ${first.version}`,
      detail: first.releaseNotes || undefined,
      tone: "neutral",
    });
  }
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1].data;
    const next = history[i].data;
    const day = history[i].day;
    if (next.version && next.version !== prev.version) {
      events.push({
        appId,
        day: next.updatedAt?.slice(0, 10) || day,
        type: "version",
        title: `Versión ${next.version}`,
        detail: next.releaseNotes || undefined,
        tone: "neutral",
      });
    }
    if (next.name !== prev.name) {
      events.push({ appId, day, type: "name", title: "Cambió el nombre", detail: `${prev.name} → ${next.name}`, tone: "neutral" });
    }
    if (next.icon && prev.icon && next.icon !== prev.icon) {
      events.push({ appId, day, type: "icon", title: "Cambió el ícono", tone: "neutral" });
    }
    if (next.screenshots.join("|") !== prev.screenshots.join("|")) {
      events.push({ appId, day, type: "screenshots", title: "Actualizó las capturas de la tienda", tone: "neutral" });
    }
    if (next.description && prev.description && next.description !== prev.description) {
      events.push({ appId, day, type: "description", title: "Editó la descripción", tone: "neutral" });
    }
    if (next.price !== prev.price) {
      events.push({
        appId,
        day,
        type: "price",
        title: "Cambió el precio",
        detail: `${priceLabel(prev.price)} → ${priceLabel(next.price)}`,
        tone: next.price < prev.price ? "up" : "down",
      });
    }
    if (prev.rating !== null && next.rating !== null && Math.abs(next.rating - prev.rating) >= 0.05) {
      events.push({
        appId,
        day,
        type: "rating",
        title: `Rating ${prev.rating.toFixed(2)} → ${next.rating.toFixed(2)}`,
        tone: next.rating > prev.rating ? "up" : "down",
      });
    }
    const gained = next.ratingCount - prev.ratingCount;
    if (prev.ratingCount && gained / prev.ratingCount >= 0.02 && gained >= 50) {
      events.push({
        appId,
        day,
        type: "ratings",
        title: `+${gained.toLocaleString("es")} calificaciones`,
        tone: "up",
      });
    }
    for (const [key, label] of [
      ["freeRank", "top gratis"],
      ["grossingRank", "top ingresos"],
    ] as const) {
      const a = prev[key];
      const b = next[key];
      if (a === b) continue;
      if (a && b && Math.abs(a - b) < 10) continue;
      events.push({
        appId,
        day,
        type: "rank",
        title: !a ? `Entró al ${label} (#${b})` : !b ? `Salió del ${label} (era #${a})` : `#${a} → #${b} en ${label}`,
        tone: !a || (b && b < a) ? "up" : "down",
      });
    }
  }
  return events;
}

export const SNAPSHOT_COUNTRIES = MARKET_COUNTRIES.map((c) => c.code as string);
