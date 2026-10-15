"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AD_OBJECTIVES,
  AD_PLATFORMS,
  CAMPAIGN_STATUSES,
  derived,
  isoDay,
  money,
  num,
  pct,
  sumMetrics,
  type AdCampaign,
  type AdMetricRow,
} from "@/lib/marketing/types";
import { buildInsights, change, dailySeries, groupTotals, parseMetricsCsv, useAds, usePeriod, type ParsedRow } from "./ads-data";
import {
  api,
  BarChart,
  Button,
  Card,
  Dot,
  Drawer,
  Empty,
  Field,
  Header,
  Kpi,
  notifyError,
  Page,
  Progress,
  SectionTitle,
  Segmented,
  SelectInput,
  TextArea,
  TextInput,
  useRefreshOnActive,
} from "./ui";

const PERIODS = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
] as const;

const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "GBP", "BRL"].map((c) => ({ id: c, label: c }));

const platformOf = (id: string) => AD_PLATFORMS.find((p) => p.id === id) ?? { id, label: id, color: "#71717a" };

function PlatformBadge({ id }: { id: string }) {
  const p = platformOf(id);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
      <Dot color={p.color} />
      {p.label}
    </span>
  );
}

type CampaignDraft = Partial<AdCampaign>;
type DayDraft = { day: string; creative_id: string; spend: string; impressions: string; clicks: string; conversions: string; revenue: string };

const emptyDay = (): DayDraft => ({ day: isoDay(new Date()), creative_id: "", spend: "", impressions: "", clicks: "", conversions: "", revenue: "" });

