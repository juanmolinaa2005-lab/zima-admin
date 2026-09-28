import type { ComponentType } from "react";
import * as React from "react";
import { transform } from "sucrase";
import {
  appDemoVarsToProps,
  mergeVariablesFromCode,
  type AppDemoVariable,
} from "@/lib/creator/app-demo";

export type CompiledAppUi = {
  component: ComponentType<Record<string, unknown>>;
  key: string;
  inputProps: Record<string, unknown>;
  variables: AppDemoVariable[];
};

export const DEFAULT_APP_DEMO_2_VARIABLES: AppDemoVariable[] = [
  { id: "appName", key: "appName", type: "text", value: "Cal AI" },
  { id: "accent", key: "accent", type: "color", value: "#111827" },
  { id: "foodName", key: "foodName", type: "text", value: "Avocado toast" },
  { id: "calories", key: "calories", type: "text", value: "420" },
  { id: "protein", key: "protein", type: "text", value: "14 g" },
  { id: "carbs", key: "carbs", type: "text", value: "28 g" },
  { id: "fat", key: "fat", type: "text", value: "22 g" },
];

export const DEFAULT_APP_DEMO_2_CODE = `import { useState } from "react";

export const variables = {
  appName: "Cal AI",
  accent: "#111827",
  foodName: "Avocado toast",
  calories: "420",
  protein: "14 g",
  carbs: "28 g",
  fat: "22 g",
};

export default function App({
  appName = vars.appName,
  accent = vars.accent,
  foodName = vars.foodName,
  calories = vars.calories,
  protein = vars.protein,
  carbs = vars.carbs,
  fat = vars.fat,
}) {
  const [screen, setScreen] = useState("home");

  return (
    <div
      style={{
        height: "100%",
        background: "#fafafa",
        color: "#111827",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "54px 22px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>
          {appName}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.6,
          }}
        >
          {screen === "home" ? "Scan a meal" : foodName}
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 22px 24px" }}>
        {screen === "home" ? (
          <button
            type="button"
            onClick={() => setScreen("result")}
            style={{
              width: "100%",
              height: 220,
              border: "none",
              borderRadius: 28,
              background: accent,
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Scan food
          </button>
        ) : (
          <div
            style={{
              borderRadius: 28,
              background: "#fff",
              padding: 22,
              boxShadow: "0 10px 40px rgba(17,24,39,0.06)",
            }}
          >
            <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>
              Calories
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1.4 }}>
              {calories}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginTop: 18,
              }}
            >
              {[
                ["Protein", protein],
                ["Carbs", carbs],
                ["Fat", fat],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 16,
                    padding: "12px 10px",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{label}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setScreen("home")}
              style={{
                marginTop: 18,
                width: "100%",
                border: "none",
                borderRadius: 16,
                padding: 14,
                background: accent,
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Scan another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`;

const ALLOWED_IMPORTS = new Set(["react", "react/jsx-runtime"]);

const IMPORT_RE =
  /^\s*import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;

function stripImports(source: string) {
  const matches = [...source.matchAll(IMPORT_RE)];
  for (const match of matches) {
    const mod = match[1];
    if (!ALLOWED_IMPORTS.has(mod)) {
      throw new Error(`No se puede importar "${mod}". Solo "react".`);
    }
  }
  return source.replace(IMPORT_RE, "").trim();
}

function injectBindings(varsJson: string) {
  const reactHooks = [
    "useState",
    "useEffect",
    "useMemo",
    "useRef",
    "useCallback",
    "useId",
    "useReducer",
    "Fragment",
    "createElement",
  ]
    .map((key) => `var ${key} = React.${key};`)
    .join("\n");
  return `${reactHooks}\nvar vars = ${varsJson};\n`;
}

function asComponent(
  value: unknown
): ComponentType<Record<string, unknown>> | null {
  if (typeof value === "function") {
    return value as ComponentType<Record<string, unknown>>;
  }
  return null;
}

function fingerprint(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export function compileAppUiCode(
  source: string,
  options?: { variables?: AppDemoVariable[] }
): CompiledAppUi {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("Escribe el código de la app.");
  if (trimmed.length > 80_000) {
    throw new Error("El código es demasiado largo (máx. 80 KB).");
  }

  const variables = mergeVariablesFromCode(options?.variables ?? [], trimmed);
  const inputProps = appDemoVarsToProps(variables);
  const varsJson = JSON.stringify(inputProps.vars ?? {});
  const withoutImports = stripImports(trimmed);
  let compiled: string;
  try {
    compiled = transform(withoutImports, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      production: true,
    }).code;
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Syntax error: ${err.message}` : "No se pudo compilar"
    );
  }

  const module = { exports: {} as Record<string, unknown> };
  const requireStub = (name: string) => {
    if (name === "react" || name === "react/jsx-runtime") return React;
    throw new Error(`No se puede importar "${name}".`);
  };

  try {
    const run = new Function(
      "React",
      "exports",
      "module",
      "require",
      `${injectBindings(varsJson)}\n${compiled}\n`
    );
    run(React, module.exports, module, requireStub);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "El código falló al ejecutarse"
    );
  }

  const exported = module.exports;
  const inner =
    asComponent(exported.default) ||
    asComponent(exported.App) ||
    Object.values(exported)
      .map(asComponent)
      .find(Boolean);

  if (!inner) {
    throw new Error("Exporta un componente: export default function App() { ... }");
  }

  return {
    component: inner,
    key: `${trimmed.length}:${fingerprint(trimmed)}`,
    inputProps,
    variables,
  };
}
