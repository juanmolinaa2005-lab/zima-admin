import { clean, projectCrud } from "@/lib/marketing/crud";
import { AD_OBJECTIVES, AD_PLATFORMS, CAMPAIGN_STATUSES } from "@/lib/marketing/types";

export const { GET, POST, PATCH, DELETE } = projectCrud({
  table: "ad_campaigns",
  required: ["name"],
  fields: {
    name: clean.text(160),
    platform: clean.oneOf(AD_PLATFORMS.map((p) => p.id)),
    objective: clean.oneOf(AD_OBJECTIVES.map((o) => o.id)),
    status: clean.oneOf(CAMPAIGN_STATUSES.map((s) => s.id)),
    daily_budget: (v) => (v === undefined ? undefined : (clean.number()(v) ?? 0)),
    total_budget: clean.number(),
    target_cpa: clean.number(),
    currency: clean.oneOf(["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "GBP", "BRL"]),
    start_date: clean.date(),
    end_date: clean.date(),
    audience: clean.text(1000),
    notes: clean.text(2000),
  },
});
