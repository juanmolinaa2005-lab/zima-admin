"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveAppDemo2,
  type AppDemo2Workspace,
} from "@/lib/creator/app-demo-2/persist";
import {
  AppDemoSaveControls,
  type AppDemoSaveStatus,
} from "../app-demo/use-persist-app-demo";

export type { AppDemoSaveStatus };
export { AppDemoSaveControls };

export function usePersistAppDemo2(
  projectId: string,
  draft: AppDemo2Workspace,
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
    saveAppDemo2(boundId.current, draftRef.current);
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
      saveAppDemo2(projectId, draft);
      setSaveStatus("saved");
    }, 700);
    return () => window.clearTimeout(id);
  }, [projectId, draft, loadedId]);

  useEffect(() => {
    const flush = () => {
      if (!boundId.current) return;
      saveAppDemo2(boundId.current, draftRef.current);
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
