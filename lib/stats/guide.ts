import type { GuideScope } from "./types";

export function parsePortalUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^https?:\/\//i.test(raw.trim())) return null;
  return raw.trim().slice(0, 300);
}

export function parseScopes(raw: unknown): GuideScope[] {
  if (!Array.isArray(raw)) return [];
  const out: GuideScope[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { name?: unknown; required?: unknown; note?: unknown };
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    out.push({
      name: o.name.trim().slice(0, 56),
      required: o.required !== false,
      note:
        typeof o.note === "string" && o.note.trim()
          ? o.note.trim().slice(0, 90)
          : undefined,
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function parseSetupSteps(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    .map((s) => s.trim().slice(0, 240))
    .slice(0, 8);
}

export type ConnectorGuideFields = {
  portalUrl: string | null;
  portalLabel: string | null;
  setupSteps: string[];
  scopes: GuideScope[];
  keyType: string | null;
};

export function withGuideFallback(input: {
  portalUrl: string | null;
  portalLabel: string | null;
  setupSteps: string[];
  scopes: GuideScope[];
  keyType: string | null;
}): ConnectorGuideFields {
  const setupSteps = [...input.setupSteps];
  if (setupSteps.length === 0) {
    setupSteps.push(
      "Entra a la web del servicio.",
      "Settings → API o Developer.",
      "Crea la key de lectura / admin read. No uses una key de chat o de una sola app.",
      "Si pide permisos: solo read / usage / analytics. Nada de write.",
      "Copia la key y pégala abajo."
    );
  }
  const scopes = [...input.scopes];
  if (scopes.length === 0) {
    scopes.push(
      { name: "Read / analytics", required: true, note: "Lee métricas" },
      { name: "Usage / cost", required: true, note: "Si existe, márcalo" },
      { name: "Write / admin", required: false, note: "No marques" }
    );
  }
  return {
    portalUrl: input.portalUrl,
    portalLabel:
      typeof input.portalLabel === "string" && input.portalLabel.trim()
        ? input.portalLabel.trim().slice(0, 40)
        : input.portalUrl
          ? "Abrir key"
          : null,
    setupSteps,
    scopes,
    keyType:
      typeof input.keyType === "string" && input.keyType.trim()
        ? input.keyType.trim().slice(0, 64)
        : null,
  };
}

export function parseGuide(raw: Partial<ConnectorGuideFields>): ConnectorGuideFields {
  return withGuideFallback({
    portalUrl: parsePortalUrl(raw.portalUrl),
    portalLabel: raw.portalLabel ?? null,
    setupSteps: parseSetupSteps(raw.setupSteps),
    scopes: parseScopes(raw.scopes),
    keyType: raw.keyType ?? null,
  });
}

export function guideIsThin(guide: {
  setupSteps?: string[] | null;
  scopes?: GuideScope[] | null;
}): boolean {
  return !(guide.scopes?.length) || (guide.setupSteps?.length ?? 0) < 4;
}
