export const APP_DEMO_FPS = 30;
export const APP_DEMO_WIDTH = 1080;
export const APP_DEMO_HEIGHT = 1920;
export const APP_DEMO_INTRO_FRAMES = 42;
export const APP_DEMO_OUTRO_FRAMES = 48;
export const APP_DEMO_MAX_SCREENS = 8;
export const APP_DEMO_FOLDER = "App Demo";

export const APP_DEMO_ACCENTS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#0ea5e9",
  "#111827",
] as const;

export type AppDemoKind = "screens" | "functional";
export type AppDemoKindHint = "auto" | AppDemoKind;

export type AppDemoCapture = {
  id: string;
  url: string;
  caption: string;
};

export type AppAction =
  | { type: "navigate"; screen: string }
  | { type: "back" }
  | { type: "set"; key: string; value: string | number | boolean }
  | { type: "toggle"; key: string }
  | { type: "inc"; key: string; by?: number }
  | { type: "none" };

export type AppHotspot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: AppAction;
};

export type UiNode =
  | { type: "navbar"; id: string; title: string; back?: AppAction }
  | { type: "title"; id: string; text: string; sub?: string }
  | { type: "text"; id: string; text: string }
  | {
      type: "button";
      id: string;
      label: string;
      variant: "primary" | "secondary" | "ghost";
      action: AppAction;
    }
  | { type: "input"; id: string; bind: string; placeholder: string }
  | { type: "toggle"; id: string; bind: string; label: string }
  | {
      type: "list";
      id: string;
      items: { id: string; title: string; sub?: string; action?: AppAction }[];
    }
  | {
      type: "cards";
      id: string;
      items: {
        id: string;
        title: string;
        sub?: string;
        meta?: string;
        action?: AppAction;
      }[];
    }
  | {
      type: "tabs";
      id: string;
      bind: string;
      items: { id: string; label: string }[];
    }
  | { type: "stat"; id: string; label: string; value: string; bind?: string }
  | { type: "chip"; id: string; text: string }
  | { type: "spacer"; id: string };

export type AppScreenSpec = {
  id: string;
  name: string;
  imageUrl: string;
  background: string;
  hotspots: AppHotspot[];
  nodes: UiNode[];
};

export type AppTabItem = { id: string; label: string; screen: string };

export type DemoStep =
  | { op: "wait"; ms: number; caption?: string }
  | { op: "tap"; target: string; caption?: string }
  | { op: "type"; bind: string; text: string; caption?: string };

export type AppDemoSpec = {
  appName: string;
  tagline: string;
  cta: string;
  accent: string;
  background: string;
  kind: AppDemoKind;
  summary: string;
  startScreen: string;
  tabs: AppTabItem[];
  screens: AppScreenSpec[];
  state: Record<string, string | number | boolean>;
  demo: DemoStep[];
};

export type AppRuntimeState = {
  screen: string;
  history: string[];
  values: Record<string, string | number | boolean>;
};

export type AppCursor = {
  x: number;
  y: number;
  pressed: boolean;
  visible: boolean;
};

export type AppDemoSnapshot = {
  state: AppRuntimeState;
  cursor: AppCursor;
  caption: string;
};

export type AppDemoSource = "prompt" | "code";

export type AppDemoVarType = "text" | "number" | "boolean" | "color" | "image";

export type AppDemoVariable = {
  id: string;
  key: string;
  type: AppDemoVarType;
  value: string;
};

export type AppDemoDraft = {
  appName: string;
  tagline: string;
  cta: string;
  accent: string;
  notes: string;
  kindHint: AppDemoKindHint;
  source: AppDemoSource;
  code: string;
  phoneFrame: boolean;
  canvasTheme: "light" | "dark";
  variables: AppDemoVariable[];
  screens: AppDemoCapture[];
  spec: AppDemoSpec | null;
};

export type AppDemoProps = {
  spec: AppDemoSpec;
} & Record<string, unknown>;

export const APP_DEMO_MAX_VARS = 16;

export const DEFAULT_APP_DEMO_VARIABLES: AppDemoVariable[] = [
  { id: "appName", key: "appName", type: "text", value: "Mi app" },
  { id: "tagline", key: "tagline", type: "text", value: "Mira cómo funciona" },
  { id: "accent", key: "accent", type: "color", value: "#6366f1" },
  { id: "cta", key: "cta", type: "text", value: "Descarga la app" },
  { id: "photo", key: "photo", type: "image", value: "" },
];

