import type { ComponentType, SVGProps } from "react";
import { EstudioIcon, GalleryIcon } from "./icons";
import {
  IconAccounts,
  IconChat,
  IconCreators,
  IconOverview,
  IconRequests,
  IconUpload,
  IconVideos,
  MARKETING_PAGES,
  type MarketingPageId,
} from "./MarketingPages";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type ViewId = MarketingPageId | "studio" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  overview: { label: "Resumen", icon: IconOverview },
  accounts: { label: "Cuentas", icon: IconAccounts },
  videos: { label: "Videos", icon: IconVideos },
  creators: { label: "Creadores", icon: IconCreators },
  upload: { label: "Publicar", icon: IconUpload },
  requests: { label: "Solicitudes", icon: IconRequests },
  responses: { label: "Respuestas", icon: IconChat },
  studio: { label: "Studio", icon: EstudioIcon },
  gallery: { label: "Galería", icon: GalleryIcon },
};

/** Sidebar sections. Gallery opens from inside Studio. */
export const NAV_GROUPS: { label: string | null; items: ViewId[] }[] = [
  { label: null, items: ["overview"] },
  { label: "Seguimiento", items: ["accounts", "videos", "creators"] },
  { label: "Automatización", items: ["upload", "requests", "responses"] },
  { label: "Contenido", items: ["studio"] },
];

export const NAV: ViewId[] = NAV_GROUPS.flatMap((g) => g.items);

const STUDIO_ALIASES = new Set(["create", "estudio", "redes"]);
const MARKETING_ALIASES = new Set(["marketing", "viewtracker", "results"]);

function isMarketingPage(raw: string | null): raw is MarketingPageId {
  return Boolean(raw) && MARKETING_PAGES.includes(raw as MarketingPageId);
}

export function viewFrom(raw: string | null, vt: string | null = null): ViewId {
  if (raw === "studio" || raw === "gallery" || isMarketingPage(raw)) return raw;
  if (raw && STUDIO_ALIASES.has(raw)) return "studio";
  if (raw === "publish") return "upload";
  if ((!raw || MARKETING_ALIASES.has(raw)) && isMarketingPage(vt)) return vt;
  return "overview";
}
