import {
  applyAction,
  findTarget,
  initialRuntime,
  tapTarget,
  type AppCursor,
  type AppDemoSpec,
  type AppRuntimeState,
} from "@/lib/creator/app-demo";
import type {
  DemoAction,
  DemoExecutor,
  DemoStep,
  ProductAdapter,
  ProductSchema,
} from "./types";

export type ControllerSnapshot = {
  spec: AppDemoSpec;
  state: AppRuntimeState;
  cursor: AppCursor;
  caption: string;
};

function percentToNorm(n: number) {
  return Math.max(0, Math.min(1, n / 100));
}

export function resolveTargetPoint(
  spec: AppDemoSpec,
  state: AppRuntimeState,
  schema: ProductSchema,
  targetId: string
): { x: number; y: number } {
  const el = schema.elements.find((e) => e.id === targetId);
  if (el?.bounds) {
    return {
      x: el.bounds.x + el.bounds.w / 2,
      y: el.bounds.y + el.bounds.h / 2,
    };
  }
  const hit = findTarget(spec, state, targetId);
  if (hit) return { x: percentToNorm(hit.x), y: percentToNorm(hit.y) };
  if (el?.type === "screen") return { x: 0.5, y: 0.5 };
  return { x: 0.5, y: 0.55 };
}

export function bindForTarget(schema: ProductSchema, targetId: string) {
  return schema.elements.find((e) => e.id === targetId)?.bind || targetId;
}

export class InternalStateExecutor implements DemoExecutor {
  spec: AppDemoSpec;
  state: AppRuntimeState;
  cursor: AppCursor;
  caption: string;
  schema: ProductSchema;
  adapter: ProductAdapter;

  constructor(adapter: ProductAdapter, spec?: AppDemoSpec) {
    this.adapter = adapter;
    this.schema = adapter.schema;
    this.spec = spec || adapter.buildSpec();
    this.state = initialRuntime(this.spec);
    this.cursor = { x: 50, y: 50, pressed: false, visible: false };
    this.caption = this.spec.tagline || this.spec.appName;
  }

  snapshot(): ControllerSnapshot {
    const spec = this.adapter.hydrateSpec
      ? this.adapter.hydrateSpec(this.spec, this.state)
      : this.spec;
    return {
      spec,
      state: this.state,
      cursor: this.cursor,
      caption: this.caption,
    };
  }

  reset() {
    this.spec = this.adapter.buildSpec();
    this.state = initialRuntime(this.spec);
    this.cursor = { x: 50, y: 50, pressed: false, visible: false };
    this.caption = this.spec.tagline || this.spec.appName;
  }

  private point(target: string) {
    const p = resolveTargetPoint(this.spec, this.state, this.schema, target);
    this.cursor = {
      x: p.x * 100,
      y: p.y * 100,
      pressed: false,
      visible: true,
    };
    return p;
  }

  open(screen: string) {
    this.point(screen);
    this.state = applyAction(this.spec, this.state, {
      type: "navigate",
      screen,
    });
    this.caption = `Open ${screen}`;
    if (this.adapter.hydrateSpec) {
      this.spec = this.adapter.hydrateSpec(this.spec, this.state);
    }
  }

  tap(target: string) {
    this.point(target);
    this.cursor = { ...this.cursor, pressed: true };
    if (target === this.schema.startScreen || this.schema.screens.some((s) => s.id === target)) {
      this.open(target);
      this.cursor = { ...this.cursor, pressed: false };
      return;
    }
    if (target.endsWith("-back") || target === "back") {
      this.back();
      return;
    }
    const before = this.state;
    this.state = tapTarget(this.spec, this.state, target);
    if (this.state === before && this.schema.screens.some((s) => s.id === target)) {
      this.open(target);
    }
    this.caption = `Tap ${target}`;
    this.cursor = { ...this.cursor, pressed: false };
    if (this.adapter.hydrateSpec) {
      this.spec = this.adapter.hydrateSpec(this.spec, this.state);
    }
  }

  type(target: string, value: string) {
    this.point(target);
    const bind = bindForTarget(this.schema, target);
    this.state = {
      ...this.state,
      values: { ...this.state.values, [bind]: value },
    };
    this.caption = `Type “${value}”`;
    if (this.adapter.hydrateSpec) {
      this.spec = this.adapter.hydrateSpec(this.spec, this.state);
    }
  }

  swipe(_target: string, _direction?: string) {
    this.caption = "Swipe";
  }

  wait(_ms: number) {
    this.cursor = { ...this.cursor, pressed: false };
  }

  scroll(_target: string, _direction?: string) {
    this.caption = "Scroll";
  }

  select(target: string, value: string) {
    this.type(target, value);
  }

  submit(target: string) {
    this.tap(target);
  }

  back() {
    this.state = applyAction(this.spec, this.state, { type: "back" });
    this.caption = "Back";
    if (this.adapter.hydrateSpec) {
      this.spec = this.adapter.hydrateSpec(this.spec, this.state);
    }
  }

  hold(target: string) {
    this.point(target);
    this.cursor = { ...this.cursor, pressed: true };
    this.caption = `Hold ${target}`;
  }

  doubleTap(target: string) {
    this.tap(target);
    this.caption = `Double tap ${target}`;
  }

  applyStep(step: DemoStep) {
    const action: DemoAction = step.action;
    const target = step.target || "";
    const value = step.value || "";
    if (action === "open") this.open(target || this.schema.startScreen);
    else if (action === "tap") this.tap(target);
    else if (action === "type") this.type(target, value);
    else if (action === "swipe") this.swipe(target, value);
    else if (action === "wait") this.wait(step.duration);
    else if (action === "scroll") this.scroll(target, value);
    else if (action === "select") this.select(target, value);
    else if (action === "submit") this.submit(target);
    else if (action === "back") this.back();
    else if (action === "hold") this.hold(target);
    else if (action === "double_tap") this.doubleTap(target);
  }
}

export const EXECUTOR_ADAPTERS: Record<
  string,
  { kind: string; status: "ready" | "planned"; note: string }
> = {
  internal: {
    kind: "internal",
    status: "ready",
    note: "Semantic targets → AppDemoSpec runtime",
  },
  browser: {
    kind: "browser",
    status: "planned",
    note: "Map targets to data-testid / CSS",
  },
  emulator: {
    kind: "emulator",
    status: "planned",
    note: "Device automation via accessibility ids",
  },
  maestro: { kind: "maestro", status: "planned", note: "Maestro YAML flows" },
  appium: { kind: "appium", status: "planned", note: "Appium locator adapters" },
  a11y: {
    kind: "a11y",
    status: "planned",
    note: "accessibilityLabel / accessibilityIdentifier",
  },
  testid: {
    kind: "testid",
    status: "planned",
    note: "data-testid / testID registry",
  },
};
