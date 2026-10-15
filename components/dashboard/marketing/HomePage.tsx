"use client";

import { useMemo } from "react";
import {
  CONTENT_STATUSES,
  daysAgo,
  derived,
  isoDay,
  money,
  num,
  type ContentPost,
  type MarketingLink,
} from "@/lib/marketing/types";
import { PlatformLogo } from "../viewtracker/vt-ui";
import type { ViewId } from "../nav";
import { change, dailySeries, groupTotals, useAds, usePeriod } from "./ads-data";
import { BarChart, Button, Card, Dot, Page, Progress, SectionTitle, useLoad, useRefreshOnActive } from "./ui";
import { UgcFlow } from "./UgcFlow";

type Task = { text: string; action: string; view: ViewId; tone: "bad" | "info" | "good" };

function ChannelHeading({ name, text, accent }: { name: string; text: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="h-5 w-1 rounded-full" style={{ background: accent }} />
      <h2 className="text-[18px] font-semibold tracking-tight text-[var(--foreground)]">{name}</h2>
      <p className="text-[12px] text-[var(--muted)]">{text}</p>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function ChannelCard({
  name,
  text,
  accent,
  stats,
  onOpen,
}: {
  name: string;
  text: string;
  accent: string;
  stats: { label: string; value: string; hint?: string; delta?: number | null; invert?: boolean }[];
  onOpen: () => void;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-[var(--foreground)]">{name}</p>
          <p className="text-[12px] text-[var(--muted)]">{text}</p>
        </div>
        <button type="button" onClick={onOpen} className="shrink-0 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
          Abrir →
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => {
          const good = s.delta == null ? null : s.invert ? s.delta <= 0 : s.delta >= 0;
          return (
            <div key={s.label} className="rounded-xl bg-[var(--surface-alt)] px-2.5 py-2">
              <p className="truncate text-[11px] text-[var(--muted)]">{s.label}</p>
              <p className="text-[17px] font-semibold tabular-nums text-[var(--foreground)]">{s.value}</p>
              {s.delta != null && Number.isFinite(s.delta) ? (
                <p className={`text-[10px] font-semibold tabular-nums ${good ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta * 100).toFixed(0)}%
                </p>
              ) : s.hint ? (
                <p className="truncate text-[10px] text-[var(--muted-soft)]">{s.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function HomePage({
  projectId,
  projectName,
  active,
  onNavigate,
}: {
  projectId: string;
  projectName: string;
  active?: boolean;
  onNavigate: (view: ViewId) => void;
}) {
  const posts = useLoad<{ items: ContentPost[] }>(`/api/projects/${projectId}/content/posts`, { items: [] });
  const views = useLoad<{ items: { day: string; views: number; videos: number }[] }>(`/api/projects/${projectId}/views-daily`, { items: [] });
  const links = useLoad<{ items: MarketingLink[] }>(`/api/projects/${projectId}/links`, { items: [] });
  const creators = useLoad<{ items: { id: string; status: string | null }[] }>(`/api/projects/${projectId}/viewtracker/creators`, { items: [] });
  const ads = useAds(projectId);
  useRefreshOnActive(active, posts.reload, links.reload, creators.reload, ads.reload);
  const week = usePeriod(ads.data.metrics, 7);
  const { current: monthRows, totals: monthTotals } = usePeriod(ads.data.metrics, 30);
  const currency = ads.data.campaigns[0]?.currency ?? "USD";

  const viewStats = useMemo(() => {
    const byDay = new Map(views.data.items.map((v) => [v.day, v.views]));
    // total_views is a running total per day; the daily gain is the difference with the previous day.
    const series = Array.from({ length: 31 }, (_, i) => {
      const day = isoDay(daysAgo(30 - i));
      return { day, total: byDay.get(day) ?? null };
    });
    let last: number | null = null;
    const gains = series.map((s) => {
      const gain = s.total != null && last != null ? Math.max(0, s.total - last) : 0;
      if (s.total != null) last = s.total;
      return { day: s.day, bar: gain };
    });
    const g = gains.slice(1);
    const sum = (a: { bar: number }[]) => a.reduce((s, x) => s + x.bar, 0);
    return { series: g, last7: sum(g.slice(-7)), prev7: sum(g.slice(-14, -7)) };
  }, [views.data.items]);

  const content = useMemo(() => {
    const items = posts.data.items;
    const now = new Date();
    const weekAgo = +daysAgo(7);
    const agenda = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const key = isoDay(d);
      return {
        key,
        date: d,
        items: items
          .filter((p) => p.scheduled_at && isoDay(new Date(p.scheduled_at)) === key)
          .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)),
      };
    });
    return {
      agenda,
      published7: items.filter((p) => p.status === "published" && +new Date(p.scheduled_at ?? p.updated_at) >= weekAgo).length,
      byStatus: CONTENT_STATUSES.map((s) => ({ ...s, n: items.filter((p) => p.status === s.id).length })),
      ideasNoScript: items.filter((p) => p.status === "idea" && !p.script).length,
      overdue: items.filter((p) => p.scheduled_at && new Date(p.scheduled_at) < now && p.status !== "published").length,
    };
  }, [posts.data.items]);

  const topCreatives = useMemo(() => {
    const totals = groupTotals(monthRows, (r) => r.creative_id);
    return ads.data.creatives
      .map((c) => ({ c, t: totals.get(c.id) }))
      .filter((x) => x.t && x.t.spend > 0)
      .map((x) => ({ ...x, d: derived(x.t!) }))
      .sort((a, b) => (b.d.roas ?? 0) - (a.d.roas ?? 0))
      .slice(0, 3);
  }, [ads.data.creatives, monthRows]);

  const tasks = useMemo(() => {
    const out: Task[] = [];
    if (!content.agenda[0].items.length) out.push({ tone: "bad", text: "No hay nada programado para hoy.", action: "Programar", view: "planner" });
    if (content.overdue) out.push({ tone: "bad", text: `${content.overdue} ${content.overdue === 1 ? "pieza atrasada" : "piezas atrasadas"} sin publicar.`, action: "Revisar", view: "planner" });
    const emptyDays = content.agenda.filter((d) => !d.items.length).length;
    if (emptyDays >= 3) out.push({ tone: "info", text: `${emptyDays} de los próximos 7 días no tienen contenido.`, action: "Llenar semana", view: "planner" });
    if (content.ideasNoScript >= 3) out.push({ tone: "info", text: `${content.ideasNoScript} ideas esperan guion.`, action: "Escribir", view: "planner" });
    const yesterday = isoDay(daysAgo(1));
    const stale = ads.data.campaigns.filter((c) => c.status === "active" && !ads.data.metrics.some((m) => m.campaign_id === c.id && m.day >= yesterday));
    if (stale.length) out.push({ tone: "info", text: `${stale.length} ${stale.length === 1 ? "campaña activa" : "campañas activas"} sin métricas de ayer.`, action: "Registrar", view: "campaigns" });
    const perCreative = groupTotals(ads.data.metrics, (r) => r.creative_id);
    const undecided = ads.data.creatives.filter((c) => c.status === "testing" && (perCreative.get(c.id)?.spend ?? 0) >= 50).length;
    if (undecided) out.push({ tone: "info", text: `${undecided} ${undecided === 1 ? "creativo lleva" : "creativos llevan"} más de 50 de gasto en prueba: decide si escalar o descartar.`, action: "Decidir", view: "creatives" });
    const uncontacted = creators.data.items.filter((c) => !c.status || c.status === "Not Invited").length;
    if (uncontacted) out.push({ tone: "info", text: `${uncontacted} ${uncontacted === 1 ? "creador sin contactar" : "creadores sin contactar"}.`, action: "Enviar solicitud", view: "requests" });
    if (!links.data.items.length) out.push({ tone: "info", text: "Aún no mides de dónde viene el tráfico.", action: "Crear enlace UTM", view: "links" });
    if (!out.length) out.push({ tone: "good", text: "Todo al día. Buen momento para generar ideas nuevas o probar otro creativo.", action: "Ideas", view: "planner" });
    return out.slice(0, 6);
  }, [content, ads.data, links.data.items.length, creators.data.items]);

  const wd = derived(week.totals);
  const pwd = derived(week.prevTotals);
  const adSeries = useMemo(() => dailySeries(monthRows, 30), [monthRows]);
  const topLinks = [...links.data.items].sort((a, b) => Number(b.clicks) - Number(a.clicks)).slice(0, 4);
  const pipelineTotal = content.byStatus.reduce((s, x) => s + x.n, 0);
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[12px] font-medium text-[var(--muted-soft)] first-letter:uppercase">
            {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            {greeting} · <span className="text-[var(--muted)]">{projectName}</span>
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Tus tres canales por separado: UGC con influencers IA, influencers reales y pagado.</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("planner")}>
          + Planificar contenido
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChannelCard
          name="UGC"
          text="Contenido propio con influencers IA"
          accent="#6366f1"
          onOpen={() => onNavigate("planner")}
          stats={[
            { label: "Vistas · 7 días", value: num(viewStats.last7), delta: change(viewStats.last7, viewStats.prev7) },
            { label: "Publicado · 7 días", value: String(content.published7) },
            { label: "Programado", value: String(content.agenda.reduce((s, d) => s + d.items.length, 0)), hint: "próximos 7 días" },
          ]}
        />
        <ChannelCard
          name="Influencers"
          text="Creadores reales que publican por ti"
          accent="#ec4899"
          onOpen={() => onNavigate("creators")}
          stats={[
            { label: "Creadores", value: String(creators.data.items.length) },
            { label: "Contactados", value: String(creators.data.items.filter((c) => c.status && c.status !== "Not Invited").length) },
            { label: "Sin contactar", value: String(creators.data.items.filter((c) => !c.status || c.status === "Not Invited").length) },
          ]}
        />
        <ChannelCard
          name="Pagado"
          text="Anuncios en Meta, TikTok, Google…"
          accent="#10b981"
          onOpen={() => onNavigate("campaigns")}
          stats={[
            { label: "Inversión · 7 días", value: money(week.totals.spend, currency, true), delta: change(week.totals.spend, week.prevTotals.spend) },
            { label: "ROAS", value: wd.roas == null ? "—" : `${wd.roas.toFixed(2)}x`, delta: change(wd.roas, pwd.roas) },
            { label: "CPA", value: money(wd.cpa, currency, true), delta: change(wd.cpa, pwd.cpa), invert: true },
          ]}
        />
      </div>

      <Card className="p-4">
        <SectionTitle title="Para hoy" hint="Lo más importante según tus datos, en los tres canales" />
        <div className="grid gap-2 md:grid-cols-2">
          {tasks.map((t) => (
            <div key={t.text} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <Dot color={t.tone === "bad" ? "var(--danger)" : t.tone === "good" ? "var(--success)" : "#6366f1"} />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--foreground-soft)]">{t.text}</p>
              <Button size="sm" onClick={() => onNavigate(t.view)}>
                {t.action}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <ChannelHeading name="UGC" accent="#6366f1" text="Del plan de contenido al video publicado y medido" />
      <UgcFlow
        onNavigate={onNavigate}
        counts={{ planner: `${pipelineTotal} piezas`, upload: content.agenda[0].items.length ? `${content.agenda[0].items.length} hoy` : undefined }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <SectionTitle
            title="Próximos 7 días"
            hint="Tu agenda de publicaciones"
            action={
              <button type="button" onClick={() => onNavigate("planner")} className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
                Abrir plan →
              </button>
            }
          />
          <div className="grid grid-cols-7 gap-1.5">
            {content.agenda.map((d, i) => (
              <div key={d.key} className={`min-h-[132px] rounded-xl border p-1.5 ${i === 0 ? "border-[var(--foreground)]/20 bg-[var(--surface-alt)]/60" : "border-[var(--border)]"}`}>
                <p className="mb-1.5 text-center text-[10px] font-semibold uppercase text-[var(--muted-soft)]">
                  {i === 0 ? "Hoy" : d.date.toLocaleDateString("es", { weekday: "short" })}
                  <span className="block text-[14px] text-[var(--foreground)]">{d.date.getDate()}</span>
                </p>
                <div className="space-y-1">
                  {d.items.slice(0, 3).map((p) => (
                    <div key={p.id} title={p.title} className="flex items-center gap-1 rounded-md bg-white px-1 py-0.5 shadow-[var(--shadow-xs)]">
                      <PlatformLogo id={p.platform} className="h-3 w-3 shrink-0" />
                      <span className="truncate text-[10px] font-medium text-[var(--foreground-soft)]">{p.title}</span>
                    </div>
                  ))}
                  {d.items.length > 3 ? <p className="text-center text-[10px] text-[var(--muted)]">+{d.items.length - 3}</p> : null}
                  {!d.items.length ? (
                    <button
                      type="button"
                      onClick={() => onNavigate("planner")}
                      className="flex h-8 w-full items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] text-[12px] text-[var(--muted-soft)] hover:text-[var(--foreground)]"
                    >
                      +
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Estado del contenido" hint={`${pipelineTotal} piezas en total`} />
          <div className="space-y-2.5">
            {content.byStatus.map((s) => (
              <div key={s.id} className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1.5 text-[var(--foreground-soft)]">
                  <Dot color={s.color} />
                  {s.label}
                </span>
                <Progress value={pipelineTotal ? s.n / pipelineTotal : 0} color={s.color} />
                <span className="text-right font-semibold tabular-nums">{s.n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle
          title="Vistas orgánicas"
          hint="Vistas nuevas por día · últimos 30 días"
          action={
            <button type="button" onClick={() => onNavigate("overview")} className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
              Ver resultados →
            </button>
          }
        />
        {viewStats.series.some((s) => s.bar > 0) ? (
          <BarChart data={viewStats.series} barLabel="Vistas nuevas" format={(n) => `${num(n)} vistas`} height={160} />
        ) : (
          <p className="py-14 text-center text-[12px] text-[var(--muted-soft)]">Añade cuentas o videos para ver la evolución diaria.</p>
        )}
      </Card>

      <ChannelHeading name="Pagado" accent="#10b981" text="Inversión, retorno y creativos de tus anuncios" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <SectionTitle
            title="Inversión vs ingresos"
            hint={`Últimos 30 días · ${money(monthTotals.spend, currency)} invertidos · ${ads.data.campaigns.filter((c) => c.status === "active").length} campañas activas`}
            action={
              <button type="button" onClick={() => onNavigate("campaigns")} className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
                Ver campañas →
              </button>
            }
          />
          {monthTotals.spend > 0 ? (
            <BarChart data={adSeries} barLabel="Inversión" lineLabel="Ingresos" format={(n) => money(n, currency)} height={160} />
          ) : (
            <p className="py-14 text-center text-[12px] text-[var(--muted-soft)]">Crea una campaña y registra su gasto para medir el retorno.</p>
          )}
        </Card>
        <div className="grid gap-4">
          <Card className="p-4">
            <SectionTitle title="Mejores creativos" hint="Por ROAS · 30 días" />
            {topCreatives.length ? (
              <div className="space-y-2">
                {topCreatives.map(({ c, t, d }, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onNavigate("creatives")}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--surface-alt)]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[12px] font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-[var(--foreground)]">{c.name}</span>
                      <span className="block truncate text-[11px] text-[var(--muted-soft)]">
                        {c.angle ?? "Sin ángulo"} · {money(t!.spend, currency, true)}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--success)]">{d.roas == null ? "—" : `${d.roas.toFixed(1)}x`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-[12px] text-[var(--muted-soft)]">Registra métricas por creativo para ver el ranking.</p>
            )}
          </Card>
          <Card className="p-4">
            <SectionTitle title="Clics por enlace UTM" />
            {topLinks.length ? (
              <div className="space-y-2.5">
                {topLinks.map((l) => (
                  <div key={l.id} className="text-[12px]">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="truncate font-medium text-[var(--foreground)]">{l.name}</span>
                      <span className="font-semibold tabular-nums">{num(Number(l.clicks))}</span>
                    </div>
                    <Progress value={Number(topLinks[0].clicks) ? Number(l.clicks) / Number(topLinks[0].clicks) : 0} color="#10b981" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-[12px] text-[var(--muted-soft)]">Crea enlaces UTM para medir cada anuncio.</p>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