export const DEFAULT_APP_DEMO: AppDemoDraft = {
  appName: "",
  tagline: "",
  cta: "Descarga la app",
  accent: "#6366f1",
  notes: "",
  kindHint: "auto",
  source: "prompt",
  code: "",
  phoneFrame: true,
  canvasTheme: "dark",
  variables: DEFAULT_APP_DEMO_VARIABLES,
  screens: [],
  spec: null,
};

function storageKey(projectId: string) {
  return `zima:estudio-v1:app-demo:${projectId}`;
}

function codeStorageKey(projectId: string) {
  return `zima:estudio-v1:app-demo-code:${projectId}`;
}

function isAccent(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isAppDemoVarKey(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

export function isAppDemoImageSrc(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("data:image/")) return true;
  if (!/^https?:\/\//i.test(v)) return false;
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(v)) return true;
  if (/\/storage\/v1\/object\/public\//.test(v)) return true;
  return false;
}

function looksLikeImageKey(key: string) {
  return /^(photo|image|img|avatar|logo|hero|cover|picture|foto)$/i.test(key);
}

export type AppDemoCodeSnapshot = {
  code: string;
  phoneFrame: boolean;
  variables: AppDemoVariable[];
};

export function parseAppDemoSnapshot(raw: unknown): AppDemoCodeSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code.trim() : "";
  if (!code || code.length > 80_000) return null;
  return {
    code,
    phoneFrame: o.phoneFrame !== false,
    variables: Array.isArray(o.variables)
      ? parseVariables(o.variables)
      : [],
  };
}

export function applyAppDemoVariablePatch(
  base: AppDemoVariable[],
  patch: unknown
): AppDemoVariable[] {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const rec = patch as Record<string, unknown>;
  return base.map((item) => {
    if (!Object.prototype.hasOwnProperty.call(rec, item.key)) return item;
    if (item.type === "image") return item;
    const raw = rec[item.key];
    if (item.type === "boolean") {
      if (raw === true || raw === "true" || raw === 1 || raw === "1") {
        return { ...item, value: "true" };
      }
      if (raw === false || raw === "false" || raw === 0 || raw === "0") {
        return { ...item, value: "false" };
      }
      return item;
    }
    if (item.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? { ...item, value: String(n) } : item;
    }
    if (item.type === "color") {
      const s = String(raw ?? "").trim();
      return isAccent(s) ? { ...item, value: s } : item;
    }
    const s = String(raw ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 280);
    return s ? { ...item, value: s } : item;
  });
}

export function appDemoVarsToProps(
  variables: AppDemoVariable[]
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const item of variables) {
    const key = item.key.trim();
    if (!isAppDemoVarKey(key)) continue;
    if (item.type === "number") {
      const n = Number(item.value);
      values[key] = Number.isFinite(n) ? n : 0;
    } else if (item.type === "boolean") {
      values[key] = item.value === "true" || item.value === "1";
    } else {
      values[key] = item.value;
    }
  }
  return { ...values, vars: values };
}

function parseVariables(raw: unknown): AppDemoVariable[] {
  if (!Array.isArray(raw)) return DEFAULT_APP_DEMO_VARIABLES.map((v) => ({ ...v }));
  const list: AppDemoVariable[] = [];
  for (const item of raw.slice(0, APP_DEMO_MAX_VARS)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    const value = typeof o.value === "string" ? o.value : String(o.value ?? "");
    const type: AppDemoVarType =
      o.type === "number" ||
      o.type === "boolean" ||
      o.type === "color" ||
      o.type === "image"
        ? o.type
        : isAppDemoImageSrc(value) || looksLikeImageKey(key)
          ? "image"
          : "text";
    list.push({
      id: typeof o.id === "string" && o.id ? o.id : `var-${list.length}`,
      key: key || `var${list.length + 1}`,
      type,
      value,
    });
  }
  return list;
}

