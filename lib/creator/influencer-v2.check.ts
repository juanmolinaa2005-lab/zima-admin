import {
  applyV2CampaignEdits,
  COMPOSE_STALE_MS,
  composeLockMode,
  composeBlockers,
  defaultV2Scenes,
  emptyContinuity,
  estimateV2CampaignCost,
  KLING_AUDIO_VOICE_NOTE,
  moveV2Scene,
  normalizeV2Scene,
  normalizeV2Scenes,
  parseV2CreateBody,
  parseV2PatchBody,
  parseV2Storyboard,
  sceneKind,
  scenesForCompose,
  scenesToEnqueue,
  scenesToRetry,
  v2SceneVideoPrompt,
  v2StoredJobScript,
  v2StoryboardPrompt,
  type V2Campaign,
  type V2Scene,
} from "./influencer-v2";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const productGenerate = normalizeV2Scene({
  role: "product",
  source: "generate",
  title: "Fake UI",
});
assert(productGenerate.source !== "generate", "product cannot generate UI");
assert(productGenerate.planningOnly, "product without asset is planning");
assert(sceneKind(productGenerate) === "planning", "product starts as planning");

const galleryReady = normalizeV2Scene({
  role: "product",
  source: "gallery",
  galleryAssetId: "asset-1",
  title: "Scan food",
  durationSec: 4,
});
assert(sceneKind(galleryReady) === "gallery", "gallery with asset is montable");
assert(!galleryReady.planningOnly, "asset clears planning");

const presenter = normalizeV2Scene({
  id: "s1",
  role: "presenter",
  source: "generate",
  script: "Hook spoken",
  action: "Talks with handheld mic",
  durationSec: 8,
});
assert(sceneKind(presenter) === "generate", "presenter generates");
assert(!presenter.planningOnly, "generate is never planning-only");

const action = normalizeV2Scene({
  id: "s2",
  role: "action",
  source: "generate",
  action: "Gym b-roll, not looking at camera",
  durationSec: 5,
});

const scenes = normalizeV2Scenes([presenter, action, galleryReady, productGenerate]);
assert(scenes.length === 4, "keeps four scenes");
assert(scenesForCompose(scenes).length === 3, "planning product skipped in compose");

const jobs = {
  "job-ready": { status: "saved", videoUrl: "https://x/a.mp4", assetId: "g1" },
};
const withJob: V2Scene[] = scenes.map((s, i) =>
  i === 0 ? { ...s, videoId: "job-ready" } : s
);
assert(
  scenesToEnqueue(withJob, jobs).every((s) => s.id !== withJob[0]!.id),
  "ready job is not enqueued again"
);
assert(
  scenesToEnqueue(withJob, jobs).some((s) => s.role === "action"),
  "missing action job still enqueues"
);

const failedJobs = {
  j1: { status: "failed", error: "fal" },
};
const failedScene: V2Scene[] = [{ ...presenter, videoId: "j1" }];
assert(scenesToRetry(failedScene, failedJobs).length === 1, "failed job retries");
assert(
  scenesToEnqueue(failedScene, failedJobs).length === 0,
  "failed job does not insert a second charge"
);

const blockers = composeBlockers(withJob, {
  "job-ready": { status: "saved", videoUrl: "https://x/a.mp4", assetId: "g1" },
});
assert(
  blockers.some((b) => /job/i.test(b) || /todavía/i.test(b)),
  "compose waits for generated action clip"
);

const ordered = moveV2Scene(scenes, scenes[0]!.id, 1);
assert(ordered[1]!.id === scenes[0]!.id, "reorder works");

const parsed = parseV2Storyboard(
  JSON.stringify({
    title: "Cal AI style",
    continuity: { wardrobe: "black tee", lighting: "gym", setting: "gym" },
    scenes: [
      { role: "presenter", source: "generate", script: "I stopped counting calories by hand", durationSec: 7 },
      { role: "action", source: "generate", action: "working out", durationSec: 5 },
      { role: "product", source: "gallery", durationSec: 4 },
    ],
  }),
  { brief: "Cal AI", objective: "proof" }
);
assert(parsed && parsed.scenes.length === 3, "parses AI storyboard");
assert(parsed && sceneKind(parsed.scenes[2]!) === "planning", "product without asset stays planning");

