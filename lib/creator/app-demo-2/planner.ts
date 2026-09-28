import { openaiChatJson } from "@/lib/openai/chat";
import { compileDemoBundle } from "./compile";
import { compactProductKnowledge, repairDemoSpec, assertUsableDemo } from "./validate";
import type { ProductAdapter } from "./types";
import type { DemoBundle, DemoSpec, DemoStyle } from "./types";
import { makeSeed } from "./rng";

const PLANNER_SYSTEM = `You are an AI Demo Planner for short marketing videos of a mobile app.

You receive a Product Schema. You MUST:
- only use existing features (feature ids)
- only use existing actions and UI element ids as "target"
- only use Demo DSL actions: open, tap, type, swipe, wait, scroll, select, submit, back, hold, double_tap
- output valid JSON matching the Demo Spec shape
- make demos visually understandable on a phone screen
- minimize unnecessary steps
- prefer flows that work in short marketing videos (5–8 seconds)
- never invent screens, buttons, or features that are not in the schema
- never use coordinate taps; only semantic targets

Return JSON:
{
  "title": string,
  "goal": string,
  "feature": featureId,
  "durationTarget": number,
  "style": "fast" | "normal" | "detailed",
  "steps": [
    {
      "id": "step_1",
      "action": "open" | "tap" | "type" | "swipe" | "wait" | "scroll" | "select" | "submit" | "back",
      "target": "semantic_id",
      "value": "optional string for type/select/swipe direction",
      "duration": 320,
      "delayAfter": 120
    }
  ]
}

Style:
- fast: 3–6 highly visual steps, almost no waits
- normal: 5–8 steps
- detailed: up to 10–12 steps, still no fluff

Start with open on the startScreen unless already implied. Prefer tap + type + tap save over long navigation.`;

export async function planDemo(opts: {
  apiKey: string;
  prompt: string;
  productNotes?: string;
  durationTarget: number;
  style: DemoStyle;
  adapter: ProductAdapter;
}): Promise<{ bundle: DemoBundle; rawAi: unknown; repaired: string[]; dropped: string[] }> {
  const knowledge = compactProductKnowledge(opts.adapter.schema);
  const user = JSON.stringify(
    {
      userPrompt: opts.prompt,
      durationTargetSec: opts.durationTarget,
      style: opts.style,
      productNotes: (opts.productNotes || "").slice(0, 2500),
      productSchema: knowledge,
    },
    null,
    2
  );

  let rawAi: unknown = await openaiChatJson<unknown>(opts.apiKey, {
    model: "gpt-4o",
    temperature: opts.style === "fast" ? 0.4 : 0.7,
    maxTokens: 2200,
    system: PLANNER_SYSTEM,
    user,
  });

  const seed = makeSeed(opts.prompt);
  let repaired = repairDemoSpec(rawAi, opts.adapter.schema, {
    productId: opts.adapter.id,
    durationTarget: opts.durationTarget,
    style: opts.style,
    seed,
  });

  try {
    assertUsableDemo(repaired.spec, opts.adapter.schema);
  } catch {
    rawAi = await openaiChatJson<unknown>(opts.apiKey, {
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 2200,
      system: PLANNER_SYSTEM,
      user: `${user}\n\nPREVIOUS_OUTPUT_WAS_INVALID. Repair it. Only use these targets:\n${opts.adapter.schema.elements
        .map((e) => e.id)
        .join(", ")}`,
    });
    repaired = repairDemoSpec(rawAi, opts.adapter.schema, {
      productId: opts.adapter.id,
      durationTarget: opts.durationTarget,
      style: opts.style,
      seed,
    });
    assertUsableDemo(repaired.spec, opts.adapter.schema);
  }

  const spec: DemoSpec = {
    ...repaired.spec,
    durationTarget: opts.durationTarget,
    style: opts.style,
    productId: opts.adapter.id,
  };

  return {
    bundle: compileDemoBundle(spec, opts.adapter, { seed, rawAi }),
    rawAi,
    repaired: repaired.repaired,
    dropped: repaired.dropped,
  };
}

const VARIATIONS_SYSTEM = `You create marketing variations of an existing app demo.

Keep the SAME functional flow (same sequence of actions and targets).
Only change content: wording, example data, dates/times, scenario names.
Do NOT invent new features, screens, or targets.

Return JSON:
{
  "variations": [
    {
      "title": string,
      "goal": string,
      "steps": [ { "id", "action", "target", "value", "duration", "delayAfter" } ]
    }
  ]
}

Each variation MUST have the same number of steps and the same action+target sequence as the original. Only "value" (and titles) may change.`;

export async function planVariations(opts: {
  apiKey: string;
  count: number;
  source: DemoSpec;
  adapter: ProductAdapter;
}): Promise<DemoBundle[]> {
  const knowledge = compactProductKnowledge(opts.adapter.schema);
  const raw = await openaiChatJson<{ variations?: unknown[] }>(opts.apiKey, {
    model: "gpt-4o",
    temperature: 0.85,
    maxTokens: 3500,
    system: VARIATIONS_SYSTEM,
    user: JSON.stringify({
      count: opts.count,
      original: opts.source,
      productSchema: knowledge,
    }),
  });

  const items = Array.isArray(raw.variations) ? raw.variations : [];
  const originalFlow = opts.source.steps.map((s) => `${s.action}:${s.target || ""}`);
  const bundles: DemoBundle[] = [];

  for (let i = 0; i < items.length && bundles.length < opts.count; i += 1) {
    const repaired = repairDemoSpec(items[i], opts.adapter.schema, {
      productId: opts.adapter.id,
      durationTarget: opts.source.durationTarget,
      style: opts.source.style,
      seed: makeSeed(`${opts.source.id}:var:${i}`),
    });
    const flow = repaired.spec.steps.map((s) => `${s.action}:${s.target || ""}`);
    const same =
      flow.length === originalFlow.length &&
      flow.every((f, idx) => f === originalFlow[idx]);
    const spec: DemoSpec = same
      ? {
          ...repaired.spec,
          id: `demo_${makeSeed(`v${i}`)}`,
          style: opts.source.style,
          durationTarget: opts.source.durationTarget,
          productId: opts.adapter.id,
          feature: opts.source.feature,
          steps: repaired.spec.steps.map((step, idx) => ({
            ...opts.source.steps[idx],
            ...step,
            action: opts.source.steps[idx].action,
            target: opts.source.steps[idx].target,
            id: `step_${idx + 1}`,
          })),
        }
      : {
          ...opts.source,
          id: `demo_${makeSeed(`v${i}`)}`,
          title: repaired.spec.title || `${opts.source.title} ${i + 1}`,
          goal: repaired.spec.goal,
          steps: opts.source.steps.map((step, idx) => {
            const nextVal = repaired.spec.steps[idx]?.value;
            return nextVal ? { ...step, value: nextVal } : step;
          }),
        };
    try {
      assertUsableDemo(spec, opts.adapter.schema);
      bundles.push(
        compileDemoBundle(spec, opts.adapter, {
          seed: makeSeed(`${opts.source.id}:${i}`),
          rawAi: items[i],
          variationOf: opts.source.id,
        })
      );
    } catch {
      /* skip invalid variation */
    }
  }

  if (bundles.length === 0) {
    throw new Error("No se pudieron generar variaciones válidas.");
  }
  return bundles;
}
