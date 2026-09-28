import type {
  DemoAction,
  DemoStep,
  GestureEvent,
  GesturePoint,
  GestureTemplateId,
  GestureVariation,
  ProductSchema,
} from "./types";
import { clamp01, lerp, rngFromSeed } from "./rng";

export function variationFromSeed(seed: string): GestureVariation {
  const rnd = rngFromSeed(seed);
  return {
    seed,
    speed: 0.88 + rnd() * 0.24,
    offsetX: (rnd() - 0.5) * 0.045,
    offsetY: (rnd() - 0.5) * 0.04,
    pauseBefore: Math.round(40 + rnd() * 120),
    durationScale: 0.9 + rnd() * 0.25,
    curvature: (rnd() - 0.5) * 0.08,
  };
}

function jitter(
  x: number,
  y: number,
  v: GestureVariation,
  rnd: () => number
) {
  return {
    x: clamp01(x + v.offsetX + (rnd() - 0.5) * 0.012),
    y: clamp01(y + v.offsetY + (rnd() - 0.5) * 0.012),
  };
}

function curve(
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
  curvature: number
): GesturePoint[] {
  const mx = (from.x + to.x) / 2 + curvature;
  const my = (from.y + to.y) / 2 - Math.abs(curvature) * 0.6;
  const out: GesturePoint[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / Math.max(steps - 1, 1);
    const ax = lerp(from.x, mx, t);
    const ay = lerp(from.y, my, t);
    const bx = lerp(mx, to.x, t);
    const by = lerp(my, to.y, t);
    out.push({ x: lerp(ax, bx, t), y: lerp(ay, by, t), t });
  }
  return out;
}

export function templateForAction(
  action: DemoAction,
  value?: string
): GestureTemplateId {
  if (action === "type") return "type_sequence";
  if (action === "swipe") {
    const d = (value || "").toLowerCase();
    if (d.includes("left")) return "swipe_left";
    if (d.includes("right")) return "swipe_right";
    if (d.includes("down")) return "swipe_down";
    return "swipe_up";
  }
  if (action === "scroll") {
    return (value || "").toLowerCase().includes("down")
      ? "swipe_down"
      : "swipe_up";
  }
  if (action === "hold") return "hold";
  if (action === "double_tap") return "double_tap";
  if (action === "wait" || action === "open") return "idle";
  return "tap";
}

export function buildGesture(
  type: GestureTemplateId,
  target: string,
  startTime: number,
  duration: number,
  at: { x: number; y: number },
  variation: GestureVariation,
  extra?: { textLength?: number }
): GestureEvent {
  const rnd = rngFromSeed(`${variation.seed}:${target}:${startTime}`);
  const dur = Math.max(120, Math.round(duration * variation.durationScale));
  const dest = jitter(at.x, at.y, variation, rnd);
  const rest = jitter(0.5 + (rnd() - 0.5) * 0.2, 0.78 + rnd() * 0.08, variation, rnd);

  let trajectory: GesturePoint[] = [];
  if (type === "idle") {
    trajectory = [
      { x: rest.x, y: rest.y, t: 0 },
      { x: rest.x, y: rest.y, t: 1 },
    ];
  } else if (type === "tap" || type === "hold") {
    trajectory = [
      ...curve(rest, dest, 5, variation.curvature),
      { x: dest.x, y: dest.y, t: 0.72 },
      { x: dest.x, y: dest.y + 0.008, t: 0.82 },
      { x: dest.x, y: dest.y, t: 1 },
    ].map((p, i, arr) => ({ ...p, t: i / Math.max(arr.length - 1, 1) }));
  } else if (type === "double_tap") {
    trajectory = [
      ...curve(rest, dest, 4, variation.curvature),
      { x: dest.x, y: dest.y, t: 0.55 },
      { x: dest.x, y: dest.y + 0.01, t: 0.62 },
      { x: dest.x, y: dest.y, t: 0.78 },
      { x: dest.x, y: dest.y + 0.01, t: 0.88 },
      { x: dest.x, y: dest.y, t: 1 },
    ].map((p, i, arr) => ({ ...p, t: i / Math.max(arr.length - 1, 1) }));
  } else if (type.startsWith("swipe_")) {
    const dx =
      type === "swipe_left" ? -0.22 : type === "swipe_right" ? 0.22 : 0;
    const dy =
      type === "swipe_up" ? -0.22 : type === "swipe_down" ? 0.22 : 0;
    const end = {
      x: clamp01(dest.x + dx),
      y: clamp01(dest.y + dy),
    };
    trajectory = curve(dest, end, 8, variation.curvature);
  } else if (type === "type_sequence") {
    const n = Math.max(4, Math.min(10, extra?.textLength || 6));
    const keys: GesturePoint[] = [{ x: dest.x, y: dest.y, t: 0 }];
    for (let i = 0; i < n; i += 1) {
      keys.push({
        x: clamp01(0.18 + rnd() * 0.64),
        y: clamp01(0.78 + rnd() * 0.14),
        t: (i + 1) / (n + 1),
      });
    }
    keys.push({ x: dest.x, y: dest.y, t: 1 });
    trajectory = keys;
  }

  return {
    type,
    target,
    startTime: startTime + variation.pauseBefore,
    duration: dur,
    trajectory,
  };
}

export function gesturesForSteps(
  steps: DemoStep[],
  points: { x: number; y: number }[],
  seed: string,
  schema: ProductSchema
): GestureEvent[] {
  const variation = variationFromSeed(seed);
  const out: GestureEvent[] = [];
  let t = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const at = points[i] || { x: 0.5, y: 0.5 };
    const type = templateForAction(step.action, step.value);
    const target = step.target || schema.startScreen;
    out.push(
      buildGesture(type, target, t, step.duration, at, variation, {
        textLength: step.value?.length,
      })
    );
    t += step.duration + step.delayAfter;
  }
  return out;
}
