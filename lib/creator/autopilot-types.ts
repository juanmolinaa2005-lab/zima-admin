export const AUTOPILOT_STATUSES = [
  "queued",
  "running",
  "done",
  "failed",
] as const;
export type AutopilotStatus = (typeof AUTOPILOT_STATUSES)[number];

export const AUTOPILOT_STAGES = [
  "queued",
  "validate",
  "influencer",
  "research",
  "plan",
  "frames",
  "clips",
  "montage",
  "done",
] as const;
export type AutopilotStage = (typeof AUTOPILOT_STAGES)[number];

/** Public contract for the one-prompt UI. No scenes or campaigns. */
export type AutopilotRun = {
  id: string;
  influencerId: string;
  idea: string;
  status: AutopilotStatus;
  stage: AutopilotStage;
  progress: number;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutopilotJobSlot = {
  requestId?: string | null;
  url?: string | null;
};

export type AutopilotViralHit = {
  name: string;
  structure: string;
  sourceUrl: string;
  hooks: string[];
};

export type AutopilotPlan = {
  hook: string;
  talkingDurationSec: number;
  brollDurationSec: number;
  demoDurationSec: number;
  talkingAction: string;
  brollAction: string;
  demoAction: string;
  setting: string;
};

export type AutopilotFalSlot =
  | "nativeDirection"
  | "nativeClip"
  | "narration"
  | "syncedTalking"
  | "viral"
  | "improved"
  | "plan"
  | "identityFrame"
  | "talkingFrame"
  | "demoFrame"
  | "brollFrame"
  | "talkingClip"
  | "demoClip"
  | "brollClip"
  | "demoScreen";

export type AutopilotPendingFal = {
  requestId: string;
  model: string;
  kind: "text" | "image" | "video" | "audio";
  slot: AutopilotFalSlot;
};

export type AutopilotState = {
  pipelineVersion?: 2 | 3 | 4;
  productionDirection?: import("./autopilot-director").ProductionDirection;
  productReferenceVideoUrl?: string;
  productEndImageUrl?: string;
  productEvidence?: string;
  visualReview?: import("./autopilot-evidence").VisualReview;
  nativeDirection?: { dialogue: string; scene: string };
  nativeClip?: AutopilotJobSlot;
  narration?: AutopilotJobSlot;
  narrationReadyUrl?: string;
  narrationAttempts?: number;
  durationSec?: number;
  syncedTalking?: AutopilotJobSlot;
  demoPlateUrl?: string;
  productVideoUrl?: string;
  productVideoStartSec?: number;
  composedDemoUrl?: string;
  language?: "es" | "en";
  modelId?: string;
  influencerId?: string;
  creatorName?: string;
  creatorTraits?: string;
  folderId?: string | null;
  productContext?: string;
  productImageAssetId?: string;
  productVideoAssetId?: string | null;
  productImageUrl?: string;
  improvedIdea?: string;
  viral?: AutopilotViralHit[];
  plan?: AutopilotPlan;
  viralRaw?: string;
  improvedRaw?: string;
  planRaw?: string;
  planAttempts?: number;
  demoFrameAttempts?: number;
  planRepairReason?: string;
  identityReferenceUrls?: string[];
  identityFrame?: AutopilotJobSlot;
  talkingFrame?: AutopilotJobSlot;
  demoFrame?: AutopilotJobSlot;
  brollFrame?: AutopilotJobSlot;
  talkingClip?: AutopilotJobSlot;
  demoClip?: AutopilotJobSlot;
  brollClip?: AutopilotJobSlot;
  pendingFal?: AutopilotPendingFal | null;
  screenMethod?: "corners" | "edit" | null;
};

export function parseAutopilotState(raw: unknown): AutopilotState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as AutopilotState;
}

export const AUTOPILOT_SELECT =
  "id, project_id, user_id, influencer_id, client_request_id, idea, status, stage, progress, video_url, asset_id, error, state, fal_request_id, lock_token, locked_at, attempt, created_at, updated_at";

export type AutopilotRow = {
  id: string;
  project_id: string;
  user_id: string;
  influencer_id: string;
  client_request_id: string;
  idea: string;
  status: string;
  stage: string;
  progress: number;
  video_url: string | null;
  asset_id: string | null;
  error: string | null;
  state: unknown;
  fal_request_id?: string | null;
  lock_token?: string | null;
  locked_at: string | null;
  attempt: number;
  created_at: string;
  updated_at: string;
};

export const AUTOPILOT_STAGE_PROGRESS: Record<AutopilotStage, number> = {
  queued: 0,
  validate: 8,
  influencer: 18,
  research: 30,
  plan: 40,
  frames: 58,
  clips: 78,
  montage: 92,
  done: 100,
};
