"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MARKET_COUNTRIES, type MarketApp } from "@/lib/market/appstore";
import type { KeywordAnalysis } from "@/lib/market/keywords";
import type { TimelineEvent } from "@/lib/market/snapshots";
import {
  AppIcon,
  compact,
  COUNTRY_OPTIONS,
  Empty,
  fetchMarket,
  FilterSelect,
  flag,
  PageTitle,
  Rating,
  shortDate,
  SkeletonRows,
  useMarket,
  type IconComp,
  type PageProps,
} from "./shared";
import { AppPicker, GhostButton, miniApp, Modal, PrimaryButton, TrashButton, useMarketItems, type MiniApp } from "./items";

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const IconKey: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="8.5" cy="14.5" r="4" />
    <path d="m11.5 11.5 8-8M16.5 6.5l2 2M14.5 8.5l1.5 1.5" />
  </Svg>
);
export const IconPhone: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M10.5 6h3" />
  </Svg>
);
export const IconRadar: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 12 18 6" />
  </Svg>
);

/* ======================= KEYWORDS ======================= */

type KeywordItem = {
  term: string;
  country: string;
  popularity: KeywordAnalysis["popularity"];
  difficulty: KeywordAnalysis["difficulty"];
  resultCount: number;
  ranking: string[];
  topApp: { id: string; name: string; icon: string | null } | null;
  checkedAt: string;
};

function toKeywordItem(analysis: KeywordAnalysis): KeywordItem {
  const top = analysis.top[0];
  return {
    term: analysis.term,
    country: analysis.country,
    popularity: analysis.popularity,
    difficulty: analysis.difficulty,
    resultCount: analysis.resultCount,
    ranking: analysis.ranking.slice(0, 200),
    topApp: top ? { id: top.id, name: top.name, icon: top.icon } : null,
    checkedAt: new Date().toISOString(),
  };
}

function isOpportunity(item: KeywordItem) {
  return item.popularity.score >= 35 && item.difficulty.score <= 55;
}

