"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  DEFAULT_APP_DEMO,
  loadAppDemo,
  type AppDemoDraft,
} from "@/lib/creator/app-demo";
import {
  compileAppDemoCode,
  DEFAULT_APP_DEMO_CODE,
  type CompiledAppDemo,
} from "@/lib/creator/app-demo-code";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { AppDemoCodeDocs } from "./AppDemoCodeDocs";
import { AppDemoVariablesEditor } from "./AppDemoVariablesEditor";
import {
  AppDemoSaveControls,
  usePersistAppDemoDraft,
} from "./use-persist-app-demo";

const AppDemoCodePreview = dynamic(
  () => import("./AppDemoCodePreview").then((mod) => mod.AppDemoCodePreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-white/40">
        Cargando preview…
      </div>
    ),
  }
);

const AppDemoCodeEditor = dynamic(
  () => import("./AppDemoCodeEditor").then((mod) => mod.AppDemoCodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-white/40">
        Cargando editor…
      </div>
    ),
  }
);

function slugName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "app"
  );
}

async function saveToGallery(
  projectId: string,
  blob: Blob,
  fileName: string
) {
  const list = await fetch(`/api/projects/${projectId}/gallery?all=1`);
  const data = await list.json();
  if (!list.ok) throw new Error(data.error || "No se pudo leer la galería");
  const folders = (data.allFolders ?? []) as {
    id: string;
    name: string;
    parentId: string | null;
    systemKey?: string | null;
  }[];
  let folderId =
    folders.find((f) => f.systemKey === "app-demo")?.id ??
    folders.find((f) => f.name === "App Demo" && !f.parentId)?.id;
  if (!folderId) {
    const created = await fetch(`/api/projects/${projectId}/gallery/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "App Demo" }),
    });
    const createdData = await created.json();
    if (!created.ok) throw new Error(createdData.error || "No se pudo crear carpeta");
    folderId = createdData.folder.id as string;
  }
  const supabase = createClient();
  const storagePath = `${projectId}/${crypto.randomUUID()}-${fileName}`;
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(storagePath, blob, { contentType: "video/mp4", upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(storagePath);
  const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderId,
      files: [
        {
          name: fileName,
          mimeType: "video/mp4",
          sizeBytes: blob.size,
          storagePath,
          publicUrl: pub.publicUrl,
        },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "No se pudo guardar");
}

export function AppDemoCodeStudio({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [draft, setDraft] = useState<AppDemoDraft>({
    ...DEFAULT_APP_DEMO,
    source: "code",
    code: DEFAULT_APP_DEMO_CODE,
    phoneFrame: true,
  });
  const [compiled, setCompiled] = useState<CompiledAppDemo | null>(null);
  const [codeError, setCodeError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const { saveNow, saveStatus } = usePersistAppDemoDraft(
    projectId,
    draft,
    loadedId
  );

  useEffect(() => {
    const loaded = loadAppDemo(projectId);
    setDraft({
      ...loaded,
      source: "code",
      code: loaded.code.trim() || DEFAULT_APP_DEMO_CODE,
      phoneFrame: loaded.phoneFrame !== false,
      variables: loaded.variables,
    });
    setLoadedId(projectId);
  }, [projectId]);

  useEffect(() => {
    const source = draft.code.trim() || DEFAULT_APP_DEMO_CODE;
    const id = window.setTimeout(() => {
      try {
        const compiledNext = compileAppDemoCode(source, {
          phoneFrame: draft.phoneFrame,
          variables: draft.variables,
        });
        setCompiled(compiledNext);
        setCodeError("");
        if (compiledNext.variables !== draft.variables) {
          setDraft((prev) => ({ ...prev, variables: compiledNext.variables }));
        }
      } catch (err) {
        setCodeError(
          err instanceof Error ? err.message : "No se pudo compilar el código"
        );
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [draft.code, draft.phoneFrame, draft.variables]);

  async function exportVideo() {
    if (exporting) return;
    saveNow();
    setExporting(true);
    setProgress(0);
    setStatus("");
    try {
      const { exportAppDemoCodeVideo } = await import("./export-app-demo");
      const source = draft.code.trim() || DEFAULT_APP_DEMO_CODE;
      const current = compileAppDemoCode(source, {
        phoneFrame: draft.phoneFrame,
        variables: draft.variables,
      });
      const blob = await exportAppDemoCodeVideo(current, setProgress);
      const fileName = `app-demo-${slugName(
        String(current.inputProps.appName || "codigo")
      )}.mp4`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      await saveToGallery(projectId, blob, fileName);
      setStatus("Video exportado y guardado en Galería › App Demo");
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }

  const backHref = `/projects/${projectId}?view=studio`;

  return (
    <div className="flex h-dvh flex-col bg-[#0b0c10] text-white">
      <header
        title={projectName}
        className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-2"
      >
        <Link
          href={backHref}
          className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] text-white/40 hover:bg-white/[0.06] hover:text-white"
          onClick={() => saveNow()}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Estudio</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <AppDemoCodeDocs tone="dark" />
          <AppDemoSaveControls
            tone="dark"
            saveStatus={saveStatus}
            onSave={saveNow}
          />
          <button
            type="button"
            className="ui-btn-primary !px-3 !py-1 !text-[12px]"
            onClick={() => void exportVideo()}
            disabled={exporting}
          >
            {exporting ? `${progress}%` : "Exportar"}
          </button>
        </div>
      </header>

      {status ? (
        <p className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-[12px] text-emerald-300">
          {status}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(220px,32vh)_minmax(0,1fr)_minmax(280px,42vh)] lg:grid-rows-none lg:grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.86fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/[0.06] bg-[#17181c] lg:border-b-0 lg:border-r lg:border-white/[0.06]">
          <AppDemoVariablesEditor
            layout="sidebar"
            tone="dark"
            projectId={projectId}
            variables={draft.variables}
            onChange={(variables) =>
              setDraft((prev) => ({ ...prev, variables }))
            }
          />
        </aside>

        <div className="flex min-h-0 flex-col border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          <div className="flex h-8 shrink-0 items-center justify-between px-3">
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/55">
              AppDemo.tsx
            </span>
            <button
              type="button"
              className="text-[11px] text-white/35 hover:text-white"
              onClick={() =>
                setDraft((prev) => ({ ...prev, code: DEFAULT_APP_DEMO_CODE }))
              }
            >
              Plantilla
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AppDemoCodeEditor
              tone="dark"
              value={draft.code}
              onChange={(code) => setDraft((prev) => ({ ...prev, code }))}
            />
          </div>
          {codeError ? (
            <p className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-300">
              {codeError}
            </p>
          ) : compiled ? (
            <p className="border-t border-white/[0.05] px-3 py-1.5 text-[10px] text-white/28">
              {compiled.width}×{compiled.height} · {compiled.fps} fps ·{" "}
              {(compiled.durationInFrames / compiled.fps).toFixed(1)}s
            </p>
          ) : null}
        </div>

        <div
          className={`relative flex min-h-0 flex-col ${
            draft.phoneFrame
              ? draft.canvasTheme === "light"
                ? "app-demo-canvas-light"
                : "app-demo-canvas"
              : "bg-[#09090b]"
          }`}
        >
          {draft.phoneFrame ? (
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  canvasTheme: prev.canvasTheme === "light" ? "dark" : "light",
                }))
              }
              className={`absolute right-3 top-3 z-10 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ${
                draft.canvasTheme === "light"
                  ? "bg-white/90 text-[#111827] hover:bg-white"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              {draft.canvasTheme === "light" ? "Fondo oscuro" : "Fondo claro"}
            </button>
          ) : null}
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div
              className={`h-full max-h-full w-auto max-w-full overflow-hidden ${
                draft.phoneFrame
                  ? "aspect-[9/16] bg-transparent"
                  : "aspect-[9/16] rounded-xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              }`}
            >
              {compiled ? (
                <AppDemoCodePreview compiled={compiled} />
              ) : (
                <div
                  className={`flex h-full items-center justify-center text-[13px] ${
                    draft.phoneFrame && draft.canvasTheme === "light"
                      ? "text-[#6b7280]"
                      : "text-white/35"
                  }`}
                >
                  El preview aparece aquí
                </div>
              )}
            </div>
          </div>
          <div
            className={`flex h-8 shrink-0 items-center justify-center gap-3 border-t text-[10px] tracking-wide ${
              draft.phoneFrame && draft.canvasTheme === "light"
                ? "border-black/[0.08] text-[#6b7280]"
                : "border-white/[0.05] text-white/28"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({ ...prev, phoneFrame: !prev.phoneFrame }))
              }
              className={`rounded-md px-2 py-0.5 font-semibold ${
                draft.phoneFrame
                  ? draft.canvasTheme === "light"
                    ? "bg-black/[0.08] text-[#111827]"
                    : "bg-white/[0.1] text-white"
                  : "text-white/35 hover:text-white"
              }`}
            >
              iPhone
            </button>
            <span>
              {draft.phoneFrame ? "Marco" : "1080×1920"}
              {exporting ? ` · ${progress}%` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