function readBalancedObject(source: string, from: number): string | null {
  const start = source.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

function unescapeQuoted(raw: string): string {
  const quote = raw[0];
  const inner = raw.slice(1, -1);
  if (quote === "'") {
    return inner.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }
  try {
    return JSON.parse(raw) as string;
  } catch {
    return inner;
  }
}

function variableFromLiteral(key: string, literal: string): AppDemoVariable {
  const id = `code-${key}`;
  if (literal === "true" || literal === "false") {
    return { id, key, type: "boolean", value: literal };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(literal)) {
    return { id, key, type: "number", value: literal };
  }
  const text =
    literal.startsWith('"') || literal.startsWith("'")
      ? unescapeQuoted(literal)
      : literal;
  if (/^#[0-9a-fA-F]{6}$/.test(text)) {
    return { id, key, type: "color", value: text };
  }
  if (isAppDemoImageSrc(text) || looksLikeImageKey(key)) {
    return { id, key, type: "image", value: text };
  }
  return { id, key, type: "text", value: text };
}

export function collectVariablesFromCode(source: string): AppDemoVariable[] {
  const found: AppDemoVariable[] = [];
  const seen = new Set<string>();

  const marker = /(?:export\s+)?const\s+variables\s*(?::[^=]*)?=/;
  const match = source.match(marker);
  if (match && match.index != null) {
    const body = readBalancedObject(source, match.index);
    if (body) {
      const entryRe =
        /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(true|false|-?\d+(?:\.\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
      for (const item of body.matchAll(entryRe)) {
        const key = item[1];
        if (!isAppDemoVarKey(key) || seen.has(key)) continue;
        seen.add(key);
        found.push(variableFromLiteral(key, item[2]));
      }
    }
  }

  return found;
}

export function mergeVariablesFromCode(
  existing: AppDemoVariable[],
  source: string
): AppDemoVariable[] {
  const incoming = collectVariablesFromCode(source);
  if (!incoming.length) return existing;
  const have = new Set(existing.map((item) => item.key));
  const additions: AppDemoVariable[] = [];
  for (const item of incoming) {
    if (have.has(item.key)) continue;
    additions.push(item);
    have.add(item.key);
  }
  if (!additions.length) return existing;
  return [...existing, ...additions].slice(0, APP_DEMO_MAX_VARS);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function slugId(value: string, fallback: string) {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || fallback;
}

export function initialRuntime(spec: AppDemoSpec): AppRuntimeState {
  const start =
    spec.screens.some((s) => s.id === spec.startScreen)
      ? spec.startScreen
      : spec.screens[0]?.id || "home";
  return {
    screen: start,
    history: [],
    values: { ...spec.state },
  };
}

export function screenById(spec: AppDemoSpec, id: string) {
  return spec.screens.find((s) => s.id === id) || spec.screens[0] || null;
}

export function applyAction(
  spec: AppDemoSpec,
  state: AppRuntimeState,
  action: AppAction | undefined
): AppRuntimeState {
  if (!action || action.type === "none") return state;
  if (action.type === "navigate") {
    const next = screenById(spec, action.screen);
    if (!next || next.id === state.screen) return state;
    return {
      ...state,
      screen: next.id,
      history: [...state.history, state.screen].slice(-12),
    };
  }
  if (action.type === "back") {
    const prev = state.history[state.history.length - 1];
    if (!prev) return state;
    return {
      ...state,
      screen: prev,
      history: state.history.slice(0, -1),
    };
  }
  if (action.type === "set") {
    return {
      ...state,
      values: { ...state.values, [action.key]: action.value },
    };
  }
  if (action.type === "toggle") {
    return {
      ...state,
      values: { ...state.values, [action.key]: !state.values[action.key] },
    };
  }
  if (action.type === "inc") {
    const cur = Number(state.values[action.key] || 0);
    return {
      ...state,
      values: {
        ...state.values,
        [action.key]: (Number.isFinite(cur) ? cur : 0) + (action.by ?? 1),
      },
    };
  }
  return state;
}

type TargetHit = {
  action?: AppAction;
  x: number;
  y: number;
  label: string;
  bind?: string;
};

function nodePoint(index: number, total: number): { x: number; y: number } {
  const y = 18 + ((index + 1) / (total + 1)) * 62;
  return { x: 50, y: clamp(y, 16, 84) };
}

export function findTarget(
  spec: AppDemoSpec,
  state: AppRuntimeState,
  targetId: string
): TargetHit | null {
  const screen = screenById(spec, state.screen);
  if (!screen) return null;

  const hotspot = screen.hotspots.find((h) => h.id === targetId);
  if (hotspot) {
    return {
      action: hotspot.action,
      x: hotspot.x + hotspot.w / 2,
      y: hotspot.y + hotspot.h / 2,
      label: hotspot.label,
    };
  }

  const tab = spec.tabs.find((t) => t.id === targetId || t.screen === targetId);
  if (tab) {
    const i = spec.tabs.findIndex((t) => t.id === tab.id);
    const x = ((i + 0.5) / Math.max(spec.tabs.length, 1)) * 100;
    return {
      action: { type: "navigate", screen: tab.screen },
      x,
      y: 93,
      label: tab.label,
    };
  }

  const nodes = screen.nodes;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const pt = nodePoint(i, nodes.length);
    if (node.type === "navbar" && (node.id === targetId || targetId === `${node.id}-back`)) {
      return {
        action: node.back,
        x: 12,
        y: 10,
        label: "Atrás",
      };
    }
    if (node.type === "button" && node.id === targetId) {
      return { action: node.action, ...pt, label: node.label };
    }
    if (node.type === "toggle" && node.id === targetId) {
      return {
        action: { type: "toggle", key: node.bind },
        x: 82,
        y: pt.y,
        label: node.label,
        bind: node.bind,
      };
    }
    if (node.type === "input" && (node.id === targetId || node.bind === targetId)) {
      return { x: pt.x, y: pt.y, label: node.placeholder, bind: node.bind };
    }
    if (node.type === "tabs" && node.id === targetId) {
      return {
        action: { type: "set", key: node.bind, value: node.items[0]?.id || "" },
        ...pt,
        label: node.items[0]?.label || "Tab",
        bind: node.bind,
      };
    }
    if ((node.type === "list" || node.type === "cards") && node.id === targetId) {
      const first = node.items[0];
      return {
        action: first?.action,
        ...pt,
        label: first?.title || node.id,
      };
    }
    if (node.type === "list" || node.type === "cards") {
      const item = node.items.find((it) => it.id === targetId);
      if (item) {
        return { action: item.action, ...pt, label: item.title };
      }
    }
  }

  const other = spec.screens.find((s) =>
    s.hotspots.some((h) => h.id === targetId)
  );
  if (other) {
    const h = other.hotspots.find((x) => x.id === targetId)!;
    return {
      action: h.action,
      x: h.x + h.w / 2,
      y: h.y + h.h / 2,
      label: h.label,
    };
  }

  return null;
}

export function tapTarget(
  spec: AppDemoSpec,
  state: AppRuntimeState,
  targetId: string
): AppRuntimeState {
  const hit = findTarget(spec, state, targetId);
  if (!hit) return state;
  return applyAction(spec, state, hit.action);
}

function msToFrames(ms: number) {
  return Math.max(8, Math.round((clamp(ms, 200, 4000) / 1000) * APP_DEMO_FPS));
}

type Segment = {
  from: number;
  to: number;
  state: AppRuntimeState;
  cursor: AppCursor;
  caption: string;
  applyAt?: number;
  nextState?: AppRuntimeState;
};

export function compileAppDemo(spec: AppDemoSpec): {
  durationInFrames: number;
  segments: Segment[];
} {
  const steps =
    spec.demo.length > 0
      ? spec.demo
      : defaultDemo(spec);

  const segments: Segment[] = [];
  let frame = APP_DEMO_INTRO_FRAMES;
  let state = initialRuntime(spec);
  let cursor: AppCursor = { x: 50, y: 50, pressed: false, visible: false };

  segments.push({
    from: 0,
    to: APP_DEMO_INTRO_FRAMES,
    state,
    cursor,
    caption: spec.tagline || spec.appName,
  });

  for (const step of steps) {
    if (step.op === "wait") {
      const to = frame + msToFrames(step.ms);
      segments.push({
        from: frame,
        to,
        state,
        cursor: { ...cursor, pressed: false },
        caption: step.caption || screenById(spec, state.screen)?.name || "",
      });
      frame = to;
      continue;
    }

    if (step.op === "type") {
      const hit = findTarget(spec, state, step.bind);
      const nextState: AppRuntimeState = {
        ...state,
        values: { ...state.values, [step.bind]: step.text },
      };
      const to = frame + Math.max(18, Math.min(45, step.text.length * 3 + 12));
      cursor = {
        x: hit?.x ?? 50,
        y: hit?.y ?? 42,
        pressed: false,
        visible: true,
      };
      segments.push({
        from: frame,
        to,
        state,
        nextState,
        applyAt: frame + 8,
        cursor,
        caption: step.caption || `Escribe ${step.text}`,
      });
      state = nextState;
      frame = to;
      continue;
    }

    const hit = findTarget(spec, state, step.target);
    const nextState = tapTarget(spec, state, step.target);
    const tap = 22;
    cursor = {
      x: hit?.x ?? 50,
      y: hit?.y ?? 50,
      pressed: true,
      visible: true,
    };
    segments.push({
      from: frame,
      to: frame + tap,
      state,
      nextState,
      applyAt: frame + 10,
      cursor,
      caption: step.caption || hit?.label || "Tap",
    });
    state = nextState;
    frame += tap;
    const hold = 16;
    segments.push({
      from: frame,
      to: frame + hold,
      state,
      cursor: { ...cursor, pressed: false, visible: true },
      caption: step.caption || hit?.label || "",
    });
    frame += hold;
  }

  segments.push({
    from: frame,
    to: frame + APP_DEMO_OUTRO_FRAMES,
    state,
    cursor: { ...cursor, visible: false, pressed: false },
    caption: spec.cta || spec.appName,
  });

  return { durationInFrames: frame + APP_DEMO_OUTRO_FRAMES, segments };
}

export function snapshotFromCompile(
  compiled: { segments: { from: number; to: number; state: AppRuntimeState; cursor: AppCursor; caption: string; applyAt?: number; nextState?: AppRuntimeState }[] },
  spec: AppDemoSpec,
  frame: number
): AppDemoSnapshot {
  const { segments } = compiled;
  const last = segments[segments.length - 1];
  const seg = segments.find((s) => frame >= s.from && frame < s.to) || last;
  if (!seg) {
    return {
      state: initialRuntime(spec),
      cursor: { x: 50, y: 50, pressed: false, visible: false },
      caption: spec.appName,
    };
  }
  const applied =
    seg.nextState && seg.applyAt != null && frame >= seg.applyAt
      ? seg.nextState
      : seg.state;
  return {
    state: applied,
    cursor: seg.cursor,
    caption: seg.caption,
  };
}

export function snapshotAtFrame(
  spec: AppDemoSpec,
  frame: number
): AppDemoSnapshot {
  return snapshotFromCompile(compileAppDemo(spec), spec, frame);
}

export function appDemoDurationFrames(spec: AppDemoSpec | null) {
  if (!spec || spec.screens.length === 0) {
    return APP_DEMO_INTRO_FRAMES + 90 + APP_DEMO_OUTRO_FRAMES;
  }
  return compileAppDemo(spec).durationInFrames;
}

export function appDemoDurationLabel(spec: AppDemoSpec | null) {
  const sec = appDemoDurationFrames(spec) / APP_DEMO_FPS;
  return `${sec.toFixed(1)}s`;
}

function defaultDemo(spec: AppDemoSpec): DemoStep[] {
  const steps: DemoStep[] = [{ op: "wait", ms: 700, caption: spec.screens[0]?.name }];
  for (const screen of spec.screens) {
    const list = screen.nodes.find((n) => n.type === "list" || n.type === "cards");
    const listTarget =
      list && (list.type === "list" || list.type === "cards")
        ? list.items[0]?.id
        : undefined;
    const target =
      screen.hotspots[0]?.id ||
      screen.nodes.find((n) => n.type === "button")?.id ||
      listTarget;
    if (target) {
      steps.push({
        op: "tap",
        target,
        caption: screen.name,
      });
      steps.push({ op: "wait", ms: 500 });
    }
  }
  return steps.slice(0, 12);
}

function parseAction(raw: unknown): AppAction {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const o = raw as Record<string, unknown>;
  const type = asString(o.type);
  if (type === "navigate") {
    const screen = slugId(asString(o.screen), "");
    return screen ? { type: "navigate", screen } : { type: "none" };
  }
  if (type === "back") return { type: "back" };
  if (type === "toggle") {
    const key = asString(o.key);
    return key ? { type: "toggle", key } : { type: "none" };
  }
  if (type === "inc") {
    const key = asString(o.key);
    return key ? { type: "inc", key, by: asNumber(o.by, 1) } : { type: "none" };
  }
  if (type === "set") {
    const key = asString(o.key);
    if (!key) return { type: "none" };
    const value = o.value;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return { type: "set", key, value };
    }
    return { type: "none" };
  }
  return { type: "none" };
}

function parseHotspot(raw: unknown, index: number): AppHotspot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: slugId(asString(o.id), `hot-${index}`),
    x: clamp(asNumber(o.x, 20), 2, 90),
    y: clamp(asNumber(o.y, 20), 2, 90),
    w: clamp(asNumber(o.w, 30), 8, 90),
    h: clamp(asNumber(o.h, 8), 6, 40),
    label: asString(o.label, `Acción ${index + 1}`).slice(0, 80),
    action: parseAction(o.action),
  };
}

