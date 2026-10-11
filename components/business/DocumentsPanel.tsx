"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "@/components/dashboard/icons";
import { createClient } from "@/lib/supabase/client";
import type { BusinessDocument } from "@/lib/business/workspace-store";
import { EmptyState, Field, FormCard, SectionHead } from "./section-ui";

const BUCKET = "business-documents";
const MAX_BYTES = 50 * 1024 * 1024;

type DocRow = {
  id: string;
  title: string;
  description: string;
  url: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  updated_at: string;
};

type StoredFile = { file_path: string; file_name: string; file_size: number; file_type: string };

type DocumentsPanelProps = {
  /** Documents saved in this browser before they moved to Supabase. */
  legacy: BusinessDocument[];
  onLegacyImported: () => void;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function extension(name: string | null) {
  if (!name || !name.includes(".")) return null;
  return name.split(".").pop()!.toUpperCase().slice(0, 5);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

async function uploadFile(file: File): Promise<StoredFile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Inicia sesión para subir archivos.");
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().slice(0, 8) : "bin";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return { file_path: path, file_name: file.name, file_size: file.size, file_type: file.type };
}

function FileGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M14 3.75H7.5A1.75 1.75 0 0 0 5.75 5.5v13A1.75 1.75 0 0 0 7.5 20.25h9a1.75 1.75 0 0 0 1.75-1.75V8zM14 3.75V8h4.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onMouseDown={() => !pending && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="doc-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.18)]"
      >
        <p id="doc-confirm-title" className="text-[15px] font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className="ui-btn-secondary disabled:opacity-60">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            autoFocus
            className={
              danger
                ? "rounded-xl bg-[var(--danger)] px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                : "ui-btn-primary disabled:opacity-60"
            }
          >
            {pending ? "Un momento…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DocMenu({ onReplace, onDelete }: { onReplace: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-black/25 hover:text-[var(--foreground)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18.5" cy="12" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute bottom-full right-0 z-20 mb-1.5 w-44 rounded-xl border border-[var(--border)] bg-white p-1 shadow-[0_12px_32px_rgba(17,24,39,0.12)]">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReplace();
            }}
            className={`${item} text-[var(--foreground)] hover:bg-[var(--surface-alt)]`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" aria-hidden>
              <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1M17.5 3.5v3.75h-3.75M6.5 20.5v-3.75h3.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reemplazar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${item} text-[var(--danger)] hover:bg-[var(--danger-soft)]`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M5 7h14M10 4.5h4M9.5 10.5v6M14.5 10.5v6M6.5 7l.75 11.25A1.75 1.75 0 0 0 9 19.9h6a1.75 1.75 0 0 0 1.75-1.65L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Eliminar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DocCard({ doc, onView, onReplace, onDelete }: { doc: DocRow; onView: () => void; onReplace: () => void; onDelete: () => void }) {
  const ext = extension(doc.file_name);
  const meta = [ext, doc.file_size != null ? formatBytes(doc.file_size) : null, shortDate(doc.updated_at)].filter(Boolean).join(" · ");
  const canView = Boolean(doc.file_path || doc.url);
  return (
    <li className="ui-card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
          <FileGlyph className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{doc.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--muted-soft)]">{meta}</p>
        </div>
      </div>
      {doc.description ? <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-[var(--muted)]">{doc.description}</p> : null}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onView}
          disabled={!canView}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2 text-[12px] font-semibold text-[var(--foreground)] transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          View doc
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M8 16 16 8M9.5 8H16v6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="flex-1" />
        <DocMenu onReplace={onReplace} onDelete={onDelete} />
      </div>
    </li>
  );
}

type Pending = { kind: "delete"; doc: DocRow } | { kind: "replace"; doc: DocRow; file: File } | null;

export function DocumentsPanel({ legacy, onLegacyImported }: DocumentsPanelProps) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<Pending>(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<DocRow | null>(null);
  const importing = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("business_documents").select("*").order("created_at", { ascending: false });
    if (error) setListError(error.message);
    else {
      setListError("");
      setDocs((data ?? []) as DocRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!legacy.length || importing.current) return;
    importing.current = true;
    void (async () => {
      const rows = legacy.map((doc) => ({
        title: doc.title,
        description: doc.notes ?? "",
        url: doc.url ?? "",
        file_path: doc.file?.path ?? null,
        file_name: doc.file?.name ?? null,
        file_size: doc.file?.size ?? null,
        file_type: doc.file?.type ?? null,
        created_at: doc.createdAt,
        updated_at: doc.createdAt,
      }));
      const { error } = await createClient().from("business_documents").insert(rows);
      if (!error) {
        onLegacyImported();
        await load();
      }
      importing.current = false;
    })();
  }, [legacy, onLegacyImported, load]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setFile(null);
    setFormError("");
    setOpen(false);
  }

  function pick(next: File | null | undefined) {
    if (!next) return;
    if (next.size > MAX_BYTES) {
      setFormError("El archivo pesa más de 50 MB.");
      return;
    }
    setFormError("");
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    setFormError("");
    try {
      const stored = file ? await uploadFile(file) : null;
      const { data, error } = await createClient()
        .from("business_documents")
        .insert({ title: trimmed, description: description.trim(), ...(stored ?? {}) })
        .select("*")
        .single();
      if (error) {
        if (stored) void createClient().storage.from(BUCKET).remove([stored.file_path]);
        throw new Error(error.message);
      }
      setDocs((prev) => [data as DocRow, ...prev]);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function view(doc: DocRow) {
    if (!doc.file_path) {
      if (doc.url) window.open(doc.url, "_blank", "noopener,noreferrer");
      return;
    }
    const tab = window.open("", "_blank");
    const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 10);
    if (error || !data?.signedUrl) {
      tab?.close();
      window.alert(error?.message || "No se pudo abrir el documento.");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  async function runConfirmed() {
    if (!confirm) return;
    setWorking(true);
    const supabase = createClient();
    try {
      if (confirm.kind === "delete") {
        const { error } = await supabase.from("business_documents").delete().eq("id", confirm.doc.id);
        if (error) throw new Error(error.message);
        if (confirm.doc.file_path) void supabase.storage.from(BUCKET).remove([confirm.doc.file_path]);
        setDocs((prev) => prev.filter((d) => d.id !== confirm.doc.id));
      } else {
        const stored = await uploadFile(confirm.file);
        const { data, error } = await supabase
          .from("business_documents")
          .update({ ...stored, updated_at: new Date().toISOString() })
          .eq("id", confirm.doc.id)
          .select("*")
          .single();
        if (error) {
          void supabase.storage.from(BUCKET).remove([stored.file_path]);
          throw new Error(error.message);
        }
        if (confirm.doc.file_path) void supabase.storage.from(BUCKET).remove([confirm.doc.file_path]);
        setDocs((prev) => prev.map((d) => (d.id === confirm.doc.id ? (data as DocRow) : d)));
      }
      setConfirm(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <SectionHead
        kicker="My Business"
        title="Documents"
        description="Archivos y notas del negocio."
        action={
          <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nuevo documento
          </button>
        }
      />

      {open ? (
        <FormCard title="Nuevo documento" onSubmit={handleSubmit} onCancel={resetForm} pending={saving} submitLabel={saving ? "Subiendo…" : "Guardar"}>
          <Field label="Título">
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Pitch, brand kit, NDA…" className="ui-input" />
          </Field>
          <Field label="Descripción">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="De qué trata este documento (opcional)"
              className="ui-input resize-y"
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">Subir archivo</span>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                  <FileGlyph />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--foreground)]">{file.name}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{formatBytes(file.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition ${
                  dragging ? "border-[var(--foreground)] bg-[var(--surface-alt)]" : "border-[var(--border)] bg-white hover:border-black/25 hover:bg-[var(--surface-alt)]"
                }`}
              >
                <FileGlyph className="h-5 w-5 text-[var(--muted)]" />
                <span className="text-[13px] font-medium text-[var(--foreground)]">Arrastra un archivo o haz clic para elegirlo</span>
                <span className="text-[11px] text-[var(--muted)]">PDF, imágenes, documentos… hasta 50 MB</span>
              </button>
            )}
          </div>
          {formError ? <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)]">{formError}</p> : null}
        </FormCard>
      ) : null}

      <input
        ref={replaceRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0];
          e.target.value = "";
          const doc = replaceTarget.current;
          if (!next || !doc) return;
          if (next.size > MAX_BYTES) {
            window.alert("El archivo pesa más de 50 MB.");
            return;
          }
          setConfirm({ kind: "replace", doc, file: next });
        }}
      />

      {listError ? (
        <p className="mt-6 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">{listError}</p>
      ) : loading ? (
        <ul className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i} className="ui-card h-[150px] animate-pulse" />
          ))}
        </ul>
      ) : docs.length === 0 && !open ? (
        <EmptyState title="Sin documentos" body="Sube el primero aquí." actionLabel="Nuevo documento" onAction={() => setOpen(true)} />
      ) : (
        <ul className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {docs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              onView={() => void view(doc)}
              onReplace={() => {
                replaceTarget.current = doc;
                replaceRef.current?.click();
              }}
              onDelete={() => setConfirm({ kind: "delete", doc })}
            />
          ))}
        </ul>
      )}

      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === "delete" ? "¿Eliminar documento?" : "¿Reemplazar archivo?"}
          body={
            confirm.kind === "delete" ? (
              <>
                Se borrará <b className="text-[var(--foreground)]">{confirm.doc.title}</b> y su archivo. No se puede deshacer.
              </>
            ) : (
              <>
                {confirm.doc.file_name ? (
                  <>
                    <b className="text-[var(--foreground)]">{confirm.doc.file_name}</b> se sustituirá por{" "}
                  </>
                ) : (
                  <>Se añadirá </>
                )}
                <b className="text-[var(--foreground)]">{confirm.file.name}</b> ({formatBytes(confirm.file.size)}) en “{confirm.doc.title}”.
              </>
            )
          }
          confirmLabel={confirm.kind === "delete" ? "Eliminar" : "Reemplazar"}
          danger={confirm.kind === "delete"}
          pending={working}
          onConfirm={() => void runConfirmed()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}
