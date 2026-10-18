import { detectCsvSeparator, splitCsvLine } from "@/lib/csv";
import { parseProfileUrl } from "@/lib/viewtracker/profile";

export type CreatorStage = "new" | "contacted" | "engaged" | "pitched" | "closed" | "lost";

/** One contact with the creator. The first touch in a stage is when it started; the rest are follow-ups. */
export type Touch = { stage: CreatorStage; at: string };

export type PipelineCreator = {
  id: string;
  name: string;
  email: string | null;
  profileUrl: string | null;
  /** More profiles of the same creator on other networks. */
  extraLinks: string[];
  platform: string | null;
  source: string | null;
  notes: string | null;
  stage: CreatorStage;
  touches: Touch[];
  createdAt: string;
  updatedAt: string;
};

export type PipelineDraft = Omit<PipelineCreator, "id" | "createdAt" | "updatedAt">;

export const STAGES: { id: CreatorStage; label: string; color: string; maxFollowups: number; next: string }[] = [
  { id: "new", label: "Por contactar", color: "#a1a1aa", maxFollowups: 0, next: "Enviar el primer mensaje" },
  { id: "contacted", label: "Contactado", color: "#f59e0b", maxFollowups: 3, next: "Esperar respuesta" },
  { id: "engaged", label: "Respondió", color: "#3b82f6", maxFollowups: 5, next: "Enviar la propuesta" },
  { id: "pitched", label: "Propuesta", color: "#8b5cf6", maxFollowups: 5, next: "Cerrar el acuerdo" },
  { id: "closed", label: "Cerrado", color: "#16a34a", maxFollowups: 0, next: "Acuerdo cerrado" },
  { id: "lost", label: "No interesado", color: "#ef4444", maxFollowups: 0, next: "Sin interés" },
];

export const STAGE_IDS = STAGES.map((s) => s.id);
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<CreatorStage, (typeof STAGES)[number]>;

/** Stages where we're waiting on the creator and a follow-up can be due. */
export const ACTIVE_STAGES: CreatorStage[] = ["contacted", "engaged", "pitched"];

export const FOLLOWUP_AFTER_DAYS = 3;

const DAY = 864e5;

export function isStage(v: unknown): v is CreatorStage {
  return typeof v === "string" && (STAGE_IDS as string[]).includes(v);
}

export function sanitizeTouches(raw: unknown): Touch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Touch => !!t && isStage(t.stage) && typeof t.at === "string" && Number.isFinite(Date.parse(t.at)))
    .map((t) => ({ stage: t.stage, at: new Date(t.at).toISOString() }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-80);
}

export function touchesIn(c: Pick<PipelineCreator, "touches">, stage: CreatorStage) {
  return c.touches.filter((t) => t.stage === stage);
}

export function stageStartedAt(c: Pick<PipelineCreator, "touches">, stage: CreatorStage) {
  return touchesIn(c, stage)[0]?.at ?? null;
}

export function followupCount(c: Pick<PipelineCreator, "touches">, stage: CreatorStage) {
  return Math.max(0, touchesIn(c, stage).length - 1);
}

export function lastTouchAt(c: Pick<PipelineCreator, "touches">) {
  return c.touches.length ? c.touches[c.touches.length - 1].at : null;
}

export function daysSince(iso: string | null, now = Date.now()) {
  return iso ? Math.floor((now - Date.parse(iso)) / DAY) : null;
}

export type NextStep = { label: string; due: boolean; overdueDays: number; exhausted: boolean };

/** What to do next with a creator, and whether it's due today. */
export function nextStep(c: PipelineCreator, now = Date.now()): NextStep {
  if (c.stage === "new") return { label: STAGE.new.next, due: true, overdueDays: 0, exhausted: false };
  if (!ACTIVE_STAGES.includes(c.stage)) return { label: STAGE[c.stage].next, due: false, overdueDays: 0, exhausted: false };
  const since = daysSince(lastTouchAt(c), now) ?? 0;
  const used = followupCount(c, c.stage);
  const max = STAGE[c.stage].maxFollowups;
  if (used >= max && since >= FOLLOWUP_AFTER_DAYS) {
    return { label: "Sin respuesta tras todos los seguimientos", due: true, overdueDays: since - FOLLOWUP_AFTER_DAYS, exhausted: true };
  }
  if (since >= FOLLOWUP_AFTER_DAYS) {
    return { label: `Seguimiento ${used + 1} de ${max}`, due: true, overdueDays: since - FOLLOWUP_AFTER_DAYS, exhausted: false };
  }
  const inDays = FOLLOWUP_AFTER_DAYS - since;
  return { label: `Seguimiento en ${inDays} ${inDays === 1 ? "día" : "días"}`, due: false, overdueDays: 0, exhausted: false };
}

const FLOW: CreatorStage[] = ["new", "contacted", "engaged", "pitched", "closed"];

export function nextStageOf(stage: CreatorStage): CreatorStage | null {
  const i = FLOW.indexOf(stage);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}

/** Moving into a stage for the first time records the date it started. */
export function moveTo(c: Pick<PipelineCreator, "touches">, stage: CreatorStage, at = new Date().toISOString()) {
  const touches = stage === "new" || touchesIn(c, stage).length ? c.touches : [...c.touches, { stage, at }];
  return { stage, touches };
}

export function withFollowup(c: Pick<PipelineCreator, "touches" | "stage">, at = new Date().toISOString()) {
  return { touches: [...c.touches, { stage: c.stage, at }] };
}

