"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_APP_DEMO_VARIABLES,
  loadAppDemo,
  type AppDemoDraft,
} from "@/lib/creator/app-demo";
import {
  compileAppDemoCode,
  DEFAULT_APP_DEMO_CODE,
  type CompiledAppDemo,
} from "@/lib/creator/app-demo-code";
import { AppDemoVideosPanel } from "./app-demo/AppDemoVideosPanel";
import { usePersistAppDemoDraft } from "./app-demo/use-persist-app-demo";
import { StudioPage } from "./studio-ui";

const AppDemoCodePreview = dynamic(
  () =>
    import("./app-demo/AppDemoCodePreview").then(
      (mod) => mod.AppDemoCodePreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-white/40">
        Cargando video…
      </div>
    ),
  }
);

export function AppDemoHome({ projectId }: { projectId: string }) {
  const [draft, setDraft] = useState<AppDemoDraft>({
    appName: "",
    tagline: "",
    cta: "Descarga la app",
    accent: "#6366f1",
    notes: "",
    kindHint: "auto",
    source: "code",
    code: DEFAULT_APP_DEMO_CODE,
    phoneFrame: true,
    canvasTheme: "dark",
    variables: DEFAULT_APP_DEMO_VARIABLES,
    screens: [],
    spec: null,
  });
  const [compiled, setCompiled] = useState<CompiledAppDemo | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const { saveNow } = usePersistAppDemoDraft(projectId, draft, loadedId);

  useEffect(() => {
    const loaded = loadAppDemo(projectId);
    setDraft({
      ...loaded,
      source: "code",
      code: loaded.code.trim() || DEFAULT_APP_DEMO_CODE,
      phoneFrame: loaded.phoneFrame !== false,
      canvasTheme: loaded.canvasTheme === "light" ? "light" : "dark",
      variables: loaded.variables,
    });
    setLoadedId(projectId);
  }, [projectId]);

  useEffect(() => {
    const source = draft.code.trim() || DEFAULT_APP_DEMO_CODE;
    const id = window.setTimeout(() => {
      try {
        setCompiled(
          compileAppDemoCode(source, {
            phoneFrame: draft.phoneFrame,
            variables: draft.variables,
          })
        );
      } catch {
        setCompiled(null);
      }
    }, 200);
    return () => window.clearTimeout(id);
  }, [draft.code, draft.phoneFrame, draft.variables]);

  const canvasLight = draft.phoneFrame && draft.canvasTheme === "light";

  return (
    <StudioPage
      kicker="Piezas"
      title="Demo de app"
      description="La pantalla que se ve en el video. Grábala aquí; luego se pega después del hook."
      actions={
        <Link
          href={`/projects/${projectId}/app-demo`}
          onClick={() => saveNow()}
          className="ui-btn-secondary"
        >
          Abrir editor
        </Link>
      }
    >

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AppDemoVideosPanel projectId={projectId} />
        <div
          className={`rounded-xl p-3 ${
            canvasLight ? "app-demo-canvas-light" : "app-demo-canvas"
          }`}
        >
          <div
            className={`mx-auto aspect-[9/16] w-full overflow-hidden ${
              draft.phoneFrame ? "bg-transparent" : "rounded-xl bg-black"
            }`}
          >
            {compiled ? (
              <AppDemoCodePreview compiled={compiled} />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-white/40">
                El video aparece aquí
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioPage>
  );
}
