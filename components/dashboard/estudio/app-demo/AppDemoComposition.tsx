"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  APP_DEMO_INTRO_FRAMES,
  compileAppDemo,
  snapshotFromCompile,
  type AppDemoProps,
  type AppDemoSpec,
} from "@/lib/creator/app-demo";
import { AppMiniApp } from "./AppMiniApp";

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex: string, alpha: number) {
  const { r, g, b } = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Backdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: -220,
          width: 900,
          height: 900,
          borderRadius: 9999,
          backgroundColor: mix(accent, 0.38),
        }}
      />
    </AbsoluteFill>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 180,
        top: 210,
        width: 720,
        height: 1420,
      }}
    >
      <div
        style={{
          width: 720,
          height: 1420,
          borderRadius: 78,
          backgroundColor: "#141418",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            width: 692,
            height: 1392,
            borderRadius: 66,
            backgroundColor: "#000",
            overflow: "hidden",
          }}
        >
          {children}
          <div
            style={{
              position: "absolute",
              top: 18,
              left: 246,
              width: 200,
              height: 38,
              borderRadius: 24,
              backgroundColor: "#09090b",
              zIndex: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 261,
              width: 170,
              height: 8,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.28)",
              zIndex: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function IntroOverlay({ spec }: { spec: AppDemoSpec }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const fadeOut = interpolate(
    frame,
    [APP_DEMO_INTRO_FRAMES - 10, APP_DEMO_INTRO_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const letter = (spec.appName.trim()[0] || "A").toUpperCase();
  if (frame >= APP_DEMO_INTRO_FRAMES) return null;

  return (
    <AbsoluteFill style={{ opacity: fadeOut, zIndex: 5 }}>
      <Backdrop accent={spec.accent} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 620,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 40,
            backgroundColor: spec.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${0.75 + mark * 0.25})`,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 68,
              fontWeight: 800,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
          >
            {letter}
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            color: "white",
            fontSize: 64,
            fontWeight: 800,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            textAlign: "center",
            paddingLeft: 64,
            paddingRight: 64,
          }}
        >
          {spec.appName}
        </div>
        <div
          style={{
            marginTop: 14,
            color: "rgba(255,255,255,0.7)",
            fontSize: 28,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            textAlign: "center",
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          {spec.tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function AppDemoFilm({ spec }: AppDemoProps) {
  const frame = useCurrentFrame();
  const compiled = useMemo(() => compileAppDemo(spec), [spec]);
  const snap = snapshotFromCompile(compiled, spec, frame);
  const introGone = interpolate(
    frame,
    [APP_DEMO_INTRO_FRAMES - 8, APP_DEMO_INTRO_FRAMES + 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <Backdrop accent={spec.accent} />
      <div style={{ opacity: introGone }}>
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            textAlign: "center",
            color: "rgba(255,255,255,0.55)",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
        >
          {spec.appName}
        </div>
        <Phone>
          <AppMiniApp
            spec={spec}
            state={snap.state}
            cursor={snap.cursor}
            playback
          />
        </Phone>
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 72,
            textAlign: "center",
            color: "white",
            fontSize: 32,
            fontWeight: 700,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
        >
          {snap.caption || spec.cta}
        </div>
      </div>
      <IntroOverlay spec={spec} />
    </AbsoluteFill>
  );
}
