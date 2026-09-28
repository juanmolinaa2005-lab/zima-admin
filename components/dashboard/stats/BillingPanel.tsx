"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SuperwallApplication,
  SuperwallBillingReport,
} from "@/lib/superwall/admin";
import { formatCount, formatMoney, MetricCard, Sparkline } from "./ui";

type SuperwallStatus = {
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
  orgId: string | null;
  applicationId: string | null;
};

export function BillingPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [status, setStatus] = useState<SuperwallStatus | null>(null);
  const [applications, setApplications] = useState<SuperwallApplication[]>([]);
  const [applicationId, setApplicationId] = useState<string>("");
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<SuperwallBillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(
    async (appId?: string, d?: number) => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({ days: String(d ?? days) });
        if (appId || applicationId) q.set("applicationId", appId || applicationId);
        const res = await fetch(`/api/superwall/analytics?${q}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load analytics");
        setApplications(data.applications ?? []);
        setReport(data.report ?? null);
        if (data.report?.applicationId) setApplicationId(data.report.applicationId);
        else if ((data.applications ?? [])[0]?.id) {
          setApplicationId(data.applications[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    },
    [applicationId, days]
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/superwall/settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setStatus(data);
        if (data.applicationId) setApplicationId(data.applicationId);
        if (data.connected) await loadReport(data.applicationId ?? undefined);
        else {
          setReport(null);
          setApplications([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleAppChange(next: string) {
    setApplicationId(next);
    await fetch("/api/superwall/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: next }),
    });
    await loadReport(next);
  }

  const selectedApp = useMemo(
    () => applications.find((a) => a.id === applicationId) ?? null,
    [applications, applicationId]
  );

  if (!status?.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-12 text-center">
        <p className="text-[14px] font-semibold text-[var(--foreground)]">Connect Superwall</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted)]">
          Add your organization API key in Settings → API.
        </p>
        <a
          href={`/projects/${projectId}/settings/api`}
          className="ui-btn-primary mt-4 inline-flex"
        >
          Open API settings
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Superwall</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Revenue, subscriptions, and new users
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-tag ui-tag-success">
            Connected {status.keyHint ? `· ${status.keyHint}` : ""}
          </span>
          <select
            value={days}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDays(d);
              void loadReport(undefined, d);
            }}
            className="ui-input !w-auto !rounded-lg !py-1.5 !text-[12px]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {applications.length > 0 ? (
            <select
              value={applicationId}
              onChange={(e) => void handleAppChange(e.target.value)}
              className="ui-input max-w-[220px] !rounded-lg !py-1.5 !text-[12px]"
            >
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.platform}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="ui-btn-primary !px-3 !py-1.5 text-[12px] disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label="Gross proceeds"
              value={formatMoney(report.grossProceeds)}
              hint={`${days}d · ${selectedApp?.name || "App"}`}
            />
            <MetricCard
              label="Net proceeds"
              value={formatMoney(report.netProceeds)}
              hint="After store fees"
            />
            <MetricCard
              label="New users"
              value={formatCount(report.newUsers)}
              hint="Installs in period"
            />
            <MetricCard label="MRR" value={formatMoney(report.mrr)} hint="Monthly recurring" />
            <MetricCard
              label="Active subscriptions"
              value={formatCount(report.activeSubscriptions)}
              hint="Current actives"
            />
          </div>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Net proceeds</h3>
                <p className="text-[12px] text-[var(--muted-soft)]">Daily · last {days} days</p>
              </div>
              <p className="text-[18px] font-semibold text-[var(--foreground)]">
                {formatMoney(report.netProceeds)}
              </p>
            </div>
            <Sparkline points={report.series} />
          </section>
        </>
      ) : !loading ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-[13px] text-[var(--muted-soft)]">
          No billing data yet for this application.
        </div>
      ) : (
        <div className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Loading Superwall analytics…
        </div>
      )}
    </div>
  );
}
