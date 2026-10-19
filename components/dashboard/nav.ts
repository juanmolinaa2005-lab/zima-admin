import type { ComponentType, SVGProps } from "react";
import { AnalyticsIcon, ContractIcon, EstudioIcon, GalleryIcon, HomeIcon, LinkIcon } from "./icons";
import {
  IconAccounts,
  IconChat,
  IconCreators,
  IconRequests,
  IconUpload,
  IconVideos,
  MARKETING_PAGES,
  type MarketingPageId,
} from "./MarketingPages";
import { IconCalendar, IconMegaphone, IconRobot, IconSparkles } from "./marketing/icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type GrowthViewId = "home" | "planner" | "ai-influencers" | "campaigns" | "creatives" | "links" | "pipeline" | "contracts";

export type ViewId = MarketingPageId | GrowthViewId | "studio" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  home: { label: "Inicio", icon: HomeIcon },
  planner: { label: "Plan de contenido", icon: IconCalendar },
  "ai-influencers": { label: "Influencers IA", icon: IconRobot },
  studio: { label: "Studio", icon: EstudioIcon },
  gallery: { label: "Galería", icon: GalleryIcon },
  upload: { label: "Publicar", icon: IconUpload },
  overview: { label: "Resultados", icon: AnalyticsIcon },
  accounts: { label: "Cuentas", icon: IconAccounts },
  videos: { label: "Videos", icon: IconVideos },
  pipeline: { label: "Influencers", icon: IconCreators },
  creators: { label: "Creadores", icon: IconCreators },
  requests: { label: "Mensajes", icon: IconRequests },
  responses: { label: "Respuestas", icon: IconChat },
  contracts: { label: "Contratos", icon: ContractIcon },
  campaigns: { label: "Campañas", icon: IconMegaphone },
  creatives: { label: "Creativos", icon: IconSparkles },
  links: { label: "Enlaces UTM", icon: LinkIcon },
};

export type SectionId = "home" | "tracking" | "organic" | "influencers" | "paid" | "gallery";

/** The icon rail shows these sections; the panel beside it lists the options of the active one. */
export const SECTIONS: { id: SectionId; label: string; icon: IconComp; tabs: ViewId[]; footer?: boolean }[] = [
  { id: "home", label: "Inicio", icon: HomeIcon, tabs: ["home"] },
  { id: "tracking", label: "Tracking", icon: AnalyticsIcon, tabs: ["overview", "accounts", "videos", "creators", "links"] },
  { id: "organic", label: "Orgánico", icon: IconSparkles, tabs: ["planner", "ai-influencers", "studio", "upload"] },
  { id: "influencers", label: "Influencers", icon: IconCreators, tabs: ["pipeline", "requests", "responses", "contracts"] },
  { id: "paid", label: "Pagado", icon: IconMegaphone, tabs: ["campaigns", "creatives"] },
  { id: "gallery", label: "Galería", icon: GalleryIcon, tabs: ["gallery"], footer: true },
];

const TAB_SECTION = new Map<ViewId, SectionId>(SECTIONS.flatMap((s) => s.tabs.map((tab) => [tab, s.id] as const)));

export function sectionOf(view: ViewId): SectionId {
  return TAB_SECTION.get(view) ?? "home";
}

export function sectionTabs(id: SectionId): ViewId[] {
  return SECTIONS.find((s) => s.id === id)?.tabs ?? [];
}

/** The UGC flow, in order. */
export const UGC_FLOW: { id: ViewId; step: string; text: string }[] = [
  { id: "planner", step: "Planificar", text: "Ideas, hooks y guiones en el calendario" },
  { id: "ai-influencers", step: "Crear", text: "Videos con tus influencers IA" },
  { id: "upload", step: "Publicar", text: "Publicación automática en tus cuentas" },
  { id: "overview", step: "Medir", text: "Vistas y engagement de cada video" },
];

const GROWTH_VIEWS = new Set<string>(["home", "planner", "ai-influencers", "campaigns", "creatives", "links", "pipeline", "contracts"]);
const STUDIO_ALIASES = new Set(["create", "estudio", "redes"]);
const MARKETING_ALIASES = new Set(["marketing", "viewtracker", "results"]);
const ALIASES: Record<string, ViewId> = {
  publish: "upload",
  calendar: "planner",
  content: "planner",
  plan: "planner",
  influencers: "ai-influencers",
  ads: "campaigns",
  paid: "campaigns",
  utm: "links",
  outreach: "pipeline",
  seguimiento: "pipeline",
  contratos: "contracts",
  mensajes: "requests",
  library: "gallery",
};

function isMarketingPage(raw: string | null): raw is MarketingPageId {
  return Boolean(raw) && MARKETING_PAGES.includes(raw as MarketingPageId);
}

export function viewFrom(raw: string | null, vt: string | null = null): ViewId {
  if (raw === "studio" || raw === "gallery" || isMarketingPage(raw)) return raw;
  if (raw && GROWTH_VIEWS.has(raw)) return raw as GrowthViewId;
  if (raw && STUDIO_ALIASES.has(raw)) return "studio";
  if (raw && ALIASES[raw]) return ALIASES[raw];
  if ((!raw || MARKETING_ALIASES.has(raw)) && isMarketingPage(vt)) return vt;
  return "home";
}