const cost = estimateV2CampaignCost({
  scenes: [presenter, action, galleryReady],
  modelId: "fal-ai/kling-video/o3/standard/image-to-video",
  refCount: 6,
});
assert(cost.scenes === 2, "gallery is not billed");
assert(cost.cost.totalUsd > 0, "generate scenes have real cost");
assert(
  cost.billedDurationSec === presenter.durationSec + action.durationSec,
  "o3 billed duration matches requested when allowed"
);

const snapped = estimateV2CampaignCost({
  scenes: [{ ...presenter, durationSec: 7 }],
  modelId: "fal-ai/kling-video/v2.6/pro/image-to-video",
  refCount: 6,
});
assert(snapped.billedDurationSec === 5, "FIVE_TEN model snaps 7s to 5s, not 7");
assert(snapped.billedDurationSec !== 7, "must not display unbilled requested seconds");

const brollMix = v2StoredJobScript({
  ...action,
  script: "Este es el diálogo de la presentadora, no va en B-roll",
  action: "Entrena en el gimnasio, no mira a cámara",
});
assert(
  brollMix === "Entrena en el gimnasio, no mira a cámara",
  "B-roll job script is the action, never presenter dialogue"
);
assert(
  v2StoredJobScript(presenter) === "Hook spoken",
  "presenter job script stays spoken"
);

const defaults = defaultV2Scenes();
assert(defaults.some((s) => sceneKind(s) === "planning"), "default product is planning");
assert(defaults.filter((s) => s.source === "generate").length === 2, "two generable defaults");

assert(
  /chino o inglés/i.test(KLING_AUDIO_VOICE_NOTE) &&
    /no garantiza voz en español/i.test(KLING_AUDIO_VOICE_NOTE),
  "voice note must not promise Spanish audio"
);
const spoken = v2SceneVideoPrompt({
  scene: presenter,
  name: "Mia",
  language: "es",
  continuity: { wardrobe: "", lighting: "", setting: "" },
});
assert(
  !/They speak Spanish naturally/i.test(spoken),
  "V2 prompt must not claim native Spanish voice"
);
assert(/auto-translated to English/i.test(spoken), "V2 prompt discloses Kling translation");
const plan = v2StoryboardPrompt({
  brief: "app",
  objective: "proof",
  product: "app",
  language: "es",
  name: "Mia",
  traits: "",
  hasAppDemo: false,
  galleryCount: 0,
});
assert(/voz española/i.test(plan), "storyboard plan discloses no Spanish voice guarantee");

