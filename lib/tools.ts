export type Tool = {
  id: string;
  name: string;
  url: string;
  icon?: string;
};

export type OpenTab = {
  id: string;
  toolId: string;
  title: string;
  url: string;
};

const STORAGE_KEY = "zima-admin-tools";

export const DEFAULT_TOOLS: Tool[] = [
  {
    id: "home",
    name: "Inicio",
    url: "",
    icon: "home",
  },
];

export function loadTools(): Tool[] {
  if (typeof window === "undefined") return DEFAULT_TOOLS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOOLS;
    const parsed = JSON.parse(raw) as Tool[];
    if (!Array.isArray(parsed)) return DEFAULT_TOOLS;
    const custom = parsed.filter((t) => t.id !== "home");
    return [...DEFAULT_TOOLS, ...custom];
  } catch {
    return DEFAULT_TOOLS;
  }
}

export function saveTools(tools: Tool[]) {
  const custom = tools.filter((t) => t.id !== "home");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function createToolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
