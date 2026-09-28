import type { ProductAdapter } from "./types";
import { InternalStateExecutor, resolveTargetPoint } from "./controller";
import { gesturesForSteps } from "./gestures";
import { makeSeed } from "./rng";
import type {
  DemoBundle,
  DemoSpec,
  TimelineEvent,
  UiStateSnapshot,
  VideoCompositionSpec,
} from "./types";

export function compileDemoBundle(
  demo: DemoSpec,
  adapter: ProductAdapter,
  opts?: { seed?: string; rawAi?: unknown; variationOf?: string }
): DemoBundle {
  const seed = opts?.seed || makeSeed(demo.title);
  const executor = new InternalStateExecutor(adapter);
  const uiStates: UiStateSnapshot[] = [];
  const timeline: TimelineEvent[] = [];
  const points: { x: number; y: number }[] = [];

  let t = 0;
  const start = executor.snapshot();
  uiStates.push({
    t: 0,
    screen: start.state.screen,
    values: { ...start.state.values },
    caption: start.caption,
  });
  timeline.push({
    t: 0,
    kind: "ui",
    label: start.state.screen,
    screen: start.state.screen,
  });

  for (const step of demo.steps) {
    const snap = executor.snapshot();
    const target = step.target || adapter.schema.startScreen;
    const pt = resolveTargetPoint(snap.spec, snap.state, adapter.schema, target);
    points.push(pt);

    if (step.action !== "wait" && step.action !== "open") {
      timeline.push({
        t,
        kind: "gesture",
        label: `finger_down ${target}`,
        target,
        action: step.action,
        screen: snap.state.screen,
      });
    }

    executor.applyStep(step);
    const after = executor.snapshot();
    t += step.duration;

    timeline.push({
      t,
      kind: "state",
      label: `${step.action}${target ? ` ${target}` : ""}${
        step.value ? ` “${step.value}”` : ""
      }`,
      action: step.action,
      target,
      screen: after.state.screen,
    });

    uiStates.push({
      t,
      screen: after.state.screen,
      values: { ...after.state.values },
      caption: after.caption,
    });

    t += step.delayAfter;
  }

  const duration = Math.max(t, Math.round(demo.durationTarget * 1000));
  const gestures = gesturesForSteps(demo.steps, points, seed, adapter.schema);

  const video: VideoCompositionSpec = {
    duration,
    aspectRatio: "9:16",
    fps: 30,
    seed,
    screenStates: uiStates,
    gestureEvents: gestures,
    frameTiming: uiStates.map((s) => ({ t: s.t, screen: s.screen })),
  };

  return {
    demo,
    steps: demo.steps,
    uiStates,
    timeline,
    gestures,
    video,
    metadata: {
      duration,
      seed,
      feature: demo.feature,
      productId: demo.productId,
      createdAt: new Date().toISOString(),
      variationOf: opts?.variationOf,
    },
    rawAi: opts?.rawAi,
  };
}

export function serializeDemoBundle(bundle: DemoBundle): string {
  return JSON.stringify(bundle, null, 2);
}
