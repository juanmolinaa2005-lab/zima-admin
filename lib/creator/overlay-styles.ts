export const CAPTION_STYLE_IDS = [
  "tiktok",
  "impact",
  "snapchat",
  "blitz",
  "yellow",
  "karaoke",
  "script",
] as const;

export type CaptionStyleId = (typeof CAPTION_STYLE_IDS)[number];
export type CaptionStyleMode = CaptionStyleId | "mix";

export const CAPTION_STYLES: {
  id: CaptionStyleId;
  label: string;
}[] = [
  { id: "tiktok", label: "TikTok classic" },
  { id: "impact", label: "Bold impact" },
  { id: "snapchat", label: "Snapchat" },
  { id: "blitz", label: "White box" },
  { id: "yellow", label: "Yellow pop" },
  { id: "karaoke", label: "Clean karaoke" },
  { id: "script", label: "Script playful" },
];

export function isCaptionStyleId(value: unknown): value is CaptionStyleId {
  return CAPTION_STYLE_IDS.includes(value as CaptionStyleId);
}

export function normalizeCaptionStyle(value: unknown): CaptionStyleId {
  return isCaptionStyleId(value) ? value : "snapchat";
}

export function normalizeCaptionStyleMode(value: unknown): CaptionStyleMode {
  if (value === "mix") return "mix";
  return normalizeCaptionStyle(value);
}

export function captionStyleForIndex(
  mode: CaptionStyleMode,
  index: number
): CaptionStyleId {
  if (mode !== "mix") return mode;
  const i = Math.max(0, index) % CAPTION_STYLE_IDS.length;
  return CAPTION_STYLE_IDS[i]!;
}

export const OVERLAY_POSITIONS = [
  "top",
  "upper",
  "center",
  "lower",
  "bottom",
] as const;

export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export const DEFAULT_OVERLAY_PREVIEW = "This is real?";

export const OVERLAY_PREVIEW_PHOTO =
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=720&q=80";

export function isOverlayPosition(value: unknown): value is OverlayPosition {
  return OVERLAY_POSITIONS.includes(value as OverlayPosition);
}

export function normalizeOverlayPosition(value: unknown): OverlayPosition {
  return isOverlayPosition(value) ? value : "upper";
}

export function nextOverlayPosition(current: OverlayPosition): OverlayPosition {
  const i = OVERLAY_POSITIONS.indexOf(normalizeOverlayPosition(current));
  return OVERLAY_POSITIONS[(i + 1) % OVERLAY_POSITIONS.length]!;
}

export function overlayPositionClass(position: OverlayPosition): string {
  switch (normalizeOverlayPosition(position)) {
    case "top":
      return "top-[8%]";
    case "upper":
      return "top-[22%]";
    case "center":
      return "top-[42%]";
    case "lower":
      return "top-[62%]";
    case "bottom":
      return "top-auto bottom-[10%]";
  }
}

export function overlayPositionFrac(position: OverlayPosition): number {
  switch (normalizeOverlayPosition(position)) {
    case "top":
      return 0.08;
    case "upper":
      return 0.22;
    case "center":
      return 0.42;
    case "lower":
      return 0.62;
    case "bottom":
      return 0.78;
  }
}
