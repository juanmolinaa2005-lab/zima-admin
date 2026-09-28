export type SimulatorPlatform = "ios" | "android";

export type SimulatorAppKind = "web" | "store" | "native";

export type SimulatorApp = {
  id: string;
  name: string;
  url: string;
  icon: string;
  platforms: SimulatorPlatform[];
  kind: SimulatorAppKind;
  createdAt: string;
};

export type SimulatorState = {
  platform: SimulatorPlatform;
  apps: SimulatorApp[];
  lastUrl: string;
};

export function emptySimulator(): SimulatorState {
  return { platform: "ios", apps: [], lastUrl: "" };
}

function storageKey(projectId: string) {
  return `zima:estudio-v1:simulator:${projectId}`;
}

export function loadSimulator(projectId: string): SimulatorState {
  if (typeof window === "undefined") return emptySimulator();
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return emptySimulator();
    const parsed = JSON.parse(raw) as Partial<SimulatorState>;
    return {
      platform: parsed.platform === "android" ? "android" : "ios",
      apps: Array.isArray(parsed.apps) ? parsed.apps : [],
      lastUrl: typeof parsed.lastUrl === "string" ? parsed.lastUrl : "",
    };
  } catch {
    return emptySimulator();
  }
}

export function saveSimulator(projectId: string, state: SimulatorState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function newSimulatorId() {
  return crypto.randomUUID();
}

export function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function faviconForUrl(url: string) {
  const host = hostnameFromUrl(url);
  if (!host) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export function classifyAppUrl(url: string): SimulatorAppKind {
  try {
    const host = new URL(url).hostname;
    if (
      host.includes("apps.apple.com") ||
      host.includes("itunes.apple.com") ||
      host.includes("play.google.com")
    ) {
      return "store";
    }
  } catch {
    /* ignore */
  }
  return "web";
}

export function normalizeHttpUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

const APPETIZE_KEY = /^[a-zA-Z0-9_]{16,80}$/;

export function parseAppetizeKey(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "appetize.io") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const at = parts.findIndex(
      (part) => part === "embed" || part === "app" || part === "apps"
    );
    const key = at >= 0 ? parts[at + 1] : "";
    return APPETIZE_KEY.test(key || "") ? key : "";
  } catch {
    return APPETIZE_KEY.test(value) ? value : "";
  }
}
