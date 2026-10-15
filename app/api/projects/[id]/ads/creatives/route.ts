import { clean, projectCrud } from "@/lib/marketing/crud";
import { CREATIVE_FORMATS, CREATIVE_STATUSES } from "@/lib/marketing/types";

export const { GET, POST, PATCH, DELETE } = projectCrud({
  table: "ad_creatives",
  required: ["name"],
  fields: {
    campaign_id: clean.uuid(),
    name: clean.text(160),
    format: clean.oneOf(CREATIVE_FORMATS.map((f) => f.id)),
    hook: clean.text(300),
    angle: clean.text(80),
    primary_text: clean.text(2000),
    headline: clean.text(200),
    cta: clean.text(60),
    asset_url: clean.url(),
    status: clean.oneOf(CREATIVE_STATUSES.map((s) => s.id)),
    source: clean.oneOf(["manual", "ai"]),
  },
});
