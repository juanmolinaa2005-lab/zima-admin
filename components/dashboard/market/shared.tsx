"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  MARKET_COUNTRIES,
  MARKET_GENRES,
  type MarketApp,
  type MarketAppDetail,
  type MarketChart,
  type MarketReview,
} from "@/lib/market/appstore";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type RankHit = { country: string; chart: MarketChart; rank: number };
export type DetailPayload = { app: MarketAppDetail; reviews: MarketReview[]; ranks: RankHit[]; similar: MarketApp[] };
export type RisingApp = MarketApp & { freeRank: number | null; grossingRank: number | null };

export const CHART_LABEL: Record<MarketChart, string> = { free: "Top gratis", paid: "Top de pago", grossing: "Top ingresos" };


export function flag(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

export function ago(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return "—";
  if (days < 1) return "hoy";
  if (days < 30) return `hace ${days} d`;
  if (days < 365) return `hace ${Math.floor(days / 30)} m`;
  const years = Math.floor(days / 365);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}

export function shortDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function bytes(value: number) {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

export function useFavorites(projectId: string) {
  const key = `market-favs:${projectId}`;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setIds(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
    } catch {
      setIds([]);
    }
  }, [key]);
  function toggle(id: string) {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((value) => value !== id) : [id, ...prev];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }
  return { ids, toggle };
}

export async function fetchMarket<T>(projectId: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/projects/${projectId}/market?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el mercado");
  return data as T;
}

export function useMarket<T>(projectId: string, params: Record<string, string> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const key = params ? JSON.stringify(params) : "";
  useEffect(() => {
    if (!params) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMarket<T>(projectId, params)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, key]);
  return { data, loading, error };
}

/* ---------------- icons ---------------- */

export function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
export const IconApps: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </Svg>
);
export const IconTrend: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m4 16 5-5 4 4 7-7" />
    <path d="M15 8h5v5" />
  </Svg>
);
export const IconRising: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M12 3c1.5 3 4.5 4.8 4.5 9a4.5 4.5 0 0 1-9 0c0-2 .9-3.4 2-4.5.2 1.6 1 2.6 2 3 0-2.6-.6-4.7.5-7.5Z" />
  </Svg>
);
export const IconHeart: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M12 19.5s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.3c0 4.9-7 9.2-7 9.2Z" />
  </Svg>
);
export const IconReviews: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    <path d="m12 8.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3.9-1.8Z" />
  </Svg>
);
export const IconSearch: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </Svg>
);

export function Star({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </svg>
  );
}

/* ---------------- shared UI ---------------- */

export function NavItem({ label, active, icon: Icon, onClick }: { label: string; active: boolean; icon: IconComp; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
          : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{children}</p>
  );
}

export function PageTitle({ icon: Icon, title, subtitle, action }: { icon: IconComp; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="vt-liquid-icon flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--foreground)]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
          <p className="text-[13px] text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const active = options[0]?.value !== value;
  return (
    <label
      className={`relative inline-flex h-9 items-center overflow-hidden rounded-xl border text-[13px] transition ${
        active ? "border-[#111113] bg-white font-semibold text-[var(--foreground)]" : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-black/25"
      }`}
    >
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--muted)]" fill="none" aria-hidden>
        <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

export const COUNTRY_OPTIONS = MARKET_COUNTRIES.map((c) => ({ value: c.code as string, label: `${flag(c.code)} ${c.name}` }));
export const GENRE_OPTIONS = [{ value: "", label: "Todas las categorías" }, ...MARKET_GENRES.map((g) => ({ value: g.id as string, label: g.name as string }))];

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex rounded-xl border border-[var(--border)] bg-white p-1" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
            value === option.value ? "ui-btn-primary text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AppIcon({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const radius = Math.round(size * 0.24);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: radius }}
      className="shrink-0 bg-[var(--surface-alt)] object-cover ring-1 ring-black/[0.06]"
    />
  ) : (
    <span
      style={{ width: size, height: size, borderRadius: radius }}
      className="flex shrink-0 items-center justify-center bg-[var(--surface-alt)] text-[13px] font-semibold text-[var(--muted)]"
    >
      {(name[0] || "?").toUpperCase()}
    </span>
  );
}

export function Rating({ value, count }: { value: number | null; count: number }) {
  if (value === null) return <span className="text-[12px] text-[var(--muted-soft)]">—</span>;
  return (
    <span className="leading-tight">
      <span className="flex items-center justify-end gap-1 text-[13px] font-semibold text-[var(--foreground)]">
        <Star className="h-3.5 w-3.5 text-[#f59e0b]" />
        {value.toFixed(1)}
      </span>
      <span className="block text-right text-[11px] text-[var(--muted-soft)]">{compact(count)}</span>
    </span>
  );
}

export function FavButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
        active ? "bg-[#fee2e2] text-[#e11d48]" : "text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M12 19.5s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.3c0 4.9-7 9.2-7 9.2Z" />
      </svg>
    </button>
  );
}

export type SortKey = "rank" | "rating" | "ratingCount" | "released" | "updated" | "price";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center text-[13px] text-[var(--muted)]">{children}</div>;
}

