"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { META_AD_COUNTRIES, type MetaAd, type AdMedia, type AdSearchResult } from "@/lib/market/meta-ad-types";
import { PlatformLogo } from "../viewtracker/vt-ui";
import { compact, FilterSelect, IconSearch, shortDate } from "./shared";
import { GhostButton, PrimaryButton } from "./items";

const COUNTRIES = META_AD_COUNTRIES.map((c) => ({ value: c.code as string, label: c.name }));
type Media = AdMedia;
type Query = { q: string; pageId?: string; label: string };
export type SavedMetaAd = { ad: MetaAd; media: Media };
type Props = { projectId: string; initialQuery?: string; onSave: (saved: SavedMetaAd) => Promise<void>; savedIds: Set<string> };

function daysRunning(ad: MetaAd) {
  if (!ad.startedAt) return null;
  const stop = ad.stoppedAt ? new Date(ad.stoppedAt).getTime() : Date.now();
  const days = Math.round((Math.min(stop, Date.now()) - new Date(ad.startedAt).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(1, days) : null;
}
function platformId(value: string) { return value.toLowerCase() === "instagram" ? "instagram" : "facebook"; }

export function MetaAdsSearch(props: Props) {
  return <SearchPanel key={`${props.projectId}:${props.initialQuery || ""}`} {...props} />;
}

function SearchPanel({ projectId, initialQuery, onSave, savedIds }: Props) {
  const base = `/api/projects/${projectId}/market/meta-ads`;
  const [draft, setDraft] = useState(initialQuery ?? "");
  const [query, setQuery] = useState<Query | null>(null);
  const [country, setCountry] = useState("US");
  const [active, setActive] = useState(true);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdSearchResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const run = useCallback(async (next: Query, region: string, onlyActive: boolean, page?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setQuery(next); setLoading(true); setError(""); setCursor(null);
    if (!page) { setAds([]); setResult(null); }
    const params = new URLSearchParams({ countries: region, active: onlyActive ? "1" : "0",
      ...(next.pageId ? { pageId: next.pageId } : { q: next.q }), ...(page ? { after: page } : {}),
    });
    try {
      // Poll the stored job, not Meta. The database lease deduplicates collection across users.
      for (let poll = 0; poll < 20; poll++) {
        const res = await fetch(`${base}?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo consultar el catálogo.");
        if (controller.signal.aborted) return;
        const snapshot = data as AdSearchResult;
        setResult(snapshot);
        setAds((previous) => [...new Map((page ? [...previous, ...snapshot.ads] : snapshot.ads).map((ad) => [ad.id, ad])).values()]);
        setCursor(snapshot.after);
        if (snapshot.state !== "queued" && snapshot.state !== "running") break;
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
          const timer = setTimeout(() => { controller.signal.removeEventListener("abort", cancel); resolve(); }, 3000);
          controller.signal.addEventListener("abort", cancel, { once: true });
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo buscar.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [base]);

  useEffect(() => {
    // The incoming app selection initiates an external catalog request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialQuery) void run({ q: initialQuery, label: initialQuery }, "US", true);
    return () => request.current?.abort();
  }, [initialQuery, run]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = draft.trim();
    if (q) void run({ q, label: q }, country, active);
  }
  const external = new URLSearchParams({ active_status: active ? "active" : "all", ad_type: "all", country,
    ...(query?.pageId ? { view_all_page_id: query.pageId, search_type: "page" } : { q: query?.q || draft.trim(), search_type: "keyword_unordered" }),
  });
  const pending = result?.state === "queued" || result?.state === "running";
  const notice = error || result?.notice;

  return (
    <section ref={sectionRef} className="vt-liquid-glass scroll-mt-4 space-y-4 rounded-[24px] p-4">
      <div className="relative">
        <p className="flex items-center gap-2 text-[14px] font-semibold"><PlatformLogo id="facebook" className="h-4 w-4" />Buscar anuncios de Meta</p>
        <p className="text-[12px] text-[var(--muted)]">Explora anuncios por marca y país. La cobertura depende de los datos disponibles; cada resultado indica cuándo se actualizó.</p>
      </div>
      <form onSubmit={submit} className="relative flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3.5 focus-within:border-black/25">
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input aria-label="Buscar marca o app" value={draft} onChange={(event) => setDraft(event.target.value)}
            maxLength={100} placeholder="Nombre de la app, marca o palabra (ej. Cal AI)…" className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
        </label>
        <FilterSelect label="País" value={country} options={COUNTRIES} onChange={(value) => {
          setCountry(value); if (query) void run(query, value, active);
        }} />
        <FilterSelect label="Estado" value={active ? "1" : "0"} options={[{ value: "1", label: "Solo activos" }, { value: "0", label: "Activos e inactivos" }]}
          onChange={(value) => { setActive(value === "1"); if (query) void run(query, country, value === "1"); }} />
        <PrimaryButton type="submit" disabled={!draft.trim() || loading}>{loading ? "Buscando…" : "Buscar"}</PrimaryButton>
      </form>
      <div className="relative space-y-3" aria-live="polite" aria-busy={loading}>
        {query ? <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--muted)]">
          <span>{loading && !ads.length ? "Comprobando anuncios…" : error ? "No se pudo completar la búsqueda" : result?.state === "error" && !ads.length ? "Búsqueda pendiente de acceso a Meta" : `${ads.length}${cursor ? "+" : ""} anuncios disponibles`} para “{query.label}”</span>
          {result?.fetchedAt ? <span>{result.stale ? "Últimos datos guardados" : "Actualizado"}: {new Date(result.fetchedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span> : null}
        </div> : null}
        {notice ? <p role="status" className="rounded-xl bg-[#fef3c7] px-3 py-2 text-[12px] text-[#92400e]">{notice}</p> : null}
        {pending && !loading ? <p className="text-[12px] text-[var(--muted)]">La actualización sigue en cola. Vuelve a pulsar Buscar para consultar su estado.</p> : null}
        {result?.partial ? <p className="text-[12px] text-[var(--muted)]">Cobertura parcial: estos son los anuncios recopilados, no un listado completo de Meta.</p> : null}
        {query ? <a href={`https://www.facebook.com/ads/library/?${external}`} target="_blank" rel="noopener noreferrer" className="inline-block text-[12px] font-semibold underline">Abrir esta búsqueda en Meta ↗</a> : null}
        {result?.state === "ready" && !loading && !error && ads.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-[12px] text-[var(--muted)]">La fuente consultada no devolvió anuncios para estos filtros. Prueba otro país o el nombre de la marca.</p> : null}
        {ads.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {ads.map((ad) => <MetaAdCard key={ad.id} ad={ad} base={base} saved={savedIds.has(ad.id)} onSave={onSave}
            onPage={() => { if (ad.pageId) void run({ q: ad.pageName, pageId: ad.pageId, label: ad.pageName }, country, active); }} />)}
        </div> : null}
        {cursor && query ? <div className="flex justify-center"><GhostButton onClick={() => void run(query, country, active, cursor)} disabled={loading}>{loading ? "Cargando…" : "Ver más anuncios"}</GhostButton></div> : null}
      </div>
    </section>
  );
}

function MetaAdCard({
  ad,
  base,
  saved,
  onSave,
  onPage,
}: {
  ad: MetaAd;
  base: string;
  saved: boolean;
  onSave: (saved: SavedMetaAd) => Promise<void>;
  onPage: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [loadedMedia, setMedia] = useState<Media | null>(null);
  const media = ad.media ?? loadedMedia;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (ad.media) return;
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fetch(`${base}?op=media&adId=${ad.id}`)
          .then((res) => res.json())
          .then((data: Media) => {
            if (!cancelled) setMedia(data);
          })
          .catch(() => {
            if (!cancelled) setMedia({ video: null, image: null, avatar: null });
          });
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [ad.id, ad.media, base]);

  const days = daysRunning(ad);
  const body = ad.bodies[0] || "";

  return (
    <article ref={ref} className="flex flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {media?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.avatar} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[12px] font-semibold">{(ad.pageName[0] || "?").toUpperCase()}</span>
        )}
        <button type="button" onClick={onPage} className="min-w-0 flex-1 text-left" title="Ver todos sus anuncios">
          <span className="block truncate text-[13px] font-semibold hover:underline">{ad.pageName}</span>
          <span className="block text-[11px] text-[var(--muted)]">
            {ad.active === true ? "Activo" : ad.active === false ? "Inactivo" : "Estado según última consulta"} · {ad.startedAt ? `desde ${shortDate(ad.startedAt)}` : ""}
          </span>
        </button>
        {days ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${days >= 30 ? "bg-[#dcfce7] text-[#15803d]" : "bg-[var(--surface-alt)] text-[var(--muted)]"}`}>
            {days} d
          </span>
        ) : null}
      </div>

      <div className="relative aspect-square bg-[var(--surface-alt)]">
        {!media ? (
          <span className="absolute inset-0 animate-pulse bg-[var(--surface-alt)]" />
        ) : media.video ? (
          <video src={media.video} poster={media.image ?? undefined} controls playsInline preload="none" className="h-full w-full object-cover" />
        ) : media.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.image} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <a href={ad.libraryUrl} target="_blank" rel="noopener noreferrer" className="flex h-full items-center justify-center px-6 text-center text-[12px] text-[var(--muted)] hover:text-[var(--foreground)]">
            Ver el creativo en Meta ↗
          </a>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {body ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className={`whitespace-pre-line text-left text-[12px] text-[var(--foreground-soft)] ${expanded ? "" : "line-clamp-3"}`}>
            {body}
          </button>
        ) : null}
        {ad.titles[0] ? (
          <div className="rounded-xl bg-[var(--surface-alt)]/70 px-2.5 py-2">
            {ad.captions[0] ? <p className="truncate text-[10px] uppercase text-[var(--muted)]">{ad.captions[0]}</p> : null}
            <p className="line-clamp-2 text-[12px] font-semibold">{ad.titles[0]}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
          {ad.platforms.map((platform) => (
            <span key={platform} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-alt)] px-2 py-0.5 capitalize">
              <PlatformLogo id={platformId(platform)} className="h-3 w-3" />
              {platform.toLowerCase().replace("_", " ")}
            </span>
          ))}
          {ad.reach ? <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5">Alcance UE {compact(ad.reach)}</span> : null}
          {ad.bodies.length > 1 ? <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5">{ad.bodies.length} versiones</span> : null}
        </div>
        <div className="mt-auto flex gap-1.5 pt-1">
          <a
            href={ad.libraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 flex-1 items-center justify-center rounded-xl border border-[var(--border)] text-[12px] font-semibold hover:bg-[var(--surface-alt)]"
          >
            Ver en Meta
          </a>
          <button
            type="button"
            disabled={saved || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await onSave({ ad, media: media ?? { video: null, image: null, avatar: null } });
              } catch {
                setSaveError("No se pudo guardar el anuncio. Inténtalo de nuevo.");
              } finally {
                setSaving(false);
              }
            }}
            className="ui-btn-primary flex h-8 flex-1 items-center justify-center rounded-xl text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {saved ? "Guardado" : saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
        {saveError ? <p role="alert" className="text-[11px] text-red-700">{saveError}</p> : null}
      </div>
    </article>
  );
}
