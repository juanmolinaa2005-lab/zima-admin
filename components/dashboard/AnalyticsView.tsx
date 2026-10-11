"use client";

import { useEffect, useState } from "react";
import { UseView } from "./UseView";
import { ApiMissingBanner } from "./ApiMissingBanner";
import { PlusIcon } from "./icons";
import { AllPanel } from "./stats/AllPanel";
import { BillingPanel } from "./stats/BillingPanel";
import { ConstructModal } from "./stats/ConstructModal";
import { GenericPlatformPanel } from "./stats/GenericPlatformPanel";
import type { StatsSource } from "@/lib/stats/types";

type AnalyticsViewProps = {
  linkedRef?: string | null;
  projectId: string;
};

type TabId = "all" | string;

export function AnalyticsView({ linkedRef, projectId }: AnalyticsViewProps) {
  const [tab, setTab] = useState<TabId>("all");
  const [sources, setSources] = useState<StatsSource[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/stats/sources?projectId=${encodeURIComponent(projectId)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar las plataformas");
        if (!cancelled) {
          setSources(data.sources ?? []);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const active = sources.find((s) => s.id === tab) ?? null;
  const missing =
    active?.builtin === "superwall" && !active.connected
      ? "Superwall"
      : active?.builtin === "openai" && !active.connected
        ? "OpenAI"
        : active?.builtin === "claude" && !active.connected
          ? "Claude"
          : null;

  async function removeSource(source: StatsSource) {
    const ok = window.confirm(`Quitar ${source.name} de este dashboard?`);
    if (!ok) return;
    await fetch(
      `/api/stats/sources/${source.id}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    if (tab === source.id) setTab("all");
    setRefreshKey((n) => n + 1);
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--surface-alt)]">
      {missing ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName={missing}
          message={`${missing} API is not connected.`}
        />
      ) : null}

      <div className="shrink-0 border-b border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-alt)] p-1">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                tab === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              All
            </button>
            {sources.map((source) => (
              <div key={source.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setTab(source.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    tab === source.id
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {source.name}
                </button>
                {tab === source.id ? (
                  <button
                    type="button"
                    onClick={() => void removeSource(source)}
                    className="ml-0.5 rounded-md px-1 text-[11px] text-[var(--muted-soft)] hover:text-[var(--danger)]"
                    aria-label={`Quitar ${source.name}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)]"
            aria-label="Añadir plataforma"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loadError ? (
          <div className="mb-3 rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {loadError}
          </div>
        ) : null}
        {tab === "all" ? (
          <AllPanel projectId={projectId} refreshKey={refreshKey} />
        ) : null}
        {active?.builtin === "superwall" ? (
          <BillingPanel projectId={projectId} refreshKey={refreshKey} />
        ) : null}
        {active?.builtin === "openai" ? (
          <div className="-m-4 h-[calc(100%+2rem)] sm:-m-5">
            <UseView
              linkedRef={linkedRef}
              embedded
              hideSetup
              refreshKey={refreshKey}
              settingsHref={`/projects/${projectId}/settings/api`}
            />
          </div>
        ) : null}
        {active && active.builtin !== "superwall" && active.builtin !== "openai" ? (
          <GenericPlatformPanel
            projectId={projectId}
            source={active}
            refreshKey={refreshKey}
          />
        ) : null}
      </div>

      <ConstructModal
        open={modalOpen}
        projectId={projectId}
        onClose={() => setModalOpen(false)}
        onAdded={(sourceId) => {
          setTab(sourceId);
          setRefreshKey((n) => n + 1);
        }}
      />
    </div>
  );
}
