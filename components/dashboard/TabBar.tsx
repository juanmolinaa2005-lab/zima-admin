"use client";

import type { OpenTab } from "@/lib/types";
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
    <div className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)] px-3">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[220px] shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
              active
                ? "border-[var(--border)] bg-white text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                : "border-transparent bg-transparent text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
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
              className={`rounded-full p-0.5 transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] ${
                active ? "opacity-70" : "opacity-0 group-hover:opacity-70"
              }`}
              aria-label={`Close ${tab.title}`}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