export function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0">
          <span className="h-10 w-10 animate-pulse rounded-[10px] bg-[var(--surface-alt)]" />
          <span className="h-3 w-48 animate-pulse rounded bg-[var(--surface-alt)]" />
          <span className="ml-auto h-3 w-24 animate-pulse rounded bg-[var(--surface-alt)]" />
        </div>
      ))}
    </div>
  );
}

export function AppTable({
  apps,
  showRank,
  extraColumn,
  favorites,
  onFavorite,
  onOpen,
}: {
  apps: MarketApp[];
  showRank?: boolean;
  extraColumn?: { label: string; render: (app: MarketApp) => ReactNode };
  favorites: string[];
  onFavorite: (id: string) => void;
  onOpen: (app: MarketApp) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: showRank ? "rank" : "ratingCount", dir: showRank ? 1 : -1 });
  const sorted = useMemo(() => {
    const value = (app: MarketApp): number => {
      switch (sort.key) {
        case "rank":
          return app.rank ?? 9999;
        case "rating":
          return app.rating ?? -1;
        case "ratingCount":
          return app.ratingCount;
        case "released":
          return app.releasedAt ? new Date(app.releasedAt).getTime() : 0;
        case "updated":
          return app.updatedAt ? new Date(app.updatedAt).getTime() : 0;
        case "price":
          return app.price;
      }
    };
    return [...apps].sort((a, b) => (value(a) - value(b)) * sort.dir);
  }, [apps, sort]);

  function header(label: string, key: SortKey, align: "left" | "right" = "right") {
    const active = sort.key === key;
    return (
      <th className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
        <button
          type="button"
          onClick={() => setSort((prev) => ({ key, dir: prev.key === key ? ((prev.dir * -1) as 1 | -1) : key === "rank" ? 1 : -1 }))}
          className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-[var(--foreground)] ${active ? "text-[var(--foreground)]" : ""}`}
        >
          {label}
          <span className="text-[9px]">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
      <table className="w-full min-w-[860px] text-left">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-alt)]/60 text-[11px] text-[var(--muted-soft)]">
          <tr>
            {showRank ? header("#", "rank", "left") : null}
            <th className="px-3 py-3 font-medium uppercase tracking-wide">App</th>
            <th className="px-3 py-3 font-medium uppercase tracking-wide">Categoría</th>
            {extraColumn ? <th className="px-3 py-3 text-right font-medium uppercase tracking-wide">{extraColumn.label}</th> : null}
            {header("Rating", "rating")}
            {header("Reseñas", "ratingCount")}
            {header("Precio", "price")}
            {header("Lanzada", "released")}
            {header("Actualizada", "updated")}
            <th className="w-12 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((app) => (
            <tr
              key={app.id}
              onClick={() => onOpen(app)}
              className="cursor-pointer border-b border-[var(--border)] transition last:border-0 hover:bg-[var(--surface-alt)]/60"
            >
              {showRank ? (
                <td className="px-3 py-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                      app.rank === 1 ? "vt-metal-gold" : app.rank === 2 ? "vt-metal-silver" : app.rank === 3 ? "vt-metal-bronze" : "text-[var(--muted)]"
                    }`}
                  >
                    {app.rank}
                  </span>
                </td>
              ) : null}
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-3">
                  <AppIcon src={app.icon} name={app.name} />
                  <span className="min-w-0">
                    <span className="block max-w-[260px] truncate text-[13px] font-semibold text-[var(--foreground)]">{app.name}</span>
                    <span className="block max-w-[260px] truncate text-[12px] text-[var(--muted-soft)]">{app.seller}</span>
                  </span>
                </span>
              </td>
              <td className="px-3 py-2.5">
                {app.genre ? (
                  <span className="whitespace-nowrap rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground-soft)]">{app.genre}</span>
                ) : null}
              </td>
              {extraColumn ? <td className="px-3 py-2.5 text-right">{extraColumn.render(app)}</td> : null}
              <td className="px-3 py-2.5 text-right">
                <Rating value={app.rating} count={app.ratingCount} />
              </td>
              <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-[var(--foreground-soft)]">{app.ratingCount ? app.ratingCount.toLocaleString("es") : "—"}</td>
              <td className="px-3 py-2.5 text-right text-[13px] text-[var(--foreground-soft)]">{app.price > 0 ? app.formattedPrice : "Gratis"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="block text-[13px] font-medium text-[#0d9488]">{ago(app.releasedAt)}</span>
                <span className="block text-[11px] text-[var(--muted-soft)]">{shortDate(app.releasedAt)}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="block text-[13px] font-medium text-[#0d9488]">{ago(app.updatedAt)}</span>
                <span className="block text-[11px] text-[var(--muted-soft)]">{shortDate(app.updatedAt)}</span>
              </td>
              <td className="px-3 py-2.5">
                <FavButton active={favorites.includes(app.id)} onClick={() => onFavorite(app.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type PageProps = {
  projectId: string;
  country: string;
  setCountry: (value: string) => void;
  favorites: string[];
  onFavorite: (id: string) => void;
  onOpen: (app: MarketApp) => void;
};
