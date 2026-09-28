"use client";

import { useEffect, useMemo, useState } from "react";
import {
  engagementRate,
  formatCompact,
  timeAgo,
} from "@/lib/viewtracker/format";
import type { TrackedAccount } from "./AccountsPage";
import type { TrackedVideo } from "./VideosPage";
import { PlatformChip, VT_PLATFORMS } from "./vt-ui";

function Heatmap({ dates }: { dates: string[] }) {
  const cells = Array.from({ length: 52 * 7 }, (_, i) => i);
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (52 * 7 - 1));
  start.setHours(0, 0, 0, 0);
  const counts = new Map<number, number>();
  for (const raw of dates) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()) || d < start) continue;
    const idx = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
    if (idx < 0 || idx >= cells.length) continue;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return (
    <div className="overflow-x-auto">
      <div
        className="grid w-max gap-[3px]"
        style={{
          gridTemplateRows: "repeat(7, 10px)",
          gridAutoFlow: "column",
          gridAutoColumns: "10px",
        }}
      >
        {cells.map((i) => {
          const n = counts.get(i) ?? 0;
          const bg =
            n === 0
              ? "bg-[#eef0f3]"
              : n / max > 0.66
                ? "bg-[var(--accent)]"
                : n / max > 0.33
                  ? "bg-[#8b85ff]"
                  : "bg-[#c9c6ff]";
          return <div key={i} className={`h-[10px] w-[10px] rounded-[2px] ${bg}`} />;
        })}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="mt-3 h-8 w-full rounded bg-[var(--surface-alt)]" />;
  }
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const span = Math.max(1, max - min);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 28 - ((p - min) / span) * 24;
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full text-[#8b85ff]" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function OverviewPage({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<"kpis" | "graph">("kpis");
  const [platform, setPlatform] = useState<string | null>(null);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/videos`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/accounts`).then((r) => r.json()),
    ])
      .then(([v, a]) => {
        if (cancelled) return;
        setVideos((v.items ?? []) as TrackedVideo[]);
        setAccounts((a.items ?? []) as TrackedAccount[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredVideos = useMemo(
    () => (platform ? videos.filter((v) => v.platform === platform) : videos),
    [videos, platform]
  );
  const filteredAccounts = useMemo(
    () => (platform ? accounts.filter((a) => a.platform === platform) : accounts),
    [accounts, platform]
  );

  const views = filteredVideos.reduce((s, v) => s + v.views, 0);
  const likes = filteredVideos.reduce((s, v) => s + v.likes, 0);
  const comments = filteredVideos.reduce((s, v) => s + v.comments, 0);
  const shares = filteredVideos.reduce((s, v) => s + v.shares, 0);
  const engagement = engagementRate({ views, likes, comments, shares });
  const recent = [...filteredVideos]
    .sort(
      (a, b) =>
        new Date(b.postedAt || b.createdAt).getTime() -
        new Date(a.postedAt || a.createdAt).getTime()
    )
    .slice(0, 8);
  const topVideos = [...filteredVideos].sort((a, b) => b.views - a.views).slice(0, 5);
  const topAccounts = [...filteredAccounts]
    .map((a) => {
      const user = (a.username || "").toLowerCase();
      const related = filteredVideos.filter(
        (v) => (v.author || "").replace(/^@/, "").toLowerCase() === user
      );
      return { account: a, views: related.reduce((s, v) => s + v.views, 0) };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const kpis = [
    { id: "views", label: "Views", value: formatCompact(views), points: filteredVideos.map((v) => v.views) },
    { id: "likes", label: "Likes", value: formatCompact(likes), points: filteredVideos.map((v) => v.likes) },
    { id: "comments", label: "Comments", value: formatCompact(comments), points: filteredVideos.map((v) => v.comments) },
    { id: "shares", label: "Shares", value: formatCompact(shares), points: filteredVideos.map((v) => v.shares) },
    { id: "engagement", label: "Engagement Rate", value: `${engagement.toFixed(1)}%`, points: [] },
    { id: "posted", label: "Posted Videos", value: String(filteredVideos.length), points: [] },
    { id: "accounts", label: "Active Accounts", value: String(filteredAccounts.length), points: [] },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--muted)]">
          {filteredAccounts.length} accounts
        </div>
        <div className="min-w-[180px] flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--muted)]">
          Last 30 days UTC
        </div>
        <div className="flex items-center gap-1.5">
          {VT_PLATFORMS.map((p) => (
            <PlatformChip
              key={p.id}
              id={p.id}
              label={p.label}
              active={platform === p.id}
              onClick={() => setPlatform((prev) => (prev === p.id ? null : p.id))}
            />
          ))}
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {recent.map((video) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="relative w-[140px] shrink-0 overflow-hidden rounded-2xl bg-[#111827]"
            >
              <div className="aspect-[9/14]">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                {video.platform || "web"}
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-white">
                <p className="truncate text-[11px]">{video.author || ""}</p>
                <p className="text-[10px] text-white/80">
                  {formatCompact(video.views)} · {timeAgo(video.postedAt || video.createdAt)}
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--muted-soft)]">
          {loading
            ? "Cargando tracking…"
            : videos.length === 0
              ? "Pega links en Videos o Accounts para llenar el Overview"
              : "Métricas de los videos y cuentas que estás trackeando"}
        </p>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMode("kpis")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
              mode === "kpis" ? "bg-[var(--surface-alt)] text-[var(--foreground)]" : "text-[var(--muted)]"
            }`}
          >
            KPIs
          </button>
          <button
            type="button"
            onClick={() => setMode("graph")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
              mode === "graph" ? "bg-[var(--surface-alt)] text-[var(--foreground)]" : "text-[var(--muted)]"
            }`}
          >
            Graph
          </button>
        </div>
      </div>

      {mode === "kpis" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
            >
              <p className="text-[12px] font-medium text-[var(--muted)]">{item.label}</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                {item.value}
              </p>
              <Sparkline points={item.points.slice(0, 12).reverse()} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[13px] text-[var(--muted-soft)]">
          {filteredVideos.length === 0
            ? "Charts will appear when tracking data is available"
            : `${filteredVideos.length} videos trackeados`}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
            Posting activity — {filteredVideos.length} posts in 52 weeks
          </h3>
        </div>
        <Heatmap dates={filteredVideos.map((v) => v.postedAt || v.createdAt)} />
      </section>

      <section>
        <h3 className="mb-3 text-[14px] font-semibold text-[var(--foreground)]">Top performers</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Top videos</p>
            <p className="text-[12px] text-[var(--muted-soft)]">Most views gained</p>
            {topVideos.length === 0 ? (
              <p className="mt-6 text-center text-[13px] text-[var(--muted-soft)]">Aún no hay videos.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {topVideos.map((v) => (
                  <li key={v.id} className="flex items-center gap-2.5">
                    <span className="h-10 w-8 overflow-hidden rounded bg-[#111827]">
                      {v.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[12px] font-medium text-[var(--foreground)]">
                        {v.title || v.url}
                      </span>
                      <span className="block text-[11px] text-[var(--muted-soft)]">{v.author}</span>
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--accent)]">
                      {formatCompact(v.views)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Top refreshed</p>
            <p className="text-[12px] text-[var(--muted-soft)]">Old videos gaining right now</p>
            <p className="mt-6 text-center text-[13px] text-[var(--muted-soft)]">
              No growth in this range yet.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Top accounts</p>
            <p className="text-[12px] text-[var(--muted-soft)]">Most views gained</p>
            {topAccounts.length === 0 ? (
              <p className="mt-6 text-center text-[13px] text-[var(--muted-soft)]">Aún no hay cuentas.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {topAccounts.map(({ account, views: v }) => (
                  <li key={account.id} className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={account.avatarUrl || "https://unavatar.io/fallback"}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      @{account.username}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--accent)]">
                      {formatCompact(v)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
