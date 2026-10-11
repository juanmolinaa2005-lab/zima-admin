"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { MarketApp } from "@/lib/market/appstore";
import { PlatformLogo } from "../viewtracker/vt-ui";
import { MetaAdsSearch, type SavedMetaAd } from "./MetaAds";
import { AppIcon, compact, Empty, fetchMarket, IconSearch, PageTitle, shortDate, Star, type IconComp, type PageProps } from "./shared";
import {
  AppPicker,
  GhostButton,
  miniApp,
  Modal,
  PickedApp,
  PrimaryButton,
  TrashButton,
  uploadMarketFile,
  useMarketItems,
  type MiniApp,
} from "./items";

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const IconOnboarding: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M10.5 18h3" />
  </Svg>
);
export const IconAds: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M4.5 10.2h2.8L16.2 6.2v11.6l-8.9-4H4.5a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1Z" />
    <path d="M7.2 13.8 8 18" />
  </Svg>
);
export const IconOrganic: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="4" y="5" width="16" height="14" rx="2.5" />
    <path d="m10.5 9.5 4 2.5-4 2.5v-5Z" />
  </Svg>
);

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AppSideCard({ app, stats, onOpen, actions }: { app: MiniApp; stats: { label: string; value: string }[]; onOpen: () => void; actions?: ReactNode }) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-alt)]/40 p-3.5 lg:w-[240px]">
      <button type="button" onClick={onOpen} className="flex items-center gap-3 text-left">
        <AppIcon src={app.icon} name={app.name} size={52} />
        <span className="min-w-0">
          <span className="line-clamp-2 text-[14px] font-semibold leading-tight">{app.name}</span>
          <span className="block truncate text-[11px] text-[var(--muted)]">{app.seller}</span>
          {app.rating !== null ? (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted)]">
              <Star className="h-3 w-3 text-[#f59e0b]" />
              {app.rating.toFixed(1)} · {compact(app.ratingCount)} reseñas
            </span>
          ) : null}
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/[0.05]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">{stat.label}</p>
            <p className="truncate text-[14px] font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
      {actions ? <div className="mt-auto flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

function released(app: MiniApp) {
  return app.releasedAt ? new Date(app.releasedAt).toLocaleDateString("es", { month: "short", year: "numeric" }) : "—";
}

/* ======================= ONBOARDINGS ======================= */

const SCREEN_TAGS = [
  "Bienvenida",
  "Onboarding",
  "Quiz",
  "Permisos",
  "Paywall",
  "Registro",
  "Login",
  "Perfil",
  "Preferencias",
  "Intro de función",
  "Home",
  "Suscripción",
  "Descuento",
  "Éxito",
  "Tienda",
  "Otro",
] as const;

type Screen = { id: string; url: string; tag: string };
type OnboardingFlow = { app: MiniApp; screens: Screen[]; country: string };

export function OnboardingsPage({ projectId, country, onOpen }: PageProps) {
  const { items, loading, error, save, remove } = useMarketItems<OnboardingFlow>(projectId, "onboarding");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadFor, setUploadFor] = useState<OnboardingFlow | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) for (const screen of item.data.screens) map.set(screen.tag, (map.get(screen.tag) ?? 0) + 1);
    return map;
  }, [items]);
  const totalScreens = [...counts.values()].reduce((a, b) => a + b, 0);

  const flows = items.filter((item) => {
    if (query && !item.data.app.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (tag && !item.data.screens.some((screen) => screen.tag === tag)) return false;
    return true;
  });

  async function updateFlow(flow: OnboardingFlow) {
    await save(flow.app.id, flow);
  }

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconOnboarding}
        title="Onboarding flows"
        subtitle="Tu biblioteca de onboardings, paywalls y permisos de otras apps, pantalla por pantalla"
        action={
          <PrimaryButton onClick={() => setAdding(true)}>
            <PlusIcon /> Añadir flujo
          </PrimaryButton>
        }
      />

      <label className="flex max-w-[420px] items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3.5 focus-within:border-black/25">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en tus flujos…"
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Pantallas</span>
        <TagChip label="Todas" count={totalScreens} active={tag === null} onClick={() => setTag(null)} />
        {SCREEN_TAGS.filter((value) => counts.get(value)).map((value) => (
          <TagChip key={value} label={value} count={counts.get(value) ?? 0} active={tag === value} onClick={() => setTag(tag === value ? null : value)} />
        ))}
      </div>

      {error ? (
        <Empty>{error}</Empty>
      ) : loading ? (
        <Empty>Cargando…</Empty>
      ) : items.length === 0 ? (
        <Empty>
          <p className="text-[14px] font-semibold text-[var(--foreground)]">Aún no tienes flujos guardados</p>
          <p className="mx-auto mt-1 max-w-[460px]">
            Descarga la app que quieres estudiar, graba o captura su onboarding y súbelo aquí. Etiqueta cada pantalla (quiz, paywall, permisos…) para
            compararlas después.
          </p>
          <div className="mt-4 flex justify-center">
            <PrimaryButton onClick={() => setAdding(true)}>
              <PlusIcon /> Añadir el primer flujo
            </PrimaryButton>
          </div>
        </Empty>
      ) : flows.length === 0 ? (
        <Empty>Ningún flujo coincide con el filtro.</Empty>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--muted)]">
            {flows.length} {flows.length === 1 ? "app" : "apps"} · {totalScreens} pantallas
          </p>
          {flows.map((item) => {
            const flow = item.data;
            const screens = tag ? flow.screens.filter((screen) => screen.tag === tag) : flow.screens;
            return (
              <div key={item.key} className="flex flex-col gap-3 rounded-[26px] border border-[var(--border)] bg-white p-3 lg:flex-row">
                <AppSideCard
                  app={flow.app}
                  onOpen={() => onOpen({ id: flow.app.id } as MarketApp)}
                  stats={[
                    { label: "Pantallas", value: String(flow.screens.length) },
                    { label: "Lanzada", value: released(flow.app) },
                  ]}
                  actions={
                    <>
                      <GhostButton onClick={() => setUploadFor(flow)}>
                        <PlusIcon /> Pantallas
                      </GhostButton>
                      <TrashButton label="Eliminar flujo" onClick={() => void remove(item.key)} />
                    </>
                  }
                />
                <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2">
                  {screens.map((screen) => (
                    <PhoneScreen
                      key={screen.id}
                      index={flow.screens.indexOf(screen) + 1}
                      screen={screen}
                      onTag={(value) =>
                        void updateFlow({ ...flow, screens: flow.screens.map((s) => (s.id === screen.id ? { ...s, tag: value } : s)) })
                      }
                      onDelete={() => void updateFlow({ ...flow, screens: flow.screens.filter((s) => s.id !== screen.id) })}
                    />
                  ))}
                  {screens.length === 0 ? <p className="self-center px-4 text-[12px] text-[var(--muted)]">Sin pantallas con esta etiqueta.</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddFlowModal
        open={adding || Boolean(uploadFor)}
        projectId={projectId}
        country={country}
        existing={uploadFor}
        exclude={uploadFor ? [] : items.map((item) => item.key)}
        onClose={() => {
          setAdding(false);
          setUploadFor(null);
        }}
        onSave={async (flow) => {
          await updateFlow(flow);
          setAdding(false);
          setUploadFor(null);
        }}
      />
    </div>
  );
}

function TagChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
        active ? "border-[#0f766e]/30 bg-[#ccfbf1] font-semibold text-[#0f766e]" : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-black/20"
      }`}
    >
      {label}
      <span className="tabular-nums text-[var(--muted)]">{count}</span>
    </button>
  );
}

function PhoneScreen({ index, screen, onTag, onDelete }: { index: number; screen: Screen; onTag: (tag: string) => void; onDelete: () => void }) {
  return (
    <figure className="group relative w-[170px] shrink-0">
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[26px] border-[5px] border-[#111113] bg-[#111113] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
        <a href={screen.url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screen.url} alt={`Pantalla ${index}: ${screen.tag}`} className="h-full w-full rounded-[20px] object-cover" loading="lazy" />
        </a>
        <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-white/95 px-1.5 text-[11px] font-bold tabular-nums shadow">
          {index}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Quitar pantalla"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[var(--muted)] opacity-0 shadow transition hover:text-[#e11d48] group-hover:opacity-100 focus-visible:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <figcaption className="mt-2 flex justify-center">
        <label className="relative">
          <span className="sr-only">Tipo de pantalla</span>
          <select
            value={screen.tag}
            onChange={(event) => onTag(event.target.value)}
            className="h-7 cursor-pointer appearance-none rounded-full border border-[var(--border)] bg-white pl-2.5 pr-6 text-[11px] font-semibold outline-none hover:border-black/25"
          >
            {SCREEN_TAGS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]" fill="none" aria-hidden>
            <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </label>
      </figcaption>
    </figure>
  );
}

function AddFlowModal({
  open,
  projectId,
  country,
  existing,
  exclude,
  onClose,
  onSave,
}: {
  open: boolean;
  projectId: string;
  country: string;
  existing: OnboardingFlow | null;
  exclude: string[];
  onClose: () => void;
  onSave: (flow: OnboardingFlow) => Promise<void>;
}) {
  const [picked, setPicked] = useState<MiniApp | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const app = existing?.app ?? picked;
  const offset = existing?.screens.length ?? 0;

  function reset() {
    setPicked(null);
    setScreens([]);
    setBusy("");
    setError("");
  }

  async function addFiles(files: FileList | File[]) {
    if (!app) return;
    const list = [...files].filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    setError("");
    try {
      const added: Screen[] = [];
      for (const [index, file] of list.entries()) {
        setBusy(`Subiendo ${index + 1} de ${list.length}…`);
        const url = await uploadMarketFile(projectId, `onboardings/${app.id}`, file);
        const position = offset + screens.length + added.length;
        added.push({ id: crypto.randomUUID(), url, tag: position === 0 ? "Bienvenida" : "Onboarding" });
      }
      setScreens((prev) => [...prev, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setBusy("");
    }
  }

  async function importStore() {
    if (!app) return;
    setBusy("Trayendo capturas de la App Store…");
    try {
      const data = await fetchMarket<{ screenshots: string[] }>(projectId, { op: "screens", appId: app.id, country });
      setScreens((prev) => [...prev, ...data.screenshots.map((url) => ({ id: crypto.randomUUID(), url, tag: "Tienda" }))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron traer");
    } finally {
      setBusy("");
    }
  }

  async function submit() {
    if (!app || screens.length === 0) return;
    setBusy("Guardando…");
    try {
      await onSave({ app, country, screens: [...(existing?.screens ?? []), ...screens] });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setBusy("");
    }
  }

  return (
    <Modal
      open={open}
      wide
      title={existing ? `Añadir pantallas · ${existing.app.name}` : "Nuevo onboarding flow"}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="space-y-4">
        {app ? (
          <PickedApp app={app} onClear={existing ? undefined : () => setPicked(null)} />
        ) : (
          <div>
            <p className="mb-2 text-[13px] font-semibold">1. ¿De qué app es el onboarding?</p>
            <AppPicker autoFocus projectId={projectId} country={country} exclude={exclude} onPick={(value) => setPicked(miniApp(value))} />
          </div>
        )}

        {app ? (
          <>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addFiles(event.dataTransfer.files);
              }}
              className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-alt)]/40 px-4 py-6 text-center"
            >
              <p className="text-[13px] font-semibold">Arrastra las capturas aquí, en orden</p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">PNG o JPG. Puedes etiquetarlas después.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <PrimaryButton onClick={() => input.current?.click()} disabled={Boolean(busy)}>
                  Elegir imágenes
                </PrimaryButton>
                <GhostButton onClick={() => void importStore()} disabled={Boolean(busy)}>
                  Usar capturas de la App Store
                </GhostButton>
              </div>
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {screens.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {screens.map((screen, index) => (
                  <div key={screen.id} className="relative w-[84px] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screen.url} alt="" className="aspect-[9/19.5] w-full rounded-xl object-cover ring-1 ring-black/10" />
                    <span className="absolute left-1 top-1 rounded-full bg-white px-1.5 text-[10px] font-bold shadow">{offset + index + 1}</span>
                    <button
                      type="button"
                      onClick={() => setScreens((prev) => prev.filter((s) => s.id !== screen.id))}
                      aria-label="Quitar"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {busy ? <p className="text-[12px] text-[var(--muted)]">{busy}</p> : null}
        {error ? <p className="text-[12px] text-[#e11d48]">{error}</p> : null}

        <div className="flex justify-end">
          <PrimaryButton onClick={() => void submit()} disabled={!app || screens.length === 0 || Boolean(busy)}>
            Guardar {screens.length ? `${screens.length} pantallas` : ""}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ======================= ADS ======================= */

const AD_PLATFORMS = [
  { id: "meta", label: "Meta" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple Search Ads" },
  { id: "otro", label: "Otro" },
] as const;

type AdCreative = {
  app: MiniApp;
  platform: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  link: string;
  copy: string;
  seenAt: string;
};

function adLibraryLinks(name: string, seller: string) {
  const q = encodeURIComponent(name.split(/[:\-–|]/)[0].trim());
  return [
    { label: "Meta Ad Library", href: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&media_type=all&search_type=keyword_unordered&q=${q}` },
    { label: "TikTok Creative Center", href: `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/es?period=30&region=&keyword=${q}` },
    { label: "Google Ads Transparency", href: `https://adstransparency.google.com/?region=anywhere&query=${encodeURIComponent(seller || name)}` },
  ];
}

