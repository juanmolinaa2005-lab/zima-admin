"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  ACTIVE_STAGES,
  STAGE,
  STAGES,
  daysSince,
  followupCount,
  lastTouchAt,
  moveTo,
  nextStageOf,
  nextStep,
  parsePipelineCsv,
  platformFrom,
  stageStartedAt,
  withFollowup,
  type CreatorStage,
  type PipelineCreator,
  type PipelineDraft,
} from "@/lib/influencers/pipeline";
import { parseProfileUrl } from "@/lib/viewtracker/profile";
import { LinkIcon } from "../icons";
import { PlatformLogo, VT_PLATFORMS } from "../viewtracker/vt-ui";
import {
  api,
  Button,
  Card,
  copyText,
  Dot,
  Drawer,
  Empty,
  Field,
  Header,
  notifyError,
  Page,
  Segmented,
  SelectInput,
  TextArea,
  TextInput,
  useLoad,
  useRefreshOnActive,
} from "./ui";

type Mode = "board" | "table";
type Draft = Partial<PipelineCreator>;

const KNOWN_PLATFORMS = new Set<string>(VT_PLATFORMS.map((p) => p.id));
const STAGE_OPTIONS = STAGES.map((s) => ({ id: s.id, label: s.label }));

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" }) : "—";
}

function ago(iso: string | null) {
  const d = daysSince(iso);
  if (d === null) return "Nunca";
  if (d <= 0) return "Hoy";
  if (d === 1) return "Ayer";
  return `Hace ${d} días`;
}

function profileHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function FollowupDots({ creator }: { creator: PipelineCreator }) {
  const max = STAGE[creator.stage].maxFollowups;
  if (!max) return null;
  const used = followupCount(creator, creator.stage);
  return (
    <span className="inline-flex items-center gap-0.5" title={`${used} de ${max} seguimientos en esta etapa`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < used ? "bg-[var(--foreground)]" : "bg-black/[0.12]"}`} />
      ))}
    </span>
  );
}

function NextStepBadge({ creator }: { creator: PipelineCreator }) {
  const step = nextStep(creator);
  const tone = step.exhausted ? "ui-tag-danger" : step.due ? "ui-tag-warning" : "ui-tag-muted";
  return <span className={`ui-tag ${tone} whitespace-nowrap`}>{step.due && !step.exhausted && creator.stage !== "new" ? `Toca: ${step.label.toLowerCase()}` : step.label}</span>;
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">{children}</p>;
}

function CreatorAvatar({ creator, className }: { creator: Pick<PipelineCreator, "name" | "profileUrl">; className: string }) {
  const url = creator.profileUrl ? parseProfileUrl(creator.profileUrl)?.avatarUrl : null;
  const [failed, setFailed] = useState<string | null>(null);
  const src = url && url !== failed ? url : null;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-[var(--surface-alt)] font-semibold text-[var(--muted)] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(src)} />
      ) : (
        (creator.name[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}

function CreatorRow({
  creator: c,
  onOpen,
  onStage,
  onFollowUp,
}: {
  creator: PipelineCreator;
  onOpen: () => void;
  onStage: (stage: CreatorStage) => void;
  onFollowUp: () => void;
}) {
  const step = nextStep(c);
  const next = nextStageOf(c.stage);
  const active = ACTIVE_STAGES.includes(c.stage);
  const due = active && step.due;
  const links = [c.profileUrl, ...(c.extraLinks ?? [])].filter((l): l is string => Boolean(l));
  return (
    <li
      className={`relative flex min-h-[84px] flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-[24px] border bg-white py-3.5 pl-[100px] pr-4 xl:grid xl:grid-cols-[minmax(0,1.3fr)_128px_150px_minmax(0,1fr)_250px] shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-sm)] ${
        due ? "border-amber-300" : "border-[var(--border)]"
      }`}
    >
      <button type="button" onClick={onOpen} tabIndex={-1} aria-hidden className="absolute inset-y-0 left-0 w-[84px]">
        <CreatorAvatar creator={c} className="h-full w-full text-[22px]" />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-[180px] flex-1 items-center text-left xl:min-w-0">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{c.name}</span>
          <span className="block truncate text-[12px] text-[var(--muted-soft)]">
            {c.stage === "new" ? "Sin contactar" : `Último contacto: ${ago(lastTouchAt(c)).toLowerCase()}`}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-1">
        {links.map((link, i) => {
          const platform = platformFrom(link, null);
          return (
            <a
              key={`${link}-${i}`}
              href={profileHref(link)}
              target="_blank"
              rel="noreferrer"
              title={link}
              aria-label={`${VT_PLATFORMS.find((p) => p.id === platform)?.label ?? "Perfil"} de ${c.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              {platform && KNOWN_PLATFORMS.has(platform) ? <PlatformLogo id={platform} className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            </a>
          );
        })}
      </div>

      <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/60 pl-2.5 pr-7 text-[12px] font-semibold text-[var(--foreground)] hover:border-[var(--border-strong)]">
        <Dot color={STAGE[c.stage].color} />
        {STAGE[c.stage].label}
        <span aria-hidden className="pointer-events-none absolute right-2.5 text-[10px] text-[var(--muted-soft)]">▾</span>
        <select
          aria-label={`Etapa de ${c.name}`}
          value={c.stage}
          onChange={(e) => onStage(e.target.value as CreatorStage)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-w-0 items-center gap-2">
        <NextStepBadge creator={c} />
        <FollowupDots creator={c} />
      </div>

      <div className="ml-auto flex items-center justify-end gap-1.5">
        {step.exhausted ? (
          <Button variant="ghost" onClick={() => onStage("lost")}>
            No interesado
          </Button>
        ) : active ? (
          <Button onClick={onFollowUp}>+ Seguimiento</Button>
        ) : null}
        {next ? (
          <Button variant={due || c.stage === "new" ? "primary" : "secondary"} onClick={() => onStage(next)}>
            {STAGE[next].label} →
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function linksOf(d: Draft) {
  return [d.profileUrl, ...(d.extraLinks ?? [])].filter((l): l is string => Boolean(l?.trim()));
}

function withLinks(d: Draft, links: string[]): Draft {
  return { ...d, profileUrl: links[0] ?? null, extraLinks: links.slice(1) };
}

function linkLabel(url: string) {
  const meta = parseProfileUrl(url);
  return meta?.username ? `@${meta.username}` : url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function NetworksCard({
  draft,
  onRemove,
  onMakePrimary,
}: {
  draft: Draft;
  onRemove: (index: number) => void;
  onMakePrimary: (index: number) => void;
}) {
  const links = linksOf(draft);
  const meta = draft.profileUrl ? parseProfileUrl(draft.profileUrl) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const avatar = meta?.username && meta.avatarUrl !== failed ? meta.avatarUrl : null;
  const name = draft.name?.trim() || (meta?.username ? `@${meta.username}` : "");
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-3 sm:w-[180px] sm:shrink-0">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-alt)] text-[18px] font-semibold text-[var(--muted)]">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" onError={() => setFailed(avatar)} />
          ) : (
            (name.replace("@", "")[0] ?? "?").toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold ${name ? "text-[var(--foreground)]" : "text-[var(--muted-soft)]"}`}>{name || "Nuevo creador"}</p>
          {draft.stage ? (
            <span className="ui-tag ui-tag-muted mt-1">
              <Dot color={STAGE[draft.stage].color} />
              {STAGE[draft.stage].label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 flex-1 border-t border-[var(--border)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">
          Redes{links.length ? ` · ${links.length}` : ""}
        </p>
        {links.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {links.map((link, i) => {
              const platform = platformFrom(link, null);
              return (
                <li
                  key={`${link}-${i}`}
                  className={`group inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border pl-2.5 pr-1 text-[12px] ${
                    i === 0 && links.length > 1 ? "border-[var(--foreground)]/25 bg-white" : "border-[var(--border)] bg-[var(--surface-alt)]/60"
                  }`}
                >
                  {platform && KNOWN_PLATFORMS.has(platform) ? (
                    <PlatformLogo id={platform} className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-soft)]" />
                  )}
                  <a
                    href={profileHref(link)}
                    target="_blank"
                    rel="noreferrer"
                    title={link}
                    className="min-w-0 truncate font-medium text-[var(--foreground)] hover:underline"
                  >
                    {linkLabel(link)}
                  </a>
                  {i === 0 && links.length > 1 ? (
                    <span className="shrink-0 text-[10px] font-semibold text-[var(--muted-soft)]">Principal</span>
                  ) : i > 0 ? (
                    <button
                      type="button"
                      onClick={() => onMakePrimary(i)}
                      className="hidden shrink-0 text-[10px] font-semibold text-[var(--muted-soft)] hover:text-[var(--foreground)] focus-visible:inline group-hover:inline"
                    >
                      Hacer principal
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Quitar ${linkLabel(link)}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] text-[var(--muted-soft)] hover:bg-black/[0.06] hover:text-[var(--foreground)]"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-[var(--muted-soft)]">Las redes que pegues aparecerán aquí</p>
        )}
      </div>
    </div>
  );
}

function LinkPaste({ autoFocus, full, onAdd }: { autoFocus?: boolean; full?: boolean; onAdd: (url: string) => void }) {
  const [value, setValue] = useState("");
  const add = (raw = value) => {
    const url = raw.trim();
    if (!url) return;
    onAdd(url);
    setValue("");
  };
  return (
    <div>
      <label htmlFor="creator-link" className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">
        Pega sus links
      </label>
      <div className="flex h-12 items-center gap-2 rounded-[14px] border border-[var(--border)] bg-white pl-3.5 pr-1.5 shadow-[var(--shadow-xs)] focus-within:border-[var(--foreground)] focus-within:shadow-[0_0_0_3px_rgba(17,17,19,0.08)]">
        <LinkIcon className="h-4 w-4 shrink-0 text-[var(--muted-soft)]" />
        <input
          id="creator-link"
          autoFocus={autoFocus}
          disabled={full}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (!text || value.trim()) return;
            e.preventDefault();
            add(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => add()}
          placeholder={full ? "Máximo de redes alcanzado" : "youtube.com/@canal, tiktok.com/@usuario…"}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
        />
        {value.trim() ? (
          <Button variant="primary" onClick={() => add()}>
            Añadir
          </Button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted-soft)]">Pega un link y se añade solo. Puedes añadir todas sus redes.</p>
    </div>
  );
}

export function InfluencerPipelinePage({ projectId, active }: { projectId: string; active?: boolean }) {
  const base = `/api/projects/${projectId}/viewtracker/creators`;
  const { data, setData, loading, reload } = useLoad<{ items: PipelineCreator[] }>(base, { items: [] });
  useRefreshOnActive(active, reload);
  const creators = data.items;

  const [mode, setMode] = useState<Mode>("board");
  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [stageFilter, setStageFilter] = useState<CreatorStage | "all">("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return creators.filter(
      (c) =>
        (!q || `${c.name} ${c.email ?? ""} ${c.profileUrl ?? ""} ${c.extraLinks?.join(" ") ?? ""} ${c.source ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(q)) &&
        (!dueOnly || (ACTIVE_STAGES.includes(c.stage) && nextStep(c).due)),
    );
  }, [creators, search, dueOnly]);

  const listed = useMemo(() => {
    const rank = (c: PipelineCreator) => (ACTIVE_STAGES.includes(c.stage) && nextStep(c).due ? 0 : 1);
    return visible
      .filter((c) => stageFilter === "all" || c.stage === stageFilter)
      .sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
  }, [visible, stageFilter]);

  const dueCount = useMemo(() => creators.filter((c) => ACTIVE_STAGES.includes(c.stage) && nextStep(c).due).length, [creators]);

  const importPreview = useMemo(() => (importText.trim() ? parsePipelineCsv(importText) : null), [importText]);

  function upsertLocal(item: PipelineCreator) {
    setData((d) => ({ items: d.items.some((c) => c.id === item.id) ? d.items.map((c) => (c.id === item.id ? item : c)) : [item, ...d.items] }));
  }

  async function patch(id: string, changes: Partial<PipelineCreator>) {
    const prev = creators.find((c) => c.id === id);
    if (!prev) return;
    upsertLocal({ ...prev, ...changes });
    if (draft?.id === id) setDraft((d) => (d ? { ...d, ...changes } : d));
    try {
      const { item } = await api<{ item: PipelineCreator }>(base, "PATCH", { id, ...changes });
      upsertLocal(item);
    } catch (e) {
      upsertLocal(prev);
      notifyError(e);
    }
  }

  function advance(c: PipelineCreator, stage: CreatorStage | null = nextStageOf(c.stage)) {
    if (!stage) return;
    void patch(c.id, moveTo(c, stage));
    toast.success(`${c.name} → ${STAGE[stage].label}`);
  }

  function followUp(c: PipelineCreator) {
    void patch(c.id, withFollowup(c));
    toast.success(`Seguimiento registrado con ${c.name}`);
  }

  function addLink(url: string) {
    if (draft && linksOf(draft).includes(url)) {
      toast.message("Ese link ya está añadido");
      return;
    }
    setDraft((d) => {
      if (!d) return d;
      const links = linksOf(d);
      if (links.includes(url)) return d;
      const handle = parseProfileUrl(url)?.username;
      const label = VT_PLATFORMS.find((p) => p.id === platformFrom(url, null))?.label;
      return {
        ...withLinks(d, [...links, url]),
        name: d.name?.trim() ? d.name : (handle ?? d.name),
        source: d.source || label || d.source,
      };
    });
  }

  async function save() {
    if (!draft?.name?.trim()) {
      toast.error("Ponle un nombre");
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name,
      email: draft.email ?? "",
      profileUrl: draft.profileUrl ?? "",
      extraLinks: (draft.extraLinks ?? []).map((l) => l.trim()).filter(Boolean),
      source: draft.source ?? "",
      notes: draft.notes ?? "",
      stage: draft.stage ?? "new",
      touches: draft.touches ?? [],
    };
    try {
      const { item } = draft.id
        ? await api<{ item: PipelineCreator }>(base, "PATCH", { id: draft.id, ...payload })
        : await api<{ item: PipelineCreator }>(base, "POST", { ...payload, ...moveTo({ touches: [] }, payload.stage) });
      upsertLocal(item);
      toast.success("Guardado");
      setDraft(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este creador del seguimiento?")) return;
    try {
      await api(`${base}?id=${id}`, "DELETE");
      setData((d) => ({ items: d.items.filter((c) => c.id !== id) }));
      setDraft(null);
    } catch (e) {
      notifyError(e);
    }
  }

  async function runImport() {
    if (!importPreview?.items.length) return;
    setImporting(true);
    try {
      const { items } = await api<{ items: PipelineCreator[] }>(base, "POST", { items: importPreview.items satisfies PipelineDraft[] });
      setData((d) => ({ items: [...items, ...d.items] }));
      toast.success(`${items.length} creadores importados`);
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      notifyError(e);
    } finally {
      setImporting(false);
    }
  }

  function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then(setImportText, notifyError);
  }


  const openNew = (stage: CreatorStage = "new") => setDraft({ name: "", stage, touches: [] });
  const live = draft?.id ? (creators.find((c) => c.id === draft.id) ?? null) : null;

  return (
    <Page>
      <Header
        kicker="Seguimiento"
        title="Influencers"
        subtitle="Cada creador avanza por etapas. Registra cada mensaje con un clic y te avisamos cuándo toca volver a escribir."
        actions={
          <>
            <Button onClick={() => setImportOpen(true)}>Importar desde Excel</Button>
            <Button variant="primary" onClick={() => openNew()}>
              + Añadir creador
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Vista"
          value={mode}
          onChange={setMode}
          options={[
            { id: "board", label: "Tarjetas" },
            { id: "table", label: "Tabla" },
          ]}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, link o nota…"
          className="ui-input h-9 min-w-[200px] flex-1 text-[13px]"
        />
        <button
          type="button"
          aria-pressed={dueOnly}
          onClick={() => setDueOnly((v) => !v)}
          className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition ${
            dueOnly ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
          }`}
        >
          Solo los que toca escribir
          <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${dueOnly ? "bg-white/20" : "bg-[var(--surface-alt)]"}`}>{dueCount}</span>
        </button>
      </div>

      {loading ? (
        <div className="ui-skeleton h-[520px] rounded-2xl" />
      ) : creators.length === 0 ? (
        <Empty
          title="Aún no hay creadores en seguimiento"
          text="Importa tu Excel de outreach o añade a mano los creadores con los que quieres colaborar."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setImportOpen(true)}>Importar desde Excel</Button>
              <Button variant="primary" onClick={() => openNew()}>
                + Añadir creador
              </Button>
            </div>
          }
        />
      ) : mode === "board" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por etapa">
            {([{ id: "all", label: "Todos", color: null }, ...STAGES] as const).map((st) => {
              const on = stageFilter === st.id;
              const count = st.id === "all" ? creators.length : creators.filter((c) => c.stage === st.id).length;
              return (
                <button
                  key={st.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStageFilter(st.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ${
                    on
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {st.color ? <Dot color={st.color} /> : null}
                  {st.label}
                  <span className={`tabular-nums ${on ? "text-white/70" : "text-[var(--muted-soft)]"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {listed.length === 0 ? (
            <Empty title="Nada por aquí" text="Ningún creador coincide con la búsqueda o el filtro." />
          ) : (
            <ul className="space-y-2">
              {listed.map((c) => (
                <CreatorRow
                  key={c.id}
                  creator={c}
                  onOpen={() => setDraft({ ...c })}
                  onStage={(stage) => advance(c, stage)}
                  onFollowUp={() => followUp(c)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : visible.length === 0 ? (
        <Empty title="Nada por aquí" text="Ningún creador coincide con la búsqueda o el filtro." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                <th className="px-4 py-2.5 font-semibold">Creador</th>
                <th className="px-3 py-2.5 font-semibold">Etapa</th>
                <th className="px-3 py-2.5 font-semibold">Contactado</th>
                <th className="px-3 py-2.5 font-semibold">Respondió</th>
                <th className="px-3 py-2.5 font-semibold">Propuesta</th>
                <th className="px-3 py-2.5 font-semibold">Cerrado</th>
                <th className="px-3 py-2.5 font-semibold">Último contacto</th>
                <th className="px-3 py-2.5 font-semibold">Próximo paso</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-alt)]/50">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => setDraft({ ...c })} className="flex min-w-0 items-center gap-2 text-left">
                      {c.platform && KNOWN_PLATFORMS.has(c.platform) ? <PlatformLogo id={c.platform} className="h-4 w-4 shrink-0" /> : null}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--foreground)]">{c.name}</span>
                        {c.email ? <span className="block truncate text-[11px] text-[var(--muted-soft)]">{c.email}</span> : null}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <SelectInput
                      value={c.stage}
                      onChange={(v) => advance(c, v as CreatorStage)}
                      options={STAGE_OPTIONS}
                      className="h-8 w-[140px] text-[12px]"
                    />
                  </td>
                  {(["contacted", "engaged", "pitched", "closed"] as const).map((stage) => (
                    <td key={stage} className="px-3 py-2.5 tabular-nums text-[var(--foreground-soft)]">
                      {shortDate(stageStartedAt(c, stage))}
                      {followupCount(c, stage) ? <span className="ml-1 text-[11px] text-[var(--muted-soft)]">+{followupCount(c, stage)}</span> : null}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.stage === "new" ? "—" : ago(lastTouchAt(c))}</td>
                  <td className="px-3 py-2.5">
                    <NextStepBadge creator={c} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {ACTIVE_STAGES.includes(c.stage) ? (
                      <Button size="sm" onClick={() => followUp(c)}>
                        + Seguimiento
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Drawer
        open={draft !== null}
        title={draft?.id ? draft.name || "Creador" : "Nuevo creador"}
        subtitle={live ? `${STAGE[live.stage].label} · ${nextStep(live).label}` : "Añádelo al seguimiento"}
        onClose={() => setDraft(null)}
        wide
        aside={
          draft ? (
            <NetworksCard
              draft={draft}
              onRemove={(i) => setDraft((d) => (d ? withLinks(d, linksOf(d).filter((_, j) => j !== i)) : d))}
              onMakePrimary={(i) =>
                setDraft((d) => {
                  if (!d) return d;
                  const links = linksOf(d);
                  return withLinks(d, [links[i], ...links.filter((_, j) => j !== i)]);
                })
              }
            />
          ) : null
        }
        footer={
          <>
            {draft?.id ? (
              <Button variant="danger" onClick={() => remove(draft.id!)}>
                Eliminar
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-5">
            {live && (ACTIVE_STAGES.includes(live.stage) || nextStageOf(live.stage)) ? (
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
                {ACTIVE_STAGES.includes(live.stage) ? <Button onClick={() => followUp(live)}>+ Registrar seguimiento</Button> : null}
                {nextStageOf(live.stage) ? (
                  <Button variant="primary" onClick={() => advance(live)}>
                    Pasar a {STAGE[nextStageOf(live.stage)!].label}
                  </Button>
                ) : null}
                {live.stage !== "lost" && live.stage !== "closed" ? (
                  <Button variant="ghost" onClick={() => advance(live, "lost")}>
                    No interesado
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="min-w-0 space-y-5">
                <LinkPaste autoFocus={!draft.id} full={linksOf(draft).length >= 11} onAdd={addLink} />

                <div>
                  <label htmlFor="creator-name" className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">
                    Nombre o marca
                  </label>
                  <input
                    id="creator-name"
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ej. Make Money Matt"
                    className="h-12 w-full rounded-[14px] border border-[var(--border)] bg-white px-3.5 text-[16px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-xs)] outline-none placeholder:font-normal placeholder:text-[var(--muted-soft)] focus:border-[var(--foreground)] focus:shadow-[0_0_0_3px_rgba(17,17,19,0.08)]"
                  />
                </div>

                <Field label="Email">
                  <div className="flex gap-2">
                    <TextInput
                      type="email"
                      value={draft.email ?? ""}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      placeholder="creador@email.com"
                      className="min-w-0 flex-1"
                    />
                    {draft.email ? (
                      <Button title="Copiar email" onClick={() => copyText(draft.email!, "Email copiado")}>
                        Copiar
                      </Button>
                    ) : null}
                  </div>
                </Field>

            <section className="space-y-3">
              <SectionLabel>Notas</SectionLabel>
              <TextArea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Tarifa, condiciones, lo que hablasteis…" />
            </section>

            {live ? (
              <div>
                <p className="mb-2 text-[12px] font-medium text-[var(--foreground-soft)]">Historial de contacto</p>
                {live.touches.length ? (
                  <ol className="space-y-1.5">
                    {[...live.touches].reverse().map((t, i, list) => {
                      const first = list.findLastIndex((x) => x.stage === t.stage) === i;
                      return (
                        <li key={`${t.at}-${i}`} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[12px]">
                          <Dot color={STAGE[t.stage].color} />
                          <span className="font-medium text-[var(--foreground)]">
                            {first ? (t.stage === "contacted" ? "Primer contacto" : `Pasó a ${STAGE[t.stage].label}`) : "Seguimiento"}
                          </span>
                          <span className="ml-auto tabular-nums text-[var(--muted)]">
                            {new Date(t.at).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-[12px] text-[var(--muted-soft)]">
                    Aún no lo has contactado
                  </p>
                )}
              </div>
            ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={importOpen}
        title="Importar desde Excel"
        subtitle="Exporta tu hoja como CSV (Archivo → Descargar → CSV) y súbela aquí"
        onClose={() => setImportOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={runImport} disabled={importing || !importPreview?.items.length}>
              {importing ? "Importando…" : importPreview?.items.length ? `Importar ${importPreview.items.length} creadores` : "Importar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-white p-3 text-[12px] leading-relaxed text-[var(--muted)]">
            Reconocemos columnas como <b>Name / Brand</b>, <b>Social Link</b>, <b>Email</b>, <b>Source</b>, <b>Date Initiated</b>, <b>Date Engaged</b>,{" "}
            <b>Date Pitched</b>, <b>Date Closed</b>, <b>Not Interested?</b> y <b>Notes</b> (también en español). Las columnas <b>A1–A3</b>, <b>B1–B5</b> y{" "}
            <b>C1–C5</b> se guardan como seguimientos de cada etapa.
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" onChange={readFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()}>Elegir archivo CSV</Button>
            <span className="text-[12px] text-[var(--muted-soft)]">o pega las celdas copiadas de la hoja</span>
          </div>
          <TextArea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Name / Brand,Social Link,Email,…" className="min-h-[140px] font-mono text-[11px]" />

          {importPreview?.missing.length ? (
            <p className="text-[12px] font-medium text-[var(--danger)]">Falta la columna de {importPreview.missing.join(", ")}.</p>
          ) : importPreview?.items.length ? (
            <div>
              <p className="mb-2 text-[12px] font-medium text-[var(--foreground-soft)]">
                Vista previa · {importPreview.items.length} creadores
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STAGES.map((s) => (
                  <div key={s.id} className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5">
                    <p className="flex items-center gap-1 text-[10px] font-medium text-[var(--muted)]">
                      <Dot color={s.color} />
                      {s.label}
                    </p>
                    <p className="text-[15px] font-semibold tabular-nums">{importPreview.items.filter((c) => c.stage === s.id).length}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-3 max-h-[220px] space-y-1 overflow-y-auto">
                {importPreview.items.slice(0, 50).map((c, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px]">
                    <Dot color={STAGE[c.stage].color} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="text-[11px] text-[var(--muted-soft)]">
                      {c.touches.length} {c.touches.length === 1 ? "contacto" : "contactos"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Drawer>
    </Page>
  );
}
