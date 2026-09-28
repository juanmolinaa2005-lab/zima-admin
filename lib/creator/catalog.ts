export const STUDIO_FLOWS = [
  {
    id: "character-scene",
    name: "Character scene",
    description:
      "Upload a character, one or more scene prompts, top text, music, and a gallery folder. Each scene becomes a video.",
    steps: ["Character", "Scene", "Top text", "Music", "Destination"],
  },
  {
    id: "layers",
    name: "Layers",
    description:
      "Three layers: background, text, and image. Stack them on the left and see the mounted result on the right.",
    steps: ["Background", "Text", "Image"],
  },
] as const;

export type StudioFlowId = (typeof STUDIO_FLOWS)[number]["id"];

export function splitScenePrompts(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildCharacterScenePrompt(
  scene: string,
  characterName?: string,
  aspectRatio?: string
): string {
  const who = characterName?.trim()
    ? `The character is named "${characterName.trim()}". Keep this exact character from the reference image. `
    : "Keep the exact same character from the reference image. ";
  const shape =
    aspectRatio === "16:9"
      ? "Horizontal 16:9 widescreen video"
      : aspectRatio === "1:1"
        ? "Square 1:1 video"
        : aspectRatio === "4:3"
          ? "Classic 4:3 video"
          : aspectRatio === "3:4"
            ? "Portrait 3:4 video"
            : "Vertical 9:16 social video";
  return `${who}Scene action: ${scene.trim()}. ${shape}, natural motion, consistent character identity. Do not add titles, captions, watermarks, or on-screen text.`;
}
