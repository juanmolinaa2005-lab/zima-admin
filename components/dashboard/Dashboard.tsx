"use client";

import { useEffect, useState } from "react";
import {
  type OpenTab,
  type Tool,
  createTabId,
  createToolId,
  loadTools,
  saveTools,
} from "@/lib/tools";
import { CreateToolModal } from "./CreateToolModal";
import { HomeView } from "./HomeView";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { ToolFrame } from "./ToolFrame";

export function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTools(loadTools());
    setReady(true);
  }, []);

  function persist(next: Tool[]) {
    setTools(next);
    saveTools(next);
  }

  function openTool(tool: Tool) {
    if (!tool.url) {
      setShowHome(true);
      setActiveTabId(null);
      return;
    }

    const existing = tabs.find((t) => t.toolId === tool.id);
    if (existing) {
      setActiveTabId(existing.id);
      setShowHome(false);
      return;
    }

    const tab: OpenTab = {
      id: createTabId(),
      toolId: tool.id,
      title: tool.name,
      url: tool.url,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setShowHome(false);
  }

  function handleCreate(name: string, url: string) {
    const tool: Tool = {
      id: createToolId(),
      name,
      url,
    };
    const next = [...tools, tool];
    persist(next);
    openTool(tool);
  }

  function handleDelete(toolId: string) {
    const next = tools.filter((t) => t.id !== toolId);
    persist(next);
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.toolId !== toolId);
      if (activeTabId && !remaining.some((t) => t.id === activeTabId)) {
        if (remaining.length > 0) {
          setActiveTabId(remaining[remaining.length - 1].id);
          setShowHome(false);
        } else {
          setActiveTabId(null);
          setShowHome(true);
        }
      }
      return remaining;
    });
  }

  function closeTab(tabId: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const remaining = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        if (remaining.length === 0) {
          setActiveTabId(null);
          setShowHome(true);
        } else {
          const nextIdx = Math.max(0, idx - 1);
          setActiveTabId(remaining[nextIdx].id);
          setShowHome(false);
        }
      }
      return remaining;
    });
  }

  function selectHome() {
    setShowHome(true);
    setActiveTabId(null);
  }

  const activeToolId = showHome
    ? "home"
    : (tabs.find((t) => t.id === activeTabId)?.toolId ?? null);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#f6f9fc] text-[13px] text-[#697386]">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-[#0a2540]">
      <Sidebar
        tools={tools}
        activeToolId={activeToolId}
        onSelectHome={selectHome}
        onSelectTool={openTool}
        onCreateClick={() => setModalOpen(true)}
        onDeleteTool={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e3e8ee] bg-white px-5">
          <div>
            <p className="text-[13px] font-semibold text-[#0a2540]">
              {showHome
                ? "Inicio"
                : (tabs.find((t) => t.id === activeTabId)?.title ?? "Dashboard")}
            </p>
            <p className="text-[11px] text-[#697386]">
              {showHome
                ? "Vista general"
                : "Pestaña interna"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-[#f6f9fc] px-2.5 py-1 text-[11px] font-medium text-[#697386] sm:inline">
              {tools.filter((t) => t.id !== "home").length} herramientas
            </span>
          </div>
        </header>

        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={(id) => {
            setActiveTabId(id);
            setShowHome(false);
          }}
          onClose={closeTab}
        />

        <main className="relative min-h-0 flex-1">
          {showHome || tabs.length === 0 ? (
            <HomeView
              tools={tools}
              onCreateClick={() => setModalOpen(true)}
              onOpenTool={openTool}
            />
          ) : null}

          {tabs.map((tab) => (
            <ToolFrame
              key={tab.id}
              tab={tab}
              active={!showHome && tab.id === activeTabId}
            />
          ))}
        </main>
      </div>

      <CreateToolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
