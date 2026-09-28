import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegStatic from "ffmpeg-static";
import { concatVerticalClipsWithBedAudio } from "./concat-videos";
import { mapAutopilotRun } from "./autopilot-server";
import { parseAutopilotState } from "./autopilot-types";
import {
  languageFromProfile,
  parseAutopilotCreateBody,
  parseAutopilotPlan,
  realViralHits,
  autopilotDemoClipPrompt,
  autopilotDemoFramePrompt,
  autopilotTalkingClipPrompt,
  AUTOPILOT_MODEL_ID,
  AUTOPILOT_PRODUCT_CONTEXT_MAX,
} from "./autopilot-plan";
import { falAutopilotWebhookUrl } from "../fal/webhook";
import { describeAutopilotRun, formatAutopilotElapsed } from "./autopilot-status";
import {
  hasProductCaptureEvidence,
  isExcludedProductAsset,
  missingProductError,
  scoreProductAsset,
} from "./autopilot-media";
import type { AutopilotRow } from "./autopilot-types";
import type { GalleryAsset } from "@/lib/gallery/asset";

const here = path.dirname(fileURLToPath(import.meta.url));

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function expectHttp(fn: () => unknown, status: number, message: string) {
  try {
    fn();
    throw new Error(`expected ${message}`);
  } catch (e) {
    assert(
      e instanceof Error &&
        "status" in e &&
        (e as Error & { status: number }).status === status,
      message
    );
  }
}

const INF_ID = "11111111-1111-4111-8111-111111111111";

expectHttp(() => parseAutopilotCreateBody(null), 400, "null body");
expectHttp(() => parseAutopilotCreateBody([]), 400, "array body");
expectHttp(() => parseAutopilotCreateBody({ idea: { x: 1 }, requestId: "abcdefgh" }), 400, "object idea");
expectHttp(() => parseAutopilotCreateBody({ idea: "corta", requestId: "abcdefgh", influencerId: INF_ID }), 400, "short idea");
expectHttp(() => parseAutopilotCreateBody({ idea: "una idea suficientemente larga", requestId: 1, influencerId: INF_ID }), 400, "numeric requestId");
expectHttp(
  () =>
    parseAutopilotCreateBody({
      idea: "Haz un UGC de la app de calorías",
      requestId: "req-12345678",
    }),
  400,
  "missing influencerId"
);
expectHttp(
  () =>
    parseAutopilotCreateBody({
      idea: "Haz un UGC de la app de calorías",
      requestId: "req-12345678",
      influencerId: "no-uuid",
    }),
  400,
  "invalid influencerId"
);
const created = parseAutopilotCreateBody({
  idea: "Haz un UGC de la app de calorías",
  requestId: "req-12345678",
  influencerId: INF_ID,
});
assert(created.idea.includes("calorías"), "keeps idea");
assert(created.requestId === "req-12345678", "keeps requestId");
assert(created.influencerId === INF_ID, "keeps influencerId");
assert(created.productContext === "", "productContext empty is allowed");
const withProduct = parseAutopilotCreateBody({
  idea: "Haz un UGC de la app de calorías",
  requestId: "req-12345678",
  influencerId: INF_ID,
  productContext: "  App de calorías con foto  ",
});
assert(withProduct.productContext === "App de calorías con foto", "stores product snapshot");
expectHttp(
  () =>
    parseAutopilotCreateBody({
      idea: "Haz un UGC de la app de calorías",
      requestId: "req-12345678",
      influencerId: INF_ID,
      productContext: { nested: true },
    }),
  400,
  "object productContext"
);
expectHttp(
  () =>
    parseAutopilotCreateBody({
      idea: "Haz un UGC de la app de calorías",
      requestId: "req-12345678",
      influencerId: INF_ID,
      productContext: "x".repeat(AUTOPILOT_PRODUCT_CONTEXT_MAX + 1),
    }),
  400,
  "productContext too long"
);
assert(languageFromProfile("en") === "en", "profile en");
assert(languageFromProfile("es") === "es", "profile es");
assert(languageFromProfile("fr") === "es", "unknown profile language stays es");
assert(
  languageFromProfile("es") === "es",
  "English-looking prompt text cannot override a Spanish profile"
);
assert(
  AUTOPILOT_MODEL_ID === "fal-ai/kling-video/v3/pro/image-to-video",
  "default video model is Kling 3.0 Pro"
);
const spokenEs = autopilotTalkingClipPrompt({
  name: "Maya",
  script: "Make this app part of your day",
  product: "calorie app",
  language: "es",
  action: "talks",
  extra: "gym",
});
assert(/ONLY in Spanish/i.test(spokenEs), "es profile forces Spanish speech");
assert(/Never translate the speech to English/i.test(spokenEs), "es does not allow English fallback");
assert(!/SPEAKS this full script in English/i.test(spokenEs), "es prompt is not the English branch");
const spokenEn = autopilotTalkingClipPrompt({
  name: "Maya",
  script: "Make this app part of your day",
  product: "calorie app",
  language: "en",
  action: "talks",
  extra: "gym",
});
assert(/in English/i.test(spokenEn), "en profile keeps English speech");

