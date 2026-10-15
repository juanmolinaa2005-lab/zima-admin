export const CONTENT_STATUSES = [
  { id: "idea", label: "Idea", color: "#a1a1aa" },
  { id: "script", label: "Guion", color: "#8b5cf6" },
  { id: "production", label: "Grabación", color: "#f59e0b" },
  { id: "review", label: "Revisión", color: "#ec4899" },
  { id: "scheduled", label: "Programado", color: "#3b82f6" },
  { id: "published", label: "Publicado", color: "#10b981" },
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number]["id"];

export const CONTENT_PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
  { id: "facebook", label: "Facebook" },
  { id: "snapchat", label: "Snapchat" },
] as const;

export const CONTENT_FORMATS = [
  { id: "video", label: "Video corto" },
  { id: "carousel", label: "Carrusel" },
  { id: "image", label: "Imagen" },
  { id: "story", label: "Story" },
  { id: "long", label: "Video largo" },
  { id: "text", label: "Texto / hilo" },
] as const;

export type ContentPost = {
  id: string;
  project_id: string;
  title: string;
  platform: string;
  format: string;
  pillar: string | null;
  status: ContentStatus;
  scheduled_at: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  hashtags: string[];
  asset_url: string | null;
  published_url: string | null;
  notes: string | null;
  source: "manual" | "ai";
  created_at: string;
  updated_at: string;
};

export const AD_PLATFORMS = [
  { id: "meta", label: "Meta Ads", color: "#0866FF" },
  { id: "tiktok", label: "TikTok Ads", color: "#111114" },
  { id: "google", label: "Google Ads", color: "#34A853" },
  { id: "apple", label: "Apple Search Ads", color: "#0A84FF" },
  { id: "snapchat", label: "Snapchat Ads", color: "#E5C800" },
  { id: "youtube", label: "YouTube Ads", color: "#FF0033" },
  { id: "x", label: "X Ads", color: "#3f3f46" },
] as const;

export const AD_OBJECTIVES = [
  { id: "awareness", label: "Alcance" },
  { id: "traffic", label: "Tráfico" },
  { id: "installs", label: "Instalaciones" },
  { id: "leads", label: "Leads" },
  { id: "conversions", label: "Conversiones" },
  { id: "sales", label: "Ventas" },
] as const;

export const CAMPAIGN_STATUSES = [
  { id: "draft", label: "Borrador", tag: "ui-tag-muted" },
  { id: "active", label: "Activa", tag: "ui-tag-success" },
  { id: "paused", label: "Pausada", tag: "ui-tag-accent" },
  { id: "ended", label: "Finalizada", tag: "ui-tag-muted" },
] as const;

export const CREATIVE_STATUSES = [
  { id: "draft", label: "Borrador", color: "#a1a1aa" },
  { id: "testing", label: "En prueba", color: "#3b82f6" },
  { id: "winner", label: "Ganador", color: "#10b981" },
  { id: "loser", label: "Descartado", color: "#e5484d" },
  { id: "paused", label: "Pausado", color: "#f59e0b" },
] as const;

export const CREATIVE_FORMATS = [
  { id: "video", label: "Video" },
  { id: "ugc", label: "UGC" },
  { id: "image", label: "Imagen" },
  { id: "carousel", label: "Carrusel" },
] as const;

export const CREATIVE_ANGLES = [
  "Problema → solución",
  "Antes / después",
  "Testimonio",
  "Demostración",
  "Comparación",
  "Oferta / urgencia",
  "Curiosidad",
  "Prueba social",
] as const;

export type AdCampaign = {
  id: string;
  project_id: string;
  name: string;
  platform: string;
  objective: string;
  status: "draft" | "active" | "paused" | "ended";
  daily_budget: number;
  total_budget: number | null;
  target_cpa: number | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  audience: string | null;
  notes: string | null;
  created_at: string;
};

export type AdCreative = {
  id: string;
  project_id: string;
  campaign_id: string | null;
  name: string;
  format: string;
  hook: string | null;
  angle: string | null;
  primary_text: string | null;
  headline: string | null;
  cta: string | null;
  asset_url: string | null;
  status: "draft" | "testing" | "winner" | "loser" | "paused";
  source: "manual" | "ai";
  created_at: string;
};

export type AdMetricRow = {
  id: string;
  campaign_id: string;
  creative_id: string | null;
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type MarketingLink = {
  id: string;
  campaign_id: string | null;
  code: string;
  name: string;
  base_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  clicks: number;
  last_click_at: string | null;
  created_at: string;
};

export type AdTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export const EMPTY_TOTALS: AdTotals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };

export function sumMetrics(rows: Pick<AdMetricRow, keyof AdTotals>[]): AdTotals {
  return rows.reduce<AdTotals>(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend || 0),
      impressions: acc.impressions + Number(r.impressions || 0),
      clicks: acc.clicks + Number(r.clicks || 0),
      conversions: acc.conversions + Number(r.conversions || 0),
      revenue: acc.revenue + Number(r.revenue || 0),
    }),
    { ...EMPTY_TOTALS },
  );
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function derived(t: AdTotals) {
  return {
    roas: ratio(t.revenue, t.spend),
    cpa: ratio(t.spend, t.conversions),
    ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null,
    cpc: ratio(t.spend, t.clicks),
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    cvr: t.clicks > 0 ? (t.conversions / t.clicks) * 100 : null,
    profit: t.revenue - t.spend,
  };
}

export function money(n: number | null | undefined, currency = "USD", compact = false) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    maximumFractionDigits: compact || Math.abs(n) >= 1000 ? 0 : 2,
    notation: compact && Math.abs(n) >= 10000 ? "compact" : "standard",
  }).format(n);
}

export function num(n: number | null | undefined, digits = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: digits,
    notation: Math.abs(n) >= 100000 ? "compact" : "standard",
  }).format(n);
}

export function pct(n: number | null | undefined, digits = 2) {
  return n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;
}

export function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function utmSlug(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildUtmUrl(link: Pick<MarketingLink, "base_url" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term">) {
  try {
    const url = new URL(link.base_url);
    const pairs: [string, string | null][] = [
      ["utm_source", link.utm_source],
      ["utm_medium", link.utm_medium],
      ["utm_campaign", link.utm_campaign],
      ["utm_content", link.utm_content],
      ["utm_term", link.utm_term],
    ];
    for (const [k, v] of pairs) if (v) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return link.base_url;
  }
}