function parseNode(raw: unknown, index: number): UiNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = asString(o.type);
  const id = slugId(asString(o.id), `node-${index}`);
  if (type === "navbar") {
    return {
      type: "navbar",
      id,
      title: asString(o.title, "App").slice(0, 40),
      back: o.back ? parseAction(o.back) : undefined,
    };
  }
  if (type === "title") {
    return {
      type: "title",
      id,
      text: asString(o.text, "").slice(0, 80),
      sub: asString(o.sub).slice(0, 120) || undefined,
    };
  }
  if (type === "text") {
    return { type: "text", id, text: asString(o.text, "").slice(0, 220) };
  }
  if (type === "button") {
    const variant = asString(o.variant);
    return {
      type: "button",
      id,
      label: asString(o.label, "Continuar").slice(0, 40),
      variant:
        variant === "secondary" || variant === "ghost" ? variant : "primary",
      action: parseAction(o.action),
    };
  }
  if (type === "input") {
    const bind = slugId(asString(o.bind), `field-${index}`);
    return {
      type: "input",
      id,
      bind,
      placeholder: asString(o.placeholder, "Escribe…").slice(0, 40),
    };
  }
  if (type === "toggle") {
    return {
      type: "toggle",
      id,
      bind: slugId(asString(o.bind), `tog-${index}`),
      label: asString(o.label, "Opción").slice(0, 40),
    };
  }
  if (type === "list" || type === "cards") {
    const items = Array.isArray(o.items) ? o.items : [];
    return {
      type,
      id,
      items: items.slice(0, 8).map((item, i) => {
        const it = (item && typeof item === "object" ? item : {}) as Record<
          string,
          unknown
        >;
        return {
          id: slugId(asString(it.id), `${id}-item-${i}`),
          title: asString(it.title, `Item ${i + 1}`).slice(0, 60),
          sub: asString(it.sub).slice(0, 80) || undefined,
          meta: asString(it.meta).slice(0, 24) || undefined,
          action: it.action ? parseAction(it.action) : undefined,
        };
      }),
    };
  }
  if (type === "tabs") {
    const items = Array.isArray(o.items) ? o.items : [];
    return {
      type: "tabs",
      id,
      bind: slugId(asString(o.bind), `tab-${index}`),
      items: items.slice(0, 5).map((item, i) => {
        const it = (item && typeof item === "object" ? item : {}) as Record<
          string,
          unknown
        >;
        return {
          id: slugId(asString(it.id), `tab-${i}`),
          label: asString(it.label, `Tab ${i + 1}`).slice(0, 20),
        };
      }),
    };
  }
  if (type === "stat") {
    return {
      type: "stat",
      id,
      label: asString(o.label, "").slice(0, 24),
      value: asString(o.value, "0").slice(0, 20),
      bind: asString(o.bind) ? slugId(asString(o.bind), "") : undefined,
    };
  }
  if (type === "chip") {
    return { type: "chip", id, text: asString(o.text, "").slice(0, 28) };
  }
  if (type === "spacer") return { type: "spacer", id };
  return null;
}

