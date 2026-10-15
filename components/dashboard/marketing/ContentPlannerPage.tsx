"use client";

import { useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import {
  CONTENT_FORMATS,
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  isoDay,
  type ContentPost,
  type ContentStatus,
} from "@/lib/marketing/types";
import { PlatformLogo } from "../viewtracker/vt-ui";
import type { ViewId } from "../nav";
import { UgcFlow } from "./UgcFlow";
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
  Kpi,
  notifyError,
  Page,
  Segmented,
  SelectInput,
  TextArea,
  TextInput,
  useLoad,
} from "./ui";

type Mode = "calendar" | "board" | "list";
type Draft = Partial<ContentPost> & { hashtagsText?: string };

const STATUS = Object.fromEntries(CONTENT_STATUSES.map((s) => [s.id, s])) as Record<ContentStatus, (typeof CONTENT_STATUSES)[number]>;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function moveToDay(iso: string | null, day: Date) {
  const base = iso ? new Date(iso) : null;
  const next = new Date(day);
  next.setHours(base ? base.getHours() : 10, base ? base.getMinutes() : 0, 0, 0);
  return next.toISOString();
}

function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function PostChip({ post, onOpen, compact }: { post: ContentPost; onOpen: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post", post.id)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={post.title}
      className="group flex w-full cursor-grab items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-left text-[11px] font-medium text-[var(--foreground-soft)] shadow-[var(--shadow-xs)] transition hover:-translate-y-px hover:border-[var(--border-strong)] active:cursor-grabbing"
    >
      <Dot color={STATUS[post.status]?.color ?? "#a1a1aa"} />
      <PlatformLogo id={post.platform} className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {!compact && post.scheduled_at ? (
          <span className="mr-1 tabular-nums text-[var(--muted-soft)]">
            {new Date(post.scheduled_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
        {post.title}
      </span>
    </button>
  );
}

export function ContentPlannerPage({ projectId, onNavigate }: { projectId: string; onNavigate: (view: ViewId) => void }) {
  const base = `/api/projects/${projectId}/content/posts`;
  const { data, setData, loading } = useLoad<{ items: ContentPost[] }>(base, { items: [] });
  const posts = data.items;

  const [mode, setMode] = useState<Mode>("calendar");
  const [cursor, setCursor] = useState(() => new Date());
  const [platform, setPlatform] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideaOpts, setIdeaOpts] = useState({ platform: "tiktok", count: 6, brief: "" });
  const [generating, setGenerating] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (!platform || p.platform === platform) &&
        (!q || `${p.title} ${p.hook ?? ""} ${p.caption ?? ""} ${p.pillar ?? ""}`.toLowerCase().includes(q)),
    );
  }, [posts, platform, search]);

  const stats = useMemo(() => {
    const now = new Date().getTime();
    const week = now + 7 * 864e5;
    const month = now - 30 * 864e5;
    return {
      ideas: posts.filter((p) => p.status === "idea").length,
      inProgress: posts.filter((p) => ["script", "production", "review"].includes(p.status)).length,
      toCreate: posts.filter((p) => p.status === "script" || p.status === "production").length,
      thisWeek: posts.filter((p) => p.scheduled_at && +new Date(p.scheduled_at) >= now && +new Date(p.scheduled_at) <= week).length,
      published: posts.filter((p) => p.status === "published" && +new Date(p.scheduled_at ?? p.updated_at) >= month).length,
    };
  }, [posts]);

  function upsertLocal(item: ContentPost) {
    setData((d) => ({ items: d.items.some((p) => p.id === item.id) ? d.items.map((p) => (p.id === item.id ? item : p)) : [...d.items, item] }));
  }

  async function patch(id: string, changes: Partial<ContentPost>) {
    const prev = posts.find((p) => p.id === id);
    if (!prev) return;
    upsertLocal({ ...prev, ...changes });
    try {
      const { item } = await api<{ item: ContentPost }>(base, "PATCH", { id, ...changes });
      upsertLocal(item);
    } catch (e) {
      upsertLocal(prev);
      notifyError(e);
    }
  }

  async function save() {
    if (!draft?.title?.trim()) {
      toast.error("Ponle un título");
      return;
    }
    setSaving(true);
    const payload = { ...draft, hashtags: draft.hashtagsText ?? draft.hashtags ?? [] };
    delete payload.hashtagsText;
    try {
      if (draft.id) {
        const { item } = await api<{ item: ContentPost }>(base, "PATCH", payload);
        upsertLocal(item);
      } else {
        const { item } = await api<{ item: ContentPost }>(base, "POST", payload);
        upsertLocal(item);
      }
      toast.success("Guardado");
      setDraft(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function sendToInfluencers() {
    if (!draft?.title?.trim()) {
      toast.error("Ponle un título");
      return;
    }
    copyText([draft.hook, draft.script].filter(Boolean).join("\n\n"), "Hook y guion copiados · pégalos en el influencer");
    setSaving(true);
    const payload = {
      ...draft,
      hashtags: draft.hashtagsText ?? draft.hashtags ?? [],
      status: draft.status === "idea" || draft.status === "script" || !draft.status ? "production" : draft.status,
    };
    delete payload.hashtagsText;
    try {
      const { item } = await api<{ item: ContentPost }>(base, draft.id ? "PATCH" : "POST", payload);
      upsertLocal(item);
      setDraft(null);
      onNavigate("ai-influencers");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta pieza de contenido?")) return;
    try {
      await api(`${base}?id=${id}`, "DELETE");
      setData((d) => ({ items: d.items.filter((p) => p.id !== id) }));
      setDraft(null);
    } catch (e) {
      notifyError(e);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ items: ContentPost[]; source: string }>(`/api/projects/${projectId}/content/ideas`, "POST", ideaOpts);
      setData((d) => ({ items: [...d.items, ...res.items] }));
      toast.success(
        res.source === "ai" ? `${res.items.length} ideas nuevas generadas con IA` : `${res.items.length} ideas desde plantillas (conecta OpenAI en Ajustes → API para usar IA)`,
      );
      setIdeasOpen(false);
      setMode("board");
    } catch (e) {
      notifyError(e);
    } finally {
      setGenerating(false);
    }
  }

  function openNew(extra: Partial<ContentPost> = {}) {
    setDraft({ title: "", platform: platform ?? "tiktok", format: "video", status: extra.scheduled_at ? "scheduled" : "idea", ...extra });
  }

  function drop(e: DragEvent, apply: (post: ContentPost) => Partial<ContentPost>) {
    e.preventDefault();
    setDropTarget(null);
    const id = e.dataTransfer.getData("text/post");
    const post = posts.find((p) => p.id === id);
    if (post) void patch(id, apply(post));
  }

  const dropProps = (key: string, apply: (post: ContentPost) => Partial<ContentPost>) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: DragEvent) => drop(e, apply),
  });

  const grid = monthGrid(cursor);
  const todayKey = isoDay(new Date());
  const byDay = new Map<string, ContentPost[]>();
  for (const p of visible) {
    if (!p.scheduled_at) continue;
    const k = isoDay(new Date(p.scheduled_at));
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const unscheduled = visible.filter((p) => !p.scheduled_at && p.status !== "published");

  return (
    <Page>
      <Header
        kicker="UGC · Paso 1"
        title="Plan de contenido"
        subtitle="Aquí empieza el flujo de UGC: planifica ideas, hooks y guiones, y llévalos a tus influencers IA para crear los videos."
        actions={
          <>
            <Button onClick={() => setIdeasOpen(true)}>✨ Ideas con IA</Button>
            <Button variant="primary" onClick={() => openNew()}>
              + Nueva pieza
            </Button>
          </>
        }
      />

      <UgcFlow
        current="planner"
        onNavigate={onNavigate}
        counts={{ planner: `${posts.length} piezas`, "ai-influencers": stats.toCreate ? `${stats.toCreate} por crear` : undefined }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ideas en el banco" value={String(stats.ideas)} hint="listas para producir" />
        <Kpi label="En producción" value={String(stats.inProgress)} hint="guion, grabación o revisión" />
        <Kpi label="Próximos 7 días" value={String(stats.thisWeek)} hint="piezas programadas" />
        <Kpi label="Publicados (30 días)" value={String(stats.published)} hint={`${(stats.published / 4.3).toFixed(1)} por semana`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Vista"
          value={mode}
          onChange={setMode}
          options={[
            { id: "calendar", label: "Calendario" },
            { id: "board", label: "Tablero" },
            { id: "list", label: "Lista" },
          ]}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, hook, pilar…"
          className="ui-input h-9 min-w-[200px] flex-1 text-[13px]"
        />
        <div className="flex items-center gap-1">
          {CONTENT_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-pressed={platform === p.id}
              onClick={() => setPlatform(platform === p.id ? null : p.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition ${
                platform === p.id ? "border-[var(--foreground)] shadow-[0_0_0_3px_rgba(17,17,19,0.1)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <PlatformLogo id={p.id} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ui-skeleton h-[520px] rounded-2xl" />
      ) : mode === "calendar" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <p className="text-[15px] font-semibold text-[var(--foreground)] first-letter:uppercase">
                {cursor.toLocaleDateString("es", { month: "long", year: "numeric" })}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  ←
                </Button>
                <Button size="sm" onClick={() => setCursor(new Date())}>
                  Hoy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  →
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-alt)]/60">
              {WEEKDAYS.map((d) => (
                <p key={d} className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
                  {d}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((day) => {
                const k = isoDay(day);
                const items = byDay.get(k) ?? [];
                const out = day.getMonth() !== cursor.getMonth();
                return (
                  <div
                    key={k}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNew({ scheduled_at: moveToDay(null, day) })}
                    onKeyDown={(e) => e.key === "Enter" && openNew({ scheduled_at: moveToDay(null, day) })}
                    {...dropProps(k, (post) => ({
                      scheduled_at: moveToDay(post.scheduled_at, day),
                      status: post.status === "idea" ? "scheduled" : post.status,
                    }))}
                    className={`group min-h-[104px] cursor-pointer border-b border-r border-[var(--border)] p-1.5 transition-colors [&:nth-child(7n)]:border-r-0 ${
                      dropTarget === k ? "bg-indigo-50" : out ? "bg-[var(--surface-alt)]/40" : "hover:bg-[var(--surface-alt)]/50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                          k === todayKey ? "bg-[var(--foreground)] text-white" : out ? "text-[var(--muted-soft)]" : "text-[var(--foreground-soft)]"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <span className="text-[13px] text-[var(--muted-soft)] opacity-0 transition group-hover:opacity-100">+</span>
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((p) => (
                        <PostChip key={p.id} post={p} onOpen={() => setDraft({ ...p })} />
                      ))}
                      {items.length > 3 ? <p className="px-1 text-[10px] font-medium text-[var(--muted)]">+{items.length - 3} más</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="h-fit p-3">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Sin fecha</p>
            <p className="mb-3 text-[11px] text-[var(--muted-soft)]">Arrastra una pieza a un día para programarla</p>
            <div
              className={`space-y-1.5 rounded-lg p-0.5 ${dropTarget === "none" ? "bg-indigo-50" : ""}`}
              {...dropProps("none", () => ({ scheduled_at: null }))}
            >
              {unscheduled.length ? (
                unscheduled.slice(0, 40).map((p) => <PostChip key={p.id} post={p} compact onOpen={() => setDraft({ ...p })} />)
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-[12px] text-[var(--muted-soft)]">
                  Todo está programado
                </p>
              )}
            </div>
          </Card>
        </div>
      ) : mode === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {CONTENT_STATUSES.map((s) => {
              const items = visible.filter((p) => p.status === s.id);
              return (
                <div
                  key={s.id}
                  {...dropProps(s.id, () => ({ status: s.id }))}
                  className={`flex min-h-[420px] flex-col rounded-2xl border border-[var(--border)] p-2 transition-colors ${
                    dropTarget === s.id ? "bg-indigo-50" : "bg-[var(--surface-alt)]/60"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                    <Dot color={s.color} />
                    <p className="text-[12px] font-semibold text-[var(--foreground)]">{s.label}</p>
                    <span className="ml-auto rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums text-[var(--muted)]">{items.length}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/post", p.id)}
                        onClick={() => setDraft({ ...p })}
                        className="ui-card-hover block w-full cursor-grab rounded-xl border border-[var(--border)] bg-white p-2.5 text-left shadow-[var(--shadow-xs)] active:cursor-grabbing"
                      >
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <PlatformLogo id={p.platform} className="h-3.5 w-3.5" />
                          {p.pillar ? <span className="ui-tag ui-tag-muted">{p.pillar}</span> : null}
                          {p.source === "ai" ? <span className="ml-auto text-[10px] text-[var(--muted-soft)]">IA</span> : null}
                        </div>
                        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--foreground)]">{p.title}</p>
                        {p.hook ? <p className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">“{p.hook}”</p> : null}
                        {p.scheduled_at ? (
                          <p className="mt-1.5 text-[10px] font-medium tabular-nums text-[var(--muted-soft)]">
                            {new Date(p.scheduled_at).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        ) : null}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => openNew({ status: s.id })}
                      className="w-full rounded-xl px-2 py-1.5 text-left text-[12px] font-medium text-[var(--muted-soft)] hover:bg-white hover:text-[var(--foreground)]"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <Empty
          title="Aún no hay contenido"
          text="Crea tu primera pieza o genera un banco de ideas con IA para empezar a planificar."
          action={<Button variant="primary" onClick={() => setIdeasOpen(true)}>✨ Generar ideas</Button>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                <th className="px-4 py-2.5 font-semibold">Pieza</th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="px-3 py-2.5 font-semibold">Formato</th>
                <th className="px-3 py-2.5 font-semibold">Pilar</th>
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {[...visible]
                .sort((a, b) => (a.scheduled_at ?? "9").localeCompare(b.scheduled_at ?? "9"))
                .map((p) => (
                  <tr key={p.id} onClick={() => setDraft({ ...p })} className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-alt)]/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PlatformLogo id={p.platform} className="h-4 w-4 shrink-0" />
                        <span className="truncate font-medium text-[var(--foreground)]">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={p.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void patch(p.id, { status: e.target.value as ContentStatus })}
                        className="rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-[12px]"
                      >
                        {CONTENT_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{CONTENT_FORMATS.find((f) => f.id === p.format)?.label ?? p.format}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{p.pillar ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin fecha"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}

      <Drawer
        open={draft !== null}
        title={draft?.id ? "Editar pieza" : "Nueva pieza de contenido"}
        subtitle={draft?.source === "ai" ? "Generada con IA · revísala antes de publicar" : undefined}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id ? (
              <>
                <Button variant="danger" onClick={() => void remove(draft.id!)}>
                  Eliminar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDraft({ ...draft, id: undefined, title: `${draft.title} (copia)`, status: "idea", scheduled_at: null })}
                >
                  Duplicar
                </Button>
              </>
            ) : null}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Título">
              <TextInput autoFocus value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. 3 errores al empezar…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Red social">
                <SelectInput value={draft.platform ?? "tiktok"} onChange={(v) => setDraft({ ...draft, platform: v })} options={CONTENT_PLATFORMS} />
              </Field>
              <Field label="Formato">
                <SelectInput value={draft.format ?? "video"} onChange={(v) => setDraft({ ...draft, format: v })} options={CONTENT_FORMATS} />
              </Field>
              <Field label="Estado">
                <SelectInput value={draft.status ?? "idea"} onChange={(v) => setDraft({ ...draft, status: v as ContentStatus })} options={CONTENT_STATUSES} />
              </Field>
              <Field label="Pilar de contenido">
                <TextInput value={draft.pillar ?? ""} onChange={(e) => setDraft({ ...draft, pillar: e.target.value })} placeholder="Educativo, Demo…" />
              </Field>
            </div>
            <Field label="Fecha de publicación">
              <TextInput
                type="datetime-local"
                value={toLocalInput(draft.scheduled_at)}
                onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </Field>
            <Field label="Hook (primeros 2 segundos)">
              <TextInput value={draft.hook ?? ""} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} placeholder="La frase que detiene el scroll" />
            </Field>
            <Field label="Guion">
              <TextArea rows={6} value={draft.script ?? ""} onChange={(e) => setDraft({ ...draft, script: e.target.value })} placeholder={"1. Gancho\n2. Desarrollo\n3. CTA"} />
            </Field>
            {draft.format === "video" || draft.format === "story" || !draft.format ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">Paso 2 · Crear con un influencer IA</p>
                  <p className="text-[12px] text-[var(--muted)]">Copia el hook y el guion, marca la pieza como “Grabación” y abre Influencers IA.</p>
                </div>
                <Button variant="primary" size="sm" disabled={saving || !(draft.hook || draft.script)} onClick={() => void sendToInfluencers()}>
                  Crear video →
                </Button>
              </div>
            ) : null}
            <Field label="Caption">
              <TextArea rows={3} value={draft.caption ?? ""} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
            </Field>
            <Field label="Hashtags" hint="Separados por espacios o comas">
              <TextInput
                value={draft.hashtagsText ?? (draft.hashtags ?? []).join(" ")}
                onChange={(e) => setDraft({ ...draft, hashtagsText: e.target.value })}
                placeholder="#marketing #tips"
              />
            </Field>
            {draft.caption || draft.hashtags?.length || draft.hashtagsText ? (
              <Button
                size="sm"
                onClick={() => copyText(`${draft.caption ?? ""}\n\n${draft.hashtagsText ?? (draft.hashtags ?? []).join(" ")}`.trim(), "Caption copiado")}
              >
                Copiar caption + hashtags
              </Button>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Enlace al archivo">
                <TextInput value={draft.asset_url ?? ""} onChange={(e) => setDraft({ ...draft, asset_url: e.target.value })} placeholder="https://drive…" />
              </Field>
              <Field label="Enlace publicado">
                <TextInput value={draft.published_url ?? ""} onChange={(e) => setDraft({ ...draft, published_url: e.target.value })} placeholder="https://tiktok.com/…" />
              </Field>
            </div>
            <Field label="Notas internas">
              <TextArea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={ideasOpen}
        title="Generar ideas de contenido"
        subtitle="Crea un banco de ideas con hook, guion y caption listos para producir"
        onClose={() => setIdeasOpen(false)}
        footer={
          <>
            <Button onClick={() => setIdeasOpen(false)}>Cancelar</Button>
            <Button variant="primary" disabled={generating} onClick={() => void generate()}>
              {generating ? "Generando…" : `Generar ${ideaOpts.count} ideas`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Red social">
            <SelectInput value={ideaOpts.platform} onChange={(v) => setIdeaOpts({ ...ideaOpts, platform: v })} options={CONTENT_PLATFORMS} />
          </Field>
          <Field label="Cantidad">
            <SelectInput
              value={String(ideaOpts.count)}
              onChange={(v) => setIdeaOpts({ ...ideaOpts, count: Number(v) })}
              options={[3, 6, 10].map((n) => ({ id: String(n), label: `${n} ideas` }))}
            />
          </Field>
          <Field label="Indicaciones (opcional)" hint="Público, tono, lanzamiento, temporada…">
            <TextArea
              rows={4}
              value={ideaOpts.brief}
              onChange={(e) => setIdeaOpts({ ...ideaOpts, brief: e.target.value })}
              placeholder="Ej. Estudiantes universitarios, tono cercano, promocionar la nueva función de recordatorios"
            />
          </Field>
          <p className="rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 text-[12px] text-[var(--muted)]">
            Usa tu clave de OpenAI (Ajustes → API). Si no está conectada, se crean ideas a partir de plantillas probadas.
          </p>
        </div>
      </Drawer>
    </Page>
  );
}
