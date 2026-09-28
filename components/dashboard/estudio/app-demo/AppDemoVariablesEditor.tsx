"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  APP_DEMO_MAX_VARS,
  isAppDemoImageSrc,
  isAppDemoVarKey,
  type AppDemoVarType,
  type AppDemoVariable,
} from "@/lib/creator/app-demo";
import { fileToAppDemoImageValue } from "@/lib/creator/app-demo-image";
import { newId } from "@/lib/creator/estudio-v1";
import type { GalleryAsset } from "@/lib/gallery/asset";
import { CloseIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";

const TYPES: {
  id: AppDemoVarType;
  label: string;
  hint: string;
  glyph: string;
}[] = [
  { id: "text", label: "Texto", hint: "Nombre, titular, CTA", glyph: "Aa" },
  { id: "number", label: "Número", hint: "Precio, delay, count", glyph: "#" },
  { id: "boolean", label: "Sí / No", hint: "Flags de la escena", glyph: "○" },
  { id: "color", label: "Color", hint: "Acento, fondos", glyph: "●" },
  { id: "image", label: "Foto", hint: "Logo, producto, avatar", glyph: "▣" },
];

function nextKey(variables: AppDemoVariable[], type: AppDemoVarType) {
  if (type === "image") {
    const n = variables.filter((item) => item.type === "image").length + 1;
    return n === 1 ? "photo" : `photo${n}`;
  }
  const n = variables.length + 1;
  return `var${n}`;
}

function varPreview(item: AppDemoVariable) {
  if (item.type === "image") return item.value ? "Foto" : "Sin foto";
  if (item.type === "boolean") return item.value === "true" ? "Sí" : "No";
  if (!item.value.trim()) return "Vacío";
  if (item.value.startsWith("data:")) return "Valor";
  return item.value;
}

function TypeGlyph({
  item,
  size = "sm",
}: {
  item: AppDemoVariable;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  if (item.type === "color") {
    const color = /^#[0-9a-fA-F]{6}$/.test(item.value)
      ? item.value
      : "#6366f1";
    return (
      <span
        className={`${box} shrink-0 rounded-[5px] border border-white/15`}
        style={{ background: color }}
      />
    );
  }
  if (item.type === "image") {
    if (item.value) {
      return (
        <img
          src={item.value}
          alt=""
          className={`${box} shrink-0 rounded-[5px] object-cover`}
        />
      );
    }
    return <ImageIcon className={`${box} shrink-0 text-white/45`} />;
  }
  const glyph = TYPES.find((t) => t.id === item.type)?.glyph ?? "Aa";
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center font-mono text-[10px] font-bold text-white/50`}
    >
      {glyph}
    </span>
  );
}

export function AppDemoVariablesEditor({
  variables,
  onChange,
  tone = "light",
  projectId,
  hideHeader = false,
  layout = "cards",
}: {
  variables: AppDemoVariable[];
  onChange: (next: AppDemoVariable[]) => void;
  tone?: "light" | "dark";
  projectId?: string;
  hideHeader?: boolean;
  compact?: boolean;
  layout?: "cards" | "sidebar";
}) {
  const dark = tone === "dark";
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryAsset[] | null>(null);
  const [galleryError, setGalleryError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = variables.find((item) => item.id === editingId) ?? null;

  useEffect(() => {
    if (!editingId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditingId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId]);

  useEffect(() => {
    if (editingId && !variables.some((item) => item.id === editingId)) {
      setEditingId(null);
    }
  }, [editingId, variables]);

  const muted = dark ? "text-white/40" : "text-[#9ca3af]";
  const input = dark
    ? "w-full rounded-lg border border-white/10 bg-[#0c0d11] px-2.5 py-1.5 font-mono text-[12px] text-white outline-none placeholder:text-white/25 focus:border-white/25"
    : "w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 font-mono text-[12px] text-[#111827] outline-none placeholder:text-[#d1d5db] focus:border-[#d1d5db]";

  const visible = query.trim()
    ? variables.filter((item) =>
        item.key.toLowerCase().includes(query.trim().toLowerCase())
      )
    : variables;

  function patch(id: string, partial: Partial<AppDemoVariable>) {
    onChange(variables.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  }

  function addVar(type: AppDemoVarType) {
    if (variables.length >= APP_DEMO_MAX_VARS) return;
    const id = newId();
    onChange([
      ...variables,
      {
        id,
        key: nextKey(variables, type),
        type,
        value:
          type === "boolean" ? "true" : type === "color" ? "#6366f1" : "",
      },
    ]);
    setMenuOpen(false);
    setEditingId(id);
  }

  async function loadGallery() {
    if (!projectId) return;
    setGalleryError("");
    setGallery([]);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/gallery?all=1&kind=image`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la galería");
      setGallery((data.assets ?? []) as GalleryAsset[]);
    } catch (err) {
      setGalleryError(
        err instanceof Error ? err.message : "No se pudo cargar la galería"
      );
    }
  }

  async function onPickFile(id: string, file: File | undefined) {
    if (!file) return;
    setBusyId(id);
    try {
      const value = await fileToAppDemoImageValue(file);
      patch(id, { type: "image", value });
    } catch (err) {
      setGalleryError(
        err instanceof Error ? err.message : "No se pudo leer la foto"
      );
    } finally {
      setBusyId("");
    }
  }

  const sidebar = layout === "sidebar";

  return (
    <div className={sidebar ? "flex h-full min-h-0 flex-col" : undefined}>
      {sidebar ? (
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
          <p className="text-[18px] font-semibold tracking-tight text-white">
            Variables
          </p>
          <AddMenu
            dark
            label="Crear"
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            onPick={addVar}
            disabled={variables.length >= APP_DEMO_MAX_VARS}
          />
        </div>
      ) : hideHeader ? null : (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold ${dark ? "text-white" : "text-[#111827]"}`}>
            Variables
          </p>
          <AddMenu
            dark={dark}
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            onPick={addVar}
            disabled={variables.length >= APP_DEMO_MAX_VARS}
          />
        </div>
      )}

      {hideHeader && !sidebar ? (
        <div className="mb-3 flex items-center gap-2">
          <input
            className={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar variable…"
          />
          <AddMenu
            dark={dark}
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            onPick={addVar}
            disabled={variables.length >= APP_DEMO_MAX_VARS}
          />
        </div>
      ) : null}

      {galleryError ? (
        <p className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {galleryError}
        </p>
      ) : null}

      {sidebar ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {variables.length === 0 ? (
            <p className="px-2.5 py-8 text-[13px] leading-relaxed text-white/35">
              Crea texto, color o una foto. Se lee en el código como vars.nombre.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const selected = editingId === item.id;
                const preview = varPreview(item);
                return (
                  <li key={item.id}>
                    <div
                      className={`group flex items-center gap-0.5 rounded-[10px] ${
                        selected ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left"
                      >
                        <TypeGlyph item={item} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-white">
                            {item.key || "sin nombre"}
                          </span>
                          <span className="block truncate text-[11px] text-white/35">
                            {preview}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mr-1 rounded-md p-1 text-white/0 hover:text-red-300 group-hover:text-white/35"
                        onClick={() =>
                          onChange(variables.filter((v) => v.id !== item.id))
                        }
                        aria-label="Quitar"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : variables.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed px-5 py-10 text-center ${
            dark ? "border-white/12 bg-white/[0.03]" : "border-[#e5e7eb] bg-[#fafafa]"
          }`}
        >
          <p className={`text-[14px] font-medium ${dark ? "text-white" : "text-[#111827]"}`}>
            Sin variables todavía
          </p>
          <p className={`mx-auto mt-1 max-w-xs text-[12px] ${muted}`}>
            Añade texto, color o una foto. En el código se leen como vars.nombre y
            el preview se actualiza al momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const badKey = !isAppDemoVarKey(item.key);
            return (
              <li
                key={item.id}
                className={`rounded-2xl border px-3 py-2.5 ${
                  dark
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <TypeBadge
                    dark={dark}
                    type={item.type}
                    onChange={(type) =>
                      patch(item.id, {
                        type,
                        value:
                          type === "boolean"
                            ? item.value === "true"
                              ? "true"
                              : "false"
                            : type === "color" && !/^#/.test(item.value)
                              ? "#6366f1"
                              : type === "image" && !isAppDemoImageSrc(item.value)
                                ? ""
                                : item.value,
                      })
                    }
                  />
                  <input
                    className={input}
                    value={item.key}
                    onChange={(e) => patch(item.id, { key: e.target.value })}
                    placeholder="nombre"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className={`rounded-lg p-1.5 ${
                      dark
                        ? "text-white/30 hover:bg-white/10 hover:text-red-300"
                        : "text-[#d1d5db] hover:bg-[#f3f4f6] hover:text-[#b91c1c]"
                    }`}
                    onClick={() =>
                      onChange(variables.filter((v) => v.id !== item.id))
                    }
                    aria-label="Quitar variable"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2">
                  <ValueField
                    item={item}
                    dark={dark}
                    input={input}
                    busy={busyId === item.id}
                    expanded={editingId === item.id}
                    onExpand={() => setEditingId(item.id)}
                    onPatch={(partial) => patch(item.id, partial)}
                    onFile={(file) => void onPickFile(item.id, file)}
                    onOpenGallery={
                      projectId
                        ? () => {
                            setPickingId(item.id);
                            void loadGallery();
                          }
                        : undefined
                    }
                  />
                </div>
                {badKey ? (
                  <p className="mt-1.5 text-[10px] text-[#f87171]">
                    El nombre debe ser un identificador JS (appName, photo…).
                  </p>
                ) : (
                  <p className={`mt-1.5 font-mono text-[10px] ${muted}`}>
                    vars.{item.key || "nombre"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && typeof document !== "undefined"
        ? createPortal(
            <VariableEditCard
              item={editing}
              dark={dark}
              input={input}
              busy={busyId === editing.id}
              onPatch={(partial) => patch(editing.id, partial)}
              onFile={(file) => void onPickFile(editing.id, file)}
              onDelete={() => {
                onChange(variables.filter((v) => v.id !== editing.id));
                setEditingId(null);
              }}
              onOpenGallery={
                projectId
                  ? () => {
                      setPickingId(editing.id);
                      void loadGallery();
                    }
                  : undefined
              }
              onClose={() => setEditingId(null)}
            />,
            document.body
          )
        : null}

      {pickingId ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar galería"
            onClick={() => setPickingId(null)}
          />
          <div
            className={`relative z-[91] flex max-h-[min(72vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border)] ${
              dark
                ? "border border-white/10 bg-[#16171c] text-white"
                : "border border-[var(--border)] bg-white text-[#111827]"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-3 ${
                dark ? "border-white/10" : "border-[var(--border)]"
              }`}
            >
              <p className="text-[14px] font-semibold">Elegir de Galería</p>
              <button
                type="button"
                className={dark ? "text-white/40 hover:text-white" : "text-[#9ca3af]"}
                onClick={() => setPickingId(null)}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!gallery || gallery.length === 0 ? (
                <p className={`py-10 text-center text-[13px] ${muted}`}>
                  {gallery ? "No hay fotos en la galería." : "Cargando…"}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="group overflow-hidden rounded-xl bg-black/20"
                      onClick={() => {
                        patch(pickingId, {
                          type: "image",
                          value: asset.publicUrl,
                        });
                        setPickingId(null);
                      }}
                    >
                      <img
                        src={asset.publicUrl}
                        alt={asset.name}
                        className="aspect-square w-full object-cover transition group-hover:scale-[1.03]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddMenu({
  dark,
  open,
  onToggle,
  onPick,
  disabled,
  label = "Añadir",
  compact = false,
}: {
  dark: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (type: AppDemoVarType) => void;
  disabled: boolean;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`relative shrink-0 ${compact ? "w-full" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={
          compact
            ? "flex w-full flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-white/80 hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            : dark
            ? "inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[13px] font-semibold text-[#111] hover:bg-white/90 disabled:opacity-40"
            : "inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
        }
      >
        {compact ? (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#111]">
              <PlusIcon className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </>
        ) : (
          <>
            <PlusIcon className="h-3.5 w-3.5" />
            {label}
          </>
        )}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Cerrar menú"
            onClick={onToggle}
          />
          <div
            className={`absolute z-20 w-56 overflow-hidden rounded-2xl border py-1 shadow-[0_16px_40px_rgba(0,0,0,0.25)] ${
              compact ? "left-full top-0 ml-2" : "right-0 mt-2"
            } ${
              dark
                ? "border-white/10 bg-[#1b1c22]"
                : "border-[var(--border)] bg-white"
            }`}
          >
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                  dark ? "hover:bg-white/[0.06]" : "hover:bg-[#f9fafb]"
                }`}
                onClick={() => onPick(t.id)}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${
                    dark
                      ? "bg-white/[0.08] text-white/80"
                      : "bg-[#f3f4f6] text-[#4b5563]"
                  }`}
                >
                  {t.glyph}
                </span>
                <span>
                  <span
                    className={`block text-[13px] font-medium ${
                      dark ? "text-white" : "text-[#111827]"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span
                    className={`block text-[11px] ${
                      dark ? "text-white/35" : "text-[#9ca3af]"
                    }`}
                  >
                    {t.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TypeBadge({
  type,
  onChange,
  dark,
}: {
  type: AppDemoVarType;
  onChange: (type: AppDemoVarType) => void;
  dark: boolean;
}) {
  return (
    <select
      aria-label="Tipo"
      className={`h-8 w-[88px] shrink-0 rounded-lg border px-1.5 text-[11px] font-medium ${
        dark
          ? "border-white/10 bg-[#0c0d11] text-white"
          : "border-[var(--border)] bg-[#f9fafb] text-[#374151]"
      }`}
      value={type}
      onChange={(e) => onChange(e.target.value as AppDemoVarType)}
    >
      {TYPES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function ValueField({
  item,
  input,
  dark,
  busy,
  expanded,
  onExpand,
  onPatch,
  onFile,
  onOpenGallery,
}: {
  item: AppDemoVariable;
  input: string;
  dark: boolean;
  busy: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  onPatch: (partial: Partial<AppDemoVariable>) => void;
  onFile: (file: File | undefined) => void;
  onOpenGallery?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [showUrl, setShowUrl] = useState(
    Boolean(item.value) && item.value.startsWith("http")
  );

  if (item.type === "boolean") {
    return (
      <div className="flex gap-1.5">
        {(["true", "false"] as const).map((v) => {
          const on = item.value === "true" ? v === "true" : v === "false";
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPatch({ value: v })}
              className={`flex-1 rounded-xl py-1.5 text-[12px] font-semibold ${
                on
                  ? dark
                    ? "bg-white text-[#111]"
                    : "bg-[var(--accent)] text-white"
                  : dark
                    ? "bg-white/5 text-white/50"
                    : "bg-[#f3f4f6] text-[#6b7280]"
              }`}
            >
              {v === "true" ? "Sí" : "No"}
            </button>
          );
        })}
      </div>
    );
  }

  if (item.type === "color") {
    const color = /^#[0-9a-fA-F]{6}$/.test(item.value)
      ? item.value
      : "#6366f1";
    return (
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-black/10"
          style={{ background: color }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => onPatch({ value: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          className={`${input} cursor-pointer`}
          value={item.value}
          readOnly
          onFocus={onExpand}
          onClick={onExpand}
          spellCheck={false}
        />
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div
          className={`flex items-stretch gap-3 rounded-2xl border border-dashed p-2 transition ${
            over
              ? dark
                ? "border-white/40 bg-white/8"
                : "border-[#111827] bg-[#f9fafb]"
              : dark
                ? "border-white/12 bg-black/20"
                : "border-[#e5e7eb] bg-[#fafafa]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          onPaste={(e) => {
            const file = [...e.clipboardData.items]
              .find((item) => item.type.startsWith("image/"))
              ?.getAsFile();
            if (file) onFile(file);
          }}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl ${
              dark ? "bg-white/8" : "bg-white"
            }`}
          >
            {item.value ? (
              <img
                src={item.value}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className={`flex h-full items-center justify-center ${
                  dark ? "text-white/30" : "text-[#d1d5db]"
                }`}
              >
                <ImageIcon className="h-6 w-6" />
              </span>
            )}
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] text-white">
                …
              </span>
            ) : null}
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
            <p
              className={`text-[12px] font-medium ${
                dark ? "text-white/80" : "text-[#111827]"
              }`}
            >
              {item.value ? "Foto lista" : "Arrastra, pega o sube una foto"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={
                  dark
                    ? "rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white"
                    : "rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#111827] shadow-sm"
                }
                onClick={() => fileRef.current?.click()}
              >
                Subir
              </button>
              {onOpenGallery ? (
                <button
                  type="button"
                  className={
                    dark
                      ? "rounded-lg px-2 py-1 text-[11px] text-white/60 hover:text-white"
                      : "rounded-lg px-2 py-1 text-[11px] text-[#6b7280] hover:text-[#111827]"
                  }
                  onClick={onOpenGallery}
                >
                  Galería
                </button>
              ) : null}
              <button
                type="button"
                className={
                  dark
                    ? "rounded-lg px-2 py-1 text-[11px] text-white/60 hover:text-white"
                    : "rounded-lg px-2 py-1 text-[11px] text-[#6b7280] hover:text-[#111827]"
                }
                onClick={() => setShowUrl((v) => !v)}
              >
                URL
              </button>
              {item.value ? (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-[11px] text-red-300/80 hover:text-red-200"
                  onClick={() => onPatch({ value: "" })}
                >
                  Quitar foto
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {showUrl ? (
          <input
            className={`${input} mt-2`}
            value={item.value.startsWith("data:") ? "" : item.value}
            onChange={(e) => onPatch({ value: e.target.value })}
            placeholder="https://…"
          />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`${input} flex min-h-[34px] items-center truncate text-left ${
        expanded ? (dark ? "border-white/30" : "border-[#111827]") : ""
      }`}
    >
      <span className={item.value ? "" : dark ? "text-white/25" : "text-[#d1d5db]"}>
        {item.value || "Escribir…"}
      </span>
    </button>
  );
}

function VariableEditCard({
  item,
  dark,
  input,
  busy,
  onPatch,
  onFile,
  onOpenGallery,
  onDelete,
  onClose,
}: {
  item: AppDemoVariable;
  dark: boolean;
  input: string;
  busy: boolean;
  onPatch: (partial: Partial<AppDemoVariable>) => void;
  onFile: (file: File | undefined) => void;
  onOpenGallery?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    fieldRef.current?.focus();
    if (fieldRef.current instanceof HTMLInputElement || fieldRef.current instanceof HTMLTextAreaElement) {
      const el = fieldRef.current;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [item.id]);

  const color = /^#[0-9a-fA-F]{6}$/.test(item.value) ? item.value : "#6366f1";
  const field =
    dark
      ? "w-full rounded-2xl border border-white/12 bg-[#0c0d11] px-3.5 py-3 text-[16px] leading-relaxed text-white outline-none focus:border-white/30"
      : "w-full rounded-2xl border border-[#e5e7eb] bg-white px-3.5 py-3 text-[16px] leading-relaxed text-[#111827] outline-none focus:border-[#111827]";

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/25"
        aria-label="Cerrar editor"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`Editar ${item.key}`}
        className={`absolute left-[max(16px,min(292px,12vw))] top-[16vh] w-[min(460px,calc(100vw-32px))] overflow-hidden rounded-[24px] shadow-[0_28px_80px_rgba(0,0,0,0.4)] ${
          dark
            ? "border border-white/10 bg-[#17181e] text-white"
            : "border border-[var(--border)] bg-white text-[#111827]"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
            dark ? "border-white/8" : "border-[var(--border)]"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Editar variable</p>
            <p
              className={`truncate font-mono text-[11px] ${
                dark ? "text-white/35" : "text-[#9ca3af]"
              }`}
            >
              vars.{item.key || "nombre"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-1.5 ${
              dark
                ? "text-white/40 hover:bg-white/10 hover:text-white"
                : "text-[#9ca3af] hover:bg-[#f3f4f6]"
            }`}
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <label
            className={`mb-1.5 block text-[11px] font-medium ${
              dark ? "text-white/40" : "text-[#9ca3af]"
            }`}
          >
            Nombre
          </label>
          <input
            className={`${field} !py-2 !text-[14px] font-mono mb-3`}
            value={item.key}
            onChange={(e) => onPatch({ key: e.target.value })}
            spellCheck={false}
            placeholder="appName"
          />
          <label
            className={`mb-1.5 block text-[11px] font-medium ${
              dark ? "text-white/40" : "text-[#9ca3af]"
            }`}
          >
            Valor
          </label>
          {item.type === "boolean" || item.type === "image" ? (
            <ValueField
              item={item}
              dark={dark}
              input={input}
              busy={busy}
              onPatch={onPatch}
              onFile={onFile}
              onOpenGallery={onOpenGallery}
            />
          ) : item.type === "color" ? (
            <div className="flex items-center gap-3">
              <label
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-black/10"
                style={{ background: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onPatch({ value: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <input
                ref={(el) => {
                  fieldRef.current = el;
                }}
                className={field}
                value={item.value}
                onChange={(e) => onPatch({ value: e.target.value })}
                spellCheck={false}
              />
            </div>
          ) : item.type === "number" ? (
            <input
              ref={(el) => {
                fieldRef.current = el;
              }}
              className={field}
              type="number"
              value={item.value}
              onChange={(e) => onPatch({ value: e.target.value })}
            />
          ) : (
            <textarea
              ref={(el) => {
                fieldRef.current = el;
              }}
              className={`${field} min-h-[140px] resize-y`}
              value={item.value}
              onChange={(e) => onPatch({ value: e.target.value })}
              placeholder="Escribe el valor…"
            />
          )}
        </div>
        <div
          className={`flex items-center justify-between gap-2 border-t px-4 py-3 ${
            dark ? "border-white/8" : "border-[var(--border)]"
          }`}
        >
          {onDelete ? (
            <button
              type="button"
              className={`text-[12px] font-medium ${
                dark ? "text-red-300/80 hover:text-red-200" : "text-[#dc2626]"
              }`}
              onClick={onDelete}
            >
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
