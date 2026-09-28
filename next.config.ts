import type { NextConfig } from "next";

const mediaTrace = [
  "./node_modules/ffmpeg-static/**/*",
  "./node_modules/@napi-rs/canvas/**/*",
  "./lib/creator/fonts/**/*",
];

const nextConfig: NextConfig = {
  cacheMaxMemorySize: 0,
  transpilePackages: [
    "remotion",
    "@remotion/player",
    "@remotion/web-renderer",
    "sucrase",
    "@monaco-editor/react",
    "monaco-editor",
  ],
  serverExternalPackages: ["ffmpeg-static", "undici", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/projects/*/creator/ingest": mediaTrace,
    "/api/projects/*/creator/influencers/*/videos": mediaTrace,
    "/api/projects/[id]/creator/influencers/[influencerId]/videos": mediaTrace,
    "/api/projects/*/creator/influencers-v2/*": mediaTrace,
    "/api/cron/estudio-images": mediaTrace,
    "/api/cron/video-autopilot": mediaTrace,
    "/api/projects/*/creator/video-autopilot": mediaTrace,
    "/api/webhooks/fal-autopilot": mediaTrace,
    "/api/projects/*/creator/blitz/generate": mediaTrace,
    "/api/projects/[id]/creator/blitz/generate": mediaTrace,
    "/api/projects/*/creator/dynamics/analyze": [
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/projects/[id]/creator/dynamics/analyze": [
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/projects/*/creator/dynamics/clip": [
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/projects/[id]/creator/dynamics/clip": [
      "./node_modules/ffmpeg-static/**/*",
    ],
  },
};

export default nextConfig;
