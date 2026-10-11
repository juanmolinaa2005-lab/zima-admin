import type { ComponentType, SVGProps } from "react";
import {
  AnalyticsIcon,
  EstudioIcon,
  GalleryIcon,
  HomeIcon,
  IdeasIcon,
  MiAppIcon,
  PageIcon,
  PublishIcon,
  UsersIcon,
} from "./icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type ViewId = "today" | "create" | "publish" | "creators" | "results" | "ideas" | "miapp" | "page" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  today: { label: "Hoy", icon: HomeIcon },
  create: { label: "Crear", icon: EstudioIcon },
  publish: { label: "Publicar", icon: PublishIcon },
  creators: { label: "Creadores", icon: UsersIcon },
  results: { label: "Resultados", icon: AnalyticsIcon },
  ideas: { label: "Ideas", icon: IdeasIcon },
  miapp: { label: "App", icon: MiAppIcon },
  page: { label: "Página", icon: PageIcon },
  gallery: { label: "Galería", icon: GalleryIcon },
};

/** Sidebar order follows the growth loop. Gallery opens from inside Crear. */
export const NAV: ViewId[] = ["today", "create", "publish", "creators", "results", "ideas", "miapp", "page"];

export type BuildKind = "app" | "web" | "both" | null;

export function viewLabel(id: ViewId, kind: BuildKind): string {
  if (id === "miapp" && kind === "web") return "Producto";
  return VIEW_META[id].label;
}

const LEGACY_VIEWS: Record<string, ViewId> = {
  launch: "today",
  estudio: "create",
  redes: "create",
  marketing: "create",
  viewtracker: "results",
  market: "ideas",
  emails: "creators",
};

export function viewFrom(raw: string | null): ViewId {
  if (!raw) return "today";
  if (raw in VIEW_META) return raw as ViewId;
  return LEGACY_VIEWS[raw] ?? "today";
}
