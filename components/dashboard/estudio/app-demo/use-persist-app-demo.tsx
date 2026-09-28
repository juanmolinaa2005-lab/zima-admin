"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAppDemo, type AppDemoDraft } from "@/lib/creator/app-demo";

export type AppDemoSaveStatus = "saved" | "saving" | "unsaved";

export function usePersistAppDemoDraft(
  projectId: string,
  draft: AppDemoDraft,
  loadedId: string
) {
  const [saveStatus, setSaveStatus] = useState<AppDemoSaveStatus>("saved");
  const draftRef = useRef(draft);
  const boundId = useRef(loadedId);
  const hydrated = useRef(false);
  draftRef.current = draft;
  boundId.current = loadedId;

  const saveNow = useCallback(() => {
    if (!boundId.current) return;
    setSaveStatus("saving");
    saveAppDemo(boundId.current, draftRef.current);
    setSaveStatus("saved");
  }, []);

  useEffect(() => {
    if (!loadedId || loadedId !== projectId) {
      hydrated.current = false;
      return;
    }
    if (!hydrated.current) {
      hydrated.current = true;
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("unsaved");
    const id = window.setTimeout(() => {
      setSaveStatus("saving");
      saveAppDemo(projectId, draft);
      setSaveStatus("saved");
    }, 700);
    return () => window.clearTimeout(id);
  }, [projectId, draft, loadedId]);

  useEffect(() => {
    const flush = () => {
      if (!boundId.current) return;
      saveAppDemo(boundId.current, draftRef.current);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      saveNow();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("keydown", onKey);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("keydown", onKey);
    };
  }, [saveNow]);

  return { saveNow, saveStatus };
}

export function AppDemoSaveControls({
  saveStatus,
  onSave,
  tone = "light",
}: {
  saveStatus: AppDemoSaveStatus;
  onSave: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const label =
    saveStatus === "saving"
      ? "Guardando…"
      : saveStatus === "unsaved"
        ? "Sin guardar"
        : "Guardado";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`hidden text-[11px] sm:inline ${
          saveStatus === "unsaved"
            ? dark
              ? "text-amber-300"
              : "text-[#b45309]"
            : dark
              ? "text-white/40"
              : "text-[#9ca3af]"
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onSave}
        className={
          dark
            ? "rounded-md px-2 py-1 text-[12px] font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
            : "ui-btn-secondary"
        }
      >
        Guardar
      </button>
    </div>
  );
}