function parseDemo(raw: unknown): DemoStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: DemoStep[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const op = asString(o.op);
    const caption = asString(o.caption).slice(0, 80) || undefined;
    if (op === "wait") {
      steps.push({ op: "wait", ms: asNumber(o.ms, 600), caption });
    } else if (op === "tap") {
      const target = slugId(asString(o.target), "");
      if (target) steps.push({ op: "tap", target, caption });
    } else if (op === "type") {
      const bind = slugId(asString(o.bind), "");
      const text = asString(o.text).slice(0, 40);
      if (bind && text) steps.push({ op: "type", bind, text, caption });
    }
  }
  return steps;
}

export function sanitizeAppDemoSpec(
  raw: unknown,
  captures: AppDemoCapture[],
  fallback: { appName: string; tagline: string; cta: string; accent: string }
): AppDemoSpec {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawScreens = Array.isArray(o.screens) ? o.screens : [];
  const screens: AppScreenSpec[] = captures.map((capture, index) => {
    const match =
      rawScreens.find((s) => {
        if (!s || typeof s !== "object") return false;
        const id = asString((s as Record<string, unknown>).id);
        return id === capture.id || id === `screen-${index + 1}`;
      }) || rawScreens[index];
    const s = (match && typeof match === "object" ? match : {}) as Record<
      string,
      unknown
    >;
    const id = capture.id;
    const hotspots = Array.isArray(s.hotspots)
      ? s.hotspots
          .map((h, i) => parseHotspot(h, i))
          .filter((h): h is AppHotspot => Boolean(h))
          .slice(0, 10)
      : [];
    const nodes = Array.isArray(s.nodes)
      ? s.nodes
          .map((n, i) => parseNode(n, i))
          .filter((n): n is UiNode => Boolean(n))
          .slice(0, 16)
      : [];
    return {
      id,
      name: asString(s.name, capture.caption || `Pantalla ${index + 1}`).slice(
        0,
        40
      ),
      imageUrl: capture.url || asString(s.imageUrl),
      background: isAccent(asString(s.background))
        ? asString(s.background)
        : "#ffffff",
      hotspots,
      nodes,
    };
  });

  const kindRaw = asString(o.kind);
  const kind: AppDemoKind = kindRaw === "functional" ? "functional" : "screens";
  const tabs = Array.isArray(o.tabs)
    ? o.tabs
        .slice(0, 5)
        .map((t, i) => {
          const it = (t && typeof t === "object" ? t : {}) as Record<
            string,
            unknown
          >;
          const screen = slugId(asString(it.screen), screens[i]?.id || "");
          if (!screens.some((s) => s.id === screen)) return null;
          return {
            id: slugId(asString(it.id), `tab-${i}`),
            label: asString(it.label, `Tab ${i + 1}`).slice(0, 16),
            screen,
          };
        })
        .filter((t): t is AppTabItem => Boolean(t))
    : [];

  const state: Record<string, string | number | boolean> = {};
  if (o.state && typeof o.state === "object") {
    for (const [k, v] of Object.entries(o.state as Record<string, unknown>)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        state[slugId(k, k)] = typeof v === "string" ? v.slice(0, 80) : v;
      }
    }
  }

  const startCandidate = slugId(asString(o.startScreen), "");
  const startScreen = screens.some((s) => s.id === startCandidate)
    ? startCandidate
    : screens[0]?.id || "home";

  const accent = isAccent(asString(o.accent) || fallback.accent)
    ? asString(o.accent) || fallback.accent
    : fallback.accent;

  return {
    appName: asString(o.appName, fallback.appName || "Tu app").slice(0, 40),
    tagline: asString(o.tagline, fallback.tagline || "Mira cómo funciona").slice(
      0,
      80
    ),
    cta: asString(o.cta, fallback.cta || "Descarga la app").slice(0, 40),
    accent,
    background: isAccent(asString(o.background)) ? asString(o.background) : "#09090b",
    kind,
    summary: asString(o.summary).slice(0, 180),
    startScreen,
    tabs,
    screens,
    state,
    demo: parseDemo(o.demo),
  };
}

