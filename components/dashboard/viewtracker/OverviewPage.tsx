"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  engagementRate,
  formatCompact,
  timeAgo,
} from "@/lib/viewtracker/format";
import type { TrackedAccount } from "./AccountsPage";
import type { TrackedVideo } from "./VideosPage";
import { PlatformChip, VT_PLATFORMS } from "./vt-ui";

const HEAT_WEEKS = 53;
const HEAT_LEVELS = ["#eef0f4", "#c7d2fe", "#a5b4fc", "#6366f1", "#3730a3"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function Heatmap({ dates }: { dates: string[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; date: Date; n: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (HEAT_WEEKS - 1) * 7);

  const counts = new Map<string, number>();
  for (const raw of dates) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()) || date < start) continue;
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const weeks = Array.from({ length: HEAT_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + weekday);
      return { date, n: counts.get(dayKey(date)) ?? 0, future: date > today };
    }),
  );
  const days = weeks.flat().filter((cell) => !cell.future);
  const max = Math.max(1, ...days.map((cell) => cell.n));
  const total = days.reduce((sum, cell) => sum + cell.n, 0);
  const activeDays = days.filter((cell) => cell.n > 0).length;
  let longest = 0;
  let run = 0;
  for (const cell of days) {
    run = cell.n > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));
  const monthLabels = weeks.map((week, index) => {
    const first = week[0].date;
    const previous = index > 0 ? weeks[index - 1][0].date : null;
    return !previous || previous.getMonth() !== first.getMonth() ? MONTHS_SHORT[first.getMonth()] : "";
  });

  function showCell(event: ReactMouseEvent<HTMLDivElement>, date: Date, n: number) {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cell = event.currentTarget.getBoundingClientRect();
    if (!wrap) return;
    const x = Math.min(Math.max(cell.left - wrap.left + cell.width / 2, 90), wrap.width - 90);
    setHover({ x, y: cell.top - wrap.top, date, n });
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "Posts en 12 meses", value: String(total) },
          { label: "Días con post", value: `${activeDays} de ${days.length}` },
          { label: "Racha más larga", value: `${longest} ${longest === 1 ? "día" : "días"}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-[#f6f7fb] px-3 py-2">
            <p className="text-[11px] text-[var(--muted)]">{stat.label}</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--foreground)]">{stat.value}</p>
          </div>
        ))}
      </div>
      <div ref={wrapRef} className="relative" onMouseLeave={() => setHover(null)}>
        <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2">
          <span />
          <div className="grid gap-[3px] sm:gap-1" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, minmax(0, 1fr))` }}>
            {monthLabels.map((label, index) => (
              <span key={index} className="overflow-visible whitespace-nowrap text-[10px] text-[var(--muted-soft)]">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-rows-7 gap-[3px] sm:gap-1">
            {["L", "", "X", "", "V", "", "D"].map((label, index) => (
              <span key={index} className="flex items-center text-[10px] leading-none text-[var(--muted-soft)]">
                {label}
              </span>
            ))}
          </div>
          <div
            className="mt-1 grid grid-flow-col grid-rows-7 gap-[3px] sm:gap-1"
            style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, minmax(0, 1fr))` }}
          >
            {weeks.flat().map((cell) =>
              cell.future ? (
                <span key={cell.date.getTime()} className="aspect-square" />
              ) : (
                <div
                  key={cell.date.getTime()}
                  className="aspect-square rounded-[3px] transition-transform duration-150 hover:scale-[1.35] hover:ring-2 hover:ring-white hover:shadow-[0_2px_8px_rgba(17,24,39,0.25)]"
                  style={{ background: HEAT_LEVELS[level(cell.n)] }}
                  onMouseEnter={(event) => showCell(event, cell.date, cell.n)}
                />
              ),
            )}
          </div>
        </div>
        {hover ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#111113] px-2.5 py-1.5 text-[11px] text-white shadow-[0_8px_20px_rgba(17,24,39,0.25)]"
            style={{ left: hover.x, top: hover.y - 6 }}
          >
            <span className="font-semibold">
              {hover.n} {hover.n === 1 ? "video" : "videos"}
            </span>
            <span className="text-white/60">
              {" · "}
              {hover.date.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--muted-soft)]">
        <span>Menos</span>
        {HEAT_LEVELS.map((color) => (
          <span key={color} className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

function hashtagsOf(title: string | null) {
  const tags = (title || "").match(/#[\p{L}\p{N}_.]+/gu) ?? [];
  return tags.slice(0, 3).join(" ");
}

function RailStat({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <span className="flex flex-col items-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
      {children}
      <span className="mt-0.5 text-[10px] font-semibold leading-none">{value}</span>
    </span>
  );
}

const PODIUM = {
  1: { height: "h-[300px] sm:h-[360px]", base: "h-12", metal: "vt-metal-gold", frame: "shadow-[0_0_0_2px_#e6c56a]" },
  2: { height: "h-[250px] sm:h-[300px]", base: "h-9", metal: "vt-metal-silver", frame: "shadow-[0_0_0_2px_#c5cad3]" },
  3: { height: "h-[220px] sm:h-[260px]", base: "h-7", metal: "vt-metal-bronze", frame: "shadow-[0_0_0_2px_#c4844a]" },
} as const;

type PodiumMetric = "views" | "likes" | "comments" | "shares" | "engagement";

const videoEngagement = (video: TrackedVideo) =>
  engagementRate({ views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, saves: video.saves });

const PODIUM_METRICS: {
  id: PodiumMetric;
  label: string;
  title: string;
  unit: string;
  value: (video: TrackedVideo) => number;
  display: (video: TrackedVideo) => string;
}[] = [
  { id: "views", label: "Vistas", title: "más vistas", unit: "views", value: (v) => v.views, display: (v) => formatCompact(v.views) },
  { id: "likes", label: "Likes", title: "más likes", unit: "likes", value: (v) => v.likes, display: (v) => formatCompact(v.likes) },
  { id: "comments", label: "Comentarios", title: "más comentarios", unit: "coment.", value: (v) => v.comments, display: (v) => formatCompact(v.comments) },
  { id: "shares", label: "Compartidos", title: "más compartidos", unit: "shares", value: (v) => v.shares, display: (v) => formatCompact(v.shares) },
  {
    id: "engagement",
    label: "Engagement",
    title: "mejor Engagement Rate",
    unit: "ER",
    value: videoEngagement,
    display: (v) => `${videoEngagement(v).toFixed(1)}%`,
  },
];

function VideoPodium({
  videos,
  accounts,
}: {
  videos: TrackedVideo[];
  accounts: TrackedAccount[];
}) {
  const avatarByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) {
      const user = (account.username || "").replace(/^@/, "").toLowerCase();
      if (user && account.avatarUrl && !account.avatarUrl.includes("unavatar.io")) {
        map.set(user, account.avatarUrl);
      }
    }
    return map;
  }, [accounts]);

  const [metric, setMetric] = useState<PodiumMetric>("views");
  const option = PODIUM_METRICS.find((item) => item.id === metric) ?? PODIUM_METRICS[0];
  const minViews = metric === "engagement" ? Math.max(1, Math.round(medianOf(videos.map((video) => video.views)))) : 0;
  const ranked = [...videos]
    .filter((video) => video.views >= minViews)
    .sort((a, b) => option.value(b) - option.value(a) || b.views - a.views)
    .slice(0, 3);
  if (videos.length === 0) return null;
  const slots: Array<{ video: TrackedVideo; place: 1 | 2 | 3 } | null> = [
    ranked[1] ? { video: ranked[1], place: 2 } : null,
    ranked[0] ? { video: ranked[0], place: 1 } : null,
    ranked[2] ? { video: ranked[2], place: 3 } : null,
  ];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Los 3 con {option.title}</h3>
          <p className="text-[12px] text-[var(--muted-soft)]">
            {metric === "engagement"
              ? `Solo videos con al menos ${formatCompact(minViews)} views (la mediana), para que uno con pocas vistas no gane por suerte`
              : "Ranking de todos los videos trackeados"}
          </p>
        </div>
        <div role="tablist" aria-label="Ordenar podio por" className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-white p-1 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          {PODIUM_METRICS.map((item) => {
            const active = item.id === metric;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(item.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  active ? "ui-btn-primary text-white" : "text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div key={metric} className="vt-podium-swap mx-auto grid max-w-[760px] grid-cols-3 items-end gap-2 sm:gap-4">
        {slots.map((slot, index) => {
          if (!slot) return <div key={index} />;
          const { video, place } = slot;
          const style = PODIUM[place];
          const handle = (video.author || "").replace(/^@/, "");
          const avatar = avatarByUser.get(handle.toLowerCase()) ?? null;
          const tags = hashtagsOf(video.title);
          return (
            <div key={video.id} className="min-w-0">
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className={`relative block overflow-hidden rounded-xl bg-[#1c1c1e] ${style.height} ${style.frame}`}
              >
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <span className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold ${style.metal}`}>
                  {place}
                </span>
                <span className="absolute right-2 top-2 hidden rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-[2px] sm:inline">
                  {timeAgo(video.postedAt || video.createdAt)}
                </span>
                <span className="absolute bottom-12 right-1.5 hidden flex-col items-center gap-2 sm:flex">
                  <RailStat value={formatCompact(video.likes)}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor" aria-hidden>
                      <path d="M12 20s-7-4.4-7-9.2C5 8 6.8 6.2 9.1 6.2c1.3 0 2.4.6 2.9 1.6.5-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.6C19 15.6 12 20 12 20Z" />
                    </svg>
                  </RailStat>
                  <RailStat value={formatCompact(video.comments)}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor" aria-hidden>
                      <path d="M6 17.5 4 20V7.2A2.2 2.2 0 0 1 6.2 5h11.6A2.2 2.2 0 0 1 20 7.2v7.1a2.2 2.2 0 0 1-2.2 2.2H6Z" />
                    </svg>
                  </RailStat>
                  <RailStat value={formatCompact(video.shares)}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" aria-hidden>
                      <path d="M14 6.5 19 11l-5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 11H10.5a5 5 0 0 0-5 5V18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </RailStat>
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 pb-2 pt-8 text-white">
                  <span className="flex items-center gap-1.5">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-4 w-4 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[8px] font-semibold">
                        {(handle[0] || "?").toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-[11px] font-semibold">@{handle || "account"}</span>
                  </span>
                  {tags ? (
                    <span className="mt-0.5 hidden truncate text-[10px] text-white/90 sm:block">{tags}</span>
                  ) : null}
                </span>
              </a>
              <div className={`mt-1.5 flex items-center justify-center gap-1 rounded-b-lg text-[13px] font-bold tabular-nums ${style.base} ${style.metal}`}>
                {option.display(video)}
                <span className="hidden text-[10px] font-semibold opacity-70 sm:inline">{option.unit}</span>
      </div>
    </div>
          );
        })}
      </div>
    </section>
  );
}

function postedAgeDays(video: TrackedVideo) {
  const t = new Date(video.postedAt || video.createdAt).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

function inWindow(video: TrackedVideo, fromDay: number, toDay: number) {
  const age = postedAgeDays(video);
  return age !== null && age >= fromDay && age < toDay;
}

function dailyTotals(videos: TrackedVideo[], pick: (video: TrackedVideo) => number, days = 14) {
  const buckets = Array.from({ length: days }, () => 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const video of videos) {
    const raw = new Date(video.postedAt || video.createdAt);
    if (Number.isNaN(raw.getTime())) continue;
    raw.setHours(0, 0, 0, 0);
    const index = days - 1 - Math.round((today.getTime() - raw.getTime()) / 86_400_000);
    if (index >= 0 && index < days) buckets[index] += pick(video);
  }
  return buckets;
}

function rateChange(recent: number, prior: number) {
  if (recent === 0 && prior === 0) return null;
  const diff = recent - prior;
  return {
    up: diff > 0,
    flat: Math.abs(diff) < 0.05,
    text: `${Math.abs(diff).toFixed(1)} pts`,
  };
}

function periodChange(recent: number, prior: number) {
  if (recent === 0 && prior === 0) return null;
  const diff = recent - prior;
  if (diff === 0) return { up: false, flat: true, text: "0%" };
  const pct = prior > 0 ? Math.round((diff / prior) * 100) : null;
  const amount = formatCompact(Math.abs(diff));
  return {
    up: diff > 0,
    flat: false,
    text: `${amount}${pct === null ? "" : ` ${diff > 0 ? "+" : ""}${pct}%`}`,
  };
}

function AreaSpark({
  points,
  tone,
  gradientId,
  filled = true,
  className = "h-14 w-full",
}: {
  points: number[];
  tone: "up" | "down" | "flat";
  gradientId: string;
  filled?: boolean;
  className?: string;
}) {
  const series = points.length >= 2 ? points : [0, 0];
  const max = Math.max(1, ...series);
  const width = 100;
  const height = 56;
  const color = tone === "up" ? "#16a34a" : tone === "down" ? "#e11d48" : "#94a3b8";
  const coords = series.map((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - (point / max) * 40 - 4;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled ? <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${gradientId})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function kpiChart(
  item: { id: string; points: number[]; change: { up: boolean; flat: boolean } | null },
  videos: TrackedVideo[],
): ChartSpec {
  const tone = item.change?.flat || !item.change ? "flat" : item.change.up ? "up" : "down";
  const columns = (color: string) =>
    ({
      type: "columns",
      color,
      items: item.points.map((value, index) => ({ label: String(index + 1), value })),
    }) as const;
  if (item.id === "views") return { type: "area", id: "kpi-views", points: item.points, tone };
  if (item.id === "likes") return { type: "line", id: "kpi-likes", points: item.points, tone };
  if (item.id === "comments") return { type: "area", id: "kpi-comments", points: item.points, tone };
  if (item.id === "shares") return { type: "area", id: "kpi-shares", points: item.points, tone };
  if (item.id === "engagement") return { type: "line", id: "kpi-engagement", points: item.points, tone };
  if (item.id === "posted") return columns("#111113");
  const views = videos.reduce((sum, video) => sum + video.views, 0);
  const ofViews = (value: number) => (views > 0 ? formatRate((value / views) * 100) : "0%");
  return {
    type: "pie",
    caption: "% de las views",
    slices: [
      {
        id: "comments",
        label: "Comentarios",
        value: videos.reduce((sum, video) => sum + video.comments, 0),
        display: ofViews(videos.reduce((sum, video) => sum + video.comments, 0)),
        color: "#6366f1",
      },
      {
        id: "saves",
        label: "Guardados",
        value: videos.reduce((sum, video) => sum + video.saves, 0),
        display: ofViews(videos.reduce((sum, video) => sum + video.saves, 0)),
        color: "#d97706",
      },
      {
        id: "shares",
        label: "Compartidos",
        value: videos.reduce((sum, video) => sum + video.shares, 0),
        display: ofViews(videos.reduce((sum, video) => sum + video.shares, 0)),
        color: "#0d9488",
      },
    ],
  };
}

function KpiIcon({ id }: { id: string }) {
  if (id === "likes") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <path d="M12 19s-6-3.6-6-7.6C6 8.8 7.6 7.2 9.8 7.2c1.2 0 2.2.6 2.2 1.6 0-1 1-1.6 2.2-1.6C16.4 7.2 18 8.8 18 11.4 18 15.4 12 19 12 19Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (id === "comments") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <path d="M6 17.2 4.5 19V7.4A1.4 1.4 0 0 1 5.9 6h12.2A1.4 1.4 0 0 1 19.5 7.4v6.4a1.4 1.4 0 0 1-1.4 1.4H6Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (id === "shares") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <path d="M14 7 18.5 11 14 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 11H10a4.5 4.5 0 0 0-4.5 4.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "engagement") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <path d="M4 14.5 8.5 10l3 3L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "posted") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M10 9.5v5l4.5-2.5L10 9.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (id === "accounts") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="2.4" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
        <path d="M4.8 17.5c.6-2 2.3-3.2 4.2-3.2s3.6 1.2 4.2 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 14.6c1.3-.3 2.6.2 3.3 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
      <path d="M9 7.2v9.6l7.2-4.8L9 7.2Z" fill="currentColor" />
    </svg>
  );
}

type About = { what: string; how: string; why: string };

type ChartSpec =
  | { type: "area" | "line"; id: string; points: number[]; tone: "up" | "down" | "flat" }
  | { type: "columns"; color: string; items: { label: string; value: number }[] }
  | { type: "donut"; slices: { id: string; value: number; color: string }[] }
  | { type: "pie"; caption?: string; slices: { id: string; label: string; value: number; display: string; color: string }[] }
  | { type: "smooth"; id: string; points: number[]; color: string; filled: boolean }
  | { type: "glow"; points: number[]; color: string }
  | { type: "gauge"; percent: number; color: string; caption: string }
  | { type: "segments"; slices: { id: string; label: string; value: number; display: string; color: string }[] }
  | { type: "highlight"; items: { label: string; value: number }[]; best: number | null; color: string; edges?: [string, string] }
  | { type: "streak"; weeks: boolean[]; streak: number; color: string }
  | { type: "hbars"; items: { label: string; value: number; display: string }[] };

type KpiItem = {
  id: string;
  label: string;
  value: string;
  change: { up: boolean; flat: boolean; text: string } | null;
  points: number[];
  about: About;
  chart: ChartSpec;
};

function MetricInfo({ about }: { about: About }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function show() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const estimated = 148;
    const below = rect.bottom + 8;
    const top = below + estimated > window.innerHeight ? Math.max(8, rect.top - 8 - estimated) : below;
    setPos({ top, left });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Qué mide esta métrica"
        className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold leading-none text-[var(--muted)]"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
              className="pointer-events-none fixed z-[80] w-64 rounded-xl border border-[var(--border)] bg-white p-3 text-left text-[12px] font-normal leading-snug text-[var(--foreground)] shadow-[0_12px_32px_rgba(17,24,39,0.16)]"
            >
              <span className="block"><span className="font-semibold">Qué describe. </span>{about.what}</span>
              <span className="mt-1.5 block"><span className="font-semibold">Cómo se calcula. </span>{about.how}</span>
              <span className="mt-1.5 block"><span className="font-semibold">Para qué sirve. </span>{about.why}</span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function MiniColumns({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="flex h-14 items-end gap-px px-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 items-end" title={`${item.label || index + 1}: ${formatPrecise(item.value)}`}>
          <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(6, (item.value / max) * 100)}%`, background: color }} />
        </div>
      ))}
    </div>
  );
}

