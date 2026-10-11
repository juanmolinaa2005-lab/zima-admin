"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MARKET_COUNTRIES, type MarketApp, type MarketChart, type MarketReview } from "@/lib/market/appstore";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { MarketIcon } from "./icons";
import {
  AppIcon,
  AppTable,
  bytes,
  CHART_LABEL,
  compact,
  COUNTRY_OPTIONS,
  Empty,
  FavButton,
  FilterSelect,
  flag,
  GENRE_OPTIONS,
  IconApps,
  IconReviews,
  IconSearch,
  IconTrend,
  NavItem,
  PageTitle,
  Segmented,
  shortDate,
  SkeletonRows,
  Star,
  useFavorites,
  useMarket,
  type DetailPayload,
  type IconComp,
  type PageProps,
} from "./market/shared";
import { AdsPage, IconAds, IconOnboarding, IconOrganic, OnboardingsPage, OrganicPage } from "./market/LibraryPages";
import { IconKey, IconPhone, KeywordsPage, MyAppsPage } from "./market/AsoPages";

type PageId = "organic" | "onboardings" | "explore" | "ads" | "rankings" | "keywords" | "myapps" | "reviews";
const PAGES = new Set<PageId>(["organic", "onboardings", "explore", "ads", "rankings", "keywords", "myapps", "reviews"]);

function pageFrom(raw: string | null): PageId {
  return raw && PAGES.has(raw as PageId) ? (raw as PageId) : "organic";
}
/* ---------------- pages ---------------- */


function ExplorePage({ projectId, country, setCountry, favorites, onFavorite, onOpen }: PageProps) {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [genre, setGenre] = useState("");
  const [price, setPrice] = useState<"all" | "free" | "paid">("all");
  const [minRating, setMinRating] = useState("0");
  const [minReviews, setMinReviews] = useState("0");
  const [released, setReleased] = useState("0");

  const params = term
    ? { op: "search", term, country, ...(genre ? { genre } : {}) }
    : { op: "chart", chart: "grossing", limit: "200", country, ...(genre ? { genre } : {}) };
  const { data, loading, error } = useMarket<{ items: MarketApp[] }>(projectId, params);

  const filtered = useMemo(() => {
    const cutoff = Number(released) ? Date.now() - Number(released) * 30.44 * 86_400_000 : 0;
    return (data?.items ?? []).filter((app) => {
      if (price === "free" && app.price > 0) return false;
      if (price === "paid" && app.price === 0) return false;
      if ((app.rating ?? 0) < Number(minRating)) return false;
      if (app.ratingCount < Number(minReviews)) return false;
      if (cutoff && (!app.releasedAt || new Date(app.releasedAt).getTime() < cutoff)) return false;
      return true;
    });
  }, [data, price, minRating, minReviews, released]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setTerm(draft.trim());
  }

  const countryName = MARKET_COUNTRIES.find((c) => c.code === country)?.name ?? country;

  return (
    <div className="space-y-4">
      <PageTitle icon={IconApps} title="Explorar apps" subtitle="Busca cualquier app de la App Store y filtra lo que está funcionando" />
      <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white p-1.5 pl-3.5 focus-within:border-black/25">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Busca apps, desarrolladores o nichos (ej. hábitos, oración, fitness)…"
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted-soft)]"
        />
        {term ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setTerm("");
            }}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)]"
          >
            Limpiar
          </button>
        ) : null}
        <button type="submit" className="ui-btn-primary h-9 rounded-xl px-4 text-[13px] font-semibold text-white">
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />
        <FilterSelect label="Categoría" value={genre} options={GENRE_OPTIONS} onChange={setGenre} />
        <FilterSelect
          label="Precio"
          value={price}
          options={[
            { value: "all", label: "Cualquier precio" },
            { value: "free", label: "Gratis" },
            { value: "paid", label: "De pago" },
          ]}
          onChange={setPrice}
        />
        <FilterSelect
          label="Rating mínimo"
          value={minRating}
          options={[
            { value: "0", label: "Cualquier rating" },
            { value: "3", label: "★ 3.0+" },
            { value: "4", label: "★ 4.0+" },
            { value: "4.5", label: "★ 4.5+" },
          ]}
          onChange={setMinRating}
        />
        <FilterSelect
          label="Reseñas mínimas"
          value={minReviews}
          options={[
            { value: "0", label: "Cualquier nº de reseñas" },
            { value: "100", label: "100+ reseñas" },
            { value: "1000", label: "1K+ reseñas" },
            { value: "10000", label: "10K+ reseñas" },
            { value: "100000", label: "100K+ reseñas" },
          ]}
          onChange={setMinReviews}
        />
        <FilterSelect
          label="Lanzada"
          value={released}
          options={[
            { value: "0", label: "Cualquier fecha" },
            { value: "1", label: "Último mes" },
            { value: "3", label: "Últimos 3 meses" },
            { value: "6", label: "Últimos 6 meses" },
            { value: "12", label: "Último año" },
          ]}
          onChange={setReleased}
        />
      </div>

      <p className="text-[12px] text-[var(--muted)]">
        {loading
          ? "Cargando…"
          : term
            ? `${filtered.length} resultados para “${term}” en ${countryName}`
            : `${filtered.length} apps del top de ingresos de ${countryName}`}
      </p>

      {error ? <Empty>{error}</Empty> : loading ? <SkeletonRows /> : filtered.length === 0 ? (
        <Empty>No hay apps con esos filtros.</Empty>
      ) : (
        <AppTable apps={filtered} showRank={!term} favorites={favorites} onFavorite={onFavorite} onOpen={onOpen} />
      )}
    </div>
  );
}

