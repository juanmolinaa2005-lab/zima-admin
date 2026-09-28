"use client";

import { useEffect, useState } from "react";
import type { AllDashboard } from "@/lib/stats/types";
import { formatMetricValue, formatMoney, formatPct, MetricCard, Sparkline } from "./ui";

export function AllPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AllDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const res = await fetch(
          `/api/stats/all?projectId=${encodeURIComponent(projectId)}&days=${days}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "No se pudo cargar All");
        if (!cancelled) setData(json as AllDashboard);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudo cargar All");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, days, refreshKey]);

  const combined = (() => {
    const map = new Map<string, number>();
    for (const p of data?.platforms ?? []) {
      for (const s of p.series) {
        const delta = s.kind === "cost" ? -s.value : s.value;
        map.set(s.date, (map.get(s.date) ?? 0) + delta);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  })();

  if (!loading && data && data.platforms.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">All</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
          Pulsa + para añadir plataformas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">All</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Métricas comunes de ingresos, costos y usuarios
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="ui-input !w-auto !py-1.5 !text-[12px]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Calculando resumen…
        </div>
      ) : data ? (
        <>
          {data.groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <h3 className="text-[13px] font-semibold text-[var(--foreground)]">{group.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.metrics.map((m) => (
                  <MetricCard
                    key={m.id}
                    label={m.label}
                    value={formatMetricValue(m.value, m.format)}
                    hint={m.hint}
                    tone={m.tone}
                  />
                ))}
              </div>
            </section>
          ))}

          {combined.length > 1 ? (
            <section className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
              <div className="mb-3">
                <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Net diario</h3>
                <p className="text-[12px] text-[var(--muted-soft)]">
                  Ingresos positivos · gastos negativos
                </p>
              </div>
              <Sparkline points={combined} />
            </section>
          ) : null}

          {data.breakdowns.map((block) => (
            <section
              key={block.id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]"
            >
              <div className="border-b border-[#eef0f4] px-5 py-3">
                <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{block.title}</h3>
                {block.hint ? (
                  <p className="mt-0.5 text-[12px] text-[var(--muted-soft)]">{block.hint}</p>
                ) : null}
              </div>
              {block.rows.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-[var(--muted-soft)]">Sin desglose todavía</p>
              ) : (
                <div className="divide-y divide-[#eef0f4]">
                  {block.rows.map((row) => (
                    <div
                      key={row.name}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">{row.name}</p>
                      <div className="flex items-center gap-4 text-right text-[13px]">
                        {block.showShare && row.share != null ? (
                          <span className="text-[var(--muted-soft)]">{formatPct(row.share)}</span>
                        ) : null}
                        <span className="font-semibold text-[var(--foreground)]">
                          {block.format === "money"
                            ? formatMoney(row.value)
                            : formatMetricValue(row.value, "count")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}
