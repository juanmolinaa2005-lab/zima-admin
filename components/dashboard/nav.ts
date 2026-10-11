import type { ComponentType, SVGProps } from "react";
import type { ToolKind, WorkspaceTool } from "@/lib/types";
import {
  GalleryIcon,
  GridIcon,
  HomeIcon,
  LaunchIcon,
  MailIcon,
  MarketIcon,
  MonetizationIcon,
  MarketingIcon,
  MiAppIcon,
  RedesIcon,
  UseIcon,
  UsersIcon,
  ViewTrackerIcon,
} from "./icons";

export type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type ToolMeta = {
  label: string;
  description: string;
  icon: IconComp;
  color: string;
};

/** Single source of truth for built-in tool labels, icons and colors. */
export const TOOL_META: Partial<Record<ToolKind, ToolMeta>> = {
  home: { label: "Overview", description: "Resumen del proyecto", icon: HomeIcon, color: "#141416" },
  miapp: { label: "Mi app", description: "Screenshots de tienda", icon: MiAppIcon, color: "#141416" },
  launch: { label: "Lanzamiento", description: "¿Qué sigue? Ruta, canales y métricas", icon: LaunchIcon, color: "#6366f1" },
  clients: { label: "Clients", description: "Usuarios Auth", icon: UsersIcon, color: "#0ea5e9" },
  emails: { label: "Emails", description: "Cuentas de correo", icon: MailIcon, color: "#2563eb" },
  analytics: { label: "Stats", description: "Ingresos y gastos", icon: UseIcon, color: "#475569" },
  use: { label: "Stats", description: "Ingresos y gastos", icon: UseIcon, color: "#475569" },
  viewtracker: { label: "Marketing", description: "Cuentas y redes", icon: ViewTrackerIcon, color: "#0d9488" },
  market: { label: "Market", description: "Conoce el mercado de apps", icon: MarketIcon, color: "#059669" },
  monetization: { label: "Monetization", description: "Ingresos y suscripciones", icon: MonetizationIcon, color: "#f2545b" },
  marketing: { label: "Studio", description: "Influencers y demos", icon: MarketingIcon, color: "#db2777" },
  estudio: { label: "Studio", description: "Influencers y demos", icon: MarketingIcon, color: "#db2777" },
  redes: { label: "Redes", description: "Cuentas sociales", icon: RedesIcon, color: "#7c3aed" },
  gallery: { label: "Galería", description: "Fotos y videos", icon: GalleryIcon, color: "#ea580c" },
  apps: { label: "Accesos", description: "Accesos directos", icon: GridIcon, color: "#64748b" },
};

export function toolMeta(kind: ToolKind): ToolMeta {
  return (
    TOOL_META[kind] ?? {
      label: "Acceso",
      description: "Se abre en otra pestaña",
      icon: GridIcon,
      color: "#64748b",
    }
  );
}

/** Sidebar groups, in display order. */
export const NAV_GROUPS: { label: string | null; kinds: ToolKind[] }[] = [
  { label: null, kinds: ["launch", "miapp"] },
  { label: "Clientes y datos", kinds: ["emails", "analytics", "viewtracker", "market", "monetization"] },
  { label: "Contenido", kinds: ["marketing", "gallery"] },
];

/** Tools that ship their own secondary navigation (sidebar auto-collapses). */
export const KINDS_WITH_OWN_NAV: ToolKind[] = [
  "launch",
  "marketing",
  "estudio",
  "viewtracker",
  "market",
  "monetization",
  "emails",
  "gallery",
  "redes",
];

export function findTool(tools: WorkspaceTool[], kind: ToolKind) {
  if (kind === "analytics") {
    return tools.find((t) => t.kind === "analytics" || t.kind === "use");
  }
  return tools.find((t) => t.kind === kind);
}

export function hostOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function faviconFor(url?: string): string | null {
  const host = hostOf(url);
  return host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;
}