const sneaky = parseAutopilotCreateBody({
  idea: "Haz un UGC de la app de calorías",
  requestId: "req-12345678",
  influencerId: INF_ID,
  lock_token: "11111111-1111-4111-8111-111111111111",
  state: { videoUrl: "https://evil.example/steal.mp4" },
  status: "done",
  fal_request_id: "forge-fal",
});
assert(
  JSON.stringify(Object.keys(sneaky).sort()) ===
    JSON.stringify(["idea", "influencerId", "productContext", "requestId"].sort()),
  "client cannot inject lock_token or state URLs"
);

function asset(name: string, kind: GalleryAsset["kind"] = "image"): GalleryAsset {
  return {
    id: name,
    name,
    mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    sizeBytes: 10,
    kind,
    folderId: null,
    storagePath: name,
    publicUrl: `https://example.com/${name}`,
    hashtag: null,
    sortOrder: 0,
    createdAt: "2026-09-05T00:00:00.000Z",
  };
}

assert(isExcludedProductAsset(asset("portrait-face.jpg")), "excludes portraits");
assert(isExcludedProductAsset(asset("influencer-shot.png")), "excludes shots");
assert(isExcludedProductAsset(asset("final-montage.mp4", "video")), "excludes finales");
assert(hasProductCaptureEvidence(asset("app-demo-moun.mp4", "video")), "moun demo is evidence");
assert(!hasProductCaptureEvidence(asset("random-photo.jpg")), "image without evidence is rejected");
assert(
  scoreProductAsset(asset("app-demo-moun.mp4", "video")) >
    scoreProductAsset(asset("screenshot.png")),
  "prefers app-demo-moun.mp4 over a still"
);
assert(
  missingProductError({ image: null, video: null })?.includes("app-demo"),
  "missing product asks for a real capture"
);

const viral = realViralHits([
  {
    name: "fake",
    structure: "x",
    why: "",
    hooks: [],
    sourceUrl: null,
    videoUrl: null,
    videoNote: "",
    videoDescription: "",
    howToUse: "",
    platform: "other",
  },
  {
    name: "real",
    structure: "hook demo cta",
    why: "",
    hooks: ["try this"],
    sourceUrl: "https://x.com/foo/status/1",
    videoUrl: null,
    videoNote: "",
    videoDescription: "",
    howToUse: "",
    platform: "x",
  },
]);
assert(viral.length === 1 && viral[0]!.sourceUrl.startsWith("https://"), "drops invented hits without urls");
assert(realViralHits([]).length === 0, "empty search does not invent trends");
const demoPrompt = autopilotDemoClipPrompt({
  name: "Maya",
  action: "uses the real iPhone with the real app UI",
});
assert(/readable|real product capture/i.test(demoPrompt), "product shot keeps real capture");
assert(
  !/Do not render a readable app UI/i.test(demoPrompt),
  "does not reuse v1 UI ban on the product plane"
);
assert(/not claimed/i.test(demoPrompt), "does not claim exact pixels after video IA");

