"use client";

import type { Tool } from "@/lib/tools";
import {
  GridIcon,
  HomeIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";

type SidebarProps = {
  tools: Tool[];
  activeToolId: string | null;
  onSelectHome: () => void;
  onSelectTool: (tool: Tool) => void;
  onCreateClick: () => void;
  onDeleteTool: (toolId: string) => void;
};

export function Sidebar({
  tools,
  activeToolId,
  onSelectHome,
  onSelectTool,
  onCreateClick,
  onDeleteTool,
}: SidebarProps) {
  const customTools = tools.filter((t) => t.id !== "home");

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[#e3e8ee] bg-[#f6f9fc]">
      <div className="flex h-14 items-center gap-2.5 border-b border-[#e3e8ee] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#635bff] text-[11px] font-bold tracking-wide text-white">
          Z
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-[#0a2540]">
            Zima Admin
          </p>
          <p className="text-[11px] text-[#697386]">Workspace</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8792a2]">
          Menú
        </p>
        <button
          type="button"
          onClick={onSelectHome}
          className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition ${
            activeToolId === "home" || activeToolId === null
              ? "bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(50,50,93,0.06)] ring-1 ring-[#e3e8ee]"
              : "text-[#425466] hover:bg-white/70 hover:text-[#0a2540]"
          }`}
        >
          <HomeIcon className="h-4 w-4 shrink-0 opacity-70" />
          Inicio
        </button>

        {customTools.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8792a2]">
              Herramientas
            </p>
            <ul className="space-y-0.5">
              {customTools.map((tool) => {
                const active = activeToolId === tool.id;
                return (
                  <li key={tool.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectTool(tool)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pr-8 text-left text-[13px] font-medium transition ${
                        active
                          ? "bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(50,50,93,0.06)] ring-1 ring-[#e3e8ee]"
                          : "text-[#425466] hover:bg-white/70 hover:text-[#0a2540]"
                      }`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        <LinkIcon className="h-3.5 w-3.5 opacity-70" />
                      </span>
                      <span className="truncate">{tool.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTool(tool.id);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#8792a2] opacity-0 transition hover:bg-[#fff0f3] hover:text-[#cd3d64] group-hover:opacity-100"
                      aria-label={`Eliminar ${tool.name}`}
                      title="Eliminar"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mt-6 px-2">
            <div className="rounded-lg border border-dashed border-[#d6dee8] bg-white/50 px-3 py-4 text-center">
              <GridIcon className="mx-auto mb-2 h-5 w-5 text-[#a3acb9]" />
              <p className="text-[12px] leading-relaxed text-[#697386]">
                Aún no hay herramientas. Crea una abajo para abrir links aquí.
              </p>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-[#e3e8ee] p-3">
        <button
          type="button"
          onClick={onCreateClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e3e8ee] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0a2540] shadow-[0_1px_2px_rgba(50,50,93,0.04)] transition hover:border-[#c4c4ff] hover:bg-[#f7f7ff] hover:text-[#635bff]"
        >
          <PlusIcon className="h-4 w-4" />
          Crear herramienta
        </button>
      </div>
    </aside>
  );
}
