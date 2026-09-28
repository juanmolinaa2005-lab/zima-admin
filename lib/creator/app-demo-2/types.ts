export const DEMO_ACTIONS = [
  "open",
  "tap",
  "type",
  "swipe",
  "wait",
  "scroll",
  "select",
  "submit",
  "back",
  "hold",
  "double_tap",
] as const;

export type DemoAction = (typeof DEMO_ACTIONS)[number];

export const DEMO_STYLES = ["fast", "normal", "detailed"] as const;
export type DemoStyle = (typeof DEMO_STYLES)[number];

export const GESTURE_TEMPLATES = [
  "tap",
  "double_tap",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "type_sequence",
  "hold",
  "idle",
] as const;

export type GestureTemplateId = (typeof GESTURE_TEMPLATES)[number];

export type DemoInputType =
  | "text"
  | "datetime"
  | "select"
  | "boolean"
  | "number";

export type ProductInput = {
  id: string;
  name: string;
  required: boolean;
  type: DemoInputType;
  placeholder?: string;
};

export type ProductActionDef = {
  id: string;
  name: string;
  description: string;
  inputs: ProductInput[];
  result: string;
  screens: string[];
  targets: string[];
};

export type ProductFeature = {
  id: string;
  name: string;
  description: string;
  availableActions: string[];
};

export type ProductScreen = {
  id: string;
  name: string;
  description: string;
  availableElements: string[];
  possibleActions: DemoAction[];
  navigationTargets: string[];
};

export type UiElementType =
  | "button"
  | "input"
  | "list"
  | "tab"
  | "toggle"
  | "screen"
  | "navbar"
  | "card"
  | "chip";

export type UiTarget = {
  id: string;
  type: UiElementType;
  label: string;
  screen: string;
  actions: DemoAction[];
  bind?: string;
  testId?: string;
  /** Normalized bounds inside the phone screen (0–1). */
  bounds?: { x: number; y: number; w: number; h: number };
};

export type ProductSchema = {
  id: string;
  name: string;
  description: string;
  features: ProductFeature[];
  actions: ProductActionDef[];
  screens: ProductScreen[];
  elements: UiTarget[];
  startScreen: string;
};

export type DemoStep = {
  id: string;
  action: DemoAction;
  target?: string;
  value?: string;
  duration: number;
  delayAfter: number;
  metadata?: Record<string, unknown>;
};

export type DemoSpec = {
  id: string;
  title: string;
  goal: string;
  feature: string;
  durationTarget: number;
  style: DemoStyle;
  productId: string;
  steps: DemoStep[];
};

export type UiStateSnapshot = {
  t: number;
  screen: string;
  values: Record<string, string | number | boolean>;
  caption: string;
};

export type TimelineEvent = {
  t: number;
  kind: "ui" | "gesture" | "state";
  label: string;
  screen?: string;
  target?: string;
  action?: string;
};

export type GesturePoint = {
  x: number;
  y: number;
  t: number;
};

export type GestureEvent = {
  type: GestureTemplateId;
  target: string;
  startTime: number;
  duration: number;
  trajectory: GesturePoint[];
};

export type GestureVariation = {
  seed: string;
  speed: number;
  offsetX: number;
  offsetY: number;
  pauseBefore: number;
  durationScale: number;
  curvature: number;
};

export type VideoCompositionSpec = {
  duration: number;
  aspectRatio: "9:16";
  fps: number;
  seed: string;
  screenStates: UiStateSnapshot[];
  gestureEvents: GestureEvent[];
  frameTiming: { t: number; screen: string }[];
};

export type DemoBundle = {
  demo: DemoSpec;
  steps: DemoStep[];
  uiStates: UiStateSnapshot[];
  timeline: TimelineEvent[];
  gestures: GestureEvent[];
  video: VideoCompositionSpec;
  metadata: {
    duration: number;
    seed: string;
    feature: string;
    productId: string;
    createdAt: string;
    variationOf?: string;
  };
  rawAi?: unknown;
};

export type DemoExecutor = {
  open(screen: string): void | Promise<void>;
  tap(target: string): void | Promise<void>;
  type(target: string, value: string): void | Promise<void>;
  swipe(target: string, direction?: string): void | Promise<void>;
  wait(ms: number): void | Promise<void>;
  scroll(target: string, direction?: string): void | Promise<void>;
  select(target: string, value: string): void | Promise<void>;
  submit(target: string): void | Promise<void>;
  back(): void | Promise<void>;
  hold?(target: string): void | Promise<void>;
  doubleTap?(target: string): void | Promise<void>;
};

export type ExecutorKind =
  | "internal"
  | "browser"
  | "emulator"
  | "maestro"
  | "appium"
  | "a11y"
  | "testid";

export type SavedDemoRecord = {
  id: string;
  name: string;
  createdAt: string;
  bundle: DemoBundle;
};

export type AppDemo2Workspace = {
  prompt: string;
  durationTarget: number;
  style: DemoStyle;
  productId: string;
  variationCount: 3 | 5 | 10 | 20;
  activeId: string | null;
  demos: SavedDemoRecord[];
  inspectorOpen: boolean;
};

export type ProductAdapter = {
  id: string;
  name: string;
  schema: ProductSchema;
  buildSpec(): import("@/lib/creator/app-demo").AppDemoSpec;
  hydrateSpec?(
    spec: import("@/lib/creator/app-demo").AppDemoSpec,
    state: import("@/lib/creator/app-demo").AppRuntimeState
  ): import("@/lib/creator/app-demo").AppDemoSpec;
};
