"use client";

import type { ComponentType } from "react";
import {
  APP_DEMO_FPS,
  APP_DEMO_HEIGHT,
  APP_DEMO_WIDTH,
  appDemoDurationFrames,
  type AppDemoProps,
} from "@/lib/creator/app-demo";
import type { CompiledAppDemo } from "@/lib/creator/app-demo-code";
import { AppDemoFilm } from "./AppDemoComposition";

async function renderBlob(
  options: {
    component: ComponentType<Record<string, unknown>>;
    durationInFrames: number;
    width: number;
    height: number;
    fps: number;
    inputProps?: Record<string, unknown>;
    defaultProps?: Record<string, unknown>;
  },
  onProgress: (percent: number) => void,
  signal?: AbortSignal
) {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import(
    "@remotion/web-renderer"
  );

  const check = await canRenderMediaOnWeb({
    width: options.width,
    height: options.height,
    muted: true,
    container: "mp4",
  });

  if (!check.canRender) {
    const detail = check.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(
      detail ||
        "Este navegador no puede exportar el video. Usa Chrome o Edge reciente."
    );
  }

  const result = await renderMediaOnWeb({
    composition: {
      id: "AppDemo",
      component: options.component,
      width: options.width,
      height: options.height,
      fps: options.fps,
      durationInFrames: options.durationInFrames,
      defaultProps: options.defaultProps ?? {},
    },
    inputProps: options.inputProps ?? {},
    muted: true,
    container: "mp4",
    signal: signal ?? null,
    onProgress: (progress) => {
      onProgress(Math.round((progress.progress ?? 0) * 100));
    },
  });

  return result.getBlob();
}

export async function exportAppDemoVideo(
  props: AppDemoProps,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
) {
  const durationInFrames = appDemoDurationFrames(props.spec);
  return renderBlob(
    {
      component: AppDemoFilm as ComponentType<Record<string, unknown>>,
      durationInFrames,
      width: APP_DEMO_WIDTH,
      height: APP_DEMO_HEIGHT,
      fps: APP_DEMO_FPS,
      inputProps: props,
      defaultProps: props,
    },
    onProgress,
    signal
  );
}

export async function exportAppDemoCodeVideo(
  compiled: CompiledAppDemo,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
) {
  return renderBlob(
    {
      component: compiled.component as ComponentType<Record<string, unknown>>,
      durationInFrames: compiled.durationInFrames,
      width: compiled.width,
      height: compiled.height,
      fps: compiled.fps,
      inputProps: compiled.inputProps,
      defaultProps: compiled.inputProps,
    },
    onProgress,
    signal
  );
}
