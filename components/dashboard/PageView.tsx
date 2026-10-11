"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductPageView } from "@/components/page/ProductPageView";
import { PAGE_HOST, type PageSubscriber, type PageUpdate, type ProductPage } from "@/lib/page/types";

type Tab = "editor" | "subscribers" | "updates";

const TABS: { id: Tab; label: string }[] = [
  { id: "editor", label: "Página" },
  { id: "subscribers", label: "Suscriptores" },
  { id: "updates", label: "Novedades" },
];

const ACCENTS = ["#111114", "#2563eb", "#6366f1", "#db2777", "#ea580c", "#059669"];

type PageData = {
  page: ProductPage;
  saved: boolean;
  subscribers: PageSubscriber[];
  subscriberCount: number;
  updates: PageUpdate[];
};

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[14px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-soft)] focus:border-black/25";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[var(--foreground)]">{label}</span>
      {hint ? <span className="ml-1.5 text-[12px] text-[var(--muted-soft)]">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-[var(--success)]" : "bg-black/15"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }
  return { copied, copy };
}

/* ---------------- editor ---------------- */

function Editor({
  page,
  updates,
  onSave,
}: {
  page: ProductPage;
  updates: PageUpdate[];
  onSave: (page: ProductPage) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(page);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(page);
  const url = `https://${PAGE_HOST}/${page.slug}`;
  const { copied, copy } = useCopy();

  function set<K extends keyof ProductPage>(key: K, value: ProductPage[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(next: ProductPage) {
    setSaving(true);
    setError(await onSave(next));
    setSaving(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
        <Switch checked={page.published} label="Publicar página" onChange={(v) => save({ ...draft, published: v })} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--foreground)]">{page.published ? "Publicada" : "Sin publicar"}</p>
          <p className="truncate text-[13px] text-[var(--muted)]">
            {PAGE_HOST}/{page.slug}
          </p>
        </div>
        {page.published ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => copy(url)} className="ui-btn-ghost h-8 px-3 text-[13px]">
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="ui-btn-secondary h-8 px-3 text-[13px]">
              Ver ↗
            </a>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Field label="Enlace">
            <div className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-white pl-3 focus-within:border-black/25">
              <span className="text-[14px] text-[var(--muted-soft)]">{PAGE_HOST}/</span>
              <input
                className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[14px] text-[var(--foreground)] outline-none"
                value={draft.slug}
                maxLength={40}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </div>
          </Field>
          <Field label="Nombre">
            <input className={inputCls} maxLength={80} value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Frase principal" hint="Qué consigue tu cliente">
            <input
              className={inputCls}
              maxLength={160}
              value={draft.tagline ?? ""}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Aprende inglés hablando 10 minutos al día"
            />
          </Field>
          <Field label="Descripción">
            <textarea
              className={`${inputCls} h-24 resize-none py-2`}
              maxLength={1000}
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="Web">
            <input className={inputCls} value={draft.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} placeholder="tuapp.com" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="App Store">
              <input className={inputCls} value={draft.ios_url ?? ""} onChange={(e) => set("ios_url", e.target.value)} placeholder="apps.apple.com/…" />
            </Field>
            <Field label="Google Play">
              <input className={inputCls} value={draft.android_url ?? ""} onChange={(e) => set("android_url", e.target.value)} placeholder="play.google.com/…" />
            </Field>
          </div>
          <div>
            <span className="text-[13px] font-medium text-[var(--foreground)]">Color</span>
            <div className="mt-2 flex gap-2">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set("accent", color)}
                  aria-label={`Color ${color}`}
                  aria-pressed={draft.accent === color}
                  className={`h-7 w-7 rounded-full transition ${draft.accent === color ? "ring-2 ring-black/80 ring-offset-2" : "hover:scale-110"}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[var(--foreground)]">Recoger emails</span>
            <Switch checked={draft.collect_emails} label="Recoger emails" onChange={(v) => set("collect_emails", v)} />
          </div>

          {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
          <button type="button" className="ui-btn-primary w-full" disabled={saving || !dirty} onClick={() => save(draft)}>
            {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
          </button>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-6 overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_-12px_rgba(17,17,20,0.18)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="ml-2 truncate text-[12px] text-[var(--muted)]">
                {PAGE_HOST}/{draft.slug}
              </span>
            </div>
            <div className="h-[620px] overflow-y-auto">
              <ProductPageView page={draft} updates={updates} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- suscriptores ---------------- */

function Subscribers({
  page,
  items,
  count,
  onDelete,
}: {
  page: ProductPage;
  items: PageSubscriber[];
  count: number;
  onDelete: (id: string) => void;
}) {
  const url = `https://${PAGE_HOST}/${page.slug}`;
  const { copied, copy } = useCopy();

  function exportCsv() {
    const rows = ["email,fecha", ...items.map((s) => `${s.email},${s.created_at.slice(0, 10)}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `suscriptores-${page.slug}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="max-w-[640px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[40px] font-semibold leading-none tabular-nums tracking-tight text-[var(--foreground)]">{count}</p>
          <p className="mt-1.5 text-[13px] text-[var(--muted)]">{count === 1 ? "persona interesada" : "personas interesadas"}</p>
        </div>
        {items.length > 0 ? (
          <button type="button" onClick={exportCsv} className="ui-btn-secondary h-9 text-[13px]">
            Exportar CSV
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-[var(--foreground)]">Todavía nadie se ha apuntado</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted)]">
            {page.published
              ? "Pon este enlace en tu bio, en tus posts y en cada canal de lanzamiento."
              : "Publica tu página en la pestaña Página y comparte el enlace."}
          </p>
          {page.published ? (
            <button type="button" onClick={() => copy(url)} className="ui-btn-primary mt-4">
              {copied ? "Copiado" : `Copiar ${PAGE_HOST}/${page.slug}`}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {items.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--foreground)]">{s.email}</span>
              <span className="text-[12px] tabular-nums text-[var(--muted-soft)]">{formatDate(s.created_at)}</span>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label={`Eliminar ${s.email}`}
                className="rounded-md px-1.5 text-[16px] leading-none text-[var(--muted-soft)] opacity-0 transition hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- novedades ---------------- */

function Updates({
  items,
  published,
  onAdd,
  onDelete,
}: {
  items: PageUpdate[];
  published: boolean;
  onAdd: (title: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    if (await onAdd(title, body)) {
      setTitle("");
      setBody("");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-[640px]">
      <div className="space-y-2">
        <input className={inputCls} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Qué hay de nuevo" />
        <textarea
          className={`${inputCls} h-24 resize-none py-2`}
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Cuéntalo en dos o tres frases (opcional)"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--muted-soft)]">
            {published ? "Aparece al instante en tu página." : "Se verá cuando publiques tu página."}
          </p>
          <button type="button" className="ui-btn-primary" disabled={saving || !title.trim()} onClick={add}>
            {saving ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-12 text-center text-[13px] text-[var(--muted)]">
          Cada mejora que publiques le demuestra a tus usuarios que el producto está vivo.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {items.map((u) => (
            <li key={u.id} className="group flex gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-[var(--muted-soft)]">{formatDate(u.created_at)}</p>
                <p className="mt-0.5 text-[14px] font-medium text-[var(--foreground)]">{u.title}</p>
                {u.body ? <p className="mt-1 whitespace-pre-line text-[13px] text-[var(--muted)]">{u.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => onDelete(u.id)}
                aria-label={`Eliminar ${u.title}`}
                className="h-fit rounded-md px-1.5 text-[16px] leading-none text-[var(--muted-soft)] opacity-0 transition hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- shell ---------------- */

export function PageView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("pg");
  const tab: Tab = raw === "subscribers" || raw === "updates" ? raw : "editor";
  const base = `/api/projects/${projectId}/page`;
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<PageData> => {
    const res = await fetch(base);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar");
    return json as PageData;
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  function go(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "page");
    if (next === "editor") params.delete("pg");
    else params.set("pg", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function savePage(page: ProductPage): Promise<string | null> {
    const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(page) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return json.error || "No se pudo guardar";
    setData((d) => (d ? { ...d, page: json.page as ProductPage, saved: true } : d));
    return null;
  }

  async function addUpdate(title: string, body: string) {
    const res = await fetch(`${base}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "No se pudo publicar");
      return false;
    }
    setData((d) => (d ? { ...d, updates: [json.item as PageUpdate, ...d.updates] } : d));
    return true;
  }

  function deleteUpdate(id: string) {
    setData((d) => (d ? { ...d, updates: d.updates.filter((u) => u.id !== id) } : d));
    void fetch(`${base}/updates?item=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  function deleteSubscriber(id: string) {
    setData((d) => (d ? { ...d, subscribers: d.subscribers.filter((s) => s.id !== id), subscriberCount: Math.max(0, d.subscriberCount - 1) } : d));
    void fetch(`${base}/subscribers?item=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-[1080px] px-5 pb-28 pt-8 sm:px-8 md:pb-12 md:pt-12">
        <nav className="flex gap-5 border-b border-[var(--border)]" aria-label="Página">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] font-medium transition ${
                  active ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
                {item.id === "subscribers" && data?.subscriberCount ? (
                  <span className="rounded-full bg-black/[0.06] px-1.5 text-[11px] tabular-nums">{data.subscriberCount}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="pt-8">
          {error ? <p className="mb-4 text-[13px] text-[var(--danger)]">{error}</p> : null}
          {!data ? (
            error ? null : (
              <div className="space-y-3">
                <div className="ui-skeleton h-14 rounded-xl" />
                <div className="ui-skeleton h-80 rounded-xl" />
              </div>
            )
          ) : tab === "subscribers" ? (
            <Subscribers page={data.page} items={data.subscribers} count={data.subscriberCount} onDelete={deleteSubscriber} />
          ) : tab === "updates" ? (
            <Updates items={data.updates} published={data.page.published} onAdd={addUpdate} onDelete={deleteUpdate} />
          ) : (
            <Editor key={JSON.stringify(data.page)} page={data.page} updates={data.updates} onSave={savePage} />
          )}
        </div>
      </div>
    </div>
  );
}
