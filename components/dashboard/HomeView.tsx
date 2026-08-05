"use client";

import type { Tool } from "@/lib/tools";
import { LinkIcon, PlusIcon } from "./icons";

type HomeViewProps = {
  tools: Tool[];
  onCreateClick: () => void;
  onOpenTool: (tool: Tool) => void;
};

export function HomeView({ tools, onCreateClick, onOpenTool }: HomeViewProps) {
  const customTools = tools.filter((t) => t.id !== "home");

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-[13px] font-medium text-[#635bff]">Dashboard</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0a2540]">
          Bienvenido a Zima Admin
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#425466]">
          Agrega herramientas con un link y ábrelas como pestañas internas.
          Ideal para CRMs, paneles, docs y cualquier URL que uses a diario.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 rounded-lg bg-[#635bff] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(50,50,93,0.12)] transition hover:bg-[#5851ea]"
          >
            <PlusIcon className="h-4 w-4" />
            Crear herramienta
          </button>
        </div>

        <div className="mt-12">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8792a2]">
            Tus herramientas
          </h2>

          {customTools.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#d6dee8] bg-[#f6f9fc] px-6 py-10 text-center">
              <p className="text-[14px] text-[#425466]">
                Todavía no creaste ninguna.
              </p>
              <p className="mt-1 text-[13px] text-[#697386]">
                Usa el botón de abajo en la barra lateral o el de arriba.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {customTools.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTool(tool)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-[#e3e8ee] bg-white p-4 text-left transition hover:border-[#c4c4ff] hover:shadow-[0_4px_12px_rgba(50,50,93,0.06)]"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f7ff] text-[#635bff] transition group-hover:bg-[#635bff] group-hover:text-white">
                      <LinkIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[#0a2540]">
                        {tool.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-[#697386]">
                        {tool.url}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