{
  const now = Date.parse("2026-09-05T12:00:00.000Z");
  assert(composeLockMode("planned", "2026-09-05T11:59:00.000Z", now) === "acquire", "non-composing acquires");
  assert(composeLockMode("composing", "2026-09-05T11:58:00.000Z", now) === "conflict", "fresh composing conflicts");
  assert(
    composeLockMode("composing", "2026-09-05T11:56:59.000Z", now) === "steal",
    "stale composing can steal"
  );
  assert(COMPOSE_STALE_MS === 3 * 60 * 1000, "stale window is 3 minutes");
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

expectHttp(() => parseV2CreateBody(null), 400, "null body is 400");
expectHttp(() => parseV2CreateBody([]), 400, "array body is 400");
expectHttp(() => parseV2CreateBody({ title: { x: 1 } }), 400, "object title is 400");
expectHttp(() => parseV2CreateBody({ modelId: 1 }), 400, "numeric modelId is 400");
expectHttp(
  () => parseV2CreateBody({ modelId: "fal-ai/kling-video/v2.1/standard/image-to-video" }),
  400,
  "silent kling is not a voice model"
);
expectHttp(() => parseV2CreateBody({ language: "fr" }), 400, "unsupported language is 400");
expectHttp(() => parseV2CreateBody({ influencerId: 12 }), 400, "numeric influencerId is 400");
const created = parseV2CreateBody({});
assert(created.title === "Campaña UGC", "empty object uses defaults");
assert(created.modelId === "fal-ai/kling-video/o3/standard/image-to-video", "default voice model");

const campaign: V2Campaign = {
  id: "c1",
  projectId: "p1",
  influencerId: "inf-1",
  title: "UGC",
  brief: "app",
  objective: "proof",
  language: "es",
  modelId: "fal-ai/kling-video/o3/standard/image-to-video",
  status: "generating",
  continuity: emptyContinuity(),
  scenes: [
    { ...presenter, id: "s1", videoId: "job-ready", script: "Hook spoken" },
    { ...action, id: "s2", videoId: null },
    { ...galleryReady, id: "s3" },
  ],
  finalAssetId: "final-1",
  finalVideoUrl: "https://x/final.mp4",
  estimatedCostUsd: 1,
  createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
};

const titleOnly = applyV2CampaignEdits(campaign, { title: "Nuevo" });
assert(titleOnly.next.scenes[0]!.videoId === "job-ready", "title edit keeps clip");
assert(titleOnly.next.finalAssetId === "final-1", "title edit keeps montage");

const scriptEdit = applyV2CampaignEdits(campaign, {
  scenes: campaign.scenes.map((s) =>
    s.id === "s1" ? { ...s, script: "Otro hook", videoId: "job-ready" } : s
  ),
});
assert(scriptEdit.next.scenes[0]!.videoId === null, "script change drops stale clip");
assert(scriptEdit.next.scenes[0]!.id !== "s1", "script change versions scene id");
assert(scriptEdit.next.finalAssetId === null, "script change invalidates montage");

const forged = applyV2CampaignEdits(campaign, {
  scenes: campaign.scenes.map((s) =>
    s.id === "s2" ? { ...s, videoId: "forged-job" } : s
  ),
});
assert(forged.next.scenes[1]!.videoId === null, "client cannot attach a foreign job");

const reorder = applyV2CampaignEdits(campaign, {
  scenes: [campaign.scenes[2]!, campaign.scenes[0]!, campaign.scenes[1]!],
});
assert(reorder.next.scenes[0]!.id === "s3", "reorder keeps scene identity");
assert(reorder.next.scenes[1]!.videoId === "job-ready", "reorder keeps ready clip");
assert(reorder.next.finalAssetId === null, "reorder invalidates montage");

const influencerEdit = applyV2CampaignEdits(campaign, { influencerId: "inf-2" });
assert(influencerEdit.next.scenes[0]!.videoId === null, "influencer change drops clips");
assert(influencerEdit.next.scenes[0]!.id !== "s1", "influencer change versions scene with job");
assert(influencerEdit.next.finalAssetId === null, "influencer change invalidates montage");

expectHttp(
  () =>
    applyV2CampaignEdits(
      campaign,
      {
        scenes: campaign.scenes.map((s) =>
          s.id === "s1" ? { ...s, script: "Mientras corre" } : s
        ),
      },
      { jobs: { "job-ready": { status: "in_progress" } } }
    ),
  409,
  "active job blocks generation edits"
);

const keepWhileQueuedSame = applyV2CampaignEdits(
  campaign,
  { scenes: campaign.scenes },
  { jobs: { "job-ready": { status: "queued" } } }
);
assert(
  keepWhileQueuedSame.next.scenes[0]!.videoId === "job-ready",
  "same generation keeps job even if still queued"
);

expectHttp(() => parseV2PatchBody({ modelId: "nope" }), 400, "patch rejects unknown model");

function isMissingV2CampaignColumn(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  if (!msg.includes("v2_campaign_id")) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /does not exist/.test(msg) ||
    /schema cache/.test(msg) ||
    /could not find/.test(msg)
  );
}
assert(
  isMissingV2CampaignColumn({
    code: "42703",
    message: 'column "v2_campaign_id" does not exist',
  }),
  "postgres missing column is detected"
);
assert(
  isMissingV2CampaignColumn({
    code: "PGRST204",
    message:
      "Could not find the 'v2_campaign_id' column of 'estudio_influencer_videos' in the schema cache",
  }),
  "postgrest schema cache miss is detected"
);
assert(
  !isMissingV2CampaignColumn({ message: "permission denied" }),
  "other errors are not treated as missing column"
);

console.log("influencer-v2 checks ok");
