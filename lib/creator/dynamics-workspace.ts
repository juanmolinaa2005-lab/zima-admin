import {
  normalizeOverlayLanguage,
  type OverlayLanguageId,
} from "@/lib/creator/overlay-language";
import type { CaptionStyleId, OverlayPosition } from "@/lib/creator/overlay-styles";
import {
  EMPTY_DYNAMIC_EXTRAS,
  extrasAreMeaningful,
  extrasHaveContent,
  extrasFromPartial,
  isDynamicPartKind,
  parseDynamicExtras,
  parseDynamicPartMeta,
  type DynamicPart,
  type DynamicPartKind,
  type DynamicPartMeta,
  type DynamicPartPrompt,
  type DynamicTemplateExtras,
  type StudioDynamic,
} from "@/lib/creator/dynamics";

export type { DynamicPartMeta };

function partsKey(projectId: string) {
  return `zima:estudio-v1:dynamic-parts:${projectId}`;
}

function templatesKey(projectId: string) {
  return `zima:estudio-v1:dynamic-templates:${projectId}`;
}

function deletedKey(projectId: string) {
  return `zima:estudio-v1:dynamic-deleted:${projectId}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function loadPartMetaMap(
  projectId: string
): Record<string, DynamicPartMeta> {
  const parsed = asRecord(readJson(partsKey(projectId)));
  if (!parsed) return {};
  const out: Record<string, DynamicPartMeta> = {};
  for (const [id, value] of Object.entries(parsed)) {
    out[id] = parseDynamicPartMeta(value);
  }
  return out;
}

export function loadPartPromptsMap(
  projectId: string
): Record<string, DynamicPartPrompt[]> {
  const map = loadPartMetaMap(projectId);
  const out: Record<string, DynamicPartPrompt[]> = {};
  for (const [id, value] of Object.entries(map)) {
    out[id] = value.prompts;
  }
  return out;
}

function writePartMetaMap(projectId: string, map: Record<string, DynamicPartMeta>) {
  const serialized: Record<
    string,
    {
      prompts: DynamicPartPrompt[];
      kind: DynamicPartKind;
      overlayStyle?: CaptionStyleId;
      overlayPosition?: OverlayPosition;
      overlayPrompt?: string;
      overlayLanguage?: OverlayLanguageId;
    }
  > = {};
  for (const [id, value] of Object.entries(map)) {
    serialized[id] = {
      kind: value.kind,
      prompts: value.prompts
        .map((p) => ({ id: p.id, text: p.text.trim().slice(0, 800) }))
        .filter((p) => p.text || value.kind === "overlay"),
      overlayStyle: value.overlayStyle,
      overlayPosition: value.overlayPosition,
      overlayPrompt: value.overlayPrompt || "",
      overlayLanguage: value.overlayLanguage,
    };
  }
  writeJson(partsKey(projectId), serialized);
}

export function savePartPrompts(
  projectId: string,
  partId: string,
  prompts: DynamicPartPrompt[]
) {
  const map = loadPartMetaMap(projectId);
  const prev = map[partId] || { prompts: [], kind: "video" as const };
  map[partId] = { ...prev, prompts };
  writePartMetaMap(projectId, map);
}

export function savePartKind(
  projectId: string,
  partId: string,
  kind: DynamicPartKind
) {
  const map = loadPartMetaMap(projectId);
  const prev = map[partId] || { prompts: [], kind: "video" as const };
  map[partId] = { ...prev, kind };
  writePartMetaMap(projectId, map);
}

export function savePartOverlay(
  projectId: string,
  partId: string,
  input: {
    text?: string;
    overlayStyle?: CaptionStyleId;
    overlayPosition?: OverlayPosition;
  }
) {
  const map = loadPartMetaMap(projectId);
  const prev = map[partId] || { prompts: [], kind: "overlay" as const };
  const first = prev.prompts[0] || { id: `prompt-${Date.now()}`, text: "" };
  map[partId] = {
    ...prev,
    kind: "overlay",
    prompts:
      input.text !== undefined
        ? [{ ...first, text: input.text.slice(0, 140) }]
        : prev.prompts,
    overlayStyle: input.overlayStyle ?? prev.overlayStyle ?? "snapchat",
    overlayPosition: input.overlayPosition ?? prev.overlayPosition ?? "upper",
  };
  writePartMetaMap(projectId, map);
}

export function loadTemplateExtrasMap(
  projectId: string
): Record<string, DynamicTemplateExtras> {
  const parsed = asRecord(readJson(templatesKey(projectId)));
  if (!parsed) return {};
  const out: Record<string, DynamicTemplateExtras> = {};
  for (const [id, value] of Object.entries(parsed)) {
    out[id] = parseDynamicExtras(value);
  }
  return out;
}

export function saveTemplateExtras(
  projectId: string,
  dynamicId: string,
  extras: DynamicTemplateExtras
) {
  const map = loadTemplateExtrasMap(projectId);
  map[dynamicId] = parseDynamicExtras(extras);
  writeJson(templatesKey(projectId), map);
}

export function deleteTemplateExtras(projectId: string, dynamicId: string) {
  const map = loadTemplateExtrasMap(projectId);
  delete map[dynamicId];
  writeJson(templatesKey(projectId), map);
}

function loadDeletedIds(projectId: string): string[] {
  const raw = readJson(deletedKey(projectId));
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && Boolean(id));
}

export function isDynamicDeleted(projectId: string, dynamicId: string) {
  return loadDeletedIds(projectId).includes(dynamicId);
}

export function markDynamicDeleted(projectId: string, dynamicId: string) {
  if (!dynamicId || dynamicId === "new") return;
  const next = Array.from(new Set([...loadDeletedIds(projectId), dynamicId]));
  writeJson(deletedKey(projectId), next);
  deleteTemplateExtras(projectId, dynamicId);
}

export function deletePartPrompts(projectId: string, partId: string) {
  const map = loadPartMetaMap(projectId);
  delete map[partId];
  writePartMetaMap(projectId, map);
}

export function mergeStudioParts(parts: DynamicPart[], projectId: string): DynamicPart[] {
  const meta = loadPartMetaMap(projectId);
  return parts.map((part) => {
    const serverKind = isDynamicPartKind(part.kind) ? part.kind : "video";
    const hasServer =
      serverKind !== "video" ||
      (part.prompts && part.prompts.length > 0) ||
      Boolean(part.overlayStyle);
    const local = !hasServer ? meta[part.id] : null;
    return {
      ...part,
      kind: local?.kind || serverKind,
      prompts: (hasServer ? part.prompts : local?.prompts) || part.prompts || [],
      audioCount: part.audioCount ?? 0,
      audioUrl: part.audioUrl ?? null,
      overlayStyle: part.overlayStyle || local?.overlayStyle,
      overlayPosition: part.overlayPosition || local?.overlayPosition,
      overlayPrompt: part.overlayPrompt || meta[part.id]?.overlayPrompt || "",
      overlayLanguage:
        (local?.kind || serverKind) === "overlay"
          ? normalizeOverlayLanguage(
              part.overlayLanguage || meta[part.id]?.overlayLanguage
            )
          : part.overlayLanguage,
    };
  });
}

export function mergeStudioDynamics(
  dynamics: StudioDynamic[],
  projectId: string
): StudioDynamic[] {
  const extras = loadTemplateExtrasMap(projectId);
  const deleted = new Set(loadDeletedIds(projectId));
  const merged = dynamics.flatMap((item) => {
    if (deleted.has(item.id)) return [];
    if (item.builtin) return [item];
    const server = extrasFromPartial(item);
    const local = extras[item.id];
    const extra = extrasHaveContent(server) ? server : local || server;
    return [
      {
        ...item,
        ...extra,
        name: extra.name || item.name,
      },
    ];
  });
  const seen = new Set(merged.map((item) => item.id));
  const localOnly = Object.entries(extras).flatMap(([id, extra]) => {
    if (deleted.has(id) || seen.has(id) || !extrasAreMeaningful(extra)) return [];
    return [
      {
        id,
        name: extra.name || "New dynamic",
        description: "Plantilla: parts, overlay y música.",
        builtin: false,
        folderId: "",
        ...EMPTY_DYNAMIC_EXTRAS,
        ...extra,
        slots: [],
      } satisfies StudioDynamic,
    ];
  });
  return [...merged, ...localOnly];
}

export async function pushDynamicExtras(
  projectId: string,
  dynamicId: string,
  extras: DynamicTemplateExtras
) {
  if (isDynamicDeleted(projectId, dynamicId)) return;
  saveTemplateExtras(projectId, dynamicId, extras);
  const res = await fetch(
    `/api/projects/${projectId}/creator/dynamics/${encodeURIComponent(dynamicId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extras),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo guardar la dinámica");
}

export async function pushPartMeta(
  projectId: string,
  partId: string,
  meta: Partial<DynamicPartMeta> & { text?: string; name?: string }
) {
  if (meta.kind) savePartKind(projectId, partId, meta.kind);
  if (meta.prompts) savePartPrompts(projectId, partId, meta.prompts);
  if (meta.text !== undefined || meta.overlayStyle || meta.overlayPosition) {
    savePartOverlay(projectId, partId, {
      text: meta.text,
      overlayStyle: meta.overlayStyle,
      overlayPosition: meta.overlayPosition,
    });
  }
  if (meta.overlayPrompt !== undefined || meta.overlayLanguage !== undefined) {
    const map = loadPartMetaMap(projectId);
    const prev = map[partId] || { prompts: [], kind: "overlay" as const };
    map[partId] = {
      ...prev,
      ...(meta.overlayPrompt !== undefined
        ? { overlayPrompt: meta.overlayPrompt.slice(0, 800) }
        : {}),
      ...(meta.overlayLanguage !== undefined
        ? { overlayLanguage: normalizeOverlayLanguage(meta.overlayLanguage) }
        : {}),
    };
    writePartMetaMap(projectId, map);
  }
  const res = await fetch(
    `/api/projects/${projectId}/creator/dynamics/parts/${encodeURIComponent(partId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo guardar la part");
}

export async function purgeDeletedDynamics(
  projectId: string,
  dynamics: StudioDynamic[]
) {
  const deleted = new Set(loadDeletedIds(projectId));
  await Promise.all(
    dynamics
      .filter((item) => !item.builtin && deleted.has(item.id))
      .map((item) =>
        fetch(
          `/api/projects/${projectId}/creator/dynamics/${encodeURIComponent(item.id)}`,
          { method: "DELETE" }
        ).catch(() => undefined)
      )
  );
}

export async function pushLocalDynamicsToServer(
  projectId: string,
  dynamics: StudioDynamic[],
  parts: DynamicPart[]
) {
  const extras = loadTemplateExtrasMap(projectId);
  const partMeta = loadPartMetaMap(projectId);
  const serverIds = new Set(
    dynamics.filter((item) => !item.builtin && item.folderId).map((item) => item.id)
  );
  let created = 0;
  await Promise.all([
    ...Object.entries(extras).map(([id, extra]) => {
      if (isDynamicDeleted(projectId, id) || !extrasAreMeaningful(extra)) {
        return Promise.resolve();
      }
      if (serverIds.has(id)) {
        const item = dynamics.find((dynamic) => dynamic.id === id);
        if (item && extrasHaveContent(extrasFromPartial(item))) return Promise.resolve();
        return fetch(`/api/projects/${projectId}/creator/dynamics/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra),
        }).catch(() => undefined);
      }
      return fetch(`/api/projects/${projectId}/creator/dynamics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...extra,
          id,
          name: extra.name || `Template ${id.slice(0, 8)}`,
        }),
      })
        .then((res) => {
          if (res.ok) created += 1;
        })
        .catch(() => undefined);
    }),
    ...parts
      .filter((part) => {
        const local = partMeta[part.id];
        if (!local) return false;
        const serverEmpty =
          (part.kind === "video" || part.kind === "mimic") &&
          !(part.prompts && part.prompts.length) &&
          !part.overlayStyle;
        return serverEmpty;
      })
      .map((part) =>
        fetch(
          `/api/projects/${projectId}/creator/dynamics/parts/${encodeURIComponent(part.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(partMeta[part.id]),
          }
        ).catch(() => undefined)
      ),
  ]);
  return { created };
}
