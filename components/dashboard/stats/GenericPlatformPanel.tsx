"use client";

import { useEffect, useState } from "react";
import type { PlatformSnapshot, StatsSource } from "@/lib/stats/types";
import { formatCount, formatMoney, kindLabel, MetricCard, Sparkline } from "./ui";

export function GenericPlatformPanel({
  projectId,
  source,
  refreshKey,
}: {
  projectId: string;
  source: StatsSource;
  refreshKey: number;
}) {
  const [days, setDays] = useState(7);
  const [snap, setSnap] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const q = new URLSearchParams({
          projectId,
          days: String(days),
        });
        const res = await fetch(`/api/stats/sources/${source.id}/metrics?${q}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "No se pudieron cargar métricas");
        if (!cancelled) setSnap(json as PlatformSnapshot);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
          setSnap(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, source.id, days, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">{source.name}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {kindLabel(source.kind)}
            {source.summary ? ` · ${source.summary}` : ""}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="ui-input !w-auto !rounded-lg !py-1.5 !text-[12px]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error || snap?.error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error || snap?.error}
        </div>
      ) : null}

      {loading && !snap ? (
        <div className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Cargando {source.name}…
        </div>
      ) : snap && snap.metrics.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {snap.metrics.map((m) => (
              <MetricCard
                key={m.id}
                label={m.label}
                value={m.unit === "usd" ? formatMoney(m.value) : formatCount(m.value)}
                hint={m.kind === "revenue" ? "Ingreso" : m.kind === "cost" ? "Gasto" : "Volumen"}
              />
            ))}
          </div>
          {snap.series.length > 1 ? (
            <section className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
              <h3 className="mb-3 text-[14px] font-semibold text-[var(--foreground)]">Serie</h3>
              <Sparkline
                points={snap.series}
                stroke={source.kind === "cost" ? "#b91c1c" : "var(--accent)"}
              />
            </section>
          ) : null}
        </>
      ) : !loading ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Sin datos todavía para esta plataforma.
        </div>
      ) : null}
    </div>
  );
}