export function AdsCampaignsPage({ projectId, active, onOpenCreatives }: { projectId: string; active?: boolean; onOpenCreatives?: () => void }) {
  const { data, loading, reload, setData } = useAds(projectId);
  useRefreshOnActive(active, reload);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("30");
  const days = Number(period);
  const { current, totals, prevTotals } = usePeriod(data.metrics, days);
  const d = derived(totals);
  const pd = derived(prevTotals);
  const currency = data.campaigns[0]?.currency ?? "USD";

  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [tab, setTab] = useState<"details" | "metrics">("details");
  const [saving, setSaving] = useState(false);
  const [dayDraft, setDayDraft] = useState<DayDraft>(emptyDay);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);

  const byCampaign = useMemo(() => groupTotals(current, (r) => r.campaign_id), [current]);
  const byPlatform = useMemo(() => {
    const platformOfCampaign = new Map(data.campaigns.map((c) => [c.id, c.platform]));
    return [...groupTotals(current, (r) => platformOfCampaign.get(r.campaign_id) ?? null)].sort((a, b) => b[1].spend - a[1].spend);
  }, [current, data.campaigns]);
  const insights = useMemo(() => buildInsights(data.campaigns, data.metrics, days), [data.campaigns, data.metrics, days]);
  const series = useMemo(() => dailySeries(current, days), [current, days]);
  const activeBudget = data.campaigns.filter((c) => c.status === "active").reduce((s, c) => s + Number(c.daily_budget || 0), 0);

  const editing = draft?.id ? data.campaigns.find((c) => c.id === draft.id) : null;
  const editingRows = useMemo(
    () => (editing ? data.metrics.filter((m) => m.campaign_id === editing.id).sort((a, b) => b.day.localeCompare(a.day)) : []),
    [editing, data.metrics],
  );
  const editingCreatives = editing ? data.creatives.filter((c) => c.campaign_id === editing.id) : [];

  function open(c: AdCampaign | null) {
    setDraft(c ? { ...c } : { name: "", platform: "meta", objective: "conversions", status: "draft", daily_budget: 20, currency });
    setTab("details");
    setDayDraft(emptyDay());
    setCsv("");
    setPreview(null);
  }

  async function saveCampaign() {
    if (!draft?.name?.trim()) {
      toast.error("Ponle un nombre a la campaña");
      return;
    }
    setSaving(true);
    try {
      const url = `/api/projects/${projectId}/ads/campaigns`;
      const { item } = await api<{ item: AdCampaign }>(url, draft.id ? "PATCH" : "POST", draft);
      const saved = { ...item, daily_budget: Number(item.daily_budget), total_budget: item.total_budget == null ? null : Number(item.total_budget), target_cpa: item.target_cpa == null ? null : Number(item.target_cpa) };
      setData((prev) => ({
        ...prev,
        campaigns: prev.campaigns.some((c) => c.id === saved.id) ? prev.campaigns.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev.campaigns],
      }));
      toast.success(draft.id ? "Campaña actualizada" : "Campaña creada · ahora registra sus métricas");
      if (draft.id) setDraft(null);
      else {
        setDraft({ ...saved });
        setTab("metrics");
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(c: AdCampaign, status: AdCampaign["status"]) {
    setData((prev) => ({ ...prev, campaigns: prev.campaigns.map((x) => (x.id === c.id ? { ...x, status } : x)) }));
    try {
      await api(`/api/projects/${projectId}/ads/campaigns`, "PATCH", { id: c.id, status });
    } catch (e) {
      notifyError(e);
      void reload();
    }
  }

  async function removeCampaign(id: string) {
    if (!confirm("¿Eliminar la campaña y todas sus métricas?")) return;
    try {
      await api(`/api/projects/${projectId}/ads/campaigns?id=${id}`, "DELETE");
      setDraft(null);
      void reload();
    } catch (e) {
      notifyError(e);
    }
  }

  async function saveRows(rows: (ParsedRow & { creative_id?: string | null })[]) {
    if (!editing) return;
    try {
      const res = await api<{ saved: number }>(`/api/projects/${projectId}/ads/metrics`, "POST", {
        rows: rows.map((r) => ({ ...r, campaign_id: editing.id })),
      });
      toast.success(`${res.saved} ${res.saved === 1 ? "día guardado" : "días guardados"}`);
      setDayDraft(emptyDay());
      setCsv("");
      setPreview(null);
      void reload();
    } catch (e) {
      notifyError(e);
    }
  }

  async function removeRow(row: AdMetricRow) {
    setData((prev) => ({ ...prev, metrics: prev.metrics.filter((m) => m.id !== row.id) }));
    try {
      await api(`/api/projects/${projectId}/ads/metrics?id=${row.id}`, "DELETE");
    } catch (e) {
      notifyError(e);
      void reload();
    }
  }

  return (
    <Page>
      <Header
        kicker="Pagado"
        title="Campañas"
        subtitle="Controla inversión, retorno y ritmo de gasto de todas tus campañas de pago en un solo lugar."
        actions={
          <>
            <Segmented label="Periodo" value={period} onChange={setPeriod} options={[...PERIODS]} />
            <Button variant="primary" onClick={() => open(null)}>
              + Nueva campaña
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ui-skeleton h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : data.campaigns.length === 0 ? (
        <Empty
          title="Crea tu primera campaña"
          text="Registra tus campañas de Meta, TikTok, Google o Apple Search Ads y mide gasto, CPA y ROAS con datos diarios o importando el CSV de la plataforma."
          action={
            <Button variant="primary" onClick={() => open(null)}>
              + Nueva campaña
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Inversión" value={money(totals.spend, currency)} delta={change(totals.spend, prevTotals.spend)} hint={`${money(activeBudget, currency)}/día activo`} />
            <Kpi label="Ingresos atribuidos" value={money(totals.revenue, currency)} delta={change(totals.revenue, prevTotals.revenue)} />
            <Kpi
              label="ROAS"
              value={d.roas == null ? "—" : `${d.roas.toFixed(2)}x`}
              delta={change(d.roas, pd.roas)}
              tone={d.roas == null ? undefined : d.roas >= 1 ? "good" : "bad"}
              hint="ingresos ÷ inversión"
            />
            <Kpi
              label="Beneficio"
              value={money(d.profit, currency)}
              tone={totals.spend === 0 ? undefined : d.profit >= 0 ? "good" : "bad"}
              hint="ingresos − inversión"
            />
            <Kpi label="Conversiones" value={num(totals.conversions, 1)} delta={change(totals.conversions, prevTotals.conversions)} />
            <Kpi label="CPA" value={money(d.cpa, currency)} delta={change(d.cpa, pd.cpa)} invert hint="coste por conversión" />
            <Kpi label="CTR" value={pct(d.ctr)} delta={change(d.ctr, pd.ctr)} hint={`${num(totals.clicks)} clics`} />
            <Kpi label="CPM" value={money(d.cpm, currency)} delta={change(d.cpm, pd.cpm)} invert hint={`${num(totals.impressions)} impresiones`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="p-4">
              <SectionTitle title="Inversión vs ingresos" hint={`Últimos ${days} días`} />
              <BarChart data={series} barLabel="Inversión" lineLabel="Ingresos" format={(n) => money(n, currency)} />
            </Card>
            <Card className="p-4">
              <SectionTitle title="Por plataforma" hint="Reparto de la inversión" />
              {byPlatform.length ? (
                <div className="space-y-3">
                  {byPlatform.map(([id, t]) => {
                    const p = platformOf(id);
                    const r = derived(t).roas;
                    return (
                      <div key={id}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                            <Dot color={p.color} />
                            {p.label}
                          </span>
                          <span className="tabular-nums text-[var(--muted)]">
                            {money(t.spend, currency, true)} · <b className={r != null && r >= 1 ? "text-[var(--success)]" : "text-[var(--foreground)]"}>{r == null ? "—" : `${r.toFixed(1)}x`}</b>
                          </span>
                        </div>
                        <Progress value={totals.spend ? t.spend / totals.spend : 0} color={p.color} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-[12px] text-[var(--muted-soft)]">Sin métricas en este periodo</p>
              )}
            </Card>
          </div>

          {insights.length ? (
            <div>
              <SectionTitle title="Recomendaciones" hint="Calculadas a partir de tus métricas" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {insights.map((i) => (
                  <div
                    key={i.title}
                    className={`rounded-2xl border p-3.5 ${
                      i.tone === "good"
                        ? "border-emerald-200 bg-[var(--success-soft)]"
                        : i.tone === "bad"
                          ? "border-red-200 bg-[var(--danger-soft)]"
                          : "border-[var(--border)] bg-white"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">{i.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--foreground-soft)]">{i.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                  <th className="px-4 py-2.5 font-semibold">Campaña</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Presup./día</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Inversión</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Conv.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">CPA</th>
                  <th className="px-3 py-2.5 text-right font-semibold">ROAS</th>
                  <th className="px-3 py-2.5 text-right font-semibold">CTR</th>
                  <th className="w-[140px] px-4 py-2.5 font-semibold">Presupuesto total</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => {
                  const t = byCampaign.get(c.id) ?? sumMetrics([]);
                  const m = derived(t);
                  const lifetime = sumMetrics(data.metrics.filter((r) => r.campaign_id === c.id)).spend;
                  const overCpa = c.target_cpa && m.cpa != null ? m.cpa > c.target_cpa : null;
                  return (
                    <tr key={c.id} onClick={() => open(c)} className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-alt)]/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--foreground)]">{c.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <PlatformBadge id={c.platform} />
                          <span className="text-[11px] text-[var(--muted-soft)]">· {AD_OBJECTIVES.find((o) => o.id === c.objective)?.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={c.status}
                          onChange={(e) => void setStatus(c, e.target.value as AdCampaign["status"])}
                          className="rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-[12px]"
                        >
                          {CAMPAIGN_STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(c.daily_budget, c.currency)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{money(t.spend, c.currency)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{num(t.conversions, 1)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${overCpa === true ? "text-[var(--danger)]" : overCpa === false ? "text-[var(--success)]" : ""}`}>
                        {money(m.cpa, c.currency)}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${m.roas == null ? "" : m.roas >= 1 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {m.roas == null ? "—" : `${m.roas.toFixed(2)}x`}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(m.ctr)}</td>
                      <td className="px-4 py-3">
                        {c.total_budget ? (
                          <div>
                            <Progress value={lifetime / c.total_budget} color={lifetime / c.total_budget > 0.9 ? "var(--danger)" : "var(--foreground)"} />
                            <p className="mt-1 text-[10px] tabular-nums text-[var(--muted-soft)]">
                              {money(lifetime, c.currency, true)} de {money(c.total_budget, c.currency, true)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--muted-soft)]">Sin límite</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Drawer
        open={draft !== null}
        wide
        title={draft?.id ? draft.name || "Campaña" : "Nueva campaña"}
        subtitle={draft?.id ? `${platformOf(draft.platform ?? "").label} · ${AD_OBJECTIVES.find((o) => o.id === draft.objective)?.label ?? ""}` : "Configura la campaña; después podrás registrar sus métricas"}
        onClose={() => setDraft(null)}
        footer={
          tab === "details" ? (
            <>
              {draft?.id ? (
                <Button variant="danger" onClick={() => void removeCampaign(draft.id!)}>
                  Eliminar
                </Button>
              ) : null}
              <span className="flex-1" />
              <Button onClick={() => setDraft(null)}>Cancelar</Button>
              <Button variant="primary" disabled={saving} onClick={() => void saveCampaign()}>
                {saving ? "Guardando…" : draft?.id ? "Guardar cambios" : "Crear campaña"}
              </Button>
            </>
          ) : undefined
        }
      >
        {draft ? (
          <div className="space-y-5">
            {draft.id ? (
              <Segmented
                label="Sección"
                value={tab}
                onChange={setTab}
                options={[
                  { id: "details", label: "Configuración" },
                  { id: "metrics", label: `Métricas (${editingRows.length})` },
                ]}
              />
            ) : null}

            {tab === "details" ? (
              <div className="space-y-4">
                <Field label="Nombre">
                  <TextInput autoFocus value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Conversiones · Lookalike 1% · ES" />
                </Field>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Plataforma">
                    <SelectInput value={draft.platform ?? "meta"} onChange={(v) => setDraft({ ...draft, platform: v })} options={AD_PLATFORMS} />
                  </Field>
                  <Field label="Objetivo">
                    <SelectInput value={draft.objective ?? "conversions"} onChange={(v) => setDraft({ ...draft, objective: v })} options={AD_OBJECTIVES} />
                  </Field>
                  <Field label="Estado">
                    <SelectInput value={draft.status ?? "draft"} onChange={(v) => setDraft({ ...draft, status: v as AdCampaign["status"] })} options={CAMPAIGN_STATUSES} />
                  </Field>
                  <Field label="Presupuesto diario">
                    <TextInput type="number" min={0} step="0.01" value={draft.daily_budget ?? ""} onChange={(e) => setDraft({ ...draft, daily_budget: Number(e.target.value) })} />
                  </Field>
                  <Field label="Presupuesto total" hint="Opcional">
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.total_budget ?? ""}
                      onChange={(e) => setDraft({ ...draft, total_budget: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Moneda">
                    <SelectInput value={draft.currency ?? "USD"} onChange={(v) => setDraft({ ...draft, currency: v })} options={CURRENCIES} />
                  </Field>
                  <Field label="CPA objetivo" hint="Para alertas de rendimiento">
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.target_cpa ?? ""}
                      onChange={(e) => setDraft({ ...draft, target_cpa: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Inicio">
                    <TextInput type="date" value={draft.start_date ?? ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value || null })} />
                  </Field>
                  <Field label="Fin">
                    <TextInput type="date" value={draft.end_date ?? ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value || null })} />
                  </Field>
                </div>
                <Field label="Audiencia">
                  <TextArea rows={2} value={draft.audience ?? ""} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} placeholder="Edad, países, intereses, lookalikes…" />
                </Field>
                <Field label="Notas">
                  <TextArea rows={3} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Hipótesis, aprendizajes, cambios realizados…" />
                </Field>
                {editing && editingCreatives.length ? (
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[var(--foreground-soft)]">Creativos en esta campaña</p>
                    <div className="flex flex-wrap gap-1.5">
                      {editingCreatives.map((c) => (
                        <span key={c.id} className="ui-chip text-[12px]">
                          {c.name}
                        </span>
                      ))}
                    </div>
                    {onOpenCreatives ? (
                      <button type="button" onClick={onOpenCreatives} className="mt-2 text-[12px] font-medium text-[var(--foreground)] underline underline-offset-2">
                        Ver creativos →
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : editing ? (
              <div className="space-y-5">
                <Card className="p-4">
                  <p className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">Registrar un día</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Fecha">
                      <TextInput type="date" value={dayDraft.day} onChange={(e) => setDayDraft({ ...dayDraft, day: e.target.value })} />
                    </Field>
                    <Field label="Creativo" hint="Opcional">
                      <SelectInput
                        value={dayDraft.creative_id}
                        onChange={(v) => setDayDraft({ ...dayDraft, creative_id: v })}
                        options={[{ id: "", label: "Toda la campaña" }, ...data.creatives.filter((c) => !c.campaign_id || c.campaign_id === editing.id).map((c) => ({ id: c.id, label: c.name }))]}
                      />
                    </Field>
                    {(
                      [
                        ["spend", `Inversión (${editing.currency})`],
                        ["impressions", "Impresiones"],
                        ["clicks", "Clics"],
                        ["conversions", "Conversiones"],
                        ["revenue", `Ingresos (${editing.currency})`],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <TextInput type="number" min={0} step="any" value={dayDraft[key]} onChange={(e) => setDayDraft({ ...dayDraft, [key]: e.target.value })} placeholder="0" />
                      </Field>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="primary"
                      disabled={!dayDraft.day}
                      onClick={() =>
                        void saveRows([
                          {
                            day: dayDraft.day,
                            creative_id: dayDraft.creative_id || null,
                            spend: Number(dayDraft.spend) || 0,
                            impressions: Number(dayDraft.impressions) || 0,
                            clicks: Number(dayDraft.clicks) || 0,
                            conversions: Number(dayDraft.conversions) || 0,
                            revenue: Number(dayDraft.revenue) || 0,
                          },
                        ])
                      }
                    >
                      Guardar día
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">Importar CSV</p>
                  <p className="mb-3 mt-0.5 text-[12px] text-[var(--muted)]">
                    Exporta el informe diario desde Meta, TikTok o Google Ads y pégalo aquí. Se detectan columnas como fecha, importe gastado, impresiones, clics, resultados e ingresos.
                  </p>
                  <TextArea
                    rows={5}
                    value={csv}
                    onChange={(e) => {
                      setCsv(e.target.value);
                      setPreview(null);
                    }}
                    placeholder={"fecha,gasto,impresiones,clics,conversiones,ingresos\n2026-10-01,45.20,12000,180,6,240"}
                    className="font-mono text-[12px]"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="ui-btn-secondary ui-press inline-flex h-9 cursor-pointer items-center rounded-[10px] px-3.5 text-[13px] font-semibold">
                      Subir archivo
                      <input
                        type="file"
                        accept=".csv,text/csv,.tsv,text/plain"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setCsv(await file.text());
                            setPreview(null);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <Button
                      disabled={!csv.trim()}
                      onClick={() => {
                        const res = parseMetricsCsv(csv);
                        if (res.missing.length) toast.error(`No encuentro las columnas: ${res.missing.join(", ")}`);
                        else if (!res.rows.length) toast.error("No hay filas con fecha válida");
                        else setPreview(res.rows);
                      }}
                    >
                      Previsualizar
                    </Button>
                    {preview ? (
                      <Button variant="primary" onClick={() => void saveRows(preview)}>
                        Importar {preview.length} días
                      </Button>
                    ) : null}
                  </div>
                  {preview ? (
                    <p className="mt-2 text-[12px] text-[var(--muted)]">
                      {preview[0].day} → {preview.at(-1)!.day} · inversión total {money(sumMetrics(preview).spend, editing.currency)} · los días ya registrados se reemplazan.
                    </p>
                  ) : null}
                </Card>

                {editingRows.length ? (
                  <Card className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted-soft)]">
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Creativo</th>
                          <th className="px-3 py-2 text-right font-semibold">Inversión</th>
                          <th className="px-3 py-2 text-right font-semibold">Impr.</th>
                          <th className="px-3 py-2 text-right font-semibold">Clics</th>
                          <th className="px-3 py-2 text-right font-semibold">Conv.</th>
                          <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {editingRows.slice(0, 120).map((r) => (
                          <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-2 tabular-nums">{new Date(`${r.day}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" })}</td>
                            <td className="max-w-[140px] truncate px-3 py-2 text-[var(--muted)]">{data.creatives.find((c) => c.id === r.creative_id)?.name ?? "Campaña"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(r.spend, editing.currency)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(r.impressions)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(r.clicks)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(r.conversions, 1)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(r.revenue, editing.currency)}</td>
                            <td className="px-2 py-2 text-right">
                              <button type="button" aria-label="Eliminar fila" onClick={() => void removeRow(r)} className="rounded px-1.5 text-[var(--muted-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                ) : (
                  <p className="text-center text-[12px] text-[var(--muted-soft)]">Todavía no hay métricas registradas para esta campaña.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </Page>
  );
}
