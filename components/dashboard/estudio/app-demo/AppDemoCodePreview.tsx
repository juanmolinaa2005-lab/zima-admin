"use client";

import { Player } from "@remotion/player";
import type { CompiledAppDemo } from "@/lib/creator/app-demo-code";

export function AppDemoCodePreview({ compiled }: { compiled: CompiledAppDemo }) {
  return (
    <Player
      key={compiled.key}
      component={compiled.component}
      durationInFrames={compiled.durationInFrames}
      compositionWidth={compiled.width}
      compositionHeight={compiled.height}
      fps={compiled.fps}
      className="app-demo-player"
      style={{ width: "100%", height: "100%", background: "transparent" }}
      inputProps={compiled.inputProps}
      controls
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
