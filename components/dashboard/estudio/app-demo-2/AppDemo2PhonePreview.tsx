"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  type AppCursor,
  type AppDemoSpec,
  type AppRuntimeState,
} from "@/lib/creator/app-demo";
import { AppMiniApp } from "../app-demo/AppMiniApp";

class PreviewErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: string }
> {
  state = { error: "" };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "La app falló" };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: "" });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-[12px] leading-relaxed text-[#b91c1c]">
          {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppDemo2PhonePreview({
  spec,
  state,
  cursor,
}: {
  spec: AppDemoSpec;
  state: AppRuntimeState;
  cursor?: AppCursor | null;
}) {
  const resetKey = `${spec.appName}:${state.screen}`;
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div
        className="relative mx-auto aspect-[393/852] w-full overflow-hidden rounded-[40px] border-[10px] border-[#1f2937] bg-white shadow-[0_18px_50px_rgba(17,24,39,0.18)]"
        data-testid="app_demo_2_phone"
      >
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-5 w-[108px] -translate-x-1/2 rounded-full bg-[#111827]" />
        <div className="absolute inset-0 overflow-hidden">
          <PreviewErrorBoundary resetKey={resetKey}>
            <AppMiniApp spec={spec} state={state} cursor={cursor} playback />
          </PreviewErrorBoundary>
        </div>
      </div>
    </div>
  );
}
