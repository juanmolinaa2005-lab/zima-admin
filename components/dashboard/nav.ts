import type { ComponentType, SVGProps } from "react";
import { EstudioIcon, GalleryIcon, ViewTrackerIcon } from "./icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type ViewId = "marketing" | "studio" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  marketing: { label: "Marketing", icon: ViewTrackerIcon },
  studio: { label: "Studio", icon: EstudioIcon },
  gallery: { label: "Galería", icon: GalleryIcon },
};

/** Sidebar order. Gallery opens from inside Studio. */
export const NAV: ViewId[] = ["marketing", "studio"];

const STUDIO_ALIASES = new Set(["create", "estudio", "redes"]);

export function viewFrom(raw: string | null): ViewId {
  if (raw === "studio" || raw === "gallery") return raw;
  if (raw && STUDIO_ALIASES.has(raw)) return "studio";
  return "marketing";
}