function platformLabel(id: string) {
  return AD_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

function groupByApp<T extends { app: MiniApp }>(items: { key: string; data: T }[]) {
  const map = new Map<string, { app: MiniApp; rows: { key: string; data: T }[] }>();
  for (const item of items) {
    const group = map.get(item.data.app.id) ?? { app: item.data.app, rows: [] };
    group.rows.push(item);
    map.set(item.data.app.id, group);
  }
  return [...map.values()];
}

export function AdsPage({ projectId, country, onOpen }: PageProps) {
  const { items, loading, error, save, remove } = useMarketItems<AdCreative>(projectId, "ad");
  const [lookup, setLookup] = useState<MiniApp | null>(null);
  const [adding, setAdding] = useState<MiniApp | null | "new">(null);
  const [metaQuery, setMetaQuery] = useState<string | undefined>(undefined);
  const groups = groupByApp(items);
  const savedMeta = new Set(items.filter((item) => item.key.startsWith("meta:")).map((item) => item.key.slice(5)));

  async function persist(url: string | null) {
    if (!url) return null;
    try {
      const res = await fetch(`/api/projects/${projectId}/market/meta-ads`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? (data.url as string) : url;
    } catch {
      return url;
    }
  }

  async function saveMeta({ ad, media }: SavedMetaAd) {
    const [mediaUrl, icon] = await Promise.all([persist(media.video || media.image), persist(media.avatar)]);
    await save(`meta:${ad.id}`, {
      app: {
        id: `meta:${ad.pageId}`,
        name: ad.pageName,
        seller: "Página en Meta",
        icon,
        genre: "",
        rating: null,
        ratingCount: 0,
        releasedAt: null,
      },
      platform: "meta",
      mediaUrl,
      mediaType: media.video ? "video" : mediaUrl ? "image" : null,
      link: ad.libraryUrl,
      copy: [ad.bodies[0], ad.titles[0]].filter(Boolean).join("\n\n"),
      seenAt: ad.startedAt || new Date().toISOString(),
    });
  }

  function openGroup(app: MiniApp) {
    if (app.id.startsWith("meta:")) {
      window.open(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${app.id.slice(5)}`, "_blank", "noopener,noreferrer");
    } else {
      onOpen({ id: app.id } as MarketApp);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconAds}
        title="Biblioteca de anuncios"
        subtitle="Encuentra los anuncios activos de cualquier app y guarda los creativos que funcionan"
        action={
          <PrimaryButton onClick={() => setAdding("new")}>
            <PlusIcon /> Guardar anuncio
          </PrimaryButton>
        }
      />

      <MetaAdsSearch projectId={projectId} initialQuery={metaQuery} savedIds={savedMeta} onSave={saveMeta} />

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <p className="text-[13px] font-semibold">Anuncios de una app en otras redes</p>
        <p className="mb-3 text-[12px] text-[var(--muted)]">TikTok y Google no tienen API pública: abrimos sus bibliotecas oficiales ya filtradas por la app.</p>
        {lookup ? (
          <div className="space-y-3">
            <PickedApp app={lookup} onClear={() => setLookup(null)} />
            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={() => setMetaQuery(lookup.name.split(/[:\-–|]/)[0].trim())}>
                <PlatformLogo id="facebook" className="h-4 w-4" /> Buscar en Meta aquí
              </PrimaryButton>
              {adLibraryLinks(lookup.name, lookup.seller)
                .slice(1)
                .map((link) => (
                  <GhostButton key={link.label} href={link.href}>
                    {link.label}
                  </GhostButton>
                ))}
              <GhostButton onClick={() => setAdding(lookup)}>
                <PlusIcon /> Guardar un anuncio manual
              </GhostButton>
            </div>
          </div>
        ) : (
          <AppPicker projectId={projectId} country={country} onPick={(app) => setLookup(miniApp(app))} placeholder="Busca una app…" />
        )}
      </section>

      {error ? (
        <Empty>{error}</Empty>
      ) : loading ? (
        <Empty>Cargando…</Empty>
      ) : groups.length === 0 ? (
        <Empty>Cuando veas un anuncio bueno, guárdalo aquí con su captura o video, el texto y dónde salió.</Empty>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--muted)]">
            {items.length} anuncios de {groups.length} {groups.length === 1 ? "app" : "apps"}
          </p>
          {groups.map((group) => (
            <div key={group.app.id} className="flex flex-col gap-3 rounded-[26px] border border-[var(--border)] bg-white p-3 lg:flex-row">
              <AppSideCard
                app={group.app}
                onOpen={() => openGroup(group.app)}
                stats={[
                  { label: "Anuncios", value: String(group.rows.length) },
                  { label: "Lanzada", value: released(group.app) },
                ]}
                actions={
                  <>
                    <GhostButton onClick={() => setAdding(group.app)}>
                      <PlusIcon /> Anuncio
                    </GhostButton>
                    <GhostButton onClick={() => setMetaQuery(group.app.name.split(/[:\-–|]/)[0].trim())}>Buscar en Meta</GhostButton>
                  </>
                }
              />
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2">
                {group.rows.map((row, index) => (
                  <article key={row.key} className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-white">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <AppIcon src={group.app.icon} name={group.app.name} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold">{group.app.name}</span>
                        <span className="block text-[10px] text-[var(--muted)]">{platformLabel(row.data.platform)}</span>
                      </span>
                      <span className="text-[10px] text-[var(--muted-soft)]">{shortDate(row.data.seenAt)}</span>
                    </div>
                    <div className="relative aspect-[4/5] bg-[var(--surface-alt)]">
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-white/95 px-1.5 text-[10px] font-bold shadow">#{index + 1}</span>
                      {row.data.mediaUrl ? (
                        row.data.mediaType === "video" ? (
                          <video src={row.data.mediaUrl} controls playsInline className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.data.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-[var(--muted)]">Sin creativo subido</div>
                      )}
                    </div>
                    {row.data.copy ? <p className="line-clamp-3 px-3 pt-2.5 text-[12px] text-[var(--foreground-soft)]">{row.data.copy}</p> : null}
                    <div className="mt-auto flex items-center gap-1.5 p-2.5">
                      {row.data.link ? (
                        <a
                          href={row.data.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 flex-1 items-center justify-center rounded-xl border border-[var(--border)] text-[12px] font-semibold hover:bg-[var(--surface-alt)]"
                        >
                          Abrir
                        </a>
                      ) : (
                        <span className="flex-1" />
                      )}
                      <TrashButton label="Eliminar anuncio" onClick={() => void remove(row.key)} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAdModal
        open={adding !== null}
        projectId={projectId}
        country={country}
        initialApp={adding === "new" ? null : adding}
        onClose={() => setAdding(null)}
        onSave={async (ad) => {
          await save(crypto.randomUUID(), ad);
          setAdding(null);
        }}
      />
    </div>
  );
}

function AddAdModal({
  open,
  projectId,
  country,
  initialApp,
  onClose,
  onSave,
}: {
  open: boolean;
  projectId: string;
  country: string;
  initialApp: MiniApp | null;
  onClose: () => void;
  onSave: (ad: AdCreative) => Promise<void>;
}) {
  const [picked, setPicked] = useState<MiniApp | null>(null);
  const [platform, setPlatform] = useState("meta");
  const [link, setLink] = useState("");
  const [copy, setCopy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const app = picked ?? initialApp;

  function close() {
    setPicked(null);
    setLink("");
    setCopy("");
    setFile(null);
    setError("");
    onClose();
  }

  async function submit() {
    if (!app) return;
    if (!file && !link.trim()) {
      setError("Sube la captura o video del anuncio, o pega su link.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const mediaUrl = file ? await uploadMarketFile(projectId, "ads", file) : null;
      await onSave({
        app,
        platform,
        mediaUrl,
        mediaType: file ? (file.type.startsWith("video") ? "video" : "image") : null,
        link: link.trim(),
        copy: copy.trim(),
        seenAt: new Date().toISOString(),
      });
      setPicked(null);
      setLink("");
      setCopy("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Guardar anuncio">
      <div className="space-y-4">
        {app ? <PickedApp app={app} onClear={() => setPicked(null)} /> : <AppPicker autoFocus projectId={projectId} country={country} onPick={(value) => setPicked(miniApp(value))} />}
        {app ? (
          <>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold">Dónde lo viste</p>
              <div className="flex flex-wrap gap-1.5">
                {AD_PLATFORMS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPlatform(option.id)}
                    aria-pressed={platform === option.id}
                    className={`h-8 rounded-full border px-3 text-[12px] transition ${
                      platform === option.id ? "border-[#111113] bg-[#111113] font-semibold text-white" : "border-[var(--border)] bg-white hover:border-black/25"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold">Captura o video del anuncio</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-alt)] file:px-3 file:py-2 file:text-[12px] file:font-semibold"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold">Link del anuncio (opcional)</span>
              <input
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://www.facebook.com/ads/library/?id=…"
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-[13px] outline-none focus:border-black/25"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold">Texto del anuncio (opcional)</span>
              <textarea
                value={copy}
                onChange={(event) => setCopy(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-black/25"
              />
            </label>
          </>
        ) : null}
        {error ? <p className="text-[12px] text-[#e11d48]">{error}</p> : null}
        <div className="flex justify-end">
          <PrimaryButton onClick={() => void submit()} disabled={!app || busy}>
            {busy ? "Guardando…" : "Guardar anuncio"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ======================= ORGANIC ======================= */

type OrganicVideo = {
  app: MiniApp;
  url: string;
  platform: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  postedAt: string | null;
  savedAt: string;
};

function organicSearchLinks(name: string) {
  const short = name.split(/[:\-–|]/)[0].trim();
  const q = encodeURIComponent(short);
  return [
    { id: "tiktok", label: "TikTok", href: `https://www.tiktok.com/search/video?q=${q}` },
    { id: "instagram", label: "Instagram", href: `https://www.instagram.com/explore/search/keyword/?q=${q}` },
    { id: "youtube", label: "YouTube", href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${short} app`)}&sp=EgIYAQ%253D%253D` },
    { id: "x", label: "X", href: `https://x.com/search?q=${q}&f=media` },
  ];
}

export function OrganicPage({ projectId, country, onOpen }: PageProps) {
  const { items, loading, error, save, remove } = useMarketItems<OrganicVideo>(projectId, "organic");
  const [lookup, setLookup] = useState<MiniApp | null>(null);
  const [adding, setAdding] = useState<MiniApp | null | "new">(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const filtered = platform ? items.filter((item) => item.data.platform === platform) : items;
  const groups = groupByApp(filtered).map((group) => ({
    ...group,
    rows: [...group.rows].sort((a, b) => (b.data.views ?? 0) - (a.data.views ?? 0)),
    views: group.rows.reduce((sum, row) => sum + (row.data.views ?? 0), 0),
  }));
  groups.sort((a, b) => b.views - a.views);
  const platforms = [...new Set(items.map((item) => item.data.platform))];

  return (
    <div className="space-y-4">
      <PageTitle
        icon={IconOrganic}
        title="Contenido orgánico"
        subtitle="Videos de creadores que están moviendo apps, con sus views reales"
        action={
          <PrimaryButton onClick={() => setAdding("new")}>
            <PlusIcon /> Añadir video
          </PrimaryButton>
        }
      />

      <section className="vt-liquid-glass rounded-[24px] p-4">
        <p className="relative text-[13px] font-semibold">Buscar videos sobre una app</p>
        <p className="relative mb-3 text-[12px] text-[var(--muted)]">Abrimos la búsqueda de cada red con el nombre de la app. Pega aquí los que te sirvan.</p>
        <div className="relative">
          {lookup ? (
            <div className="space-y-3">
              <PickedApp app={lookup} onClear={() => setLookup(null)} />
              <div className="flex flex-wrap gap-2">
                {organicSearchLinks(lookup.name).map((link) => (
                  <GhostButton key={link.id} href={link.href}>
                    <PlatformLogo id={link.id} className="h-4 w-4" />
                    {link.label}
                  </GhostButton>
                ))}
                <PrimaryButton onClick={() => setAdding(lookup)}>
                  <PlusIcon /> Añadir video de esta app
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <AppPicker projectId={projectId} country={country} onPick={(app) => setLookup(miniApp(app))} placeholder="Busca una app para ver videos sobre ella…" />
          )}
        </div>
      </section>

      {platforms.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <TagChip label="Todas" count={items.length} active={platform === null} onClick={() => setPlatform(null)} />
          {platforms.map((value) => (
            <TagChip
              key={value}
              label={value === "tiktok" ? "TikTok" : value === "instagram" ? "Instagram" : value === "youtube" ? "YouTube" : value.toUpperCase()}
              count={items.filter((item) => item.data.platform === value).length}
              active={platform === value}
              onClick={() => setPlatform(platform === value ? null : value)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <Empty>{error}</Empty>
      ) : loading ? (
        <Empty>Cargando…</Empty>
      ) : groups.length === 0 ? (
        <Empty>Pega el link de un TikTok, Reel o Short que hable de una app y traemos sus views, likes y comentarios.</Empty>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.app.id} className="flex flex-col gap-3 rounded-[26px] border border-[var(--border)] bg-white p-3 lg:flex-row">
              <AppSideCard
                app={group.app}
                onOpen={() => onOpen({ id: group.app.id } as MarketApp)}
                stats={[
                  { label: "Videos", value: String(group.rows.length) },
                  { label: "Views", value: group.views ? compact(group.views) : "—" },
                ]}
                actions={
                  <GhostButton onClick={() => setAdding(group.app)}>
                    <PlusIcon /> Video
                  </GhostButton>
                }
              />
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2">
                {group.rows.map((row) => (
                  <article key={row.key} className="group relative w-[180px] shrink-0">
                    <a href={row.data.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[9/16] overflow-hidden rounded-[20px] bg-[#111113]">
                      {row.data.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.data.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
                      <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow">
                        <PlatformLogo id={row.data.platform} className="h-4 w-4" />
                      </span>
                      <span className="absolute inset-x-2.5 bottom-2.5 text-white">
                        <span className="block text-[18px] font-semibold tabular-nums leading-none">{row.data.views !== null ? compact(row.data.views) : "—"}</span>
                        <span className="text-[10px] opacity-80">views</span>
                        <span className="mt-1 flex gap-2 text-[11px] opacity-90">
                          {row.data.likes !== null ? <span>♥ {compact(row.data.likes)}</span> : null}
                          {row.data.comments !== null ? <span>💬 {compact(row.data.comments)}</span> : null}
                        </span>
                      </span>
                    </a>
                    <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
                      <span className="flex rounded-full bg-white/95 shadow">
                        <TrashButton label="Quitar video" onClick={() => void remove(row.key)} />
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[12px] font-semibold">{row.data.author ? `@${row.data.author.replace(/^@/, "")}` : "Creador"}</p>
                    {row.data.title ? <p className="line-clamp-2 text-[11px] text-[var(--muted)]">{row.data.title}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddVideoModal
        open={adding !== null}
        projectId={projectId}
        country={country}
        initialApp={adding === "new" ? null : adding}
        onClose={() => setAdding(null)}
        onSave={async (video) => {
          await save(video.url, video);
          setAdding(null);
        }}
      />
    </div>
  );
}

function AddVideoModal({
  open,
  projectId,
  country,
  initialApp,
  onClose,
  onSave,
}: {
  open: boolean;
  projectId: string;
  country: string;
  initialApp: MiniApp | null;
  onClose: () => void;
  onSave: (video: OrganicVideo) => Promise<void>;
}) {
  const [picked, setPicked] = useState<MiniApp | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const app = picked ?? initialApp;

  function close() {
    setPicked(null);
    setUrl("");
    setError("");
    onClose();
  }

  async function submit() {
    if (!app || !url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await fetchMarket<Omit<OrganicVideo, "app" | "savedAt">>(projectId, { op: "video", url: url.trim() });
      await onSave({ ...data, app, savedAt: new Date().toISOString() });
      setPicked(null);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Añadir video orgánico">
      <div className="space-y-4">
        {app ? <PickedApp app={app} onClear={() => setPicked(null)} /> : <AppPicker autoFocus projectId={projectId} country={country} onPick={(value) => setPicked(miniApp(value))} />}
        {app ? (
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold">Link del video</span>
            <input
              autoFocus
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.tiktok.com/@creador/video/…"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-[13px] outline-none focus:border-black/25"
            />
            <span className="mt-1 block text-[11px] text-[var(--muted)]">TikTok, Instagram, YouTube o X. Leemos las views públicas del video.</span>
          </label>
        ) : null}
        {error ? <p className="text-[12px] text-[#e11d48]">{error}</p> : null}
        <div className="flex justify-end">
          <PrimaryButton onClick={() => void submit()} disabled={!app || !url.trim() || busy}>
            {busy ? "Leyendo video…" : "Añadir video"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
