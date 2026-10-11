import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  appDetail,
  appReviews,
  countryRanks,
  lookupApps,
  safeChart,
  safeCountry,
  safeGenre,
  searchApps,
  topChart,
  type MarketApp,
} from "@/lib/market/appstore";
import { analyzeKeyword, normalizeKeyword, searchHints } from "@/lib/market/keywords";
import { buildTimeline, captureApps, chartHistory, chartMovement, saveChartSnapshot } from "@/lib/market/snapshots";
import { parseVideoUrl, fetchVideoPreview } from "@/lib/viewtracker/video";
import { fetchPublicVideoStats } from "@/lib/viewtracker/stats";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

function ok(body: unknown) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "chart";
  const country = safeCountry(url.searchParams.get("country"));
  const genre = safeGenre(url.searchParams.get("genre"));

  if (op === "chart") {
    const chart = safeChart(url.searchParams.get("chart"));
    const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit")) || 100));
    const items = await topChart(chart, country, genre, limit);
    const ids = items.map((item) => item.id);
    const [history] = await Promise.all([
      chartHistory(chart, country, genre),
      saveChartSnapshot(chart, country, genre, ids),
    ]);
    const { movement, previousDay, days } = chartMovement(ids, history);
    return ok({ items, chart, country, genre, movement, previousDay, historyDays: days });
  }

  if (op === "search") {
    const term = (url.searchParams.get("term") || "").trim().slice(0, 100);
    if (!term) return ok({ items: [] });
    const items = await searchApps(term, country);
    return ok({ items: genre ? items.filter((item) => item.genreId === genre) : items });
  }

  if (op === "rising") {
    const months = Math.min(24, Math.max(1, Number(url.searchParams.get("months")) || 6));
    const excludeGames = url.searchParams.get("excludeGames") === "1";
    const [free, grossing] = await Promise.all([
      topChart("free", country, genre, 200),
      topChart("grossing", country, genre, 200),
    ]);
    const cutoff = Date.now() - months * 30.44 * 86_400_000;
    const merged = new Map<string, MarketApp & { freeRank: number | null; grossingRank: number | null }>();
    for (const [list, key] of [
      [free, "freeRank"],
      [grossing, "grossingRank"],
    ] as const) {
      for (const app of list) {
        const released = app.releasedAt ? new Date(app.releasedAt).getTime() : NaN;
        if (!Number.isFinite(released) || released < cutoff) continue;
        if (excludeGames && app.genreId === "6014") continue;
        const current = merged.get(app.id) ?? { ...app, freeRank: null, grossingRank: null };
        current[key] = app.rank ?? null;
        merged.set(app.id, current);
      }
    }
    const items = [...merged.values()].sort((a, b) => {
      const best = (x: typeof a) => Math.min(x.grossingRank ?? 999, x.freeRank ?? 999);
      return best(a) - best(b);
    });
    return ok({ items, months });
  }

  if (op === "app") {
    const appId = (url.searchParams.get("appId") || "").replace(/\D/g, "");
    if (!appId) return NextResponse.json({ error: "Falta el id de la app" }, { status: 400 });
    const app = await appDetail(appId, country);
    if (!app) return NextResponse.json({ error: "No se encontró la app" }, { status: 404 });
    const [reviews, ranks, similarPool] = await Promise.all([
      appReviews(appId, country),
      countryRanks(appId),
      app.genreId ? topChart("grossing", country, app.genreId, 30) : Promise.resolve([] as MarketApp[]),
    ]);
    const similar = similarPool.filter((item) => item.id !== appId).slice(0, 8);
    return ok({ app, reviews, ranks, similar });
  }

  if (op === "lookup") {
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean)
      .slice(0, 100);
    if (!ids.length) return ok({ items: [] });
    return ok({ items: await lookupApps(ids, country) });
  }

  if (op === "screens") {
    const appId = (url.searchParams.get("appId") || "").replace(/\D/g, "");
    const app = appId ? await appDetail(appId, country) : null;
    if (!app) return NextResponse.json({ error: "No se encontró la app" }, { status: 404 });
    return ok({ screenshots: app.screenshots });
  }

  if (op === "keyword") {
    const term = normalizeKeyword(url.searchParams.get("term") || "");
    if (!term) return NextResponse.json({ error: "Escribe una palabra clave" }, { status: 400 });
    return ok(await analyzeKeyword(term, country));
  }

  if (op === "hints") {
    const term = normalizeKeyword(url.searchParams.get("term") || "");
    return ok({ items: term ? await searchHints(term, country) : [] });
  }

  if (op === "track") {
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean)
      .slice(0, 60);
    if (!ids.length) return ok({ apps: [], events: [] });
    const [history, apps] = await Promise.all([captureApps(ids, country), lookupApps(ids, country)]);
    const events = apps
      .flatMap((app) => buildTimeline(app.id, history.get(app.id) ?? [], app.releasedAt))
      .sort((a, b) => b.day.localeCompare(a.day));
    const series = Object.fromEntries(
      apps.map((app) => [
        app.id,
        (history.get(app.id) ?? []).map((row) => ({
          day: row.day,
          rating: row.data.rating,
          ratingCount: row.data.ratingCount,
          freeRank: row.data.freeRank,
          grossingRank: row.data.grossingRank,
          version: row.data.version,
        })),
      ])
    );
    return ok({ apps, events, series });
  }

  if (op === "video") {
    const meta = parseVideoUrl(url.searchParams.get("url") || "");
    if (!meta || meta.platform === "web") {
      return NextResponse.json({ error: "Pega un link de TikTok, Instagram, YouTube o X" }, { status: 400 });
    }
    const preview = await fetchVideoPreview(meta.url, meta.platform, meta.videoId);
    const stats = await fetchPublicVideoStats(meta.url, meta.platform, preview.thumbnailUrl);
    return NextResponse.json({
      url: meta.url,
      platform: meta.platform,
      title: preview.title || stats.title,
      author: meta.username || preview.author || stats.author,
      thumbnailUrl: preview.thumbnailUrl || stats.thumbnailUrl,
      views: stats.views,
      likes: stats.likes,
      comments: stats.comments,
      postedAt: stats.postedAt,
    });
  }

  return NextResponse.json({ error: "Operación no soportada" }, { status: 400 });
}
