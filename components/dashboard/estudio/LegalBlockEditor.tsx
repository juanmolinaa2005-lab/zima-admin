"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LegalProfile } from "@/lib/creator/app-legal";

const DEFAULT_COLOR = "#1a1f36";

const TOKEN_FIELDS = [
  { token: "{{app}}", key: "appName", fallback: "App" },
  { token: "{{razon}}", key: "legalName", fallback: "Razón social" },
  { token: "{{dominio}}", key: "domain", fallback: "Dominio" },
  { token: "{{email}}", key: "contactEmail", fallback: "Correo" },
  { token: "{{direccion}}", key: "address", fallback: "Domicilio" },
  { token: "{{region}}", key: "region", fallback: "País" },
] as const;

export function LegalBlockEditor({
  open,
  title,
  body,
  color,
  docLabel,
  profile,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  body: string;
  color: string;
  docLabel: string;
  profile: LegalProfile;
  onClose: () => void;
  onApply: (next: { title: string; body: string; color: string }) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftBody, setDraftBody] = useState(body);
  const [textColor, setTextColor] = useState(color || DEFAULT_COLOR);
  const [heading, setHeading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const tokenLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const field of TOKEN_FIELDS) {
      labels[field.token] = profile[field.key].trim() || field.fallback;
    }
    return labels;
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    setDraftTitle(title);
    setDraftBody(body);
    setTextColor(color || DEFAULT_COLOR);
    setHeading(false);
    setLinkOpen(false);
  }, [open, title, body, color]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const node = areaRef.current;
    if (!open || !node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(node.scrollHeight, 520)}px`;
  }, [open, draftBody]);

  if (!open) return null;

  function replace(next: string, cursor: number) {
    setDraftBody(next);
    requestAnimationFrame(() => {
      const field = areaRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(cursor, cursor);
    });
  }

  function wrap(before: string, after = before) {
    const field = areaRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = field.value.slice(start, end);
    const next = field.value.slice(0, start) + before + selected + after + field.value.slice(end);
    replace(next, start + before.length + selected.length + after.length);
  }

  function prefixLines(kind: "p" | "h" | "ul" | "ol") {
    const field = areaRef.current;
    if (!field) return;
    const value = field.value;
    const from = value.lastIndexOf("\n", field.selectionStart - 1) + 1;
    const breakAt = value.indexOf("\n", field.selectionEnd);
    const to = breakAt === -1 ? value.length : breakAt;
    const lines = value.slice(from, to).split("\n").map((line, index) => {
      const bare = line.replace(/^(?:# |- |\d+\.\s)/, "");
      if (kind === "h") return `# ${bare}`;
      if (kind === "ul") return `- ${bare}`;
      if (kind === "ol") return `${index + 1}. ${bare}`;
      return bare;
    });
    const chunk = lines.join("\n");
    replace(value.slice(0, from) + chunk + value.slice(to), from + chunk.length);
    setHeading(kind === "h");
  }

  function insertVariable(token: string) {
    const field = areaRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const next = field.value.slice(0, start) + token + field.value.slice(field.selectionEnd);
    replace(next, start + token.length);
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const field = areaRef.current;
    if (!field) return;
    let text = event.clipboardData.getData("text/plain");
    if (heading) {
      text = text
        .split("\n")
        .map((line) => {
          const bare = line.replace(/^(?:# |- |\d+\.\s)/, "");
          return bare ? `# ${bare}` : "";
        })
        .join("\n");
    }
    const start = field.selectionStart;
    const next = field.value.slice(0, start) + text + field.value.slice(field.selectionEnd);
    replace(next, start + text.length);
  }

  function syncHeading() {
    const field = areaRef.current;
    if (!field) return;
    selectionRef.current = { start: field.selectionStart, end: field.selectionEnd };
    const from = field.value.lastIndexOf("\n", field.selectionStart - 1) + 1;
    setHeading(field.value.slice(from).startsWith("# "));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0" aria-label="Cerrar editor" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editor de ${docLabel}`}
        className="relative flex h-[min(860px,92dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{docLabel}</p>
            <p className="truncate text-[13px] text-[var(--muted)]">Texto plano. Puedes pegar lo que salga de ChatGPT.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface-alt)]"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() =>
                onApply({
                  title: draftTitle,
                  body: draftBody,
                  color: textColor.toLowerCase() === DEFAULT_COLOR ? "" : textColor,
                })
              }
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white"
            >
              Listo
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-white px-3 py-2">
          <select
            aria-label="Estilo"
            value={heading ? "h" : "p"}
            onChange={(event) => prefixLines(event.target.value === "h" ? "h" : "p")}
            className="h-8 rounded-md border border-[#e4e6eb] bg-white px-2 text-[13px] font-medium text-[var(--foreground)]"
          >
            <option value="p">Texto</option>
            <option value="h">Título</option>
          </select>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <FormatButton label="Negrita" onClick={() => wrap("**")}>
            <b>B</b>
          </FormatButton>
          <FormatButton label="Cursiva" onClick={() => wrap("*")}>
            <i>I</i>
          </FormatButton>
          <FormatButton label="Subrayado" onClick={() => wrap("++")}>
            <u>U</u>
          </FormatButton>
          <FormatButton label="Tachado" onClick={() => wrap("~~")}>
            <s>S</s>
          </FormatButton>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <FormatButton label="Lista" onClick={() => prefixLines("ul")}>
            <ListIcon ordered={false} />
          </FormatButton>
          <FormatButton label="Numerada" onClick={() => prefixLines("ol")}>
            <ListIcon ordered />
          </FormatButton>
          <FormatButton label="Enlace" active={linkOpen} onClick={() => setLinkOpen((open) => !open)}>
            <LinkIcon />
          </FormatButton>
          <label className="ml-1 grid h-8 cursor-pointer place-items-center rounded-md px-1.5 hover:bg-[var(--surface-alt)]" title="Color">
            <span className="sr-only">Color</span>
            <input
              type="color"
              aria-label="Color"
              value={textColor}
              onChange={(event) => setTextColor(event.target.value)}
              className="h-6 w-6 cursor-pointer rounded border border-[#e4e6eb] bg-transparent p-0"
            />
          </label>
          {linkOpen ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                const url = linkUrl.trim();
                const field = areaRef.current;
                if (!url || !field) return;
                const start = selectionRef.current.start;
                const end = selectionRef.current.end;
                const selected = field.value.slice(start, end) || "enlace";
                const chunk = `[${selected}](${url})`;
                const next = field.value.slice(0, start) + chunk + field.value.slice(end);
                replace(next, start + chunk.length);
                setLinkOpen(false);
              }}
            >
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                aria-label="Dirección del enlace"
                className="h-8 w-40 rounded-md border border-[#e4e6eb] px-2 text-[12px] outline-none"
              />
              <button type="submit" className="h-8 rounded-md bg-[var(--accent)] px-2 text-[12px] font-semibold text-white">
                Ok
              </button>
            </form>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-white px-3 py-2">
          {TOKEN_FIELDS.map((field) => (
            <button
              key={field.token}
              type="button"
              title={field.token}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertVariable(field.token)}
              className="max-w-[140px] truncate rounded-full border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {tokenLabels[field.token]}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9]">
          <div className="mx-auto flex min-h-full max-w-[680px] flex-col px-8 py-10 sm:px-10">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              aria-label="Título"
              className="w-full bg-transparent text-[40px] font-semibold leading-[1.15] tracking-[-0.03em] outline-none placeholder:text-[#c5cad3]"
              style={{ color: textColor }}
              placeholder="Título del documento"
            />
            <textarea
              ref={areaRef}
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              onSelect={syncHeading}
              onKeyUp={syncHeading}
              onPaste={onPaste}
              aria-label="Texto del documento"
              spellCheck
              placeholder="Pega aquí el texto. Toma el color elegido arriba."
              className="mt-8 min-h-[520px] w-full resize-none overflow-hidden bg-transparent text-[16px] leading-[1.75] outline-none placeholder:text-[#c5cad3]"
              style={{ color: textColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md text-[14px] text-[var(--foreground)] hover:bg-[var(--surface-alt)] ${
        active ? "bg-[var(--surface-alt)]" : ""
      }`}
    >
      {children}
    </button>
  );
}

function ListIcon({ ordered }: { ordered: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      {ordered ? (
        <path d="M10 7h9M10 12h9M10 17h9M5 6.5h1.2V9M5 12h1.6M4.8 16.2 6.2 15v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M10 7h9M10 12h9M10 17h9M5.5 7h.01M5.5 12h.01M5.5 17h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 13.5a4 4 0 0 0 5.7.4l2.3-2.3a4 4 0 0 0-5.7-5.7L11 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.4L6 12.4a4 4 0 0 0 5.7 5.7L13 16.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
