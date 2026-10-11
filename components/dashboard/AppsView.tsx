"use client";

import { useEffect, useState } from "react";
import type { WorkspaceTool } from "@/lib/types";
import { GridIcon, PlusIcon, SearchIcon, TrashIcon } from "./icons";
import { hostOf } from "./nav";
import { FaviconMark } from "./FaviconMark";

type AppsViewProps = {
  tools: WorkspaceTool[];
  projectName: string;
  onCreateClick: () => void;
  onOpenTool: (tool: WorkspaceTool) => void;
  onDeleteTool?: (toolId: string) => void;
  onConfigureIcon?: (tool: WorkspaceTool) => void;
};

type MenuState = {
  tool: WorkspaceTool;
  x: number;
  y: number;
} | null;

export function AppsView({
  tools,
  projectName,
  onCreateClick,
  onOpenTool,
  onDeleteTool,
  onConfigureIcon,
}: AppsViewProps) {
  const customTools = tools.filter((t) => t.kind === "link");
  const [menu, setMenu] = useState<MenuState>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? customTools.filter((t) =>
        `${t.name} ${hostOf(t.url)}`.toLowerCase().includes(q)
      )
    : customTools;

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ui-kicker">{projectName}</p>
            <h2 className="ui-title mt-1.5">Accesos directos</h2>
            <p className="ui-lead mt-1">
              Enlaces a tus herramientas externas. Se abren en una pestaña nueva.
            </p>
          </div>
          <button type="button" onClick={onCreateClick} className="ui-btn-primary">
            <PlusIcon className="h-3.5 w-3.5" />
            Nuevo acceso
          </button>
        </div>

        {customTools.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--border-strong)] bg-white px-6 py-14 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <GridIcon className="h-6 w-6" />
            </span>
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              No hay accesos todavía
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Añade un enlace para abrirlo en otra pestaña.
            </p>
            <button type="button" onClick={onCreateClick} className="ui-btn-primary mt-5">
              <PlusIcon className="h-3.5 w-3.5" />
              Nuevo acceso
            </button>
          </div>
        ) : (
          <section className="ui-card mt-6 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="relative min-w-[200px] flex-1">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-soft)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar accesos…"
                  className="ui-input h-8 pl-8 text-[13px]"
                />
              </div>
              <span className="ui-tag ui-tag-muted">
                {visible.length} de {customTools.length}
              </span>
            </div>
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">
                Ningún acceso coincide con “{query}”.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {visible.map((tool) => (
                  <li
                    key={tool.id}
                    className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--background)]"
                    onContextMenu={(e) => {
                      if (!onDeleteTool && !onConfigureIcon) return;
                      e.preventDefault();
                      setMenu({ tool, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTool(tool)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
                        <FaviconMark url={tool.url} iconUrl={tool.iconUrl} name={tool.name} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">
                          {tool.name}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                          {hostOf(tool.url) || tool.url}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {onConfigureIcon ? (
                        <button
                          type="button"
                          onClick={() => onConfigureIcon(tool)}
                          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--muted)] opacity-0 transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] group-hover:opacity-100"
                        >
                          Icono
                        </button>
                      ) : null}
                      {onDeleteTool ? (
                        <button
                          type="button"
                          onClick={() => onDeleteTool(tool.id)}
                          aria-label={`Eliminar ${tool.name}`}
                          className="rounded-lg p-1.5 text-[var(--muted-soft)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenTool(tool)}
                        className="ui-btn-secondary h-8 px-3 text-[12px]"
                      >
                        Abrir ↗
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {menu ? (
        <div
          role="menu"
          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-lg)]"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onConfigureIcon ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              onClick={() => {
                onConfigureIcon(menu.tool);
                setMenu(null);
              }}
            >
              <GridIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              Cambiar icono
            </button>
          ) : null}
          {onDeleteTool ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={() => {
                onDeleteTool(menu.tool.id);
                setMenu(null);
              }}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Eliminar acceso
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
