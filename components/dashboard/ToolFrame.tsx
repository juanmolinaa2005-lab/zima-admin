"use client";

import { useState } from "react";
import type { OpenTab } from "@/lib/tools";
import { ExternalIcon } from "./icons";

type ToolFrameProps = {
  tab: OpenTab;
  active: boolean;
};

export function ToolFrame({ tab, active }: ToolFrameProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`absolute inset-0 flex flex-col bg-white ${active ? "z-10" : "z-0 pointer-events-none invisible"}`}
      aria-hidden={!active}
    >
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[#e3e8ee] bg-white px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#00d924]" />
          <p className="truncate font-mono text-[12px] text-[#697386]">{tab.url}</p>
        </div>
        <a
          href={tab.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#425466] transition hover:bg-[#f6f9fc] hover:text-[#635bff]"
        >
          Abrir fuera
          <ExternalIcon className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#fafbfc]">
        {!loaded ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center">
            <div className="flex items-center gap-2 text-[13px] text-[#697386]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e3e8ee] border-t-[#635bff]" />
              Cargando…
            </div>
          </div>
        ) : null}
        <iframe
          title={tab.title}
          src={tab.url}
          className="h-full w-full border-0 bg-white"
          onLoad={() => setLoaded(true)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