type Movement = { change: number | null; isNew: boolean; trend: (number | null)[] };
type ChartPayload = { items: MarketApp[]; movement: Record<string, Movement>; previousDay: string | null; historyDays: number };

function RankTrend({ trend }: { trend: (number | null)[] }) {
  const points = trend.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (trend.length < 2 || points.length < 2) return <span className="block h-7 w-[110px]" />;
  const w = 110;
  const h = 28;
  const max = Math.max(...points.map((p) => p.v), 10);
  const min = Math.min(...points.map((p) => p.v), 1);
  const span = max - min || 1;
  const d = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${((p.i / (trend.length - 1)) * w).toFixed(1)},${(3 + ((p.v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1].v <= points[0].v;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[110px]" aria-label="Posición en los últimos días">
      <path d={d} fill="none" stroke={up ? "#16a34a" : "#e11d48"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MovePill({ move }: { move: Movement | undefined }) {
  if (!move) return null;
  if (move.isNew) return <span className="rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[11px] font-semibold text-[#4338ca]">Nuevo</span>;
  if (move.change === null) return <span className="text-[12px] text-[var(--muted-soft)]">—</span>;
  if (move.change === 0) return <span className="text-[12px] text-[var(--muted-soft)]">=</span>;
  const up = move.change > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${up ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fee2e2] text-[#be123c]"}`}>
      {up ? "↑" : "↓"} {Math.abs(move.change)}
    </span>
  );
}

function RankingsPage({ projectId, country, setCountry, favorites, onFavorite, onOpen }: PageProps) {
  const [chart, setChart] = useState<MarketChart>("free");
  const [genre, setGenre] = useState("");
  const { data, loading, error } = useMarket<ChartPayload>(projectId, {
    op: "chart",
    chart,
    country,
    limit: "100",
    ...(genre ? { genre } : {}),
  });
  const history = data
    ? data.previousDay
      ? `Movimiento vs ${shortDate(data.previousDay)} · ${data.historyDays} días registrados`
      : "Empezamos a registrar este ranking hoy. El movimiento diario y la tendencia aparecen a partir de mañana."
    : "";
  return (
    <div className="space-y-4">
      <PageTitle icon={IconTrend} title="Tendencias" subtitle="Top charts oficiales de la App Store con su movimiento diario" />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Ranking"
          value={chart}
          onChange={setChart}
          options={[
            { value: "free", label: "Top gratis" },
            { value: "paid", label: "Top de pago" },
            { value: "grossing", label: "Top ingresos" },
          ]}
        />
        <FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />
        <FilterSelect label="Categoría" value={genre} options={GENRE_OPTIONS} onChange={setGenre} />
      </div>
      {history ? <p className="text-[12px] text-[var(--muted)]">{history}</p> : null}
      {error ? <Empty>{error}</Empty> : loading || !data ? <SkeletonRows /> : data.items.length === 0 ? (
        <Empty>Apple no devolvió ranking para esta combinación.</Empty>
      ) : (
        <AppTable
          apps={data.items}
          showRank
          favorites={favorites}
          onFavorite={onFavorite}
          onOpen={onOpen}
          extraColumn={{
            label: "Movimiento",
            render: (app) => (
              <span className="flex items-center justify-end gap-3">
                <MovePill move={data.movement?.[app.id]} />
                <RankTrend trend={data.movement?.[app.id]?.trend ?? []} />
              </span>
            ),
          }}
        />
      )}
    </div>
  );
}

function ReviewsPage({ projectId, country, setCountry, onOpen }: PageProps) {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<MarketApp | null>(null);
  const search = useMarket<{ items: MarketApp[] }>(projectId, term ? { op: "search", term, country } : null);
  const detail = useMarket<DetailPayload>(projectId, picked ? { op: "app", appId: picked.id, country } : null);

  return (
    <div className="space-y-4">
      <PageTitle icon={IconReviews} title="Análisis de reseñas" subtitle="Qué aman y qué odian los usuarios de cualquier app" />
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(draft.trim());
            setPicked(null);
          }}
          className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-[var(--border)] bg-white p-1.5 pl-3.5"
        >
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Busca la app que quieres analizar…"
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          />
          <button type="submit" className="ui-btn-primary h-9 rounded-xl px-4 text-[13px] font-semibold text-white">
            Buscar
          </button>
        </form>
        <FilterSelect label="País" value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />
      </div>

      {picked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3">
            <AppIcon src={picked.icon} name={picked.name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{picked.name}</p>
              <p className="truncate text-[12px] text-[var(--muted)]">{picked.seller}</p>
            </div>
            <button type="button" onClick={() => onOpen(picked)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-[12px] font-semibold hover:bg-[var(--surface-alt)]">
              Ver ficha completa
            </button>
            <button type="button" onClick={() => setPicked(null)} className="rounded-xl px-3 py-2 text-[12px] text-[var(--muted)] hover:bg-[var(--surface-alt)]">
              Cambiar app
            </button>
          </div>
          {detail.loading || !detail.data ? <SkeletonRows /> : <ReviewAnalytics reviews={detail.data.reviews} />}
        </div>
      ) : term ? (
        search.loading || !search.data ? (
          <SkeletonRows />
        ) : search.data.items.length === 0 ? (
          <Empty>No encontramos apps con “{term}”.</Empty>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {search.data.items.slice(0, 24).map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setPicked(app)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-black/20"
              >
                <AppIcon src={app.icon} name={app.name} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{app.name}</span>
                  <span className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
                    <Star className="h-3 w-3 text-[#f59e0b]" />
                    {app.rating?.toFixed(1) ?? "—"} · {compact(app.ratingCount)} reseñas
                  </span>
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <Empty>Busca una app para ver cómo la califican sus usuarios.</Empty>
      )}
    </div>
  );
}

/* ---------------- reviews analytics ---------------- */

const STOP = new Set(
  "the and for that this with you are app was but not have just its it's all can they when what your from like get has had too very more out one use been there their them would will only about also than then into any some even app. i'm i've don't doesn't can't it’s de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras esos esas estoy estás está estamos estáis están app aplicación".split(
    " "
  )
);

function topWords(reviews: MarketReview[]) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    const words = new Set(
      `${review.title} ${review.content}`
        .toLowerCase()
        .replace(/[^\p{L}\s']/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOP.has(word))
    );
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function ReviewAnalytics({ reviews }: { reviews: MarketReview[] }) {
  const [stars, setStars] = useState<number | null>(null);
  if (reviews.length === 0) return <Empty>Apple no tiene reseñas recientes de esta app en este país.</Empty>;
  const dist = [5, 4, 3, 2, 1].map((value) => ({ value, count: reviews.filter((r) => r.rating === value).length }));
  const max = Math.max(1, ...dist.map((d) => d.count));
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const positive = reviews.filter((r) => r.rating >= 4).length / reviews.length;
  const negative = reviews.filter((r) => r.rating <= 2).length / reviews.length;
  const loved = topWords(reviews.filter((r) => r.rating >= 4));
  const hated = topWords(reviews.filter((r) => r.rating <= 2));
  const list = stars ? reviews.filter((r) => r.rating === stars) : reviews;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="vt-liquid-glass rounded-[22px] p-5">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">Promedio de {reviews.length} reseñas</p>
          <div className="relative mt-1 flex items-end gap-2">
            <span className="text-[34px] font-semibold leading-none tabular-nums">{avg.toFixed(1)}</span>
            <span className="mb-1 flex text-[#f59e0b]">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`h-4 w-4 ${i <= Math.round(avg) ? "" : "opacity-25"}`} />
              ))}
            </span>
          </div>
          <div className="relative mt-4 space-y-1.5">
            {dist.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setStars((s) => (s === d.value ? null : d.value))}
                className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-[12px] transition hover:bg-white/60 ${stars === d.value ? "bg-white/80" : ""}`}
              >
                <span className="w-3 tabular-nums text-[var(--muted)]">{d.value}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(d.count / max) * 100}%`, background: d.value >= 4 ? "#16a34a" : d.value === 3 ? "#f59e0b" : "#e11d48" }}
                  />
                </span>
                <span className="w-7 text-right tabular-nums text-[var(--foreground-soft)]">{d.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="vt-liquid-glass rounded-[22px] p-5">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">Sentimiento</p>
          <div className="relative mt-2 flex items-baseline gap-3">
            <span className="text-[26px] font-semibold text-[#16a34a]">{Math.round(positive * 100)}%</span>
            <span className="text-[13px] text-[var(--muted)]">positivas</span>
          </div>
          <div className="relative mt-2 flex h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
            <span style={{ width: `${positive * 100}%` }} className="bg-[#16a34a]" />
            <span style={{ width: `${(1 - positive - negative) * 100}%` }} className="bg-[#f59e0b]" />
            <span style={{ width: `${negative * 100}%` }} className="bg-[#e11d48]" />
          </div>
          <p className="relative mt-2 text-[12px] text-[var(--muted)]">
            <span className="font-semibold text-[#e11d48]">{Math.round(negative * 100)}%</span> negativas (1–2 ★)
          </p>
          <p className="relative mt-4 text-[12px] font-medium text-[var(--muted)]">Lo que más mencionan al quejarse</p>
          <div className="relative mt-2 flex flex-wrap gap-1.5">
            {hated.length ? hated.map(([word, n]) => (
              <span key={word} className="rounded-full bg-[#ffe4e6] px-2 py-0.5 text-[11px] font-medium text-[#be123c]">
                {word} · {n}
              </span>
            )) : <span className="text-[12px] text-[var(--muted-soft)]">Sin suficientes quejas</span>}
          </div>
        </div>
        <div className="vt-liquid-glass rounded-[22px] p-5">
          <p className="relative text-[12px] font-medium text-[var(--muted)]">Lo que más mencionan al elogiarla</p>
          <div className="relative mt-2 flex flex-wrap gap-1.5">
            {loved.length ? loved.map(([word, n]) => (
              <span key={word} className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-medium text-[#15803d]">
                {word} · {n}
              </span>
            )) : <span className="text-[12px] text-[var(--muted-soft)]">Sin suficientes elogios</span>}
          </div>
          <p className="relative mt-4 text-[12px] font-medium text-[var(--muted)]">Versiones más reseñadas</p>
          <div className="relative mt-2 space-y-1">
            {[...reviews.reduce((map, r) => map.set(r.version, (map.get(r.version) ?? 0) + 1), new Map<string, number>())]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([version, n]) => (
                <div key={version} className="flex justify-between text-[12px]">
                  <span className="text-[var(--foreground-soft)]">v{version || "?"}</span>
                  <span className="tabular-nums text-[var(--muted)]">{n} reseñas</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">{stars ? `Reseñas de ${stars} ★` : "Reseñas recientes"}</p>
          {stars ? (
            <button type="button" onClick={() => setStars(null)} className="text-[12px] text-[var(--muted)] hover:text-[var(--foreground)]">
              Ver todas
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {list.slice(0, 30).map((review) => (
            <article key={review.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex text-[#f59e0b]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i <= review.rating ? "" : "opacity-20"}`} />
                  ))}
                </span>
                <span className="text-[11px] text-[var(--muted-soft)]">
                  {shortDate(review.updatedAt)} · v{review.version}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold text-[var(--foreground)]">{review.title}</p>
              <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-[var(--foreground-soft)]">{review.content}</p>
              <p className="mt-2 text-[11px] text-[var(--muted-soft)]">{review.author}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- app detail ---------------- */

function MetricCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`vt-liquid-glass rounded-[20px] p-4 ${accent ? "border-l-4 border-l-[#0d9488]" : ""}`}>
      <p className="relative text-[12px] text-[var(--muted)]">{label}</p>
      <p className={`relative mt-1 font-semibold tabular-nums tracking-tight ${accent ? "text-[30px] text-[#0d9488]" : "text-[20px] text-[var(--foreground)]"}`}>{value}</p>
      {hint ? <p className="relative mt-0.5 text-[11px] text-[var(--muted-soft)]">{hint}</p> : null}
    </div>
  );
}

function AppDetailPage({
  projectId,
  appId,
  country,
  favorites,
  onFavorite,
  onBack,
  onOpen,
}: {
  projectId: string;
  appId: string;
  country: string;
  favorites: string[];
  onFavorite: (id: string) => void;
  onBack: () => void;
  onOpen: (app: MarketApp) => void;
}) {
  const { data, loading, error } = useMarket<DetailPayload>(projectId, { op: "app", appId, country });
  const [expanded, setExpanded] = useState(false);

  if (error) return <Empty>{error}</Empty>;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-[28px] bg-white" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-[20px] bg-white" />
          <div className="h-28 animate-pulse rounded-[20px] bg-white" />
        </div>
        <p className="text-center text-[12px] text-[var(--muted)]">Revisando rankings en {MARKET_COUNTRIES.length} países…</p>
      </div>
    );
  }

  const { app, reviews, ranks, similar } = data;
  const positive = reviews.length ? reviews.filter((r) => r.rating >= 4).length / reviews.length : null;
  const recentAvg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const shots = app.screenshots.length ? app.screenshots : app.ipadScreenshots;

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
        <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-white hover:text-[var(--foreground)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </button>
        <span>/</span>
        <span className="truncate font-medium text-[var(--foreground)]">{app.name}</span>
      </nav>

      <section className="vt-liquid-glass rounded-[28px] p-5 sm:p-6">
        <div className="relative flex flex-wrap items-start gap-5">
          <AppIcon src={app.icon} name={app.name} size={92} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]">{app.name}</h1>
            <p className="text-[14px] font-medium text-[#0d9488]">{app.seller}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--muted)]">
              <span>
                Lanzada <b className="text-[var(--foreground-soft)]">{shortDate(app.releasedAt)}</b>
              </span>
              <span>
                Última actualización <b className="text-[var(--foreground-soft)]">{shortDate(app.updatedAt)}</b>
              </span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[#ccfbf1] px-2.5 py-1 text-[11px] font-semibold text-[#0f766e]">{app.genre}</span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-medium">{app.price > 0 ? app.formattedPrice : "Gratis"}</span>
              {app.contentRating ? <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-medium">{app.contentRating}</span> : null}
              {positive !== null ? (
                <span className="flex items-center gap-2 rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-medium">
                  Sentimiento <b className="text-[#16a34a]">{Math.round(positive * 100)}% positivo</b>
                  <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[#fecdd3]">
                    <span className="bg-[#16a34a]" style={{ width: `${positive * 100}%` }} />
                  </span>
                </span>
          ) : null}
            </div>
            {ranks.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ranks.slice(0, 18).map((hit) => (
                  <span
                    key={`${hit.country}-${hit.chart}`}
                    title={`${MARKET_COUNTRIES.find((c) => c.code === hit.country)?.name} · ${CHART_LABEL[hit.chart]}`}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold tabular-nums ${
                      hit.chart === "grossing" ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]" : "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]"
                    }`}
                  >
                    <span className="text-[13px] leading-none">{flag(hit.country)}</span>#{hit.rank}
                  </span>
                ))}
              </div>
          ) : (
              <p className="mt-3 text-[12px] text-[var(--muted-soft)]">No está en el top 200 de ningún país revisado.</p>
            )}
            {ranks.length ? (
              <p className="mt-1.5 text-[11px] text-[var(--muted-soft)]">
                <span className="text-[#15803d]">Verde</span> = top ingresos · <span className="text-[#4338ca]">Azul</span> = top gratis
              </p>
          ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <FavButton active={favorites.includes(app.id)} onClick={() => onFavorite(app.id)} />
            <a href={app.url} target="_blank" rel="noreferrer" className="ui-btn-primary rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white">
              Abrir en App Store
            </a>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard accent label="Rating global" value={app.rating ? `★ ${app.rating.toFixed(1)}` : "—"} hint={`${app.ratingCount.toLocaleString("es")} calificaciones`} />
        <MetricCard accent label="Rating en reseñas" value={recentAvg ? `★ ${recentAvg.toFixed(1)}` : "—"} hint={`Promedio de ${reviews.length} reseñas`} />
        <MetricCard label="Mejor posición" value={ranks[0] ? `#${ranks[0].rank}` : "—"} hint={ranks[0] ? `${flag(ranks[0].country)} ${CHART_LABEL[ranks[0].chart]}` : "Fuera del top 200"} />
        <MetricCard label="Países en el top 200" value={String(new Set(ranks.map((r) => r.country)).size)} hint={`De ${MARKET_COUNTRIES.length} revisados`} />
        <MetricCard label="Tamaño" value={bytes(app.sizeBytes)} hint={`Versión ${app.version}`} />
        <MetricCard label="iOS mínimo" value={app.minimumOs || "—"} hint={`${app.devices} dispositivos compatibles`} />
        <MetricCard label="Idiomas" value={String(app.languages.length || 1)} hint={app.languages.slice(0, 6).join(" · ")} />
        <MetricCard label="Precio" value={app.price > 0 ? app.formattedPrice : "Gratis"} hint={app.price > 0 ? "Pago único" : "Puede tener compras dentro"} />
      </div>

      {shots.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold">Capturas de la tienda</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {shots.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="h-[360px] w-auto shrink-0 rounded-[18px] border border-[var(--border)] bg-white object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[22px] border border-[var(--border)] bg-white p-5">
          <h2 className="text-[15px] font-semibold">Acerca de {app.name}</h2>
          <p className={`mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--foreground-soft)] ${expanded ? "" : "line-clamp-[8]"}`}>{app.description}</p>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[12px] font-semibold text-[#0d9488]">
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-white p-5">
          <h2 className="text-[15px] font-semibold">Novedades · v{app.version}</h2>
          <p className="mt-2 line-clamp-[10] whitespace-pre-line text-[13px] leading-relaxed text-[var(--foreground-soft)]">{app.releaseNotes || "Sin notas de versión."}</p>
          <dl className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3 text-[12px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Bundle ID</dt>
              <dd className="truncate font-medium">{app.bundleId}</dd>
            </div>
            {app.sellerUrl ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Sitio web</dt>
                <dd className="truncate">
                  <a href={app.sellerUrl} target="_blank" rel="noreferrer" className="font-medium text-[#0d9488] hover:underline">
                    {app.sellerUrl.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
          ) : null}
          </dl>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Reseñas</h2>
        <ReviewAnalytics reviews={reviews} />
      </section>

      {similar.length ? (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Top de {app.genre} en {MARKET_COUNTRIES.find((c) => c.code === country)?.name}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {similar.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-black/20"
              >
                <AppIcon src={item.icon} name={item.name} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{item.name}</span>
                  <span className="block text-[12px] text-[var(--muted)]">#{item.rank} en ingresos</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------- shell ---------------- */

export function MarketView({ projectId, projectName }: { projectId: string; projectName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("mk"));
  const appId = searchParams.get("mapp");
  const [country, setCountry] = useState(searchParams.get("mc") || "us");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { ids: favorites, toggle } = useFavorites(projectId);

  function update(next: { page?: PageId; app?: string | null; country?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "ideas");
    if (next.page) {
      if (next.page === "organic") params.delete("mk");
      else params.set("mk", next.page);
    }
    if (next.app !== undefined) {
      if (next.app) params.set("mapp", next.app);
      else params.delete("mapp");
    }
    if (next.country) {
      if (next.country === "us") params.delete("mc");
      else params.set("mc", next.country);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function go(next: PageId) {
    update({ page: next, app: null });
  }

  function changeCountry(next: string) {
    setCountry(next);
    update({ country: next });
  }

  const pageProps: PageProps = {
    projectId,
    country,
    setCountry: changeCountry,
    favorites,
    onFavorite: toggle,
    onOpen: (app) => update({ app: app.id }),
  };

  const nav: { id: PageId; label: string; icon: IconComp }[] = [
    { id: "organic", label: "Videos virales", icon: IconOrganic },
    { id: "onboardings", label: "Onboardings", icon: IconOnboarding },
    { id: "explore", label: "Apps", icon: IconApps },
    { id: "ads", label: "Anuncios", icon: IconAds },
    { id: "rankings", label: "Tendencias", icon: IconTrend },
    { id: "keywords", label: "Keywords", icon: IconKey },
    { id: "myapps", label: "Tus apps", icon: IconPhone },
    { id: "reviews", label: "Reseñas", icon: IconReviews },
  ];

  const mobileSections: MobileNavSection[] = [
    {
      items: nav.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        active: !appId && page === item.id,
        onClick: () => {
          go(item.id);
          setMobileOpen(false);
        },
      })),
    },
  ];

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {nav.map((item) => (
            <NavItem key={item.id} label={item.label} icon={item.icon} active={!appId && page === item.id} onClick={() => go(item.id)} />
          ))}
        </div>
        <p className="shrink-0 border-t border-[var(--border)] px-4 py-3 text-[11px] leading-snug text-[var(--muted-soft)]">
          Datos públicos de la App Store de Apple. Rankings y apps seguidas se registran cada día.
        </p>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
        <div className="mx-auto max-w-[1400px]">
          {appId ? (
            <AppDetailPage
              key={appId}
              projectId={projectId}
              appId={appId}
              country={country}
              favorites={favorites}
              onFavorite={toggle}
              onBack={() => update({ app: null })}
              onOpen={pageProps.onOpen}
            />
          ) : page === "organic" ? (
            <OrganicPage {...pageProps} />
          ) : page === "onboardings" ? (
            <OnboardingsPage {...pageProps} />
          ) : page === "rankings" ? (
            <RankingsPage {...pageProps} />
          ) : page === "reviews" ? (
            <ReviewsPage {...pageProps} />
          ) : page === "ads" ? (
            <AdsPage {...pageProps} />
          ) : page === "keywords" ? (
            <KeywordsPage {...pageProps} />
          ) : page === "myapps" ? (
            <MyAppsPage {...pageProps} />
          ) : (
            <ExplorePage {...pageProps} />
          )}
        </div>
      </div>

      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Ideas"
        subtitle={projectName || "Workspace"}
        fabLabel="Menú de Ideas"
        fabClassName="bottom-[5.25rem] right-4"
        accent="dark"
        fabIcon={<MarketIcon className="h-5 w-5" />}
        sections={mobileSections}
      />
    </div>
  );
}
