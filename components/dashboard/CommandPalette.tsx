"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceTool } from "@/lib/types";
import { ArrowRightIcon, SearchIcon } from "./icons";
import { hostOf, toolMeta, type IconComp } from "./nav";
import { ToolAvatar } from "./Sidebar";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: IconComp;
  tool?: WorkspaceTool;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
};

export function CommandPalette({ open, onClose, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) =>
      `${a.label} ${a.hint ?? ""} ${a.group}`.toLowerCase().includes(q)
    );
  }, [actions, query]);


  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  function run(action: PaletteAction | undefined) {
    if (!action) return;
    onClose();
    action.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(filtered[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const groups: { name: string; items: { action: PaletteAction; idx: number }[] }[] = [];
  filtered.forEach((action, idx) => {
    let g = groups.find((x) => x.name === action.group);
    if (!g) {
      g = { name: action.group, items: [] };
      groups.push(g);
    }
    g.items.push({ action, idx });
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-[rgba(17,17,20,0.28)] px-4 pt-[12vh] backdrop-blur-[6px] animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-[0_32px_80px_-16px_rgba(17,17,20,0.35),0_0_0_1px_rgba(17,17,20,0.06)] backdrop-blur-2xl animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-[var(--muted-soft)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Buscar herramientas, accesos o acciones…"
            className="h-14 w-full bg-transparent text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
          />
          <kbd className="ui-kbd">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--muted)]">
              Sin resultados para “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                  {group.name}
                </p>
                {group.items.map(({ action, idx }) => {
                  const Icon = action.icon ?? (action.tool ? toolMeta(action.tool.kind).icon : undefined);
                  const active = idx === index;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      data-idx={idx}
                      onMouseEnter={() => setIndex(idx)}
                      onClick={() => run(action)}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left text-[13px] transition-all duration-150 ${
                        active
                          ? "bg-[#111114] text-white shadow-[0_6px_16px_-6px_rgba(17,17,20,0.5)]"
                          : "text-[var(--foreground-soft)]"
                      }`}
                    >
                      {action.tool && (action.tool.kind === "link" || action.tool.kind === "social") ? (
                        <ToolAvatar tool={action.tool} />
                      ) : Icon ? (
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-[var(--muted)]"}`} />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-medium">{action.label}</span>
                      {action.hint ? (
                        <span className={`truncate text-[12px] ${active ? "text-white/60" : "text-[var(--muted-soft)]"}`}>
                          {action.hint}
                        </span>
                      ) : null}
                      {active ? <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 animate-fade-in" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-alt)]/60 px-4 py-2.5 text-[11px] text-[var(--muted-soft)]">
          <span className="flex items-center gap-1.5"><span className="ui-kbd">↑</span><span className="ui-kbd">↓</span> moverte</span>
          <span className="flex items-center gap-1.5"><span className="ui-kbd">↵</span> abrir</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="ui-kbd">⌘K</span> cerrar</span>
        </div>
      </div>
    </div>
  );
}

export function linkHint(tool: WorkspaceTool) {
  return hostOf(tool.url);
}
