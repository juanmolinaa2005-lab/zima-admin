import {
  DEMO_ACTIONS,
  DEMO_STYLES,
  type DemoAction,
  type DemoSpec,
  type DemoStep,
  type DemoStyle,
  type ProductSchema,
} from "./types";
import { makeSeed } from "./rng";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isDemoAction(v: unknown): v is DemoAction {
  return typeof v === "string" && (DEMO_ACTIONS as readonly string[]).includes(v);
}

export function isDemoStyle(v: unknown): v is DemoStyle {
  return typeof v === "string" && (DEMO_STYLES as readonly string[]).includes(v);
}

export function targetIndex(schema: ProductSchema) {
  const byId = new Map(schema.elements.map((e) => [e.id, e]));
  const screens = new Set(schema.screens.map((s) => s.id));
  return { byId, screens };
}

function closestTarget(id: string, schema: ProductSchema): string | null {
  if (!id) return null;
  const { byId, screens } = targetIndex(schema);
  if (byId.has(id) || screens.has(id)) return id;
  const lower = id.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  for (const el of schema.elements) {
    if (el.id.toLowerCase() === lower) return el.id;
    if (el.bind && el.bind.toLowerCase() === lower) return el.id;
  }
  let best: { id: string; score: number } | null = null;
  for (const el of schema.elements) {
    if (el.id.includes(lower) || lower.includes(el.id)) {
      const score = Math.min(el.id.length, lower.length);
      if (!best || score > best.score) best = { id: el.id, score };
    }
  }
  return best?.id || null;
}

function defaultDuration(action: DemoAction, value: string, style: DemoStyle) {
  const scale = style === "fast" ? 0.85 : style === "detailed" ? 1.2 : 1;
  const base =
    action === "type"
      ? Math.max(420, Math.min(1600, 70 * Math.max(value.length, 4) + 280))
      : action === "wait"
        ? 350
        : action === "open"
          ? 380
          : action === "swipe" || action === "scroll"
            ? 480
            : action === "hold"
              ? 520
              : action === "double_tap"
                ? 420
                : 320;
  return Math.round(base * scale);
}

function defaultDelay(style: DemoStyle) {
  return style === "fast" ? 80 : style === "detailed" ? 180 : 120;
}

export function parseDemoStep(
  raw: unknown,
  index: number,
  schema: ProductSchema,
  style: DemoStyle
): DemoStep | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const actionRaw = rec.action ?? rec.op;
  if (!isDemoAction(actionRaw)) return null;
  const action = actionRaw;
  let target = asString(rec.target);
  if (action === "type" && !target) target = asString(rec.bind);
  const value = asString(rec.value ?? rec.text);
  if (action !== "wait" && action !== "back" && !target) {
    if (action === "open") target = schema.startScreen;
    else return null;
  }
  if (target) {
    const resolved = closestTarget(target, schema);
    if (!resolved) return null;
    target = resolved;
  }
  if (action === "type" && !value) return null;
  const duration = Math.max(
    80,
    Math.min(4000, asNumber(rec.duration, defaultDuration(action, value, style)))
  );
  const delayAfter = Math.max(
    0,
    Math.min(2000, asNumber(rec.delayAfter, defaultDelay(style)))
  );
  const id = asString(rec.id) || `step_${index + 1}`;
  const metadata = asRecord(rec.metadata) || undefined;
  return {
    id,
    action,
    target: target || undefined,
    value: value || undefined,
    duration,
    delayAfter,
    metadata,
  };
}

export type RepairResult = {
  spec: DemoSpec;
  dropped: string[];
  repaired: string[];
};

const MAX_STEPS: Record<DemoStyle, number> = {
  fast: 6,
  normal: 10,
  detailed: 14,
};

export function repairDemoSpec(
  raw: unknown,
  schema: ProductSchema,
  opts: {
    productId: string;
    durationTarget: number;
    style: DemoStyle;
    seed?: string;
  }
): RepairResult {
  const rec = asRecord(raw) || {};
  const dropped: string[] = [];
  const repaired: string[] = [];
  const style = isDemoStyle(rec.style) ? rec.style : opts.style;
  const featureRaw = asString(rec.feature);
  const feature =
    schema.features.some((f) => f.id === featureRaw)
      ? featureRaw
      : schema.features[0]?.id || "core";
  if (featureRaw && featureRaw !== feature) {
    repaired.push(`feature:${featureRaw}->${feature}`);
  }

  const rawSteps = Array.isArray(rec.steps) ? rec.steps : [];
  const steps: DemoStep[] = [];
  for (let i = 0; i < rawSteps.length; i += 1) {
    const step = parseDemoStep(rawSteps[i], i, schema, style);
    if (!step) {
      dropped.push(`step_${i + 1}`);
      continue;
    }
    steps.push(step);
  }

  const capped = steps.slice(0, MAX_STEPS[style]);
  if (capped.length < steps.length) {
    dropped.push(`truncated:${steps.length - capped.length}`);
  }

  const ensureOpen =
    capped.length === 0 ||
    (capped[0].action !== "open" && capped[0].target !== schema.startScreen);
  const finalSteps = ensureOpen
    ? [
        {
          id: "step_open",
          action: "open" as const,
          target: schema.startScreen,
          duration: defaultDuration("open", "", style),
          delayAfter: defaultDelay(style),
        },
        ...capped.map((s, i) => ({ ...s, id: s.id || `step_${i + 2}` })),
      ]
    : capped;

  if (ensureOpen) repaired.push("inserted:open");

  const durationTarget = Math.max(
    4,
    Math.min(12, asNumber(rec.durationTarget, opts.durationTarget) || 6)
  );

  return {
    spec: {
      id: asString(rec.id) || `demo_${opts.seed || makeSeed()}`,
      title: asString(rec.title) || "App demo",
      goal: asString(rec.goal) || asString(rec.title) || "Show a core flow",
      feature,
      durationTarget,
      style,
      productId: opts.productId,
      steps: finalSteps.map((s, i) => ({ ...s, id: s.id || `step_${i + 1}` })),
    },
    dropped,
    repaired,
  };
}

export function assertUsableDemo(spec: DemoSpec, schema: ProductSchema) {
  const { byId, screens } = targetIndex(schema);
  const interactive = spec.steps.filter(
    (s) => s.action !== "open" && s.action !== "wait"
  );
  if (interactive.length === 0) {
    throw new Error("El demo no tiene acciones interactivas válidas.");
  }
  for (const step of spec.steps) {
    if (!step.target) continue;
    if (!byId.has(step.target) && !screens.has(step.target)) {
      throw new Error(`Target desconocido: ${step.target}`);
    }
  }
}

export function compactProductKnowledge(schema: ProductSchema) {
  return {
    id: schema.id,
    name: schema.name,
    description: schema.description,
    startScreen: schema.startScreen,
    features: schema.features,
    actions: schema.actions.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      inputs: a.inputs,
      result: a.result,
      screens: a.screens,
      targets: a.targets,
    })),
    screens: schema.screens.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      availableElements: s.availableElements,
      possibleActions: s.possibleActions,
      navigationTargets: s.navigationTargets,
    })),
    elements: schema.elements.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      screen: e.screen,
      actions: e.actions,
      bind: e.bind,
    })),
  };
}
