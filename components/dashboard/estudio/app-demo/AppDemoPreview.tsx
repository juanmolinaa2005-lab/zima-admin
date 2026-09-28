"use client";

import { Player } from "@remotion/player";
import {
  APP_DEMO_FPS,
  APP_DEMO_HEIGHT,
  APP_DEMO_WIDTH,
  appDemoDurationFrames,
  type AppDemoProps,
} from "@/lib/creator/app-demo";
import { AppDemoFilm } from "./AppDemoComposition";

export function AppDemoPreview({ props }: { props: AppDemoProps }) {
  const durationInFrames = appDemoDurationFrames(props.spec);

  return (
    <Player
      key={`${props.spec.kind}-${props.spec.screens.length}-${props.spec.demo.length}`}
      component={AppDemoFilm}
      inputProps={props}
      durationInFrames={durationInFrames}
      compositionWidth={APP_DEMO_WIDTH}
      compositionHeight={APP_DEMO_HEIGHT}
      fps={APP_DEMO_FPS}
      className="app-demo-player"
      style={{ width: "100%", height: "100%" }}
      controls
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
