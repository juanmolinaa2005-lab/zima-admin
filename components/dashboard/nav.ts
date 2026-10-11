import type { ComponentType, SVGProps } from "react";
import {
  GalleryIcon,
  LaunchIcon,
  MailIcon,
  MarketIcon,
  MarketingIcon,
  MiAppIcon,
  ViewTrackerIcon,
} from "./icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type ViewId = "launch" | "miapp" | "market" | "marketing" | "viewtracker" | "emails" | "gallery";

export type ViewMeta = {
  label: string;
  icon: IconComp;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  launch: { label: "Lanzamiento", icon: LaunchIcon },
  miapp: { label: "Mi app", icon: MiAppIcon },
  market: { label: "Market", icon: MarketIcon },
  marketing: { label: "Studio", icon: MarketingIcon },
  viewtracker: { label: "Marketing", icon: ViewTrackerIcon },
  emails: { label: "Emails", icon: MailIcon },
  gallery: { label: "Galería", icon: GalleryIcon },
};

/** Sidebar order. Gallery opens from inside Studio. */
export const NAV: ViewId[] = ["launch", "miapp", "market", "marketing", "viewtracker", "emails"];

const LEGACY_VIEWS: Record<string, ViewId> = {
  estudio: "marketing",
  redes: "marketing",
};

export function viewFrom(raw: string | null): ViewId {
  if (!raw) return "launch";
  if (raw in VIEW_META) return raw as ViewId;
  return LEGACY_VIEWS[raw] ?? "launch";
}