function MiniRing({ slices }: { slices: { id: string; value: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 48 48" className="mx-auto h-14 w-14" aria-hidden>
      <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(17,24,39,0.06)" strokeWidth="6" />
      {total > 0
        ? slices.map((slice) => {
            const length = (slice.value / total) * circumference;
            const node = (
              <circle
                key={slice.id}
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="6"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 24 24)"
              />
            );
            offset += length;
            return node;
          })
        : null}
    </svg>
  );
}

function MiniPie({
  slices,
  caption,
}: {
  slices: { id: string; label: string; value: number; display: string; color: string }[];
  caption?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const cx = 16;
  const cy = 16;
  const radius = 14;
  let angle = -Math.PI / 2;
  return (
    <div className="flex items-center gap-3 px-4 pb-3">
      <svg viewBox="0 0 32 32" className="h-14 w-14 shrink-0" aria-hidden>
        {total > 0 ? (
          slices.map((slice) => {
            const portion = Math.max(0, slice.value) / total;
            const start = angle;
            const end = angle + portion * Math.PI * 2;
            angle = end;
            if (portion <= 0) return null;
            if (portion >= 0.999) return <circle key={slice.id} cx={cx} cy={cy} r={radius} fill={slice.color} />;
            const large = end - start > Math.PI ? 1 : 0;
            const x1 = cx + radius * Math.cos(start);
            const y1 = cy + radius * Math.sin(start);
            const x2 = cx + radius * Math.cos(end);
            const y2 = cy + radius * Math.sin(end);
            return (
              <path
                key={slice.id}
                d={`M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`}
                fill={slice.color}
              />
            );
          })
        ) : (
          <circle cx={cx} cy={cy} r={radius} fill="rgba(17,24,39,0.06)" />
        )}
    </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {caption ? <li className="text-[10px] text-[var(--muted)]">{caption}</li> : null}
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--foreground)]">{slice.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function smoothPath(points: number[], width: number, height: number) {
  const series = points.length >= 2 ? points : [0, 0];
  const max = Math.max(1e-9, ...series);
  const top = 6;
  const bottom = height - 3;
  const coords = series.map((point, index) => [
    (index / (series.length - 1)) * width,
    bottom - (max > 0 ? point / max : 0) * (bottom - top),
  ]);
  const clampY = (y: number) => Math.min(bottom, Math.max(top - 2, y));
  let d = `M${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function SmoothSpark({ id, points, color, filled }: { id: string; points: number[]; color: string; filled: boolean }) {
  const width = 100;
  const height = 56;
  const line = smoothPath(points, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled ? <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WeekEdges() {
  return (
    <div className="mt-1 flex justify-between px-4 text-[9px] text-[var(--muted-soft)]">
      <span>hace 12 sem</span>
      <span>esta sem</span>
    </div>
  );
}

function MiniGlow({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(1e-9, ...points);
  const peak = points.indexOf(Math.max(...points));
  return (
    <div className="pb-2">
      <div className="flex h-14 items-end gap-1 px-4">
        {points.map((value, index) => (
          <div key={index} className="relative flex h-full min-w-0 flex-1 items-end" title={formatPrecise(value)}>
            {index === peak && value > 0 ? (
              <span
                className="absolute inset-x-[-6px] text-center text-[9px] font-semibold leading-none tabular-nums"
                style={{ color, bottom: `calc(${(value / max) * 82}% + 3px)` }}
              >
                {formatPrecise(value)}
              </span>
            ) : null}
            <div
              className="w-full rounded-t-[5px] rounded-b-[2px]"
              style={{
                height: `${Math.max(6, (value / max) * 82)}%`,
                background: value > 0 ? `linear-gradient(180deg, ${color} 0%, ${color}33 100%)` : "rgba(17,24,39,0.07)",
                opacity: value > 0 ? (index === peak ? 1 : 0.55) : 1,
              }}
            />
          </div>
        ))}
      </div>
      <WeekEdges />
    </div>
  );
}

function MiniGauge({ percent, color, caption }: { percent: number; color: string; caption: string }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative mx-auto w-[140px] pb-3">
      <svg viewBox="0 0 100 56" className="h-[76px] w-full" aria-hidden>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="rgba(17,24,39,0.07)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value} 100`}
        />
      </svg>
      <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium tabular-nums text-[var(--muted)]">{caption}</p>
    </div>
  );
}

