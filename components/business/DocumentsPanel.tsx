"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/dashboard/icons";
import {
  newId,
  type BusinessDocument,
  type BusinessWorkspace,
  type DocumentKind,
} from "@/lib/business/workspace-store";
import {
  DeleteButton,
  EmptyState,
  Field,
  FormCard,
  SectionHead,
} from "./section-ui";

const KIND_LABEL: Record<DocumentKind, string> = {
  note: "Nota",
  link: "Link",
  file: "Archivo",
};

type DocumentsPanelProps = {
  documents: BusinessDocument[];
  onChange: (next: (prev: BusinessWorkspace) => BusinessWorkspace) => void;
};

export function DocumentsPanel({ documents, onChange }: DocumentsPanelProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("note");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle("");
    setKind("note");
    setUrl("");
    setNotes("");
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange((prev) => ({
      ...prev,
      documents: [
        {
          id: newId(),
          title: trimmed,
          kind,
          url: url.trim(),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        },
        ...prev.documents,
      ],
    }));
    reset();
  }

  function remove(id: string) {
    onChange((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc.id !== id),
    }));
  }

  return (
    <>
      <SectionHead
        kicker="My Business"
        title="Documents"
        description="Notas, links y archivos del negocio."
        action={
          <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nuevo documento
          </button>
        }
      />

      {open ? (
        <FormCard
          title="Nuevo documento"
          onSubmit={handleSubmit}
          onCancel={reset}
          submitLabel="Guardar"
        >
          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Pitch, brand kit, NDA…"
              className="ui-input"
            />
          </Field>
          <Field label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              className="ui-input"
            >
              <option value="note">Nota</option>
              <option value="link">Link</option>
              <option value="file">Archivo</option>
            </select>
          </Field>
          <Field label="URL">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="ui-input"
            />
          </Field>
          <Field label="Notas">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="ui-input"
            />
          </Field>
        </FormCard>
      ) : null}

      {documents.length === 0 && !open ? (
        <EmptyState
          title="Sin documentos"
          body="Guarda el primero aquí."
          actionLabel="Nuevo documento"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-3 rounded-xl bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <span className="ui-tag ui-tag-muted">{KIND_LABEL[doc.kind]}</span>
                <p className="mt-2 text-[15px] font-semibold text-[var(--foreground)]">
                  {doc.title}
                </p>
                {doc.notes ? (
                  <p className="mt-1 line-clamp-2 text-[13px] text-[var(--muted)]">
                    {doc.notes}
                  </p>
                ) : null}
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block truncate text-[12px] font-medium text-[var(--foreground)] underline"
                  >
                    {doc.url}
                  </a>
                ) : null}
              </div>
              <DeleteButton
                label={`Eliminar ${doc.title}`}
                onClick={() => remove(doc.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
