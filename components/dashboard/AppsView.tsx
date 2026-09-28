"use client";

import { useEffect, useState } from "react";
import type { WorkspaceTool } from "@/lib/types";
import { GridIcon, PlusIcon, TrashIcon } from "./icons";
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

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-6xl p-5">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="ui-chip">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {projectName}
          </span>
          <span className="ui-chip">Accesos directos</span>
          <span className="ui-chip">{customTools.length} enlaces</span>
          <div className="ml-auto">
            <button
              type="button"
              onClick={onCreateClick}
              className="ui-btn-primary !py-1.5 !text-[12px]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Nuevo acceso
            </button>
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Accesos directos
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Se abren en una pestaña nueva.
          </p>
        </div>

        {customTools.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <GridIcon className="h-6 w-6" />
            </span>
            <p className="text-[14px] font-medium text-[var(--foreground)]">
              No hay accesos todavía
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Añade un enlace para abrirlo en otra pestaña.
            </p>
            <button
              type="button"
              onClick={onCreateClick}
              className="ui-btn-primary mt-5 !py-2 !text-[13px]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Nuevo acceso
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <li>
              <button
                type="button"
                onClick={onCreateClick}
                className="flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] bg-white p-4 text-center text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span className="flex h-14 w-14 items-center justify-center">
                  <PlusIcon className="h-6 w-6" />
                </span>
                <span className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight">
                  Nuevo acceso
                </span>
              </button>
            </li>
            {customTools.map((tool) => (
              <li
                key={tool.id}
                className="relative"
                onContextMenu={(e) => {
                  if (!onDeleteTool && !onConfigureIcon) return;
                  e.preventDefault();
                  setMenu({ tool, x: e.clientX, y: e.clientY });
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpenTool(tool)}
                  className="flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white p-4 text-center shadow-[0_1px_2px_rgba(17,24,39,0.04)] transition hover:border-[var(--accent-border)] hover:shadow-[0_4px_16px_rgba(17,24,39,0.06)]"
                >
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
                    <FaviconMark
                      url={tool.url}
                      iconUrl={tool.iconUrl}
                      name={tool.name}
                    />
                  </span>
                  <span className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-[var(--foreground)]">
                    {tool.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menu ? (
        <div
          role="menu"
          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[0_12px_32px_rgba(17,24,39,0.12)]"
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
