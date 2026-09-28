import type { ComponentType } from "react";
import * as React from "react";
import * as Remotion from "remotion";
import { transform } from "sucrase";
import {
  APP_DEMO_FPS,
  APP_DEMO_HEIGHT,
  APP_DEMO_WIDTH,
  appDemoVarsToProps,
  mergeVariablesFromCode,
  type AppDemoVariable,
} from "@/lib/creator/app-demo";
import { wrapAppDemoPhoneFrame } from "@/lib/creator/app-demo-phone";

export type CompiledAppDemo = {
  component: ComponentType<Record<string, unknown>>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  key: string;
  inputProps: Record<string, unknown>;
  variables: AppDemoVariable[];
};

export const DEFAULT_APP_DEMO_CODE = `import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const durationInFrames = 180;
export const fps = 30;
export const width = 1080;
export const height = 1920;

export const variables = {
  appName: "Mi app",
  tagline: "Mira cómo funciona",
  accent: "#6366f1",
  cta: "Descarga la app",
  photo: "",
};

export default function AppDemo({
  appName = vars.appName,
  tagline = vars.tagline,
  accent = vars.accent,
  cta = vars.cta,
  photo = vars.photo,
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const screen = frame < 70 ? "home" : frame < 130 ? "detalle" : "listo";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        padding: 48,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}>
        {appName}
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: -1,
          transform: \`translateY(\${(1 - enter) * 24}px)\`,
          opacity: enter,
        }}
      >
        {screen === "home"
          ? "Home"
          : screen === "detalle"
            ? "Detalle"
            : "Listo"}
      </div>
      <div style={{ marginTop: 14, fontSize: 22, color: "#6b7280" }}>
        {tagline}
      </div>
      {photo ? (
        <Img
          src={photo}
          style={{
            marginTop: 36,
            width: "100%",
            height: 420,
            objectFit: "cover",
            borderRadius: 28,
          }}
        />
      ) : null}
      <div
        style={{
          marginTop: 36,
          height: 64,
          borderRadius: 18,
          backgroundColor: accent,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 20,
          opacity: interpolate(frame, [20, 40], [0.45, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
}
`;

const ALLOWED_IMPORTS = new Set(["remotion", "react", "react/jsx-runtime"]);

const IMPORT_RE =
  /^\s*import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;

const RESERVED = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "await",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
]);

function stripImports(source: string) {
  const matches = [...source.matchAll(IMPORT_RE)];
  for (const match of matches) {
    const mod = match[1];
    if (!ALLOWED_IMPORTS.has(mod)) {
      throw new Error(
        `No se puede importar "${mod}". Solo "remotion" y "react".`
      );
    }
  }
  return source.replace(IMPORT_RE, "").trim();
}

function injectBindings(varsJson: string) {
  const remotion = Object.keys(Remotion)
    .filter(
      (key) =>
        /^[A-Za-z_$][\w$]*$/.test(key) &&
        !RESERVED.has(key) &&
        key !== "__esModule"
    )
    .map((key) => `var ${key} = Remotion[${JSON.stringify(key)}];`)
    .join("\n");
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
  return `${remotion}\n${reactHooks}\nvar vars = ${varsJson};\n`;
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

function clampMeta(n: unknown, fallback: number, min: number, max: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function compileAppDemoCode(
  source: string,
  options?: { phoneFrame?: boolean; variables?: AppDemoVariable[] }
): CompiledAppDemo {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("Pega o escribe el código de la composición.");
  if (trimmed.length > 80000) {
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
    if (name === "remotion") return Remotion;
    throw new Error(`No se puede importar "${name}".`);
  };

  try {
    const run = new Function(
      "React",
      "Remotion",
      "exports",
      "module",
      "require",
      `${injectBindings(varsJson)}\n${compiled}\n`
    );
    run(React, Remotion, module.exports, module, requireStub);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "El código falló al ejecutarse"
    );
  }

  const exported = module.exports;
  const inner =
    asComponent(exported.default) ||
    asComponent(exported.AppDemo) ||
    asComponent(exported.MyComposition) ||
    asComponent(exported.Composition) ||
    Object.values(exported)
      .map(asComponent)
      .find(Boolean);

  if (!inner) {
    throw new Error(
      "Exporta un componente: export default function AppDemo() { ... }"
    );
  }

  const innerWidth = clampMeta(exported.width, APP_DEMO_WIDTH, 320, 1920);
  const innerHeight = clampMeta(exported.height, APP_DEMO_HEIGHT, 320, 1920);
  const phoneFrame = options?.phoneFrame !== false;
  const component = phoneFrame
    ? wrapAppDemoPhoneFrame(inner, innerWidth, innerHeight)
    : inner;

  return {
    component,
    durationInFrames: clampMeta(
      exported.durationInFrames,
      180,
      30,
      APP_DEMO_FPS * 60
    ),
    fps: clampMeta(exported.fps, APP_DEMO_FPS, 12, 60),
    width: phoneFrame ? APP_DEMO_WIDTH : innerWidth,
    height: phoneFrame ? APP_DEMO_HEIGHT : innerHeight,
    key: `${trimmed.length}:${phoneFrame ? "phone" : "raw"}:${fingerprint(varsJson)}:${trimmed.slice(0, 16)}`,
    inputProps,
    variables,
  };
}

