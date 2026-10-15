"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AD_PLATFORMS,
  CREATIVE_ANGLES,
  CREATIVE_FORMATS,
  CREATIVE_STATUSES,
  derived,
  money,
  pct,
  sumMetrics,
  type AdCreative,
} from "@/lib/marketing/types";
import type { CopyDraft } from "@/lib/marketing/ai";
import { groupTotals, useAds } from "./ads-data";
import {
  api,
  Button,
  Card,
  copyText,
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
  SelectInput,
  TextArea,
  TextInput,
  useRefreshOnActive,
} from "./ui";

const STATUS = Object.fromEntries(CREATIVE_STATUSES.map((s) => [s.id, s])) as Record<AdCreative["status"], (typeof CREATIVE_STATUSES)[number]>;
const ANGLE_OPTIONS = [{ id: "", label: "Sin ángulo" }, ...CREATIVE_ANGLES.map((a) => ({ id: a, label: a }))];

export function AdsCreativesPage({ projectId, active }: { projectId: string; active?: boolean }) {
  const { data, setData, loading, reload } = useAds(projectId);
  useRefreshOnActive(active, reload);
  const [campaign, setCampaign] = useState("");
  const [status, setStatus] = useState<string>("");
  const [draft, setDraft] = useState<Partial<AdCreative> | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiOpts, setAiOpts] = useState({ platform: "meta", angle: "", count: 4, brief: "" });
  const [aiResults, setAiResults] = useState<(CopyDraft & { picked: boolean })[] | null>(null);
  const [aiSource, setAiSource] = useState<"ai" | "template">("ai");
  const [generating, setGenerating] = useState(false);

  const currency = data.campaigns[0]?.currency ?? "USD";
  const perCreative = useMemo(() => groupTotals(data.metrics, (r) => r.creative_id), [data.metrics]);
  const campaignName = useMemo(() => new Map(data.campaigns.map((c) => [c.id, c.name])), [data.campaigns]);

  const visible = data.creatives.filter((c) => (!campaign || c.campaign_id === campaign) && (!status || c.status === status));

  const angleBoard = useMemo(() => {
    const map = new Map<string, { count: number; totals: ReturnType<typeof sumMetrics> }>();
    for (const c of data.creatives) {
      if (!c.angle) continue;
      const t = perCreative.get(c.id);
      const prev = map.get(c.angle) ?? { count: 0, totals: sumMetrics([]) };
      map.set(c.angle, { count: prev.count + 1, totals: t ? sumMetrics([prev.totals, t]) : prev.totals });
    }
    return [...map]
      .map(([angle, v]) => ({ angle, count: v.count, ...v.totals, ...derived(v.totals) }))
      .filter((a) => a.spend > 0)
      .sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1) || (b.ctr ?? 0) - (a.ctr ?? 0));
  }, [data.creatives, perCreative]);
  const bestRoas = Math.max(0.0001, ...angleBoard.map((a) => a.roas ?? 0));

  const counts = {
    testing: data.creatives.filter((c) => c.status === "testing").length,
    winner: data.creatives.filter((c) => c.status === "winner").length,
  };
  const tested = data.creatives.filter((c) => c.status === "winner" || c.status === "loser").length;

  function upsert(item: AdCreative) {
    setData((prev) => ({
      ...prev,
      creatives: prev.creatives.some((c) => c.id === item.id) ? prev.creatives.map((c) => (c.id === item.id ? item : c)) : [item, ...prev.creatives],
    }));
  }

  async function save() {
    if (!draft?.name?.trim()) {
      toast.error("Ponle un nombre al creativo");
      return;
    }
    setSaving(true);
    try {
      const { item } = await api<{ item: AdCreative }>(`/api/projects/${projectId}/ads/creatives`, draft.id ? "PATCH" : "POST", draft);
      upsert(item);
      setDraft(null);
      toast.success("Creativo guardado");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(c: AdCreative, next: AdCreative["status"]) {
    upsert({ ...c, status: next });
    try {
      await api(`/api/projects/${projectId}/ads/creatives`, "PATCH", { id: c.id, status: next });
    } catch (e) {
      notifyError(e);
      void reload();
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este creativo y sus métricas?")) return;
    try {
      await api(`/api/projects/${projectId}/ads/creatives?id=${id}`, "DELETE");
      setDraft(null);
      void reload();
    } catch (e) {
      notifyError(e);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ copies: CopyDraft[]; source: "ai" | "template" }>(`/api/projects/${projectId}/ads/copy`, "POST", aiOpts);
      setAiResults(res.copies.map((c) => ({ ...c, picked: true })));
      setAiSource(res.source);
    } catch (e) {
      notifyError(e);
    } finally {
      setGenerating(false);
    }
  }

  async function savePicked() {
    const picked = (aiResults ?? []).filter((c) => c.picked);
    if (!picked.length) return;
    try {
      const { items } = await api<{ items: AdCreative[] }>(`/api/projects/${projectId}/ads/creatives`, "POST", {
        items: picked.map((c) => ({
          name: c.name,
          angle: c.angle,
          hook: c.hook,
          primary_text: c.primary_text,
          headline: c.headline,
          cta: c.cta,
          status: "draft",
          source: "ai",
          format: "video",
          campaign_id: campaign || null,
        })),
      });
      setData((prev) => ({ ...prev, creatives: [...items, ...prev.creatives] }));
      toast.success(`${items.length} creativos añadidos como borrador`);
      setAiOpen(false);
      setAiResults(null);
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <Page>
      <Header
        kicker="Pagado"
        title="Creativos"
        subtitle="Prueba hooks y ángulos, mide qué anuncio rinde mejor y escala los ganadores."
        actions={
          <>
            <Button onClick={() => setAiOpen(true)}>✨ Copys con IA</Button>
            <Button variant="primary" onClick={() => setDraft({ name: "", format: "video", status: "testing", campaign_id: campaign || null })}>
              + Nuevo creativo
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Creativos" value={String(data.creatives.length)} hint={`${new Set(data.creatives.map((c) => c.angle).filter(Boolean)).size} ángulos distintos`} />
        <Kpi label="En prueba" value={String(counts.testing)} />
        <Kpi label="Ganadores" value={String(counts.winner)} tone={counts.winner ? "good" : undefined} />
        <Kpi label="Tasa de acierto" value={tested ? `${Math.round((counts.winner / tested) * 100)}%` : "—"} hint="ganadores ÷ decididos" />
      </div>

      {angleBoard.length ? (
        <Card className="p-4">
          <SectionTitle title="Qué ángulos funcionan" hint="Rendimiento agregado de todos los creativos de cada ángulo" />
          <div className="space-y-2.5">
            {angleBoard.map((a, i) => (
              <div key={a.angle} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-3 text-[12px]">
                <span className="truncate font-medium text-[var(--foreground)]">
                  {i === 0 ? "🏆 " : ""}
                  {a.angle} <span className="text-[var(--muted-soft)]">· {a.count}</span>
                </span>
                <Progress value={(a.roas ?? 0) / bestRoas} color={i === 0 ? "var(--success)" : "#a5b4fc"} />
                <span className="w-[220px] text-right tabular-nums text-[var(--muted)]">
                  ROAS <b className="text-[var(--foreground)]">{a.roas == null ? "—" : `${a.roas.toFixed(2)}x`}</b> · CTR {pct(a.ctr)} · CPA {money(a.cpa, currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          value={campaign}
          onChange={setCampaign}
          className="h-9 w-auto min-w-[200px]"
          options={[{ id: "", label: "Todas las campañas" }, ...data.campaigns.map((c) => ({ id: c.id, label: c.name }))]}
        />
        <div className="flex flex-wrap gap-1">
          {[{ id: "", label: "Todos", color: "#111114" }, ...CREATIVE_STATUSES].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatus(s.id)}
              className={`ui-chip h-8 text-[12px] font-medium transition ${status === s.id ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : "hover:border-[var(--border-strong)]"}`}
            >
              {s.id ? <Dot color={s.color} /> : null}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="ui-skeleton h-[220px] rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Empty
          title={data.creatives.length ? "Ningún creativo con este filtro" : "Aún no hay creativos"}
          text="Genera variantes de copy con IA o añade tus anuncios para comparar su rendimiento."
          action={<Button variant="primary" onClick={() => setAiOpen(true)}>✨ Generar copys</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const t = perCreative.get(c.id);
            const m = t ? derived(t) : null;
            const s = STATUS[c.status];
            return (
              <div key={c.id} className="ui-card ui-card-hover flex flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setDraft({ ...c })} className="min-w-0 text-left">
                    <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">{c.name}</p>
                    <p className="truncate text-[11px] text-[var(--muted-soft)]">
                      {CREATIVE_FORMATS.find((f) => f.id === c.format)?.label}
                      {c.campaign_id ? ` · ${campaignName.get(c.campaign_id) ?? ""}` : " · Sin campaña"}
                      {c.source === "ai" ? " · IA" : ""}
                    </p>
                  </button>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${s.color}1a`, color: s.color }}>
                    <Dot color={s.color} />
                    {s.label}
                  </span>
                </div>
                {c.angle ? <span className="ui-tag ui-tag-muted mb-2 w-fit">{c.angle}</span> : null}
                {c.hook ? <p className="text-[13px] font-medium leading-snug text-[var(--foreground)]">“{c.hook}”</p> : null}
                {c.primary_text ? <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-[var(--muted)]">{c.primary_text}</p> : null}
                {c.headline ? (
                  <p className="mt-2 text-[12px] font-semibold text-[var(--foreground-soft)]">
                    {c.headline}
                    {c.cta ? <span className="ml-1.5 rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">{c.cta}</span> : null}
                  </p>
                ) : null}
                <div className="mt-auto pt-3">
                  {t && m ? (
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--surface-alt)] p-2 text-center">
                      {[
                        ["Gasto", money(t.spend, currency, true)],
                        ["CTR", pct(m.ctr, 1)],
                        ["CPA", money(m.cpa, currency, true)],
                        ["ROAS", m.roas == null ? "—" : `${m.roas.toFixed(1)}x`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[10px] text-[var(--muted-soft)]">{label}</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-center text-[11px] text-[var(--muted-soft)]">Sin métricas · regístralas desde la campaña</p>
                  )}
                  <div className="mt-2 flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void quickStatus(c, "winner")} title="Marcar como ganador">
                      🏆 Ganador
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void quickStatus(c, "loser")} title="Descartar">
                      Descartar
                    </Button>
                    <span className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copiar texto del anuncio"
                      onClick={() => copyText([c.hook, c.primary_text, c.headline].filter(Boolean).join("\n\n"), "Copy copiado")}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        open={draft !== null}
        title={draft?.id ? "Editar creativo" : "Nuevo creativo"}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id ? (
              <>
                <Button variant="danger" onClick={() => void remove(draft.id!)}>
                  Eliminar
                </Button>
                <Button variant="ghost" onClick={() => setDraft({ ...draft, id: undefined, name: `${draft.name} · variante`, status: "draft", source: "manual" })}>
                  Crear variante
                </Button>
              </>
            ) : null}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Nombre interno">
              <TextInput autoFocus value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. UGC testimonio · hook 2" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Campaña">
                <SelectInput
                  value={draft.campaign_id ?? ""}
                  onChange={(v) => setDraft({ ...draft, campaign_id: v || null })}
                  options={[{ id: "", label: "Sin campaña" }, ...data.campaigns.map((c) => ({ id: c.id, label: c.name }))]}
                />
              </Field>
              <Field label="Estado">
                <SelectInput value={draft.status ?? "testing"} onChange={(v) => setDraft({ ...draft, status: v as AdCreative["status"] })} options={CREATIVE_STATUSES} />
              </Field>
              <Field label="Formato">
                <SelectInput value={draft.format ?? "video"} onChange={(v) => setDraft({ ...draft, format: v })} options={CREATIVE_FORMATS} />
              </Field>
              <Field label="Ángulo">
                <SelectInput value={draft.angle ?? ""} onChange={(v) => setDraft({ ...draft, angle: v || null })} options={ANGLE_OPTIONS} />
              </Field>
            </div>
            <Field label="Hook (primeros 3 segundos)">
              <TextInput value={draft.hook ?? ""} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />
            </Field>
            <Field label="Texto principal">
              <TextArea rows={4} value={draft.primary_text ?? ""} onChange={(e) => setDraft({ ...draft, primary_text: e.target.value })} />
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
              <Field label="Titular">
                <TextInput value={draft.headline ?? ""} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
              </Field>
              <Field label="Botón (CTA)">
                <TextInput value={draft.cta ?? ""} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} placeholder="Descargar" />
              </Field>
            </div>
            <Field label="Enlace al video o imagen">
              <TextInput value={draft.asset_url ?? ""} onChange={(e) => setDraft({ ...draft, asset_url: e.target.value })} placeholder="https://…" />
            </Field>
            {draft.id && perCreative.get(draft.id) ? (
              <div className="rounded-xl bg-[var(--surface-alt)] p-3 text-[12px] text-[var(--muted)]">
                Total acumulado: {money(perCreative.get(draft.id)!.spend, currency)} invertidos · {perCreative.get(draft.id)!.conversions} conversiones ·{" "}
                {money(perCreative.get(draft.id)!.revenue, currency)} en ingresos
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={aiOpen}
        wide
        title="Generar copys de anuncios"
        subtitle="Variantes listas para test A/B con hook, texto principal, titular y CTA"
        onClose={() => {
          setAiOpen(false);
          setAiResults(null);
        }}
        footer={
          aiResults ? (
            <>
              <Button variant="ghost" onClick={() => setAiResults(null)}>
                ← Volver
              </Button>
              <span className="flex-1" />
              <Button variant="primary" disabled={!aiResults.some((c) => c.picked)} onClick={() => void savePicked()}>
                Guardar {aiResults.filter((c) => c.picked).length} como creativos
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setAiOpen(false)}>Cancelar</Button>
              <Button variant="primary" disabled={generating} onClick={() => void generate()}>
                {generating ? "Generando…" : `Generar ${aiOpts.count} variantes`}
              </Button>
            </>
          )
        }
      >
        {aiResults ? (
          <div className="space-y-3">
            {aiSource === "template" ? (
              <p className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[12px] text-[var(--warning)]">
                Variantes desde plantillas. Conecta tu clave de OpenAI en Ajustes → API para copys personalizados con IA.
              </p>
            ) : null}
            {aiResults.map((c, i) => (
              <label
                key={i}
                className={`block cursor-pointer rounded-2xl border bg-white p-4 transition ${c.picked ? "border-[var(--foreground)] shadow-[0_0_0_3px_rgba(17,17,19,0.06)]" : "border-[var(--border)] opacity-70"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.picked}
                    onChange={(e) => setAiResults(aiResults.map((x, j) => (j === i ? { ...x, picked: e.target.checked } : x)))}
                  />
                  <span className="text-[13px] font-semibold text-[var(--foreground)]">{c.name}</span>
                  {c.angle ? <span className="ui-tag ui-tag-muted ml-auto">{c.angle}</span> : null}
                </div>
                <p className="text-[13px] font-medium text-[var(--foreground)]">“{c.hook}”</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">{c.primary_text}</p>
                <p className="mt-2 text-[12px] font-semibold text-[var(--foreground-soft)]">
                  {c.headline} <span className="ml-1 rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{c.cta}</span>
                </p>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plataforma">
                <SelectInput value={aiOpts.platform} onChange={(v) => setAiOpts({ ...aiOpts, platform: v })} options={AD_PLATFORMS} />
              </Field>
              <Field label="Variantes">
                <SelectInput
                  value={String(aiOpts.count)}
                  onChange={(v) => setAiOpts({ ...aiOpts, count: Number(v) })}
                  options={[2, 4, 6, 8].map((n) => ({ id: String(n), label: `${n} variantes` }))}
                />
              </Field>
            </div>
            <Field label="Ángulo" hint="Vacío = mezcla de ángulos para testear">
              <SelectInput value={aiOpts.angle} onChange={(v) => setAiOpts({ ...aiOpts, angle: v })} options={[{ id: "", label: "Mezclar ángulos" }, ...CREATIVE_ANGLES.map((a) => ({ id: a, label: a }))]} />
            </Field>
            <Field label="Indicaciones (opcional)" hint="Oferta, público, beneficios clave, tono…">
              <TextArea
                rows={4}
                value={aiOpts.brief}
                onChange={(e) => setAiOpts({ ...aiOpts, brief: e.target.value })}
                placeholder="Ej. 50% de descuento el primer mes, mujeres 25-40 que entrenan en casa, tono motivador"
              />
            </Field>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
