import type {
  AppDemoSpec,
  AppAction,
  UiNode,
} from "@/lib/creator/app-demo";
import type {
  DemoAction,
  ProductActionDef,
  ProductFeature,
  ProductSchema,
  ProductScreen,
  UiElementType,
  UiTarget,
} from "./types";

function actionsFromAppAction(action: AppAction | undefined): DemoAction[] {
  if (!action || action.type === "none") return ["tap"];
  if (action.type === "back") return ["tap", "back"];
  if (action.type === "set") return ["tap", "type", "select"];
  return ["tap"];
}

function nodeType(node: UiNode): UiElementType {
  if (node.type === "button") return "button";
  if (node.type === "input") return "input";
  if (node.type === "toggle") return "toggle";
  if (node.type === "list") return "list";
  if (node.type === "cards") return "card";
  if (node.type === "tabs") return "tab";
  if (node.type === "navbar") return "navbar";
  if (node.type === "chip") return "chip";
  return "button";
}

function collectTargets(spec: AppDemoSpec): UiTarget[] {
  const out: UiTarget[] = [];
  const seen = new Set<string>();

  const push = (el: UiTarget) => {
    if (!el.id || seen.has(el.id)) return;
    seen.add(el.id);
    out.push(el);
  };

  for (const screen of spec.screens) {
    push({
      id: screen.id,
      type: "screen",
      label: screen.name || screen.id,
      screen: screen.id,
      actions: ["open"],
      testId: screen.id,
    });

    for (const node of screen.nodes) {
      if (node.type === "spacer" || node.type === "title" || node.type === "text") {
        continue;
      }
      if (node.type === "navbar") {
        push({
          id: node.id,
          type: "navbar",
          label: node.title,
          screen: screen.id,
          actions: ["open"],
          testId: node.id,
        });
        if (node.back) {
          push({
            id: `${node.id}-back`,
            type: "button",
            label: "Atrás",
            screen: screen.id,
            actions: ["tap", "back"],
            testId: `${node.id}-back`,
            bounds: { x: 0.04, y: 0.04, w: 0.12, h: 0.06 },
          });
        }
        continue;
      }
      if (node.type === "input") {
        push({
          id: node.id,
          type: "input",
          label: node.placeholder || node.id,
          screen: screen.id,
          actions: ["tap", "type"],
          bind: node.bind,
          testId: node.id,
          bounds: { x: 0.08, y: 0.28, w: 0.84, h: 0.08 },
        });
        continue;
      }
      if (node.type === "button") {
        push({
          id: node.id,
          type: "button",
          label: node.label,
          screen: screen.id,
          actions: actionsFromAppAction(node.action),
          testId: node.id,
          bounds: { x: 0.08, y: 0.78, w: 0.84, h: 0.08 },
        });
        continue;
      }
      if (node.type === "toggle") {
        push({
          id: node.id,
          type: "toggle",
          label: node.label,
          screen: screen.id,
          actions: ["tap", "select"],
          bind: node.bind,
          testId: node.id,
        });
        continue;
      }
      if (node.type === "list" || node.type === "cards") {
        push({
          id: node.id,
          type: node.type === "list" ? "list" : "card",
          label: node.id,
          screen: screen.id,
          actions: ["tap", "scroll", "swipe"],
          testId: node.id,
        });
        for (const item of node.items) {
          push({
            id: item.id,
            type: "card",
            label: item.title,
            screen: screen.id,
            actions: actionsFromAppAction(item.action),
            testId: item.id,
          });
        }
        continue;
      }
      if (node.type === "tabs") {
        for (const item of node.items) {
          push({
            id: item.id,
            type: "tab",
            label: item.label,
            screen: screen.id,
            actions: ["tap", "select"],
            bind: node.bind,
            testId: item.id,
          });
        }
      }
    }

    for (const hotspot of screen.hotspots) {
      push({
        id: hotspot.id,
        type: "button",
        label: hotspot.label,
        screen: screen.id,
        actions: actionsFromAppAction(hotspot.action),
        testId: hotspot.id,
        bounds: {
          x: hotspot.x / 100,
          y: hotspot.y / 100,
          w: hotspot.w / 100,
          h: hotspot.h / 100,
        },
      });
    }
  }

  for (const tab of spec.tabs) {
    push({
      id: tab.id,
      type: "tab",
      label: tab.label,
      screen: tab.screen,
      actions: ["tap", "open"],
      testId: tab.id,
      bounds: { x: 0.1, y: 0.93, w: 0.2, h: 0.06 },
    });
  }

  return out;
}

function screensFromSpec(spec: AppDemoSpec, elements: UiTarget[]): ProductScreen[] {
  return spec.screens.map((screen) => {
    const els = elements.filter((e) => e.screen === screen.id);
    const nav = new Set<string>();
    for (const node of screen.nodes) {
      if (node.type === "button" && node.action.type === "navigate") {
        nav.add(node.action.screen);
      }
      if (node.type === "navbar" && node.back?.type === "navigate") {
        nav.add(node.back.screen);
      }
      if ((node.type === "list" || node.type === "cards") && node.items) {
        for (const item of node.items) {
          if (item.action?.type === "navigate") nav.add(item.action.screen);
        }
      }
    }
    for (const h of screen.hotspots) {
      if (h.action.type === "navigate") nav.add(h.action.screen);
    }
    return {
      id: screen.id,
      name: screen.name || screen.id,
      description: screen.name || screen.id,
      availableElements: els.map((e) => e.id),
      possibleActions: Array.from(
        new Set(els.flatMap((e) => e.actions))
      ) as DemoAction[],
      navigationTargets: [...nav],
    };
  });
}

export function schemaFromAppDemoSpec(
  spec: AppDemoSpec,
  opts?: { id?: string; description?: string }
): ProductSchema {
  const elements = collectTargets(spec);
  const screens = screensFromSpec(spec, elements);
  const featureId = "core";
  const actionDefs: ProductActionDef[] = screens.map((screen) => ({
    id: `open_${screen.id}`,
    name: `Open ${screen.name}`,
    description: `Navigate to ${screen.name}`,
    inputs: [],
    result: screen.id,
    screens: [screen.id],
    targets: [screen.id],
  }));

  const feature: ProductFeature = {
    id: featureId,
    name: spec.appName || "App",
    description: spec.summary || spec.tagline || spec.appName || "Core app flows",
    availableActions: actionDefs.map((a) => a.id),
  };

  return {
    id: opts?.id || spec.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "app",
    name: spec.appName || "App",
    description:
      opts?.description ||
      spec.summary ||
      spec.tagline ||
      "Flows derived from the existing App Demo spec.",
    features: [feature],
    actions: actionDefs,
    screens,
    elements,
    startScreen: spec.startScreen || spec.screens[0]?.id || "home",
  };
}
