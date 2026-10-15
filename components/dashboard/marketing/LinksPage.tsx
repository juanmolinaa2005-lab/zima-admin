"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { buildUtmUrl, num, utmSlug, type AdCampaign, type MarketingLink } from "@/lib/marketing/types";
import {
  api,
  Button,
  Card,
  copyText,
  Empty,
  Field,
  Header,
  Kpi,
  notifyError,
  Page,
  SectionTitle,
  SelectInput,
  TextInput,
  useLoad,
} from "./ui";

const PRESETS = [
  { id: "bio-tiktok", label: "Bio de TikTok", source: "tiktok", medium: "social" },
  { id: "bio-instagram", label: "Bio de Instagram", source: "instagram", medium: "social" },
  { id: "meta-ads", label: "Meta Ads", source: "facebook", medium: "paid_social" },
  { id: "tiktok-ads", label: "TikTok Ads", source: "tiktok", medium: "paid_social" },
  { id: "google-ads", label: "Google Ads", source: "google", medium: "cpc" },
  { id: "youtube", label: "YouTube", source: "youtube", medium: "video" },
  { id: "email", label: "Newsletter", source: "newsletter", medium: "email" },
  { id: "influencer", label: "Creador / influencer", source: "influencer", medium: "referral" },
] as const;

type Form = {
  name: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  campaign_id: string;
};

const noopSubscribe = () => () => {};

const EMPTY: Form = { name: "", base_url: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "", campaign_id: "" };

