"use client";

import { useEffect, useRef, useState } from "react";
import { SnapCaption, CaptionStyleSwatch } from "./StudioVideoPlayer";
import {
  OVERLAY_LANGUAGES,
  normalizeOverlayLanguage,
  type OverlayLanguageId,
} from "@/lib/creator/overlay-language";
import {
  CAPTION_STYLES,
  DEFAULT_OVERLAY_PREVIEW,
  OVERLAY_PREVIEW_PHOTO,
  nextOverlayPosition,
  normalizeCaptionStyle,
  normalizeOverlayPosition,
  type CaptionStyleId,
  type OverlayPosition,
} from "@/lib/creator/overlay-styles";

function linesToField(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ");
}

function fieldToLines(value: string) {
  return value
    .split(";")
    .map((line) => line.trim().slice(0, 140))
    .filter(Boolean);
}

function foldLanguage(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function OverlayLanguagePill({
  value,
  onChange,
}: {
  value: OverlayLanguageId;
  onChange: (id: OverlayLanguageId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current =
    OVERLAY_LANGUAGES.find((item) => item.id === value) || OVERLAY_LANGUAGES[0];
  const folded = foldLanguage(query.trim());
  const options = folded
    ? OVERLAY_LANGUAGES.filter((item) =>
        foldLanguage(`${item.label} ${item.name}`).includes(folded)
      )
    : OVERLAY_LANGUAGES;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((next) => !next);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[var(--foreground)]"
      >
        <span aria-hidden>{current.flag}</span>
        {current.label}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              aria-label="Buscar idioma"
              className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {options.length ? (
              options.map((item) => {
                const active = item.id === current.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(item.id);
                        setQuery("");
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
                        active ? "bg-[var(--surface-alt)] font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]"
                      }`}
                    >
                      <span aria-hidden>{item.flag}</span>
                      {item.label}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2 text-[12px] text-[var(--muted-soft)]">Sin resultados</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function OverlayTextEditor({
  text,
  styleId,
  position,
  onText,
  onStyle,
  onPosition,
  compact,
  lines,
  prompt,
  language,
  onLines,
  onPrompt,
  onLanguage,
  hideText,
}: {
  text: string;
  styleId: CaptionStyleId;
  position: OverlayPosition;
  onText: (v: string) => void;
  onStyle: (v: CaptionStyleId) => void;
  onPosition: (v: OverlayPosition) => void;
  compact?: boolean;
  lines?: string[];
  prompt?: string;
  language?: OverlayLanguageId;
  onLines?: (lines: string[]) => void;
  onPrompt?: (prompt: string) => void;
  onLanguage?: (language: OverlayLanguageId) => void;
  hideText?: boolean;
}) {
  const style = normalizeCaptionStyle(styleId);
  const pos = normalizeOverlayPosition(position);
  const [listDraft, setListDraft] = useState<string | null>(null);
  const listValue = listDraft ?? linesToField(lines || []);
  const stylePicker = (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        Estilo
      </p>
      <div className="flex flex-wrap gap-1.5">
          {CAPTION_STYLES.map((item) => {
            const active = style === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onStyle(item.id)}
                className={`flex items-center gap-2 rounded-full p-1 pr-3 ${
                  active ? "bg-[#16181d] text-white" : "bg-[var(--surface-alt)] text-[var(--foreground)]"
                }`}
              >
                <CaptionStyleSwatch styleId={item.id} active={active} />
                <span className="text-[12px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
    </div>
  );
  const preview = compact ? null : (
    <div className="relative mt-2 aspect-[9/16] w-[148px] overflow-hidden rounded-xl bg-[#111827]">
      <img
        src={OVERLAY_PREVIEW_PHOTO}
        alt=""
        className="h-full w-full object-cover"
      />
      <SnapCaption
        text={text.trim() || DEFAULT_OVERLAY_PREVIEW}
        styleId={style}
        position={pos}
      />
    </div>
  );
  const tallPreview = (
    <div className="relative w-[280px] shrink-0 self-start">
      <span className="absolute -left-[3px] top-[88px] h-6 w-[3px] rounded-l bg-[#3a3a3c]" />
      <span className="absolute -left-[3px] top-[124px] h-11 w-[3px] rounded-l bg-[#3a3a3c]" />
      <span className="absolute -left-[3px] top-[176px] h-11 w-[3px] rounded-l bg-[#3a3a3c]" />
      <span className="absolute -right-[3px] top-[140px] h-16 w-[3px] rounded-r bg-[#3a3a3c]" />
      <div className="relative aspect-[393/852] w-full overflow-hidden rounded-[42px] border-[11px] border-[#1c1c1e] bg-black shadow-[0_18px_40px_rgba(17,24,39,0.14)]">
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-6 w-[104px] -translate-x-1/2 rounded-full bg-[#1c1c1e]" />
        <img
          src={OVERLAY_PREVIEW_PHOTO}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <SnapCaption
          text={text.trim() || DEFAULT_OVERLAY_PREVIEW}
          styleId={style}
          position={pos}
        />
      </div>
    </div>
  );
  const sources = onLines && onPrompt ? (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <div className="block rounded-xl bg-[var(--surface-alt)] p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Prompt
          </span>
          {onLanguage ? (
            <OverlayLanguagePill
              value={normalizeOverlayLanguage(language)}
              onChange={onLanguage}
            />
          ) : null}
        </div>
        <span className="mb-3 block text-[12px] text-[var(--muted-soft)]">
          La IA escribe el texto en el momento de generar.
        </span>
        <textarea
          value={prompt || ""}
          rows={5}
          maxLength={800}
          onChange={(e) => onPrompt(e.target.value)}
          placeholder="Un gancho corto sobre la sorpresa del video, en español, tono casual."
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-[14px] outline-none"
        />
      </div>
      <div className="rounded-xl bg-[var(--surface-alt)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Lista
        </p>
        <p className="mb-3 mt-1 text-[12px] text-[var(--muted-soft)]">
          Separa cada texto con ;. La IA elige uno al azar.
        </p>
        <textarea
          value={listValue}
          rows={5}
          onChange={(e) => {
            const next = e.target.value;
            setListDraft(next);
            onLines(fieldToLines(next));
          }}
          onBlur={() => setListDraft(null)}
          placeholder="Texto uno; Texto dos; Texto tres"
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-[14px] outline-none"
        />
      </div>
    </div>
  ) : null;

  if (sources) {
    return (
      <div className="flex items-stretch gap-4">
        {tallPreview}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Texto en pantalla</h3>
            <button
              type="button"
              onClick={() => onPosition(nextOverlayPosition(pos))}
              className="rounded-lg bg-[#16181d] px-3 py-2 text-[11px] font-semibold text-white"
            >
              Smart position
            </button>
          </div>
          {stylePicker}
          {sources}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {stylePicker}
      <div
        className={
          compact
            ? "flex flex-col gap-2 sm:flex-row sm:items-center"
            : onLines
              ? "flex items-start"
              : "grid items-start gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]"
        }
      >
        <div className={compact ? "shrink-0" : undefined}>
          <button
            type="button"
            onClick={() => onPosition(nextOverlayPosition(pos))}
            className="mb-0 w-full rounded-full bg-[#16181d] px-3 py-2 text-[11px] font-semibold text-white sm:w-auto"
          >
            Smart position
          </button>
          {preview}
        </div>
        {hideText ? null : (
          <label className={`block min-w-0 flex-1 ${compact ? "rounded-lg bg-[var(--surface-alt)] p-3" : "rounded-xl bg-[var(--surface-alt)] p-4"}`}>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Texto
            </span>
            <input
              value={text}
              onChange={(e) => onText(e.target.value)}
              className="ui-input !text-[14px]"
              placeholder={DEFAULT_OVERLAY_PREVIEW}
              maxLength={140}
            />
          </label>
        )}
      </div>
    </div>
  );
}
