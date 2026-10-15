import { randomBytes } from "node:crypto";
import { clean, projectCrud, type Sanitizer } from "@/lib/marketing/crud";
import { utmSlug } from "@/lib/marketing/types";

const utm: Sanitizer = (v) => (v === undefined ? undefined : typeof v === "string" ? utmSlug(v) || null : null);

function shortCode() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(7), (b) => alphabet[b % alphabet.length]).join("");
}

export const { GET, POST, PATCH, DELETE } = projectCrud({
  table: "marketing_links",
  required: ["name", "base_url"],
  fields: {
    name: clean.text(160),
    base_url: clean.url(),
    campaign_id: clean.uuid(),
    utm_source: utm,
    utm_medium: utm,
    utm_campaign: utm,
    utm_content: utm,
    utm_term: utm,
  },
  prepareInsert: (row) => ({ ...row, code: shortCode() }),
});
