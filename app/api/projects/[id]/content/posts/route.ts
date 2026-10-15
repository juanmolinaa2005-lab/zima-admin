import { clean, projectCrud } from "@/lib/marketing/crud";
import { CONTENT_FORMATS, CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/marketing/types";

export const { GET, POST, PATCH, DELETE } = projectCrud({
  table: "content_posts",
  required: ["title"],
  order: { column: "scheduled_at", ascending: true },
  fields: {
    title: clean.text(200),
    platform: clean.oneOf(CONTENT_PLATFORMS.map((p) => p.id)),
    format: clean.oneOf(CONTENT_FORMATS.map((f) => f.id)),
    pillar: clean.text(80),
    status: clean.oneOf(CONTENT_STATUSES.map((s) => s.id)),
    scheduled_at: clean.timestamp(),
    hook: clean.text(300),
    script: clean.text(6000),
    caption: clean.text(2200),
    hashtags: clean.tags(),
    asset_url: clean.url(),
    published_url: clean.url(),
    notes: clean.text(2000),
    source: clean.oneOf(["manual", "ai"]),
  },
});
