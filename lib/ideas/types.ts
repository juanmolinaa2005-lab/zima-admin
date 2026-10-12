export type IdeaFormat = "slideshow" | "pov" | "reaction" | "talking" | "listicle" | "founder-post" | "demo";

export type ContentIdea = {
  id: string;
  format: IdeaFormat;
  platform: string | null;
  hook: string;
  beats: string[];
  caption: string | null;
  hashtags: string[];
  status: "new" | "used" | "discarded";
  source: "ai" | "template";
  variant_of: string | null;
  created_at: string;
};

export const FORMAT_LABEL: Record<IdeaFormat, string> = {
  slideshow: "Slideshow",
  pov: "POV + demo",
  reaction: "Reacción",
  talking: "A cámara",
  listicle: "Lista de apps",
  "founder-post": "Post del fundador",
  demo: "Demo",
};