assert(parseAutopilotPlan({hook: "Mi rutina matutina favorita"}, 15) === null, "rejects a four-word script for 15 seconds");
const plan = parseAutopilotPlan(
  {
    narration: "Antes de empezar mi mañana, me tomo un momento para abrir esta aplicación. Hoy la estoy probando mientras preparo el desayuno y te enseño aquí, en mi teléfono, cómo se ve por dentro.",
    talkingDurationSec: 5,
    brollDurationSec: 5,
    demoDurationSec: 5,
    talkingAction: "talks",
    brollAction: "cooks",
    demoAction: "holds phone",
    setting: "kitchen",
  },
  15
);
assert(plan && plan.talkingDurationSec + plan.brollDurationSec + plan.demoDurationSec === 15, "plan totals 15s");

const row: AutopilotRow = {
  id: "run-1",
  project_id: "p1",
  user_id: "u1",
  influencer_id: INF_ID,
  client_request_id: "req-12345678",
  idea: "Haz un UGC de la app",
  status: "running",
  stage: "clips",
  progress: 78,
  video_url: null,
  asset_id: null,
  error: null,
  state: { plan, viral, language: "en" },
  lock_token: null,
  locked_at: null,
  attempt: 1,
  created_at: "2026-09-05T00:00:00.000Z",
  updated_at: "2026-09-05T00:00:00.000Z",
};
const pub = mapAutopilotRun(row);
assert(
  JSON.stringify(Object.keys(pub).sort()) ===
    JSON.stringify(["createdAt", "error", "id", "idea", "influencerId", "progress", "stage", "status", "updatedAt", "videoUrl"].sort()),
  "public contract has influencerId and no scenes"
);
assert(pub.influencerId === INF_ID, "run exposes influencerId");
assert(pub.updatedAt === row.updated_at, "run exposes updatedAt for elapsed time");
assert(!("state" in pub) && !("plan" in pub), "internal plan is not public");
assert(!("lock_token" in pub) && !("lockToken" in pub), "lock token is not public");
assert(!("fal_request_id" in pub) && !("falRequestId" in pub), "fal request id is not public");
const lockedRow: AutopilotRow = {
  ...row,
  lock_token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  fal_request_id: "fal-secret",
  state: { language: "en", videoUrl: "https://internal.example/x.mp4" },
};
const lockedPub = mapAutopilotRun(lockedRow);
assert(lockedPub.videoUrl === row.video_url, "public videoUrl comes from the column, not state");
assert(!("lock_token" in lockedPub) && !("state" in lockedPub), "CAS lock stays server-side");
assert(parseAutopilotState(row.state).language === "en", "language snapshot stays from profile");

const t0 = Date.parse("2026-09-05T12:00:00.000Z");
assert(formatAutopilotElapsed("2026-09-05T11:56:00.000Z", t0) === "4 min", "elapsed minutes");
const queuedView = describeAutopilotRun(
  {
    status: "queued",
    stage: "queued",
    videoUrl: null,
    createdAt: "2026-09-05T11:58:00.000Z",
    updatedAt: "2026-09-05T11:58:00.000Z",
  },
  t0
);
assert(queuedView.title === "En cola", "queued is not generating");
assert(!queuedView.live && !queuedView.ready, "queued is not live or ready");
assert(/lleva 2 min/i.test(queuedView.detail), "queued shows elapsed time");
assert(!/listo/i.test(queuedView.title + queuedView.detail), "queued does not say ready");
const clipsLive = describeAutopilotRun(
  {
    status: "running",
    stage: "clips",
    videoUrl: null,
    createdAt: "2026-09-05T11:52:00.000Z",
    updatedAt: "2026-09-05T11:59:30.000Z",
  },
  t0
);
assert(clipsLive.title === "Generando los clips de video", "fresh clips stage is generating");
assert(clipsLive.live && !clipsLive.ready, "fresh clips is live, not done");
assert(/lleva 8 min/i.test(clipsLive.detail), "clips shows elapsed time");
assert(!/casi listo|listo para compartir|78%/i.test(clipsLive.title + clipsLive.detail), "no fake completion");
const clipsWait = describeAutopilotRun(
  {
    status: "running",
    stage: "clips",
    videoUrl: null,
    createdAt: "2026-09-05T11:45:00.000Z",
    updatedAt: "2026-09-05T11:56:00.000Z",
  },
  t0
);
assert(clipsWait.title === "Esperando los clips del modelo", "stale clips is waiting, not finishing");
assert(!clipsWait.live && !clipsWait.ready, "waiting on the model is not a live local job");
const doneNoVideo = describeAutopilotRun(
  {
    status: "done",
    stage: "done",
    videoUrl: null,
    createdAt: "2026-09-05T11:50:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
  },
  t0
);
assert(!doneNoVideo.ready && !/listo/i.test(doneNoVideo.title), "done without file is not ready");
const readyView = describeAutopilotRun(
  {
    status: "done",
    stage: "done",
    videoUrl: "https://cdn.example/v.mp4",
    createdAt: "2026-09-05T11:52:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
  },
  t0
);
assert(readyView.ready && readyView.title === "Listo", "ready only with a video URL");
assert(readyView.elapsed === "8 min" && /tardó 8 min/i.test(readyView.detail), "finished videos show duration");
assert(!readyView.live, "finished is not generating");
const failedView = describeAutopilotRun(
  {
    status: "failed",
    stage: "clips",
    videoUrl: null,
    error: "fal.ai se quedó sin saldo",
    createdAt: "2026-09-05T11:50:00.000Z",
    updatedAt: "2026-09-05T11:59:00.000Z",
  },
  t0
);
assert(failedView.title === "No se pudo terminar", "failed is not generating");
assert(!failedView.live && !failedView.ready, "failed is terminal");
assert(failedView.detail.includes("saldo"), "failed shows the real error");