export function LinksPage({ projectId }: { projectId: string }) {
  const base = `/api/projects/${projectId}/links`;
  const { data, setData, loading } = useLoad<{ items: MarketingLink[] }>(base, { items: [] });
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );

  useEffect(() => {
    api<{ items: AdCampaign[] }>(`/api/projects/${projectId}/ads/campaigns`)
      .then((r) => setCampaigns(r.items))
      .catch(() => {});
  }, [projectId]);

  const preview = useMemo(
    () =>
      /^https?:\/\//i.test(form.base_url)
        ? buildUtmUrl({
            base_url: form.base_url,
            utm_source: utmSlug(form.utm_source) || null,
            utm_medium: utmSlug(form.utm_medium) || null,
            utm_campaign: utmSlug(form.utm_campaign) || null,
            utm_content: utmSlug(form.utm_content) || null,
            utm_term: utmSlug(form.utm_term) || null,
          })
        : "",
    [form],
  );

  const links = data.items;
  const totalClicks = links.reduce((s, l) => s + Number(l.clicks || 0), 0);
  const top = [...links].sort((a, b) => Number(b.clicks) - Number(a.clicks))[0];
  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of links) map.set(l.utm_source || "directo", (map.get(l.utm_source || "directo") ?? 0) + Number(l.clicks || 0));
    return [...map].sort((a, b) => b[1] - a[1]);
  }, [links]);

  async function create() {
    if (!form.name.trim() || !/^https?:\/\//i.test(form.base_url)) {
      toast.error("Necesitas un nombre y una URL que empiece por https://");
      return;
    }
    setSaving(true);
    try {
      const { item } = await api<{ item: MarketingLink }>(base, "POST", { ...form, campaign_id: form.campaign_id || null });
      setData((d) => ({ items: [item, ...d.items] }));
      copyText(`${origin}/r/${item.code}`, "Enlace creado y copiado");
      setForm({ ...EMPTY, base_url: form.base_url });
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este enlace? Dejará de redirigir.")) return;
    try {
      await api(`${base}?id=${id}`, "DELETE");
      setData((d) => ({ items: d.items.filter((l) => l.id !== id) }));
    } catch (e) {
      notifyError(e);
    }
  }

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <Page>
      <Header
        kicker="Pagado"
        title="Enlaces y UTM"
        subtitle="Crea enlaces con UTM para cada canal, compártelos con un enlace corto y mide cuántos clics trae cada uno."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Enlaces activos" value={String(links.length)} />
        <Kpi label="Clics totales" value={num(totalClicks)} />
        <Kpi label="Enlace top" value={top && Number(top.clicks) > 0 ? num(Number(top.clicks)) : "—"} hint={top && Number(top.clicks) > 0 ? top.name : "sin clics aún"} />
        <Kpi label="Canal top" value={bySource[0] && bySource[0][1] > 0 ? bySource[0][0] : "—"} hint={bySource[0] && bySource[0][1] > 0 ? `${num(bySource[0][1])} clics` : undefined} />
      </div>

      <Card className="p-4 sm:p-5">
        <SectionTitle title="Nuevo enlace" hint="Elige un canal para rellenar source y medium automáticamente" />
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setForm({ ...form, utm_source: p.source, utm_medium: p.medium, name: form.name || p.label })}
              className={`ui-chip h-8 text-[12px] font-medium transition hover:border-[var(--border-strong)] ${
                form.utm_source === p.source && form.utm_medium === p.medium ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre" className="lg:col-span-1">
            <TextInput value={form.name} onChange={set("name")} placeholder="Bio TikTok · octubre" />
          </Field>
          <Field label="URL de destino" className="sm:col-span-1 lg:col-span-3">
            <TextInput value={form.base_url} onChange={set("base_url")} placeholder="https://tuweb.com/oferta" />
          </Field>
          <Field label="utm_source" hint="Dónde: tiktok, google…">
            <TextInput value={form.utm_source} onChange={set("utm_source")} />
          </Field>
          <Field label="utm_medium" hint="Tipo: social, cpc, email…">
            <TextInput value={form.utm_medium} onChange={set("utm_medium")} />
          </Field>
          <Field label="utm_campaign" hint="Nombre de la campaña">
            <TextInput value={form.utm_campaign} onChange={set("utm_campaign")} placeholder="lanzamiento-otono" />
          </Field>
          <Field label="utm_content" hint="Creativo o variante">
            <TextInput value={form.utm_content} onChange={set("utm_content")} placeholder="video-hook-2" />
          </Field>
          <Field label="utm_term" hint="Palabra clave (opcional)">
            <TextInput value={form.utm_term} onChange={set("utm_term")} />
          </Field>
          <Field label="Campaña de ads" hint="Opcional">
            <SelectInput
              value={form.campaign_id}
              onChange={(v) => setForm({ ...form, campaign_id: v })}
              options={[{ id: "", label: "Ninguna" }, ...campaigns.map((c) => ({ id: c.id, label: c.name }))]}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 truncate rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 font-mono text-[12px] text-[var(--muted)]" title={preview}>
            {preview || "La URL final aparecerá aquí"}
          </p>
          {preview ? (
            <Button onClick={() => copyText(preview, "URL con UTM copiada")}>Copiar URL larga</Button>
          ) : null}
          <Button variant="primary" disabled={saving} onClick={() => void create()}>
            {saving ? "Creando…" : "Crear enlace corto"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="ui-skeleton h-[240px] rounded-2xl" />
      ) : links.length === 0 ? (
        <Empty title="Sin enlaces todavía" text="Crea un enlace por canal (bio, anuncios, creadores, newsletter) para saber de dónde llega realmente tu tráfico." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                <th className="px-4 py-2.5 font-semibold">Enlace</th>
                <th className="px-3 py-2.5 font-semibold">Source / medium</th>
                <th className="px-3 py-2.5 font-semibold">Campaña</th>
                <th className="px-3 py-2.5 text-right font-semibold">Clics</th>
                <th className="px-3 py-2.5 font-semibold">Último clic</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const short = `${origin}/r/${l.code}`;
                return (
                  <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="truncate font-semibold text-[var(--foreground)]">{l.name}</p>
                      <p className="truncate font-mono text-[11px] text-[var(--muted-soft)]" title={buildUtmUrl(l)}>
                        {short.replace(/^https?:\/\//, "")} → {l.base_url.replace(/^https?:\/\//, "")}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                      {[l.utm_source, l.utm_medium].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{l.utm_campaign || "—"}</td>
                    <td className="px-3 py-3 text-right text-[15px] font-semibold tabular-nums">{num(Number(l.clicks))}</td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                      {l.last_click_at ? new Date(l.last_click_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => copyText(short, "Enlace corto copiado")}>
                          Copiar corto
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copyText(buildUtmUrl(l), "URL con UTM copiada")}>
                          UTM
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void remove(l.id)}>
                          ×
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