function ScoreBar({ value, tone }: { value: number; tone: "pop" | "diff" }) {
  const color = tone === "pop" ? "#0d9488" : value >= 70 ? "#e11d48" : value >= 45 ? "#f59e0b" : "#16a34a";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, value)}%`, background: color }} />
      </span>
      <span className="w-6 text-right text-[12px] font-semibold tabular-nums">{value}</span>
    </span>
  );
}

export function KeywordsPage({ projectId, country, setCountry, onOpen }: PageProps) {
  const { items, loading, save, remove } = useMarketItems<KeywordItem>(projectId, "keyword");
  const myApps = useMarketItems<{ app: MiniApp; country: string }>(projectId, "my_app");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<"all" | "opp" | "low">("all");
  const [sort, setSort] = useState<"new" | "pop" | "diff">("new");
  const [selected, setSelected] = useState<string | null>(null);

  const scoped = items.filter((item) => item.data.country === country);
  const list = scoped
    .filter((item) => (filter === "opp" ? isOpportunity(item.data) : filter === "low" ? item.data.difficulty.score <= 35 : true))
    .sort((a, b) =>
      sort === "pop"
        ? b.data.popularity.score - a.data.popularity.score
        : sort === "diff"
          ? a.data.difficulty.score - b.data.difficulty.score
          : b.created_at.localeCompare(a.created_at)
    );
  const active = scoped.find((item) => item.key === selected) ?? list[0] ?? null;

  async function addTerms(raw: string) {
    const terms = [...new Set(raw.split(/[,\n;]/).map((t) => t.toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 20);
    if (!terms.length) return;
    let last: string | null = null;
    for (const [index, term] of terms.entries()) {
      setBusy(`Analizando “${term}” (${index + 1}/${terms.length})…`);
      try {
        const analysis = await fetchMarket<KeywordAnalysis>(projectId, { op: "keyword", term, country });
        const key = `${country}:${analysis.term}`;
        await save(key, toKeywordItem(analysis));
        last = key;
      } catch {
        /* skip failed term */
      }
    }
    setBusy("");
    setDraft("");
    if (last) setSelected(last);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void addTerms(draft);
  }

  const counts = {
    all: scoped.length,
    opp: scoped.filter((item) => isOpportunity(item.data)).length,
    low: scoped.filter((item) => item.data.difficulty.score <= 35).length,
  };

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconKey}
        title="Keyword Explorer"
        subtitle="Popularidad, dificultad y keywords relacionadas, con datos de búsqueda de la App Store"
        action={<FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <section className="flex min-h-[420px] flex-col rounded-[24px] border border-[var(--border)] bg-white">
          <div className="space-y-3 border-b border-[var(--border)] p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">
                Tus keywords <span className="text-[var(--muted)]">{scoped.length}</span>
              </p>
              <FilterSelect
                label="Ordenar"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "new", label: "Recientes" },
                  { value: "pop", label: "Más populares" },
                  { value: "diff", label: "Más fáciles" },
                ]}
              />
            </div>
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe o pega keywords separadas por coma…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 text-[13px] outline-none focus:border-black/25"
              />
              <PrimaryButton type="submit" disabled={!draft.trim() || Boolean(busy)}>
                Explorar
              </PrimaryButton>
            </form>
            {busy ? <p className="text-[12px] text-[var(--muted)]">{busy}</p> : null}
            <div className="flex gap-1.5">
              {(
                [
                  ["all", "Todas"],
                  ["opp", "Oportunidades"],
                  ["low", "Baja dificultad"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`h-7 rounded-full border px-2.5 text-[12px] transition ${
                    filter === id ? "border-[#111113] bg-[#111113] font-semibold text-white" : "border-[var(--border)] text-[var(--foreground-soft)] hover:border-black/20"
                  }`}
                >
                  {label} <span className="tabular-nums opacity-70">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-[12px] text-[var(--muted)]">Cargando…</p>
            ) : list.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[13px] font-semibold">{scoped.length ? "Ninguna keyword con este filtro" : "Aún no tienes keywords"}</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">Añade una arriba para ver su popularidad, dificultad y sugerencias.</p>
              </div>
            ) : (
              <ul>
                <li className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--border)] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                  <span>Keyword</span>
                  <span className="w-[86px]">Popularidad</span>
                  <span className="w-[86px]">Dificultad</span>
                </li>
                {list.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.key)}
                      className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--border)] px-3.5 py-2.5 text-left transition last:border-0 ${
                        active?.key === item.key ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-alt)]/60"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{item.data.term}</span>
                        {isOpportunity(item.data) ? <span className="text-[10px] font-semibold text-[#0f766e]">Oportunidad</span> : null}
                      </span>
                      <span className="w-[86px]">
                        <ScoreBar value={item.data.popularity.score} tone="pop" />
                      </span>
                      <span className="w-[86px]">
                        <ScoreBar value={item.data.difficulty.score} tone="diff" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {active ? (
          <KeywordDetail
            key={active.key}
            projectId={projectId}
            item={active.data}
            myApps={myApps.items.filter((row) => row.data.country === country).map((row) => row.data.app)}
            tracked={new Set(scoped.map((row) => row.data.term))}
            onAdd={(term) => void addTerms(term)}
            onRemove={() => {
              void remove(active.key);
              setSelected(null);
            }}
            onRefresh={() => void addTerms(active.data.term)}
            onOpen={onOpen}
          />
        ) : (
          <section className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[var(--border)] bg-white p-8 text-center">
            <div>
              <p className="text-[14px] font-semibold">Elige una keyword</p>
              <p className="mt-1 max-w-[340px] text-[12px] text-[var(--muted)]">Verás quién la domina hoy, qué tan difícil es entrar y keywords parecidas que Apple sugiere.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function KeywordDetail({
  projectId,
  item,
  myApps,
  tracked,
  onAdd,
  onRemove,
  onRefresh,
  onOpen,
}: {
  projectId: string;
  item: KeywordItem;
  myApps: MiniApp[];
  tracked: Set<string>;
  onAdd: (term: string) => void;
  onRemove: () => void;
  onRefresh: () => void;
  onOpen: (app: MarketApp) => void;
}) {
  const { data, loading } = useMarket<KeywordAnalysis>(projectId, { op: "keyword", term: item.term, country: item.country });
  const pop = item.popularity;
  const diff = item.difficulty;
  const mine = myApps.map((app) => ({ app, position: item.ranking.indexOf(app.id) }));

  return (
    <section className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
            {flag(item.country)} {MARKET_COUNTRIES.find((c) => c.code === item.country)?.name}
          </p>
          <h2 className="text-[24px] font-semibold tracking-tight">{item.term}</h2>
          <p className="text-[11px] text-[var(--muted)]">Analizada {shortDate(item.checkedAt)}</p>
        </div>
        <div className="flex gap-1.5">
          <GhostButton onClick={onRefresh}>Actualizar</GhostButton>
          <TrashButton label="Dejar de seguir" onClick={onRemove} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="vt-liquid-glass rounded-[20px] p-4">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">Popularidad</p>
          <p className="relative text-[28px] font-semibold tabular-nums">
            {pop.score}
            <span className="text-[14px] text-[var(--muted)]">/100</span>
          </p>
          <p className="relative text-[11px] leading-snug text-[var(--muted)]">
            {pop.prefix
              ? `Apple la sugiere al escribir “${pop.prefix}” (posición ${pop.position}). Menos letras = más búsquedas.`
              : "Apple no la sugiere en el autocompletado: poca gente la busca."}
          </p>
        </div>
        <div className="vt-liquid-glass rounded-[20px] p-4">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">Dificultad</p>
          <p className="relative text-[28px] font-semibold tabular-nums">
            {diff.score}
            <span className="text-[14px] text-[var(--muted)]">/100</span>
          </p>
          <p className="relative text-[11px] leading-snug text-[var(--muted)]">
            El top {diff.sample} tiene en promedio {compact(diff.avgRatings)} calificaciones y {diff.titleMatches} usan la keyword en su nombre.
          </p>
        </div>
        <div className="vt-liquid-glass rounded-[20px] p-4">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">{mine.length ? "Tus apps" : "Resultados"}</p>
          {mine.length ? (
            <div className="relative mt-1 space-y-1.5">
              {mine.map(({ app, position }) => (
                <p key={app.id} className="flex items-center gap-2 text-[13px]">
                  <AppIcon src={app.icon} name={app.name} size={22} />
                  <span className="min-w-0 flex-1 truncate">{app.name}</span>
                  <span className="font-semibold tabular-nums">{position >= 0 ? `#${position + 1}` : "Fuera del top 200"}</span>
                </p>
              ))}
            </div>
          ) : (
            <>
              <p className="relative text-[28px] font-semibold tabular-nums">{item.resultCount >= 200 ? "200+" : item.resultCount}</p>
              <p className="relative text-[11px] text-[var(--muted)]">Apps que Apple muestra para esta búsqueda. Añade tu app en “Tus apps” para ver su posición.</p>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold">Quién la domina hoy</p>
        {loading || !data ? (
          <SkeletonRows />
        ) : (
          <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
            {data.top.map((app) => (
              <li key={app.id}>
                <button type="button" onClick={() => onOpen(app)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--surface-alt)]/60">
                  <span className="w-6 text-center text-[12px] font-semibold tabular-nums text-[var(--muted)]">{app.rank}</span>
                  <AppIcon src={app.icon} name={app.name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{app.name}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{app.genre}</span>
                  </span>
                  <Rating value={app.rating} count={app.ratingCount} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold">Keywords relacionadas que sugiere Apple</p>
        {loading || !data ? (
          <p className="text-[12px] text-[var(--muted)]">Cargando…</p>
        ) : data.related.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">Apple no sugiere variantes para esta keyword.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.related.map((term) => (
              <button
                key={term}
                type="button"
                disabled={tracked.has(term)}
                onClick={() => onAdd(term)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 text-[12px] transition hover:border-black/25 disabled:opacity-50"
              >
                {tracked.has(term) ? "✓" : "+"} {term}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ======================= TRACKED APPS (shared) ======================= */

type TrackedApp = { app: MiniApp; country: string };
type SeriesPoint = { day: string; rating: number | null; ratingCount: number; freeRank: number | null; grossingRank: number | null; version: string };
type TrackPayload = { apps: MarketApp[]; events: TimelineEvent[]; series: Record<string, SeriesPoint[]> };

function useTracked(projectId: string, kind: "my_app" | "competitor", country: string) {
  const store = useMarketItems<TrackedApp>(projectId, kind);
  const ids = store.items.filter((item) => item.data.country === country).map((item) => item.key);
  const track = useMarket<TrackPayload>(projectId, ids.length ? { op: "track", ids: ids.join(","), country } : null);
  return { store, ids, track };
}

function AddTrackedModal({
  open,
  title,
  projectId,
  country,
  exclude,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  projectId: string;
  country: string;
  exclude: string[];
  onClose: () => void;
  onPick: (app: MarketApp) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <AppPicker autoFocus projectId={projectId} country={country} exclude={exclude} onPick={onPick} />
    </Modal>
  );
}

function Spark({ values, invert, color }: { values: (number | null)[]; invert?: boolean; color: string }) {
  const points = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (points.length < 2) return <span className="text-[11px] text-[var(--muted-soft)]">Se completa con los días</span>;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = max - min || 1;
  const w = 120;
  const h = 32;
  const d = points
    .map((p, idx) => {
      const x = (p.i / Math.max(1, values.length - 1)) * w;
      const norm = (p.v - min) / span;
      const y = invert ? 3 + norm * (h - 6) : h - 3 - norm * (h - 6);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const EVENT_FILTERS = [
  { id: "all", label: "Todo", types: null },
  { id: "version", label: "Versiones", types: ["version", "launch"] },
  { id: "store", label: "Ficha de la tienda", types: ["name", "icon", "screenshots", "description"] },
  { id: "rating", label: "Ratings", types: ["rating", "ratings"] },
  { id: "rank", label: "Rankings", types: ["rank"] },
  { id: "price", label: "Precio", types: ["price"] },
] as const;

function Timeline({ events, apps, limit }: { events: TimelineEvent[]; apps: Map<string, MarketApp>; limit?: number }) {
  const [filter, setFilter] = useState<(typeof EVENT_FILTERS)[number]["id"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const types = EVENT_FILTERS.find((f) => f.id === filter)?.types;
  const shown = events.filter((event) => !types || (types as readonly string[]).includes(event.type)).slice(0, limit ?? 200);
  const byDay = new Map<string, TimelineEvent[]>();
  for (const event of shown) byDay.set(event.day, [...(byDay.get(event.day) ?? []), event]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {EVENT_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`h-7 rounded-full border px-2.5 text-[12px] transition ${
              filter === option.id ? "border-[#111113] bg-[#111113] font-semibold text-white" : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-black/20"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12px] text-[var(--muted)]">Sin cambios de este tipo todavía.</p>
      ) : (
        <ol className="space-y-4">
          {[...byDay.entries()].map(([day, list]) => (
            <li key={day}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                {new Date(`${day}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
              <ul className="space-y-1.5">
                {list.map((event, index) => {
                  const app = apps.get(event.appId);
                  const id = `${day}-${event.appId}-${index}`;
                  return (
                    <li key={id} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <AppIcon src={app?.icon ?? null} name={app?.name ?? "?"} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] text-[var(--muted)]">{app?.name}</span>
                          <span className="block text-[13px] font-semibold">{event.title}</span>
                          {event.detail && event.type !== "version" ? <span className="block text-[12px] text-[var(--muted)]">{event.detail}</span> : null}
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${event.tone === "up" ? "bg-[#16a34a]" : event.tone === "down" ? "bg-[#e11d48]" : "bg-[#94a3b8]"}`}
                          aria-hidden
                        />
                      </div>
                      {event.type === "version" && event.detail ? (
                        <div className="mt-2 pl-[42px]">
                          <p className={`whitespace-pre-line text-[12px] text-[var(--foreground-soft)] ${open === id ? "" : "line-clamp-2"}`}>{event.detail}</p>
                          <button type="button" onClick={() => setOpen(open === id ? null : id)} className="text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
                            {open === id ? "Ver menos" : "Ver notas"}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function latest(series: SeriesPoint[] | undefined) {
  return series?.at(-1) ?? null;
}

/* ======================= YOUR APPS ======================= */

export function MyAppsPage({ projectId, country, setCountry, onOpen }: PageProps) {
  const { store, track } = useTracked(projectId, "my_app", country);
  const keywords = useMarketItems<KeywordItem>(projectId, "keyword");
  const [adding, setAdding] = useState(false);
  const scoped = store.items.filter((item) => item.data.country === country);
  const apps = new Map((track.data?.apps ?? []).map((app) => [app.id, app]));

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconPhone}
        title="Tus apps"
        subtitle="Rating, rankings y posición en tus keywords, revisado cada día"
        action={
          <div className="flex items-center gap-2">
            <FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />
            <PrimaryButton onClick={() => setAdding(true)}>+ Añadir app</PrimaryButton>
          </div>
        }
      />

      {store.loading ? (
        <SkeletonRows />
      ) : scoped.length === 0 ? (
        <Empty>
          <p className="text-[14px] font-semibold text-[var(--foreground)]">Añade tu app</p>
          <p className="mx-auto mt-1 max-w-[440px]">Búscala por nombre en la App Store. Guardamos una foto diaria de su rating y rankings, y la cruzamos con tus keywords.</p>
          <div className="mt-4 flex justify-center">
            <PrimaryButton onClick={() => setAdding(true)}>+ Añadir app</PrimaryButton>
          </div>
        </Empty>
      ) : (
        <div className="space-y-4">
          {scoped.map((item) => {
            const app = apps.get(item.key);
            const series = track.data?.series[item.key] ?? [];
            const now = latest(series);
            const kws = keywords.items
              .filter((row) => row.data.country === country)
              .map((row) => ({ term: row.data.term, position: row.data.ranking.indexOf(item.key), pop: row.data.popularity.score }))
              .sort((a, b) => (a.position < 0 ? 999 : a.position) - (b.position < 0 ? 999 : b.position));
            const events = (track.data?.events ?? []).filter((event) => event.appId === item.key);
            return (
              <section key={item.key} className="space-y-4 rounded-[26px] border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onOpen({ id: item.key } as MarketApp)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <AppIcon src={app?.icon ?? item.data.app.icon} name={item.data.app.name} size={56} />
                    <span className="min-w-0">
                      <span className="block truncate text-[18px] font-semibold">{app?.name ?? item.data.app.name}</span>
                      <span className="block truncate text-[12px] text-[var(--muted)]">
                        {item.data.app.seller} · {now?.version ? `v${now.version}` : ""} · actualizada {shortDate(app?.updatedAt ?? null)}
                      </span>
                    </span>
                  </button>
                  <TrashButton label="Quitar app" onClick={() => void store.remove(item.key)} />
                </div>

                {track.loading && !track.data ? (
                  <SkeletonRows />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Rating" value={app?.rating ? `★ ${app.rating.toFixed(2)}` : "—"} hint={`${(app?.ratingCount ?? 0).toLocaleString("es")} calificaciones`}>
                      <Spark values={series.map((p) => p.ratingCount)} color="#f59e0b" />
                    </Stat>
                    <Stat label="Top gratis" value={now?.freeRank ? `#${now.freeRank}` : "Fuera del top 100"} hint={`${flag(country)} general`}>
                      <Spark values={series.map((p) => p.freeRank)} invert color="#4338ca" />
                    </Stat>
                    <Stat label="Top ingresos" value={now?.grossingRank ? `#${now.grossingRank}` : "Fuera del top 100"} hint={`${flag(country)} general`}>
                      <Spark values={series.map((p) => p.grossingRank)} invert color="#15803d" />
                    </Stat>
                    <Stat label="Días registrados" value={String(series.length)} hint={series[0] ? `Desde ${shortDate(series[0].day)}` : "Empieza hoy"} />
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[13px] font-semibold">Posición en tus keywords</p>
                    {kws.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[12px] text-[var(--muted)]">
                        Añade keywords en Keyword Explorer para ver dónde aparece tu app.
                      </p>
                    ) : (
                      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
                        {kws.map((kw) => (
                          <li key={kw.term} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                            <span className="min-w-0 flex-1 truncate font-medium">{kw.term}</span>
                            <span className="text-[11px] text-[var(--muted)]">pop. {kw.pop}</span>
                            <span
                              className={`w-[92px] text-right font-semibold tabular-nums ${
                                kw.position < 0 ? "text-[var(--muted-soft)]" : kw.position < 10 ? "text-[#15803d]" : "text-[var(--foreground)]"
                              }`}
                            >
                              {kw.position < 0 ? "Fuera top 200" : `#${kw.position + 1}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-semibold">Últimos cambios</p>
                    <Timeline events={events} apps={apps} limit={8} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AddTrackedModal
        open={adding}
        title="Añadir tu app"
        projectId={projectId}
        country={country}
        exclude={scoped.map((item) => item.key)}
        onClose={() => setAdding(false)}
        onPick={(app) => {
          setAdding(false);
          void store.save(app.id, { app: miniApp(app), country });
        }}
      />
    </div>
  );
}

function Stat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="vt-liquid-glass rounded-[20px] p-4">
      <p className="relative text-[12px] font-medium text-[var(--muted)]">{label}</p>
      <p className="relative text-[22px] font-semibold tabular-nums">{value}</p>
      {hint ? <p className="relative text-[11px] text-[var(--muted)]">{hint}</p> : null}
      {children ? <div className="relative mt-2">{children}</div> : null}
    </div>
  );
}

/* ======================= COMPETITORS ======================= */

export function CompetitorsPage({ projectId, country, setCountry, onOpen }: PageProps) {
  const { store, track } = useTracked(projectId, "competitor", country);
  const [adding, setAdding] = useState(false);
  const [focusRaw, setFocus] = useState<string | null>(null);
  const scoped = store.items.filter((item) => item.data.country === country);
  const focus = focusRaw && scoped.some((item) => item.key === focusRaw) ? focusRaw : null;
  const apps = useMemo(() => new Map((track.data?.apps ?? []).map((app) => [app.id, app])), [track.data]);
  const events = (track.data?.events ?? []).filter((event) => !focus || event.appId === focus);

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconRadar}
        title="Competidores"
        subtitle="Lanzamientos, actualizaciones, cambios en la ficha y movimientos de ranking en una línea de tiempo diaria"
        action={<FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-[24px] border border-[var(--border)] bg-white p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[13px] font-semibold">
              Apps seguidas <span className="text-[var(--muted)]">{scoped.length}</span>
            </p>
            <button type="button" onClick={() => setAdding(true)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[#0f766e] hover:bg-[#ccfbf1]">
              + Añadir
            </button>
          </div>
          {store.loading ? (
            <p className="px-1 py-3 text-[12px] text-[var(--muted)]">Cargando…</p>
          ) : scoped.length === 0 ? (
            <p className="px-1 py-6 text-center text-[12px] text-[var(--muted)]">Añade las apps con las que compites.</p>
          ) : (
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className={`w-full rounded-xl px-2.5 py-2 text-left text-[13px] font-medium ${focus === null ? "bg-[var(--accent-soft)] font-semibold" : "hover:bg-[var(--surface-alt)]"}`}
                >
                  Todas
                </button>
              </li>
              {scoped.map((item) => (
                <li key={item.key} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => setFocus(item.key)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${focus === item.key ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-alt)]"}`}
                  >
                    <AppIcon src={item.data.app.icon} name={item.data.app.name} size={30} />
                    <span className="min-w-0 truncate text-[13px] font-medium">{item.data.app.name}</span>
                  </button>
                  <span className="opacity-0 transition group-hover:opacity-100">
                    <TrashButton label="Dejar de seguir" onClick={() => void store.remove(item.key)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="space-y-4">
          {scoped.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                    <th className="px-3 py-2.5">App</th>
                    <th className="px-3 py-2.5 text-right">Rating</th>
                    <th className="px-3 py-2.5">Versión</th>
                    <th className="px-3 py-2.5">Actualizada</th>
                    <th className="px-3 py-2.5 text-right">Top gratis</th>
                    <th className="px-3 py-2.5 text-right">Top ingresos</th>
                    <th className="px-3 py-2.5">Calificaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {scoped.map((item) => {
                    const app = apps.get(item.key);
                    const series = track.data?.series[item.key] ?? [];
                    const now = latest(series);
                    return (
                      <tr key={item.key} onClick={() => onOpen({ id: item.key } as MarketApp)} className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-alt)]/60">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2.5">
                            <AppIcon src={app?.icon ?? item.data.app.icon} name={item.data.app.name} size={32} />
                            <span className="max-w-[220px] truncate font-semibold">{app?.name ?? item.data.app.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2">{app ? <Rating value={app.rating} count={app.ratingCount} /> : "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{now?.version || "—"}</td>
                        <td className="px-3 py-2 text-[12px] text-[var(--muted)]">{shortDate(app?.updatedAt ?? null)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{now?.freeRank ? `#${now.freeRank}` : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{now?.grossingRank ? `#${now.grossingRank}` : "—"}</td>
                        <td className="px-3 py-2">
                          <Spark values={series.map((p) => p.ratingCount)} color="#f59e0b" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
            <div className="mb-3">
              <p className="text-[15px] font-semibold">Línea de tiempo</p>
              <p className="text-[12px] text-[var(--muted)]">
                Revisamos cada app una vez al día. Los cambios de ficha, rating y ranking aparecen desde que empiezas a seguirla; lanzamientos y versiones vienen de Apple.
              </p>
            </div>
            {scoped.length === 0 ? (
              <Empty>
                <div className="flex flex-col items-center gap-3">
                  <span>Sigue a tus competidores para ver cada cambio que hacen.</span>
                  <PrimaryButton onClick={() => setAdding(true)}>+ Añadir competidor</PrimaryButton>
                </div>
              </Empty>
            ) : track.loading && !track.data ? (
              <SkeletonRows />
            ) : (
              <Timeline events={events} apps={apps} />
            )}
          </section>
        </div>
      </div>

      <AddTrackedModal
        open={adding}
        title="Seguir competidor"
        projectId={projectId}
        country={country}
        exclude={scoped.map((item) => item.key)}
        onClose={() => setAdding(false)}
        onPick={(app) => {
          setAdding(false);
          void store.save(app.id, { app: miniApp(app), country });
        }}
      />
    </div>
  );
}
