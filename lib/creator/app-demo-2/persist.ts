import type { AppDemoVariable } from "@/lib/creator/app-demo";
import {
  DEFAULT_APP_DEMO_2_CODE,
  DEFAULT_APP_DEMO_2_VARIABLES,
} from "@/lib/creator/app-demo-2-code";
import { isDemoStyle } from "./validate";
import type {
  AppDemo2Workspace,
  DemoBundle,
  SavedDemoRecord,
} from "./types";

export type { AppDemo2Workspace, SavedDemoRecord };

export type AppDemo2Draft = {
  code: string;
  variables: AppDemoVariable[];
  canvasTheme: "light" | "dark";
};

function storageKey(projectId: string) {
  return `zima:estudio-v1:app-demo-2:${projectId}`;
}

export const DEFAULT_APP_DEMO_2_DRAFT: AppDemo2Draft = {
  code: DEFAULT_APP_DEMO_2_CODE,
  variables: DEFAULT_APP_DEMO_2_VARIABLES.map((v) => ({ ...v })),
  canvasTheme: "light",
};

export const DEFAULT_APP_DEMO_2: AppDemo2Workspace = {
  prompt: "",
  durationTarget: 6,
  style: "normal",
  productId: "moun",
  variationCount: 3,
  activeId: null,
  demos: [],
  inspectorOpen: false,
};

function emptyWorkspace(): AppDemo2Workspace {
  return {
    ...DEFAULT_APP_DEMO_2,
    demos: [],
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function parseBundle(raw: unknown): DemoBundle | null {
  const o = asRecord(raw);
  const demo = asRecord(o?.demo);
  if (!o || !demo || typeof demo.id !== "string" || !demo.id) return null;
  if (!Array.isArray(o.steps)) return null;
  return raw as DemoBundle;
}

function parseRecord(raw: unknown): SavedDemoRecord | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const bundle = parseBundle(o.bundle);
  if (!id || !bundle) return null;
  return {
    id,
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : bundle.demo.title,
    createdAt:
      typeof o.createdAt === "string" && o.createdAt
        ? o.createdAt
        : bundle.metadata.createdAt,
    bundle,
  };
}

function parseWorkspace(raw: unknown): AppDemo2Workspace {
  const o = asRecord(raw);
  if (!o) return emptyWorkspace();
  if (typeof o.code === "string" && !Array.isArray(o.demos)) {
    return emptyWorkspace();
  }
  const demos = Array.isArray(o.demos)
    ? o.demos.map(parseRecord).filter((d): d is SavedDemoRecord => Boolean(d))
    : [];
  const variationCount =
    o.variationCount === 5 || o.variationCount === 10 || o.variationCount === 20
      ? o.variationCount
      : 3;
  const durationTarget = Number(o.durationTarget);
  const activeId =
    typeof o.activeId === "string" && demos.some((d) => d.id === o.activeId)
      ? o.activeId
      : demos[0]?.id || null;
  return {
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    durationTarget:
      durationTarget === 5 ||
      durationTarget === 6 ||
      durationTarget === 7 ||
      durationTarget === 8
        ? durationTarget
        : 6,
    style: isDemoStyle(o.style) ? o.style : "normal",
    productId: typeof o.productId === "string" && o.productId ? o.productId : "moun",
    variationCount,
    activeId,
    demos,
    inspectorOpen: o.inspectorOpen === true,
  };
}

export function upsertDemo(
  ws: AppDemo2Workspace,
  record: SavedDemoRecord
): AppDemo2Workspace {
  const idx = ws.demos.findIndex((d) => d.id === record.id);
  const demos =
    idx >= 0
      ? ws.demos.map((d, i) => (i === idx ? record : d))
      : [...ws.demos, record];
  return { ...ws, demos, activeId: record.id };
}

export function deleteDemo(
  ws: AppDemo2Workspace,
  id: string
): AppDemo2Workspace {
  const demos = ws.demos.filter((d) => d.id !== id);
  const activeId = ws.activeId === id ? demos[0]?.id || null : ws.activeId;
  return { ...ws, demos, activeId };
}

export function duplicateDemo(
  ws: AppDemo2Workspace,
  id: string
): AppDemo2Workspace {
  const src = ws.demos.find((d) => d.id === id);
  if (!src) return ws;
  const newId = `demo_${Date.now().toString(36)}`;
  const copy: SavedDemoRecord = {
    id: newId,
    name: `${src.name} copia`,
    createdAt: new Date().toISOString(),
    bundle: {
      ...src.bundle,
      demo: {
        ...src.bundle.demo,
        id: newId,
        title: `${src.bundle.demo.title} copia`,
      },
      metadata: {
        ...src.bundle.metadata,
        createdAt: new Date().toISOString(),
      },
    },
  };
  return { ...ws, demos: [...ws.demos, copy], activeId: newId };
}

export function loadAppDemo2(projectId: string): AppDemo2Workspace {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return emptyWorkspace();
    return parseWorkspace(JSON.parse(raw));
  } catch {
    return emptyWorkspace();
  }
}

export function saveAppDemo2(projectId: string, ws: AppDemo2Workspace) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(ws));
  } catch {
    /* ignore quota */
  }
}