export function platformFrom(profileUrl: string | null, source: string | null) {
  const fromUrl = profileUrl ? parseProfileUrl(profileUrl)?.platform : null;
  if (fromUrl && fromUrl !== "web") return fromUrl;
  const s = (source ?? "").toLowerCase();
  return ["tiktok", "instagram", "youtube", "x", "snapchat"].find((p) => s.includes(p)) ?? (s.includes("twitter") ? "x" : null);
}

const MONTHS: Record<string, number> = {
  jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dec: 11, dic: 11,
};

/** Spreadsheet dates often lack a year ("May 16", "8 May", "5.05"); those land in the most recent past occurrence. */
export function parseLooseDate(raw: string, now = new Date()): string | null {
  const s = raw.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/, "$1");
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12)).toISOString();

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  const named = s.match(/^([a-zé]{3})[a-zé]*\.?\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/) ?? null;
  const namedRev = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-zé]{3})[a-zé]*\.?(?:,?\s+(?:de\s+)?(\d{2,4}))?$/) ?? null;
  const numeric = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (named && named[1] in MONTHS) {
    month = MONTHS[named[1]];
    day = +named[2];
    year = named[3] ? +named[3] : null;
  } else if (namedRev && namedRev[2] in MONTHS) {
    day = +namedRev[1];
    month = MONTHS[namedRev[2]];
    year = namedRev[3] ? +namedRev[3] : null;
  } else if (numeric) {
    const a = +numeric[1];
    const b = +numeric[2];
    [day, month] = b > 12 && a <= 12 ? [b, a - 1] : [a, b - 1];
    year = numeric[3] ? +numeric[3] : null;
  } else {
    return null;
  }
  if (year !== null && year < 100) year += 2000;
  if (!(day >= 1 && day <= 31 && month >= 0 && month <= 11)) return null;
  let date = new Date(Date.UTC(year ?? now.getFullYear(), month, day, 12));
  if (year === null && date.getTime() > now.getTime() + DAY) date = new Date(Date.UTC(now.getFullYear() - 1, month, day, 12));
  return date.toISOString();
}

const COLUMNS = {
  name: ["name / brand", "name/brand", "name", "nombre", "brand", "marca", "creator", "creador", "influencer"],
  profileUrl: ["social link", "social", "link", "url", "perfil", "profile", "enlace"],
  email: ["email", "e-mail", "correo", "mail"],
  source: ["source", "fuente", "platform", "plataforma", "red"],
  contacted: ["date initiated", "initiated", "date contacted", "contacted", "contactado", "fecha de contacto", "fecha contacto"],
  engaged: ["date engaged", "engaged", "respondió", "respondio", "fecha respuesta"],
  pitched: ["date pitched", "pitched", "propuesta", "fecha propuesta"],
  closed: ["date closed", "closed", "cerrado", "fecha cierre"],
  lost: ["not interested?", "not interested", "no interesado", "no interesado?"],
  notes: ["notes", "notas", "nota", "comentarios"],
} as const;

function findColumn(header: string[], aliases: readonly string[]) {
  for (const alias of aliases) {
    const i = header.indexOf(alias);
    if (i >= 0) return i;
  }
  for (const alias of aliases) {
    const i = header.findIndex((h) => h.startsWith(alias));
    if (i >= 0) return i;
  }
  return -1;
}

const TRUTHY = new Set(["true", "verdadero", "yes", "si", "sí", "x", "1", "✓", "✔", "checked"]);

/**
 * Reads an outreach spreadsheet exported as CSV. Follow-up columns are recognised by their letter:
 * A1–A9 after first contact, B1–B9 after the reply and C1–C9 after the pitch.
 */
export function parsePipelineCsv(text: string, now = new Date()): { items: PipelineDraft[]; missing: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { items: [], missing: ["cabecera y filas"] };
  const sep = detectCsvSeparator(lines[0]);
  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, aliases]) => [k, findColumn(header, aliases)])) as Record<
    keyof typeof COLUMNS,
    number
  >;
  if (col.name < 0) return { items: [], missing: ["nombre"] };
  const followupCols = (letter: string) => header.flatMap((h, i) => (new RegExp(`^${letter}\\s?\\d$`).test(h) ? [i] : []));
  const followups: Partial<Record<CreatorStage, number[]>> = {
    contacted: followupCols("a"),
    engaged: followupCols("b"),
    pitched: followupCols("c"),
  };

  const items: PipelineDraft[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep);
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const name = cell(col.name).slice(0, 120);
    if (!name) continue;

    const touches: Touch[] = [];
    for (const stage of ["contacted", "engaged", "pitched", "closed"] as const) {
      const dates = [col[stage], ...(followups[stage] ?? [])].map((i) => parseLooseDate(cell(i), now)).filter((d): d is string => !!d);
      for (const at of dates) touches.push({ stage, at });
    }
    const lost = TRUTHY.has(cell(col.lost).toLowerCase());
    const sorted = sanitizeTouches(touches);
    const reached = (["closed", "pitched", "engaged", "contacted"] as const).find((s) => sorted.some((t) => t.stage === s));
    const stage: CreatorStage = lost ? "lost" : reached ?? "new";
    if (lost) sorted.push({ stage: "lost", at: sorted.length ? sorted[sorted.length - 1].at : now.toISOString() });

    const profileUrl = cell(col.profileUrl) || null;
    const source = cell(col.source) || null;
    items.push({
      name,
      email: cell(col.email) || null,
      profileUrl,
      extraLinks: [],
      platform: platformFrom(profileUrl, source),
      source,
      notes: cell(col.notes) || null,
      stage,
      touches: sorted,
    });
  }
  return { items, missing: [] };
}