function MiniSegments({ slices }: { slices: { id: string; label: string; value: number; display: string; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  return (
    <div className="px-4 pb-3.5">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-black/[0.05]">
        {total > 0
          ? slices.map((slice) => (
              <span
                key={slice.id}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(Math.max(0, slice.value) / total) * 100}%`, background: slice.color }}
              />
            ))
          : null}
      </div>
      <ul className="mt-2.5 space-y-1">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--foreground)]">{slice.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniHighlight({
  items,
  best,
  color,
  edges,
}: {
  items: { label: string; value: number }[];
  best: number | null;
  color: string;
  edges?: [string, string];
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const showLabels = items.some((item) => item.label);
  return (
    <div className="px-4 pb-2.5">
      <div className={`flex h-14 items-end ${items.length > 12 ? "gap-[2px]" : "gap-1.5"}`}>
        {items.map((item, index) => {
          const active = index === best;
          return (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end" title={`${item.label || index}: ${formatPrecise(item.value)}`}>
              <div
                className={`w-full ${items.length > 12 ? "rounded-[2px]" : "rounded-[6px]"}`}
                style={{
                  height: `${Math.max(8, (item.value / max) * 100)}%`,
                  background: active ? color : "rgba(17,24,39,0.09)",
                  boxShadow: active ? `0 4px 12px ${color}55` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      {showLabels ? (
        <div className={`mt-1 flex ${items.length > 12 ? "gap-[2px]" : "gap-1.5"}`}>
          {items.map((item, index) => (
            <span
              key={index}
              className={`min-w-0 flex-1 text-center text-[9px] ${index === best ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted-soft)]"}`}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {edges ? (
        <div className="mt-1 flex justify-between text-[9px] text-[var(--muted-soft)]">
          <span>{edges[0]}</span>
          <span>{edges[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

function MiniStreak({ weeks, streak, color }: { weeks: boolean[]; streak: number; color: string }) {
  const inStreak = new Set<number>();
  let cursor = weeks.length - 1;
  if (cursor >= 0 && !weeks[cursor]) cursor -= 1;
  for (let left = streak; left > 0 && cursor >= 0 && weeks[cursor]; left -= 1, cursor -= 1) inStreak.add(cursor);
  return (
    <div className="pb-2.5">
      <div className="flex h-14 items-center justify-between px-4">
        {weeks.map((posted, index) => (
          <span
            key={index}
            className="h-3.5 w-3.5 rounded-full"
            style={
              posted
                ? {
                    background: inStreak.has(index) ? color : `${color}55`,
                    boxShadow: inStreak.has(index) ? `0 0 0 3px ${color}26` : undefined,
                  }
                : { border: "1.5px dashed rgba(17,24,39,0.22)" }
            }
            title={posted ? "Con publicación" : "Sin publicación"}
          />
        ))}
      </div>
      <WeekEdges />
    </div>
  );
}

function MiniChart({ spec }: { spec: ChartSpec }) {
  if (spec.type === "smooth") {
    return (
      <div className="pb-2">
        <SmoothSpark id={spec.id} points={spec.points} color={spec.color} filled={spec.filled} />
        <WeekEdges />
      </div>
    );
  }
  if (spec.type === "glow") return <MiniGlow points={spec.points} color={spec.color} />;
  if (spec.type === "gauge") return <MiniGauge percent={spec.percent} color={spec.color} caption={spec.caption} />;
  if (spec.type === "segments") return <MiniSegments slices={spec.slices} />;
  if (spec.type === "highlight") return <MiniHighlight items={spec.items} best={spec.best} color={spec.color} edges={spec.edges} />;
  if (spec.type === "streak") return <MiniStreak weeks={spec.weeks} streak={spec.streak} color={spec.color} />;
  if (spec.type === "area" || spec.type === "line") {
    return (
      <AreaSpark
        points={spec.points}
        tone={spec.tone}
        gradientId={spec.id}
        filled={spec.type === "area"}
        className="h-14 w-full"
      />
    );
  }
  if (spec.type === "columns") return <MiniColumns items={spec.items} color={spec.color} />;
  if (spec.type === "donut") return <div className="pb-2"><MiniRing slices={spec.slices} /></div>;
  if (spec.type === "pie") return <MiniPie slices={spec.slices} caption={spec.caption} />;
  if (spec.type !== "hbars") return null;
  const max = Math.max(1, ...spec.items.map((item) => item.value));
  return (
    <ul className="space-y-1.5 px-4 pb-3">
      {spec.items.slice(0, 3).map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className="w-16 truncate text-[10px] text-[var(--muted)]">{item.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <span className="block h-full rounded-full bg-[#111113]" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  return (
    <div className="vt-liquid-glass relative overflow-hidden rounded-[22px] backdrop-blur-2xl">
      <span className="absolute right-3 top-3 z-10">
        <MetricInfo about={item.about} />
      </span>
      <div className="relative flex items-start gap-3 px-4 pt-4 pr-10">
        <span className="vt-liquid-icon relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <KpiIcon id={item.id} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--muted)]">{item.label}</p>
          <p className="text-[26px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
            {item.value}
          </p>
          {item.change ? (
            <p
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                item.change.flat
                  ? "bg-black/[0.04] text-[var(--muted)]"
                  : item.change.up
                    ? "bg-[#16a34a]/10 text-[#15803d]"
                    : "bg-[#e11d48]/10 text-[#e11d48]"
              }`}
            >
              {item.change.flat ? "–" : item.change.up ? "↑" : "↓"} {item.change.text}
            </p>
          ) : (
            <p className="mt-2 inline-flex rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-[var(--muted)]">
              Sin cambio
            </p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <MiniChart spec={item.chart} />
      </div>
    </div>
  );
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function medianOf(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return formatCompact(value);
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatRate(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0%";
  if (value >= 10) return `${value.toFixed(1)}%`;
  if (value >= 1) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

function weekStart(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

function postingTimes(videos: TrackedVideo[]) {
  return videos
    .map((video) => new Date(video.postedAt || video.createdAt).getTime())
    .filter((time) => !Number.isNaN(time));
}

function bestBucket(videos: TrackedVideo[], keyOf: (date: Date) => number, minCount = 1) {
  const buckets = new Map<number, { views: number; n: number }>();
  for (const video of videos) {
    const date = new Date(video.postedAt || video.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = keyOf(date);
    const row = buckets.get(key) ?? { views: 0, n: 0 };
    row.views += video.views;
    row.n += 1;
    buckets.set(key, row);
  }
  let best: { key: number; avg: number; n: number } | null = null;
  for (const [key, row] of buckets) {
    if (row.n < minCount) continue;
    const avg = row.views / row.n;
    if (!best || avg > best.avg) best = { key, avg, n: row.n };
  }
  return best;
}

function postingStreak(times: number[]) {
  if (times.length === 0) return 0;
  const weeks = new Set(times.map((time) => weekStart(time)));
  let cursor = weekStart(Date.now());
  if (!weeks.has(cursor)) cursor -= 7 * 86_400_000;
  let streak = 0;
  while (weeks.has(cursor) && streak < 520) {
    streak += 1;
    cursor -= 7 * 86_400_000;
  }
  return streak;
}

type GroupId = "perf" | "inter" | "rhythm";

const GROUPS: Record<GroupId, { name: string; description: string; color: string }> = {
  perf: { name: "Rendimiento", description: "Cuánto alcanza cada video", color: "#6366f1" },
  inter: { name: "Interacción", description: "Qué hace la gente después de ver", color: "#e11d48" },
  rhythm: { name: "Constancia", description: "Ritmo y mejores momentos para publicar", color: "#0d9488" },
};

type DetailIconId =
  | "avg"
  | "median"
  | "account"
  | "target"
  | "pie"
  | "heart"
  | "bubble"
  | "share"
  | "calendar"
  | "flame"
  | "sun"
  | "clock";

const DETAIL_META: Record<string, { group: GroupId; icon: DetailIconId; caption: string; wide?: boolean }> = {
  "Avg Views per Video": { group: "perf", icon: "avg", caption: "Promedio por video · por semana", wide: true },
  "Median Views": { group: "perf", icon: "median", caption: "Videos por rango de views" },
  "Views per Account": { group: "perf", icon: "account", caption: "Aporte de cada cuenta" },
  "Hit Rate": { group: "perf", icon: "target", caption: "Videos sobre 1K views" },
  "Top Video Concentration": { group: "perf", icon: "pie", caption: "Reparto de las views" },
  "Like Rate": { group: "inter", icon: "heart", caption: "Like rate · por semana", wide: true },
  "Comment Rate": { group: "inter", icon: "bubble", caption: "Comment rate · por semana" },
  "Share Rate": { group: "inter", icon: "share", caption: "Share rate · por semana" },
  "Likes per Video": { group: "inter", icon: "heart", caption: "Likes por video · por semana" },
  "Comments per Video": { group: "inter", icon: "bubble", caption: "Comentarios por video · por semana" },
  "Posts per Week": { group: "rhythm", icon: "calendar", caption: "Videos publicados · por semana", wide: true },
  "Posting Streak": { group: "rhythm", icon: "flame", caption: "Semanas con al menos un post" },
  "Best Posting Day": { group: "rhythm", icon: "sun", caption: "Views promedio por día · mín. 5 videos" },
  "Best Posting Hour": { group: "rhythm", icon: "clock", caption: "Views promedio por hora · gana con mín. 5 videos", wide: true },
};

function DetailIcon({ id }: { id: DetailIconId }) {
  const common = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<DetailIconId, ReactNode> = {
    avg: <path d="M5 19V11M10 19V6M15 19v-9M20 19v-5M4 19h17" {...common} />,
    median: <path d="M4 17h16M7 17V9M12 17V5M17 17v-6M4 12h16" {...common} strokeDasharray="2 2.5" />,
    account: (
      <>
        <circle cx="12" cy="8.5" r="3.5" {...common} />
        <path d="M5.5 19.5c.9-3.2 3.5-5 6.5-5s5.6 1.8 6.5 5" {...common} />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" {...common} />
        <circle cx="12" cy="12" r="4" {...common} />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </>
    ),
    pie: (
      <>
        <path d="M12 4a8 8 0 1 0 8 8h-8V4Z" {...common} />
        <path d="M15 3.6A8 8 0 0 1 20.4 9H15V3.6Z" fill="currentColor" />
      </>
    ),
    heart: <path d="M12 19s-6.5-3.9-6.5-8.3C5.5 8 7.2 6.3 9.4 6.3c1.3 0 2.2.6 2.6 1.6.4-1 1.3-1.6 2.6-1.6 2.2 0 3.9 1.7 3.9 4.4C18.5 15.1 12 19 12 19Z" {...common} />,
    bubble: <path d="M6 17.5 4.5 20V7.5A2 2 0 0 1 6.5 5.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6Z" {...common} />,
    share: (
      <>
        <path d="M14 6.5 19 11l-5 4.5" {...common} />
        <path d="M19 11h-8.5A5 5 0 0 0 5.5 16v1.5" {...common} />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2.5" {...common} />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" {...common} />
      </>
    ),
    flame: <path d="M12 20c3.3 0 6-2.4 6-5.8 0-3.3-2.4-5.2-3.4-8.2-1.8 1.2-2.6 3-2.6 4.6-1-.7-1.6-1.8-1.7-3C8 9.3 6 11.6 6 14.2 6 17.6 8.7 20 12 20Z" {...common} />,
    sun: (
      <>
        <circle cx="12" cy="12" r="3.5" {...common} />
        <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" {...common} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" {...common} />
        <path d="M12 7.5V12l3 2" {...common} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      {paths[id]}
    </svg>
  );
}

function DetailStat({
  label,
  value,
  hint,
  about,
  chart,
  group,
  icon,
  caption,
}: {
  label: string;
  value: string;
  hint: string;
  about: About;
  chart: ChartSpec;
  group: GroupId;
  icon: DetailIconId;
  caption: string;
}) {
  return (
    <div className="vt-liquid-glass relative flex h-full flex-col overflow-hidden rounded-[22px] backdrop-blur-2xl">
      <span className="absolute right-3 top-3 z-10">
        <MetricInfo about={about} />
      </span>
      <div className="relative flex items-start gap-3 px-4 pt-4 pr-10">
        <span
          className="vt-liquid-icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ color: GROUPS[group].color }}
        >
          <DetailIcon id={icon} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--muted)]">{label}</p>
          <p className="text-[24px] font-semibold leading-tight tracking-tight text-[var(--foreground)] tabular-nums">{value}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted-soft)]">{hint}</p>
        </div>
      </div>
      <div className="relative mt-auto pt-4">
        <p className="px-4 pb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--muted-soft)]">{caption}</p>
        <div className="flex min-h-[84px] flex-col justify-end">
          <MiniChart spec={chart} />
        </div>
      </div>
    </div>
  );
}

const TOP_COLOR = "#d97706";

function TopCard({
  icon,
  title,
  subtitle,
  about,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  about: About;
  children: ReactNode;
}) {
  return (
    <div className="vt-liquid-glass relative flex h-full flex-col overflow-hidden rounded-[22px] backdrop-blur-2xl">
      <span className="absolute right-3 top-3 z-10">
        <MetricInfo about={about} />
      </span>
      <div className="relative flex items-center gap-3 px-4 pt-4 pr-10">
        <span className="vt-liquid-icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: TOP_COLOR }}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
          <p className="text-[12px] text-[var(--muted-soft)]">{subtitle}</p>
        </div>
      </div>
      <div className="relative flex-1 px-4 pb-4 pt-4">{children}</div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const metal = rank === 1 ? "vt-metal-gold" : rank === 2 ? "vt-metal-silver" : rank === 3 ? "vt-metal-bronze" : "";
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
        metal || "bg-black/[0.05] text-[var(--muted)]"
      }`}
    >
      {rank}
    </span>
  );
}

function ShareBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/[0.06]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: `linear-gradient(90deg, ${TOP_COLOR}99, ${TOP_COLOR})` }}
      />
    </span>
  );
}

function TopEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/40 px-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-[var(--muted)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-[var(--muted-soft)]">{body}</p>
    </div>
  );
}

function TopVideosCard({ videos }: { videos: TrackedVideo[] }) {
  const max = videos[0]?.views ?? 0;
  return (
    <TopCard
      title="Top videos"
      subtitle="Más views en total"
      about={{
        what: "Los 5 videos con más views de todos los que estás trackeando.",
        how: "Se ordenan los videos por views totales. La barra compara cada uno contra el primero.",
        why: "Ver qué piezas funcionan para repetir el formato, el gancho o el tema.",
      }}
      icon={
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <rect x="5" y="4" width="14" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M10.5 9.5v5l4-2.5-4-2.5Z" fill="currentColor" />
        </svg>
      }
    >
      {videos.length === 0 ? (
        <TopEmpty title="Aún no hay videos" body="Agrega links en Videos o Accounts para ver el ranking." />
      ) : (
        <ul className="space-y-3">
          {videos.map((video, index) => (
            <li key={video.id}>
              <a href={video.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl transition-colors">
                <RankBadge rank={index + 1} />
                <span className="h-11 w-8 shrink-0 overflow-hidden rounded-lg bg-[#111827] shadow-[0_2px_6px_rgba(17,24,39,0.18)]">
                  {video.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-[var(--foreground)] group-hover:underline">
                      {video.title || video.url}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                      {formatCompact(video.views)}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] text-[var(--muted-soft)]">@{(video.author || "").replace(/^@/, "")}</span>
                  <ShareBar value={video.views} max={max} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </TopCard>
  );
}

function TopRefreshedCard({ videos }: { videos: TrackedVideo[] }) {
  const cutoff = Date.now() - 14 * 86_400_000;
  const gaining = videos
    .filter((video) => video.viewsPrev > 0 && video.views > video.viewsPrev)
    .filter((video) => new Date(video.postedAt || video.createdAt).getTime() < cutoff)
    .map((video) => ({ video, gain: video.views - video.viewsPrev }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);
  const measured = videos.some((video) => video.viewsPrev > 0);
  const max = gaining[0]?.gain ?? 0;
  return (
    <TopCard
      title="Top refreshed"
      subtitle="Videos viejos que siguen ganando views"
      about={{
        what: "Videos con más de 14 días que ganaron views entre la medición anterior y la actual.",
        how: "Views actuales − views de la medición anterior, solo en videos publicados hace más de 14 días.",
        why: "Detectar contenido que el algoritmo vuelve a empujar y que vale la pena reciclar o promocionar.",
      }}
      icon={
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M4 16.5 9 11.5l3.5 3.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7.5h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      {gaining.length === 0 ? (
        <TopEmpty
          title={measured ? "Sin crecimiento por ahora" : "Falta una segunda medición"}
          body={
            measured
              ? "Ningún video de más de 14 días ganó views desde la última actualización."
              : "Las views se midieron una sola vez. En cuanto se refresquen de nuevo, aquí aparecen los videos que siguen creciendo."
          }
        />
      ) : (
        <ul className="space-y-3">
          {gaining.map(({ video, gain }, index) => (
            <li key={video.id} className="flex items-center gap-3">
              <RankBadge rank={index + 1} />
              <span className="h-11 w-8 shrink-0 overflow-hidden rounded-lg bg-[#111827]">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-[var(--foreground)]">{video.title || video.url}</span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#15803d]">+{formatCompact(gain)}</span>
                </span>
                <span className="block truncate text-[11px] text-[var(--muted-soft)]">{formatCompact(video.views)} views en total</span>
                <ShareBar value={gain} max={max} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </TopCard>
  );
}

function TopAccountsCard({
  rows,
  total,
}: {
  rows: { account: TrackedAccount; views: number; count: number }[];
  total: number;
}) {
  const max = rows[0]?.views ?? 0;
  return (
    <TopCard
      title="Top accounts"
      subtitle="Más views en total"
      about={{
        what: "Las cuentas trackeadas ordenadas por las views de sus videos.",
        how: "Suma de las views de los videos de cada cuenta. El porcentaje es su parte del total.",
        why: "Ver qué cuenta carga el alcance y cuál necesita más atención.",
      }}
      icon={
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.4M17 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      {rows.length === 0 ? (
        <TopEmpty title="Aún no hay cuentas" body="Agrega cuentas en Accounts para compararlas aquí." />
      ) : (
        <ul className="space-y-3.5">
          {rows.map(({ account, views, count }, index) => (
            <li key={account.id} className="flex items-center gap-3">
              <RankBadge rank={index + 1} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={account.avatarUrl || "https://unavatar.io/fallback"}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-[0_2px_6px_rgba(17,24,39,0.15)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--foreground)]">@{(account.username || "").replace(/^@/, "")}</span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">{formatCompact(views)}</span>
                </span>
                <span className="block text-[11px] text-[var(--muted-soft)]">
                  {count} {count === 1 ? "video" : "videos"} · {total > 0 ? formatRate((views / total) * 100) : "0%"} del total
                </span>
                <ShareBar value={views} max={max} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </TopCard>
  );
}

export function OverviewPage({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<"kpis" | "graph">("kpis");
  const [moreOpen, setMoreOpen] = useState(false);
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
  const saves = filteredVideos.reduce((s, v) => s + v.saves, 0);
  const engagement = engagementRate({ views, likes, comments, shares, saves });
  const topVideos = [...filteredVideos].sort((a, b) => b.views - a.views).slice(0, 5);
  const topAccounts = [...filteredAccounts]
    .map((a) => {
      const user = (a.username || "").replace(/^@/, "").toLowerCase();
      const related = filteredVideos.filter(
        (v) => (v.author || "").replace(/^@/, "").toLowerCase() === user
      );
      return { account: a, views: related.reduce((s, v) => s + v.views, 0), count: related.length };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const recentMonth = filteredVideos.filter((video) => inWindow(video, 0, 30));
  const priorMonth = filteredVideos.filter((video) => inWindow(video, 30, 60));
  const sumOf = (list: TrackedVideo[], pick: (video: TrackedVideo) => number) =>
    list.reduce((total, video) => total + pick(video), 0);
  const rateOf = (list: TrackedVideo[]) =>
    engagementRate({
      views: sumOf(list, (video) => video.views),
      likes: sumOf(list, (video) => video.likes),
      comments: sumOf(list, (video) => video.comments),
      shares: sumOf(list, (video) => video.shares),
      saves: sumOf(list, (video) => video.saves),
    });
  const accountsIn = (list: TrackedVideo[]) =>
    new Set(list.map((video) => (video.author || "").replace(/^@/, "").toLowerCase()).filter(Boolean)).size;

  const kpis = [
    {
      id: "views",
      label: "Views",
      value: formatCompact(views),
      change: periodChange(sumOf(recentMonth, (video) => video.views), sumOf(priorMonth, (video) => video.views)),
      points: dailyTotals(filteredVideos, (video) => video.views),
      about: {
        what: "El alcance acumulado de todos los videos que estás trackeando.",
        how: "Suma de las views de cada video.",
        why: "Ver cuánta gente llegó al contenido en total, sin mezclarlo con likes o comentarios.",
      },
    },
    {
      id: "likes",
      label: "Likes",
      value: formatCompact(likes),
      change: periodChange(sumOf(recentMonth, (video) => video.likes), sumOf(priorMonth, (video) => video.likes)),
      points: dailyTotals(filteredVideos, (video) => video.likes),
      about: {
        what: "Cuántas veces gustó el contenido, sumando todos los videos.",
        how: "Suma de los likes de cada video.",
        why: "Medir aprobación. Un total alto con pocas views indica que gustó a quien lo vio.",
      },
    },
    {
      id: "comments",
      label: "Comments",
      value: formatCompact(comments),
      change: periodChange(sumOf(recentMonth, (video) => video.comments), sumOf(priorMonth, (video) => video.comments)),
      points: dailyTotals(filteredVideos, (video) => video.comments),
      about: {
        what: "La conversación que generan los videos.",
        how: "Suma de los comentarios de cada video.",
        why: "Ver si el contenido hace que la gente responda, no solo que lo mire.",
      },
    },
    {
      id: "shares",
      label: "Shares",
      value: formatCompact(shares),
      change: periodChange(sumOf(recentMonth, (video) => video.shares), sumOf(priorMonth, (video) => video.shares)),
      points: dailyTotals(filteredVideos, (video) => video.shares),
      about: {
        what: "Cuántas veces se compartió el contenido.",
        how: "Suma de los shares de cada video.",
        why: "Es de las señales más fuertes de alcance: compartir expande el video fuera de quien ya lo vio.",
      },
    },
    {
      id: "engagement",
      label: "Engagement Rate",
      value: `${engagement.toFixed(1)}%`,
      change: rateChange(rateOf(recentMonth), rateOf(priorMonth)),
      points: dailyTotals(filteredVideos, (video) =>
        engagementRate({
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: video.shares,
          saves: video.saves,
        })
      ),
      about: {
        what: "Qué parte de quien ve el video también interactúa.",
        how: "(Likes + comentarios + shares + guardados) ÷ views × 100.",
        why: "Comparar calidad de respuesta aunque una cuenta tenga muchas más views que otra.",
      },
    },
    {
      id: "posted",
      label: "Posted Videos",
      value: String(filteredVideos.length),
      change: periodChange(recentMonth.length, priorMonth.length),
      points: dailyTotals(filteredVideos, () => 1),
      about: {
        what: "Cuántos videos hay trackeados en este filtro.",
        how: "Conteo de videos publicados.",
        why: "El volumen contra el que se dividen promedios, tasas y la constancia.",
      },
    },
    {
      id: "accounts",
      label: "Active Accounts",
      value: String(filteredAccounts.length),
      change: periodChange(accountsIn(recentMonth), accountsIn(priorMonth)),
      points: dailyTotals(filteredVideos, () => 1),
      about: {
        what: "Cuentas que estás trackeando en este filtro.",
        how: "Conteo de cuentas activas. El cambio compara cuentas que publicaron en los últimos 30 días contra los 30 anteriores.",
        why: "Saber sobre cuántas cuentas se reparte el alcance.",
      },
    },
  ].map((item) => ({ ...item, chart: kpiChart(item, filteredVideos) }));

  const detail = useMemo(() => {
    const count = filteredVideos.length;
    if (count === 0) return null;
    const viewList = filteredVideos.map((video) => video.views);
    const totalViews = viewList.reduce((sum, value) => sum + value, 0);
    const totalLikes = filteredVideos.reduce((sum, video) => sum + video.likes, 0);
    const totalComments = filteredVideos.reduce((sum, video) => sum + video.comments, 0);
    const totalShares = filteredVideos.reduce((sum, video) => sum + video.shares, 0);
    const sortedViews = [...viewList].sort((a, b) => b - a);
    const shareOf = (take: number) =>
      totalViews > 0 ? (sortedViews.slice(0, take).reduce((sum, value) => sum + value, 0) / totalViews) * 100 : 0;
    const over = (threshold: number) => viewList.filter((value) => value >= threshold).length;
    const times = postingTimes(filteredVideos);
    const span =
      times.length === 0
        ? 1
        : Math.round((weekStart(Date.now()) - weekStart(Math.min(...times))) / (7 * 86_400_000)) + 1;
    const day = bestBucket(filteredVideos, (date) => date.getDay(), 5) ?? bestBucket(filteredVideos, (date) => date.getDay());
    const hour = bestBucket(filteredVideos, (date) => date.getHours(), 5) ?? bestBucket(filteredVideos, (date) => date.getHours());
    const hit1k = over(1_000);
    const hit10k = over(10_000);
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const dayShort = ["L", "M", "X", "J", "V", "S", "D"];
    const byDay = dayOrder.map((weekday, index) => {
      const rows = filteredVideos.filter((video) => new Date(video.postedAt || video.createdAt).getDay() === weekday);
      const avg = rows.length ? rows.reduce((sum, video) => sum + video.views, 0) / rows.length : 0;
      return { label: dayShort[index], value: avg };
    });
    const byHour = Array.from({ length: 24 }, (_, hour) => {
      const rows = filteredVideos.filter((video) => new Date(video.postedAt || video.createdAt).getHours() === hour);
      const avg = rows.length ? rows.reduce((sum, video) => sum + video.views, 0) / rows.length : 0;
      return { label: "", value: avg };
    });
    const weekCount = 12;
    const currentWeek = weekStart(Date.now());
    const byWeek = Array.from({ length: weekCount }, (_, index) => {
      const start = currentWeek - (weekCount - 1 - index) * 7 * 86_400_000;
      const value = filteredVideos.filter((video) => {
        const time = new Date(video.postedAt || video.createdAt).getTime();
        return !Number.isNaN(time) && weekStart(time) === start;
      }).length;
      return { label: "", value };
    });
    const weekly = Array.from({ length: weekCount }, (_, index) => {
      const start = currentWeek - (weekCount - 1 - index) * 7 * 86_400_000;
      const rows = filteredVideos.filter((video) => {
        const time = new Date(video.postedAt || video.createdAt).getTime();
        return !Number.isNaN(time) && weekStart(time) === start;
      });
      return {
        n: rows.length,
        views: rows.reduce((sum, video) => sum + video.views, 0),
        likes: rows.reduce((sum, video) => sum + video.likes, 0),
        comments: rows.reduce((sum, video) => sum + video.comments, 0),
        shares: rows.reduce((sum, video) => sum + video.shares, 0),
      };
    });
    const top10Views = sortedViews.slice(0, 10).reduce((sum, value) => sum + value, 0);
    const streakWeeks = postingStreak(times);
    const accountBars = [...filteredAccounts]
      .map((account) => {
        const user = (account.username || "").replace(/^@/, "").toLowerCase();
        const value = filteredVideos
          .filter((video) => (video.author || "").replace(/^@/, "").toLowerCase() === user)
          .reduce((sum, video) => sum + video.views, 0);
        return { label: `@${user || "cuenta"}`, value, display: formatCompact(value) };
      })
      .sort((a, b) => b.value - a.value);
    const top5Views = sortedViews.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const accountTotal = accountBars.reduce((sum, item) => sum + item.value, 0);
    const perf = GROUPS.perf.color;
    const inter = GROUPS.inter.color;
    const rhythm = GROUPS.rhythm.color;
    const median = medianOf(viewList);
    const buckets = [
      { label: "<250", min: 0, max: 250 },
      { label: "250", min: 250, max: 500 },
      { label: "500", min: 500, max: 1_000 },
      { label: "1K", min: 1_000, max: 5_000 },
      { label: "5K+", min: 5_000, max: Number.POSITIVE_INFINITY },
    ];
    const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
    const shades = [perf, "#818cf8", "#c7d2fe", "#e0e7ff"];
    const charts: Record<string, ChartSpec> = {
      "Avg Views per Video": {
        type: "smooth",
        id: "d-avg",
        color: perf,
        filled: true,
        points: weekly.map((week) => ratio(week.views, week.n)),
      },
      "Median Views": {
        type: "highlight",
        color: perf,
        best: buckets.findIndex((bucket) => median >= bucket.min && median < bucket.max),
        items: buckets.map((bucket) => ({
          label: bucket.label,
          value: viewList.filter((value) => value >= bucket.min && value < bucket.max).length,
        })),
      },
      "Views per Account": {
        type: "segments",
        slices: (accountBars.length ? accountBars : [{ label: "—", value: 0, display: "0" }]).map((item, index) => ({
          id: item.label,
          label: item.label,
          value: item.value,
          display: `${item.display} · ${accountTotal > 0 ? formatRate((item.value / accountTotal) * 100) : "0%"}`,
          color: shades[index % shades.length],
        })),
      },
      "Hit Rate": {
        type: "gauge",
        percent: (hit1k / count) * 100,
        color: perf,
        caption: `${hit1k} de ${count} videos`,
      },
      "Top Video Concentration": {
        type: "segments",
        slices: [
          { id: "top5", label: "Top 5", value: top5Views, display: formatRate(shareOf(5)), color: perf },
          {
            id: "top10",
            label: "Del 6 al 10",
            value: Math.max(0, top10Views - top5Views),
            display: formatRate(Math.max(0, shareOf(10) - shareOf(5))),
            color: "#a5b4fc",
          },
          {
            id: "rest",
            label: "Resto",
            value: Math.max(0, totalViews - top10Views),
            display: formatRate(Math.max(0, 100 - shareOf(10))),
            color: "#e4e4e7",
          },
        ],
      },
      "Like Rate": {
        type: "smooth",
        id: "d-like-rate",
        color: inter,
        filled: true,
        points: weekly.map((week) => ratio(week.likes, week.views) * 100),
      },
      "Comment Rate": {
        type: "smooth",
        id: "d-comment-rate",
        color: inter,
        filled: false,
        points: weekly.map((week) => ratio(week.comments, week.views) * 100),
      },
      "Share Rate": {
        type: "glow",
        color: inter,
        points: weekly.map((week) => ratio(week.shares, week.views) * 100),
      },
      "Likes per Video": {
        type: "glow",
        color: inter,
        points: weekly.map((week) => ratio(week.likes, week.n)),
      },
      "Comments per Video": {
        type: "smooth",
        id: "d-comments-video",
        color: inter,
        filled: true,
        points: weekly.map((week) => ratio(week.comments, week.n)),
      },
      "Posts per Week": {
        type: "glow",
        color: rhythm,
        points: byWeek.map((item) => item.value),
      },
      "Posting Streak": { type: "streak", color: rhythm, weeks: byWeek.map((item) => item.value > 0), streak: streakWeeks },
      "Best Posting Day": {
        type: "highlight",
        color: rhythm,
        best: day ? dayOrder.indexOf(day.key) : null,
        items: byDay,
      },
      "Best Posting Hour": {
        type: "highlight",
        color: rhythm,
        best: hour ? hour.key : null,
        items: byHour.map((item, index) => ({ ...item, label: index % 3 === 0 ? `${index}h` : "" })),
      },
    };
    return [
      {
        label: "Avg Views per Video",
        value: formatPrecise(totalViews / count),
        hint: "Views ÷ videos publicados",
        about: {
          what: "Cuánto rinde en promedio cada video.",
          how: "Views totales ÷ videos publicados.",
          why: "Comparar rendimiento entre periodos o cuentas. Un solo viral sube este número.",
        },
      },
      {
        label: "Median Views",
        value: formatPrecise(medianOf(viewList)),
        hint: "La mitad de los videos queda por debajo",
        about: {
          what: "Las views del video que queda en el medio si los ordenas de menor a mayor.",
          how: "Mediana de las views de cada video. Con un número par de videos, el promedio de los dos del centro.",
          why: "Es más honesta que el promedio: un viral no la infla.",
        },
      },
      {
        label: "Views per Account",
        value: filteredAccounts.length > 0 ? formatPrecise(totalViews / filteredAccounts.length) : "—",
        hint: `Views totales ÷ ${filteredAccounts.length} cuentas trackeadas`,
        about: {
          what: "Cuántas views le tocan en promedio a cada cuenta.",
          how: "Views totales ÷ cuentas trackeadas. La barra muestra cuánto aporta cada una.",
          why: "Comparar el rendimiento entre cuentas sin que una con más videos domine el total.",
        },
      },
      {
        label: "Like Rate",
        value: formatRate(totalViews > 0 ? (totalLikes / totalViews) * 100 : 0),
        hint: "Likes ÷ views",
        about: {
          what: "Qué tanto gusta el contenido a quien ya lo está viendo.",
          how: "(Likes ÷ views) × 100.",
          why: "Separar alcance de aprobación. Muchas views con tasa baja significa que llega, pero no convence.",
        },
      },
      {
        label: "Comment Rate",
        value: formatRate(totalViews > 0 ? (totalComments / totalViews) * 100 : 0),
        hint: "Comments ÷ views",
        about: {
          what: "Cuánta conversación genera cada vista.",
          how: "(Comentarios ÷ views) × 100.",
          why: "Ver si el contenido invita a responder, no solo a dejar un like.",
        },
      },
      {
        label: "Share Rate",
        value: formatRate(totalViews > 0 ? (totalShares / totalViews) * 100 : 0),
        hint: "Shares ÷ views",
        about: {
          what: "La tasa de viralidad: cuántas vistas terminan en un compartir.",
          how: "(Shares ÷ views) × 100.",
          why: "Compartir es lo que más expande el alcance. Es una de las señales más fuertes para el algoritmo.",
        },
      },
      {
        label: "Likes per Video",
        value: formatPrecise(totalLikes / count),
        hint: "Promedio de likes por publicación",
        about: {
          what: "Cuántos likes deja en promedio cada publicación.",
          how: "Likes totales ÷ videos publicados.",
          why: "Comparar cuentas o periodos sin que el que publicó más acumule un total más grande solo por volumen.",
        },
      },
      {
        label: "Comments per Video",
        value: formatPrecise(totalComments / count),
        hint: "Promedio de comentarios por publicación",
        about: {
          what: "Cuántos comentarios deja en promedio cada publicación.",
          how: "Comentarios totales ÷ videos publicados.",
          why: "Comparar la conversación por pieza, no por el total de la cuenta.",
        },
      },
      {
        label: "Hit Rate",
        value: formatRate((hit1k / count) * 100),
        hint: `${hit1k} de ${count} superan 1K · ${formatRate((hit10k / count) * 100)} superan 10K`,
        about: {
          what: "Qué porcentaje de videos supera un umbral de views.",
          how: "Videos con 1.000 views o más ÷ videos publicados × 100. También se muestra el corte de 10.000.",
          why: "Ver si el resultado es consistente o si solo unos pocos videos despegan.",
        },
      },
      {
        label: "Top Video Concentration",
        value: formatRate(shareOf(5)),
        hint: `El top 10 concentra ${formatRate(shareOf(10))}`,
        about: {
          what: "Qué parte de todas las views viene de los mejores videos.",
          how: "Views de los 5 videos con más views ÷ views totales × 100. La nota de abajo usa el top 10.",
          why: "Si el porcentaje es muy alto, el alcance depende de pocos virales.",
        },
      },
      {
        label: "Posts per Week",
        value: formatPrecise(count / Math.max(1, span)),
        hint: `${count} videos en ${span} semanas`,
        about: {
          what: "El ritmo de publicación desde el primer video hasta hoy.",
          how: "Videos publicados ÷ semanas entre la semana del primer video y la semana actual.",
          why: "Ver si la constancia acompaña los resultados.",
        },
      },
      {
        label: "Posting Streak",
        value: `${streakWeeks} sem`,
        hint: "Semanas seguidas publicando",
        about: {
          what: "Cuántas semanas seguidas hubo al menos un video.",
          how: "Se cuenta hacia atrás desde esta semana. Si esta semana aún no hay post, la racha no se corta todavía.",
          why: "Leer la constancia junto al calendario de actividad.",
        },
      },
      {
        label: "Best Posting Day",
        value: day ? DAY_NAMES[day.key] : "—",
        hint: day ? `${formatPrecise(day.avg)} views prom. · ${day.n} videos` : "Sin fecha de publicación",
        about: {
          what: "El día de la semana con mejor promedio de views.",
          how: "Promedio de views de los videos publicados ese día. Solo cuenta si hay al menos 5 videos.",
          why: "Elegir en qué día publicar cuando el promedio es más alto.",
        },
      },
      {
        label: "Best Posting Hour",
        value: hour ? `${String(hour.key).padStart(2, "0")}:00` : "—",
        hint: hour ? `${formatPrecise(hour.avg)} views prom. · ${hour.n} videos` : "Sin hora de publicación",
        about: {
          what: "La hora local con mejor promedio de views.",
          how: "Promedio de views de los videos publicados a esa hora. Solo cuenta si hay al menos 5 videos, para que uno solo no la marque.",
          why: "Elegir una hora de publicación con una muestra real, no con un viral suelto.",
        },
      },
    ].map((item) => ({ ...item, ...DETAIL_META[item.label], chart: charts[item.label] }));
  }, [filteredVideos, filteredAccounts.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--muted)]">
          {filteredAccounts.length} {filteredAccounts.length === 1 ? "cuenta" : "cuentas"}
        </div>
        <div className="min-w-[180px] flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--muted)]">
          Totales históricos · cambio: 30 días vs 30 previos
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

      <VideoPodium videos={filteredVideos} accounts={filteredAccounts} />

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
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.slice(0, 4).map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
            </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.slice(4).map((item) => (
              <KpiCard key={item.id} item={item} />
          ))}
        </div>
        </>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[13px] text-[var(--muted-soft)]">
          {filteredVideos.length === 0
            ? "Charts will appear when tracking data is available"
            : `${filteredVideos.length} videos trackeados`}
        </div>
      )}

      {detail ? (
      <section>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="vt-more-metrics"
            onClick={() => setMoreOpen((open) => !open)}
            className="vt-liquid-glass group relative flex w-full items-center gap-4 overflow-hidden rounded-[22px] px-5 py-4 text-left backdrop-blur-2xl transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]"
          >
            <span className="vt-liquid-icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" />
              </svg>
                    </span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--foreground)]">Más métricas</span>
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--muted)]">
                  {detail.length + 3}
                      </span>
                    </span>
              <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                Promedios, tasas, ritmo de publicación y top performers
                    </span>
                    </span>
            <span className="relative hidden text-[12px] font-medium text-[var(--muted)] sm:block">{moreOpen ? "Ocultar" : "Ver todo"}</span>
            <span
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111113] text-white shadow-[0_6px_16px_rgba(17,24,39,0.22)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                moreOpen ? "rotate-180" : ""
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
                    </span>
          </button>
          <div
            id="vt-more-metrics"
            inert={!moreOpen}
            className="grid transition-[grid-template-rows,opacity] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ gridTemplateRows: moreOpen ? "1fr" : "0fr", opacity: moreOpen ? 1 : 0 }}
          >
            <div className="-mx-2 overflow-hidden px-2">
              <div className="space-y-6 pb-2 pt-5">
                {(Object.keys(GROUPS) as GroupId[]).map((groupId) => {
                  const items = detail.filter((item) => item.group === groupId);
                  return (
                    <div key={groupId}>
                      <div className="mb-3 flex items-baseline gap-2 px-1">
                        <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: GROUPS[groupId].color }} />
                        <h4 className="text-[13px] font-semibold text-[var(--foreground)]">{GROUPS[groupId].name}</h4>
                        <span className="truncate text-[12px] text-[var(--muted-soft)]">{GROUPS[groupId].description}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => {
                          const order = detail.indexOf(item);
                          return (
                            <div
                              key={item.label}
                              className={`transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${item.wide ? "sm:col-span-2" : ""}`}
                              style={{
                                opacity: moreOpen ? 1 : 0,
                                transform: moreOpen ? "translateY(0) scale(1)" : "translateY(14px) scale(0.97)",
                                filter: moreOpen ? "none" : "blur(4px)",
                                transitionDelay: moreOpen ? `${80 + order * 30}ms` : "0ms",
                              }}
                            >
                              <DetailStat
                                label={item.label}
                                value={item.value}
                                hint={item.hint}
                                about={item.about}
                                chart={item.chart}
                                group={item.group}
                                icon={item.icon}
                                caption={item.caption}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <div className="mb-3 flex items-baseline gap-2 px-1">
                    <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: TOP_COLOR }} />
                    <h4 className="text-[13px] font-semibold text-[var(--foreground)]">Top performers</h4>
                    <span className="truncate text-[12px] text-[var(--muted-soft)]">Los videos y cuentas que más aportan</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {[
                      <TopVideosCard key="videos" videos={topVideos} />,
                      <TopRefreshedCard key="refreshed" videos={filteredVideos} />,
                      <TopAccountsCard key="accounts" rows={topAccounts} total={views} />,
                    ].map((card, index) => (
                      <div
                        key={index}
                        className="transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                          opacity: moreOpen ? 1 : 0,
                          transform: moreOpen ? "translateY(0) scale(1)" : "translateY(14px) scale(0.97)",
                          filter: moreOpen ? "none" : "blur(4px)",
                          transitionDelay: moreOpen ? `${80 + (detail.length + index) * 30}ms` : "0ms",
                        }}
                      >
                        {card}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </section>
      ) : null}

      <section className="rounded-[22px] border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.03)] sm:p-6">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Actividad de publicación</h3>
          <p className="text-[12px] text-[var(--muted-soft)]">Cada cuadro es un día. Pasa el cursor para ver cuántos videos se publicaron.</p>
        </div>
        <Heatmap dates={filteredVideos.map((v) => v.postedAt || v.createdAt)} />
      </section>

    </div>
  );
}
