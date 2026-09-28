"use client";

import { useState } from "react";
import type { OpenTab } from "@/lib/types";

type ToolFrameProps = {
  tab: OpenTab;
  active: boolean;
};

export function ToolFrame({ tab, active }: ToolFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const url = tab.url ?? "";

  return (
    <div
      className={`absolute inset-0 flex flex-col bg-black ${active ? "z-10" : "z-0 pointer-events-none invisible"}`}
      aria-hidden={!active}
    >
      {!loaded ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black">
          <div className="flex items-center gap-2 text-[13px] text-white/70">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            Loading…
          </div>
        </div>
      ) : null}
      <iframe
        title={tab.title}
        src={url}
        className="h-full w-full flex-1 border-0 bg-black"
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