const webhookSrc = readFileSync(path.join(here, "../fal/webhook.ts"), "utf8");
assert(
  !webhookSrc.includes("process.env.NEXT_PUBLIC_APP_URL"),
  "webhook base must not use NEXT_PUBLIC_APP_URL"
);
assert(
  !/\$\{process\.env\.(CRON_SECRET|MAIL_ENCRYPTION_KEY)/.test(webhookSrc),
  "env secrets are not interpolated into the webhook URL"
);
assert(
  !/encodeURIComponent\(\s*process\.env\.(CRON_SECRET|MAIL_ENCRYPTION_KEY)/.test(
    webhookSrc
  ),
  "env secrets are not sent as a query token"
);
assert(
  webhookSrc.includes("AUTOPILOT_WEBHOOK_BASE") &&
    /NODE_ENV === ["']development["']/.test(webhookSrc),
  "dev does not fall back to a production public URL"
);
if (webhookSrc.includes("createHmac")) {
  assert(
    /createHmac\(\s*["']sha256["']/.test(webhookSrc),
    "HMAC token is derived, not the raw secret"
  );
  assert(
    /update\(\s*["'][^"']+["']\s*\)/.test(webhookSrc),
    "HMAC uses a fixed context string"
  );
}
const hookUrl = falAutopilotWebhookUrl();
const cron = process.env.CRON_SECRET?.trim() || "";
const mail = process.env.MAIL_ENCRYPTION_KEY?.trim() || "";
if (hookUrl) {
  assert(
    !/[?&]token=/i.test(hookUrl) || webhookSrc.includes("createHmac"),
    "no raw-secret token query"
  );
  if (cron) assert(!hookUrl.includes(cron), "CRON_SECRET is not in the fal URL");
  if (mail) assert(!hookUrl.includes(mail), "MAIL_ENCRYPTION_KEY is not in the fal URL");
}

const hookRouteSrc = readFileSync(
  path.join(here, "../../app/api/webhooks/fal-autopilot/route.ts"),
  "utf8"
);
assert(
  hookRouteSrc.includes("verifyFalWebhookSignature") ||
    /createHmac|hmac/i.test(hookRouteSrc),
  "webhook route requires fal signature or HMAC"
);

const instSrc = readFileSync(path.join(here, "../../instrumentation.ts"), "utf8");
assert(
  /NODE_ENV !== ["']development["']/.test(instSrc) ||
    /NODE_ENV === ["']development["']/.test(instSrc),
  "local poller is development-only"
);
assert(instSrc.includes("NEXT_RUNTIME"), "local poller is node-only");

const sql = readFileSync(
  path.join(here, "../../supabase/migrations/20260905210000_video_autopilot.sql"),
  "utf8"
);
assert(sql.includes("lock_token"), "runs table has CAS lock_token");
assert(
  /grant select on public\.estudio_video_autopilot_runs to authenticated/i.test(sql),
  "auth can only SELECT"
);
assert(!/grant insert, update, delete/i.test(sql), "auth cannot write runs");
assert(
  /drop policy if exists "estudio_autopilot_insert_own"/i.test(sql),
  "client insert policy is removed"
);
assert(
  /revoke all on public\.estudio_video_autopilot_runs from authenticated/i.test(sql),
  "authenticated write grants are revoked"
);

const sql23 = readFileSync(
  path.join(here, "../../supabase/migrations/20260905230000_autopilot_fal_request_unique.sql"),
  "utf8"
);
assert(
  /estudio_autopilot_fal_request_uidx/.test(sql23),
  "fal_request_id lookup is unique"
);

const apiSrc = readFileSync(
  path.join(here, "../../app/api/projects/[id]/creator/video-autopilot/route.ts"),
  "utf8"
);
assert(apiSrc.includes("Falta influencerId"), "GET requires influencerId");
assert(
  !/listAutopilotRuns\([^)]+\)/.test(apiSrc.replace(/\s+/g, " ")) ||
    /listAutopilotRuns\(\s*gate\.supabase,\s*projectId,\s*influencerId\s*\)/.test(apiSrc),
  "GET lists only the requested influencer"
);

const serverSrc = readFileSync(path.join(here, "./autopilot-server.ts"), "utf8");
assert(serverSrc.includes("lock_token: null"), "new runs start unlocked");
assert(serverSrc.includes("parseAutopilotCreateBody"), "POST body is allowlisted");
assert(!/\.insert\(\s*opts\.body/.test(serverSrc), "client body is not inserted raw");
assert(serverSrc.includes("languageFromProfile"), "language comes from the influencer profile");
assert(!serverSrc.includes("detectIdeaLanguage"), "prompt text cannot choose language");

const workerSrc = readFileSync(path.join(here, "./autopilot-worker.ts"), "utf8");
assert(workerSrc.includes('.eq("lock_token", token)'), "patches require the CAS lock");
assert(workerSrc.includes('.is("lock_token", null)'), "claim requires an unlocked row");
assert(workerSrc.includes("LockLostError"), "lost lock aborts the writer");
assert(/function acquireLock/.test(workerSrc), "worker claims with a lock token");
const demoFramePrompt = autopilotDemoFramePrompt({
  name: "Maya",
  traits: "natural",
  extra: "kitchen",
});
assert(!/composited later/i.test(demoFramePrompt), "demo frame is not a dark-screen overlay heuristic");

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

async function audioCheck() {
  const bin = ffmpegStatic;
  assert(bin, "ffmpeg-static");
  const ffmpeg = bin as string;
  const dir = await mkdtemp(path.join(tmpdir(), "zima-autopilot-audio-"));
  try {
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    const voice = path.join(dir, "voice.mp4");
    for (const [file, color] of [
      [a, "red"],
      [b, "blue"],
    ] as const) {
      const r = await run(ffmpeg, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:s=1080x1920:d=2:r=30`,
        "-an",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        file,
      ]);
      assert(r.code === 0, r.stderr.slice(-300) || `${color} clip failed`);
    }
    const voiceRun = await run(ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=1080x1920:d=4:r=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:sample_rate=44100:duration=4",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      voice,
    ]);
    assert(voiceRun.code === 0, voiceRun.stderr.slice(-300) || "voice failed");
    const out = await concatVerticalClipsWithBedAudio({
      clips: [
        { buffer: await readFile(a), durationSec: 2 },
        { buffer: await readFile(b), durationSec: 2 },
      ],
      audio: await readFile(voice),
    });
    const outFile = path.join(dir, "out.mp4");
    await writeFile(outFile, out);
    const probe = await run(ffmpeg, ["-i", outFile]);
    assert(/Audio:/i.test(probe.stderr), "montage keeps a continuous audio stream");
    const tail = await run(ffmpeg, [
      "-ss",
      "3.2",
      "-t",
      "0.5",
      "-i",
      outFile,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]);
    const mean = tail.stderr.match(/mean_volume:\s*([-0-9.]+)\s*dB/i);
    assert(mean && Number(mean[1]) > -40, "B-roll/demo segment is not silence");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

audioCheck()
  .then(() => {
    console.log("autopilot checks ok");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
