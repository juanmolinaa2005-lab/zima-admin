"use client";

import type { OpenTab } from "@/lib/tools";
import { CloseIcon } from "./icons";

type TabBarProps = {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
};

export function TabBar({ tabs, activeTabId, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[#e3e8ee] bg-[#f6f9fc] px-2 pt-1.5">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[220px] shrink-0 items-center gap-1 rounded-t-md border border-b-0 px-2.5 py-1.5 text-[12px] transition ${
              active
                ? "border-[#e3e8ee] bg-white text-[#0a2540] shadow-[0_-1px_0_#fff]"
                : "border-transparent text-[#697386] hover:bg-white/70 hover:text-[#0a2540]"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="min-w-0 flex-1 truncate text-left font-medium"
              title={tab.title}
            >
              {tab.title}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={`rounded p-0.5 transition hover:bg-[#eef2f7] hover:text-[#0a2540] ${
                active ? "opacity-70" : "opacity-0 group-hover:opacity-70"
              }`}
              aria-label={`Cerrar ${tab.title}`}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