export function toAppDemoProps(draft: AppDemoDraft): AppDemoProps | null {
  if (!draft.spec || draft.spec.screens.length === 0) return null;
  const spec: AppDemoSpec = {
    ...draft.spec,
    appName: draft.appName.trim() || draft.spec.appName,
    tagline: draft.tagline.trim() || draft.spec.tagline,
    cta: draft.cta.trim() || draft.spec.cta,
    accent: isAccent(draft.accent) ? draft.accent : draft.spec.accent,
  };
  return { spec };
}

function parseCaptures(raw: unknown): AppDemoCapture[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is AppDemoCapture =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as AppDemoCapture).id === "string" &&
        typeof (s as AppDemoCapture).url === "string"
    )
    .map((s) => ({
      id: s.id,
      url: s.url,
      caption: typeof s.caption === "string" ? s.caption : "",
    }))
    .slice(0, APP_DEMO_MAX_SCREENS);
}

function loadCodeSlice(projectId: string): Partial<AppDemoDraft> | null {
  try {
    const raw = localStorage.getItem(codeStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppDemoDraft>;
    return {
      source: parsed.source === "code" ? "code" : parsed.source === "prompt" ? "prompt" : undefined,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      phoneFrame: typeof parsed.phoneFrame === "boolean" ? parsed.phoneFrame : undefined,
      canvasTheme: parsed.canvasTheme === "light" || parsed.canvasTheme === "dark" ? parsed.canvasTheme : undefined,
      variables: Array.isArray(parsed.variables)
        ? parseVariables(parsed.variables)
        : undefined,
    };
  } catch {
    return null;
  }
}

export function loadAppDemo(projectId: string): AppDemoDraft {
  let draft: AppDemoDraft = { ...DEFAULT_APP_DEMO, screens: [] };
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDemoDraft>;
      const screens = parseCaptures(parsed.screens);
      const kindHint =
        parsed.kindHint === "screens" || parsed.kindHint === "functional"
          ? parsed.kindHint
          : "auto";
      let spec: AppDemoSpec | null = null;
      if (parsed.spec && screens.length) {
        try {
          spec = sanitizeAppDemoSpec(parsed.spec, screens, {
            appName: typeof parsed.appName === "string" ? parsed.appName : "",
            tagline: typeof parsed.tagline === "string" ? parsed.tagline : "",
            cta: typeof parsed.cta === "string" ? parsed.cta : DEFAULT_APP_DEMO.cta,
            accent:
              typeof parsed.accent === "string"
                ? parsed.accent
                : DEFAULT_APP_DEMO.accent,
          });
        } catch {
          spec = null;
        }
      }
      draft = {
        appName: typeof parsed.appName === "string" ? parsed.appName : "",
        tagline: typeof parsed.tagline === "string" ? parsed.tagline : "",
        cta: typeof parsed.cta === "string" ? parsed.cta : DEFAULT_APP_DEMO.cta,
        accent: isAccent(parsed.accent || "")
          ? parsed.accent!
          : DEFAULT_APP_DEMO.accent,
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
        kindHint,
        source: parsed.source === "code" ? "code" : "prompt",
        code: typeof parsed.code === "string" ? parsed.code : "",
        phoneFrame: parsed.phoneFrame !== false,
        canvasTheme: parsed.canvasTheme === "light" ? "light" : "dark",
        variables: parseVariables(parsed.variables),
        screens,
        spec,
      };
    }
  } catch {
    draft = { ...DEFAULT_APP_DEMO, screens: [] };
  }

  const slice = loadCodeSlice(projectId);
  if (slice) {
    draft = {
      ...draft,
      source: slice.source ?? draft.source,
      code: slice.code ?? draft.code,
      phoneFrame: slice.phoneFrame ?? draft.phoneFrame,
      canvasTheme: slice.canvasTheme ?? draft.canvasTheme,
      variables: slice.variables ?? draft.variables,
    };
  }
  return draft;
}

export function saveAppDemo(projectId: string, draft: AppDemoDraft) {
  const slice = {
    source: draft.source,
    code: draft.code,
    phoneFrame: draft.phoneFrame,
    canvasTheme: draft.canvasTheme,
    variables: draft.variables,
  };
  try {
    localStorage.setItem(codeStorageKey(projectId), JSON.stringify(slice));
  } catch {
    /* ignore quota */
  }
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(draft));
  } catch {
    try {
      localStorage.setItem(
        storageKey(projectId),
        JSON.stringify({
          ...draft,
          screens: draft.screens.map((screen) => ({
            ...screen,
            url: screen.url.startsWith("http") ? screen.url : "",
          })),
          spec: null,
        })
      );
    } catch {
      /* ignore quota */
    }
  }
}
