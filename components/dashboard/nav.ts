import type { ComponentType, SVGProps } from "react";
import { AnalyticsIcon, EstudioIcon, GalleryIcon, HomeIcon, LinkIcon } from "./icons";
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
import { IconCalendar, IconMegaphone, IconSparkles } from "./marketing/icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type GrowthViewId = "home" | "planner" | "campaigns" | "creatives" | "links";

export type ViewId = MarketingPageId | GrowthViewId | "studio" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  home: { label: "Inicio", icon: HomeIcon },
  planner: { label: "Planificador", icon: IconCalendar },
  studio: { label: "Studio", icon: EstudioIcon },
  gallery: { label: "Biblioteca", icon: GalleryIcon },
  campaigns: { label: "Campañas", icon: IconMegaphone },
  creatives: { label: "Creativos", icon: IconSparkles },
  links: { label: "Enlaces UTM", icon: LinkIcon },
  overview: { label: "Orgánico", icon: AnalyticsIcon },
  accounts: { label: "Cuentas", icon: IconAccounts },
  videos: { label: "Videos", icon: IconVideos },
  creators: { label: "Creadores", icon: IconCreators },
  upload: { label: "Publicar", icon: IconUpload },
  requests: { label: "Solicitudes", icon: IconRequests },
  responses: { label: "Respuestas", icon: IconChat },
};

export const NAV_GROUPS: { label: string | null; items: ViewId[] }[] = [
  { label: null, items: ["home"] },
  { label: "Contenido", items: ["planner", "studio", "gallery"] },
  { label: "Paid Ads", items: ["campaigns", "creatives"] },
  { label: "Marketing", items: ["creators", "links"] },
  { label: "Seguimiento", items: ["overview", "accounts", "videos"] },
  { label: "Automatización", items: ["upload", "requests", "responses"] },
];

export const NAV: ViewId[] = NAV_GROUPS.flatMap((g) => g.items);

const GROWTH_VIEWS = new Set<string>(["home", "planner", "campaigns", "creatives", "links"]);
const STUDIO_ALIASES = new Set(["create", "estudio", "redes"]);
const MARKETING_ALIASES = new Set(["marketing", "viewtracker", "results"]);
const ALIASES: Record<string, ViewId> = {
  publish: "upload",
  calendar: "planner",
  content: "planner",
  ads: "campaigns",
  utm: "links",
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
