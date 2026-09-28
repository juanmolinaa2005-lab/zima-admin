"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { OpenAIUsageReport } from "@/lib/openai/admin";
import {
  divideCost,
  effectivePerMillionFromUsage,
  formatUsd,
  formatUsdPrecise,
} from "@/lib/openai/pricing";

type SettingsStatus = {
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
};

type UseViewProps = {
  linkedRef?: string | null;
  /** When true, hide outer chrome (used inside Analytics → AI Cost). */
  embedded?: boolean;
  /** Hide inline API setup — keys live in Settings → API. */
  hideSetup?: boolean;
  /** Bump to reload status/report after external settings change. */
  refreshKey?: number;
  /** Link to central API settings. */
  settingsHref?: string;
  onOpenSettings?: () => void;
};

function FloatingTip({
  children,
  content,
  align = "left",
}: {
  children: ReactNode;
  content: ReactNode;
  align?: "left" | "right";
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 320;
    let left =
      align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const below = r.bottom + 8;
    const tipH = 180;
    const top =
      below + tipH > window.innerHeight - 8
        ? Math.max(8, r.top - tipH - 8)
        : below;
    setPos({ top, left });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <div
      ref={anchorRef}
      className="cursor-help"
      onMouseEnter={() => {
        setOpen(true);
        place();
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        setOpen(true);
        place();
      }}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && pos
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[9999] w-[min(320px,calc(100vw-1rem))] rounded-xl border border-[var(--border)] bg-[#0a2540] px-3.5 py-3 text-left shadow-[0_16px_40px_rgba(10,37,64,0.35)]"
              style={{ top: pos.top, left: pos.left }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const DAY_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
] as const;

/** Cifras completas con separador de miles (sin K/M). */
function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function formatDay(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDayShort(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en", {
      day: "numeric",
      month: "numeric",
    });
  } catch {
    return iso.slice(5);
  }
}

function DayCostChart({
  days,
}: {
  days: { date: string; costUsd: number; tokens: number; requests: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (days.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[12px] text-[var(--muted-soft)]">
        No data in this period
      </div>
    );
  }

  const max = Math.max(...days.map((d) => d.costUsd), 1e-12);
  const hovered = hover != null ? days[hover] : null;

  return (
    <div>
      <div className="mb-3 flex min-h-[40px] items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
            {hovered ? formatDay(hovered.date) : "Chart total"}
          </p>
          <p className="text-[20px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
            {formatUsdPrecise(
              hovered ? hovered.costUsd : days.reduce((s, d) => s + d.costUsd, 0),
              6
            )}
          </p>
        </div>
        {hovered ? (
          <div className="text-right text-[11px] tabular-nums text-[var(--muted)]">
            <p>{formatCount(hovered.tokens)} tokens</p>
            <p>{formatCount(hovered.requests)} requests</p>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted-soft)]">Hover a day</p>
        )}
      </div>

      <div
        className="flex h-[160px] items-end gap-1.5 border-b border-[#eef1f5] px-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {days.map((d, i) => {
          const pct = Math.max(1.5, (d.costUsd / max) * 100);
          const active = hover === i;
          return (
            <button
              key={d.date}
              type="button"
              title={`${formatDay(d.date)} · ${formatUsdPrecise(d.costUsd, 6)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <span
                className={`mb-1 text-[9px] font-medium tabular-nums transition ${
                  active ? "text-[var(--accent)] opacity-100" : "text-[var(--muted-soft)] opacity-0 group-hover:opacity-100"
                }`}
              >
                {formatUsd(d.costUsd)}
              </span>
              <span
                className={`w-full max-w-[36px] rounded-t-md transition ${
                  active
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--accent)]/35 group-hover:bg-[var(--accent)]/70"
                }`}
                style={{ height: `${pct}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5 px-0.5">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${
              hover === i ? "font-semibold text-[var(--accent)]" : "text-[var(--muted-soft)]"
            }`}
          >
            {formatDayShort(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModelBars({
  items,
}: {
  items: { label: string; tokens: number; costUsd: number }[];
}) {
  const maxCost = Math.max(...items.map((i) => i.costUsd), 1e-12);
  const totalCost = items.reduce((s, i) => s + i.costUsd, 0);
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-[var(--muted-soft)]">No usage by model</p>
    );
  }
  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const share = totalCost > 0 ? (item.costUsd / totalCost) * 100 : 0;
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[12px] font-medium text-[var(--foreground)]">
                {item.label}
              </span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--foreground)]">
                {formatUsdPrecise(item.costUsd, 6)}
              </span>
            </div>
            <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.max(1.5, (item.costUsd / maxCost) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between gap-2 text-[11px] tabular-nums text-[var(--muted)]">
              <span>{formatCount(item.tokens)} tokens</span>
              <span>{share.toLocaleString("es-ES", { maximumFractionDigits: 1 })}% of spend</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const ADMIN_KEYS_URL =
  "https://platform.openai.com/settings/organization/admin-keys";

export function UseView({
  linkedRef,
  embedded = false,
  hideSetup = false,
  refreshKey = 0,
  settingsHref,
  onOpenSettings,
}: UseViewProps) {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [report, setReport] = useState<OpenAIUsageReport | null>(null);
  const [days, setDays] = useState(7);
  const [modelFilter, setModelFilter] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/openai/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load connection");
      setStatus(data);
      if (!data.connected && !hideSetup) setShowSetup(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection error");
    } finally {
      setLoadingStatus(false);
    }
  }, [hideSetup]);

  const loadReport = useCallback(async () => {
    if (!status?.connected) return;
    setLoadingReport(true);
    setError("");
    try {
      const q = new URLSearchParams({ days: String(days) });
      const res = await fetch(`/api/openai/usage?${q}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "NOT_CONNECTED") {
          setStatus((s) => (s ? { ...s, connected: false } : s));
          if (!hideSetup) setShowSetup(true);
        }
        throw new Error(data.error || data.message || "Could not load usage");
      }
      setReport(data.report as OpenAIUsageReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading usage");
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }, [status?.connected, days, hideSetup]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    if (status?.connected) void loadReport();
  }, [status?.connected, loadReport]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/openai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the key");
      setApiKey("");
      setShowKey(false);
      setStatus({
        connected: true,
        connectedAt: data.connectedAt ?? new Date().toISOString(),
        keyHint: data.keyHint ?? null,
      });
      setShowSetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Use and delete the encrypted OpenAI Admin API key?")) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/openai/settings", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect");
      setStatus({ connected: false, connectedAt: null, keyHint: null });
      setReport(null);
      if (!hideSetup) setShowSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error disconnecting");
    } finally {
      setSaving(false);
    }
  }

  const modelOptions = useMemo(() => {
    if (!report) return [];
    return report.byModel.map((m) => m.model);
  }, [report]);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (!modelFilter.trim()) return report.rows;
    const q = modelFilter.trim().toLowerCase();
    return report.rows.filter((r) => (r.model ?? "").toLowerCase().includes(q));
  }, [report, modelFilter]);

  const filteredModels = useMemo(() => {
    if (!report) return [];
    if (!modelFilter.trim()) return report.byModel;
    const q = modelFilter.trim().toLowerCase();
    return report.byModel.filter((m) => m.model.toLowerCase().includes(q));
  }, [report, modelFilter]);

  const costPerRequest = useMemo(() => {
    if (!report) return null;
    const n = report.totals.requests;
    if (n <= 0) return null;
    return {
      count: n,
      totalCost: report.totals.costUsd,
      cost: divideCost(report.totals.costUsd, n),
    };
  }, [report]);

  const perMillion = useMemo(() => {
    if (!report) return null;
    return effectivePerMillionFromUsage({
      totalCostUsd: report.totals.costUsd,
      rows: report.rows,
      inputTokens: report.totals.inputTokens,
      outputTokens: report.totals.outputTokens,
    });
  }, [report]);

  const byDay = useMemo(() => {
    if (!report) return [];
    return report.byDay.map((day) => ({
      date: day.date,
      tokens: day.tokens,
      inputTokens: day.inputTokens,
      outputTokens: day.outputTokens,
      requests: day.requests,
      costUsd: day.costUsd,
      costPerRequest:
        day.requests > 0 ? divideCost(day.costUsd, day.requests) : null,
    }));
  }, [report]);

  if (loadingStatus) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--surface-alt)] text-[13px] text-[var(--muted)]">
        Loading Use…
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "flex h-full flex-col overflow-hidden bg-transparent"
          : "flex h-full flex-col overflow-hidden bg-[var(--surface-alt)]"
      }
    >
      {!embedded ? (
        <div className="shrink-0 border-b border-[var(--border)] bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
                AI Cost
              </h1>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                OpenAI spend · tokens and cost per request
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status?.connected ? (
                <>
                  <span className="ui-tag ui-tag-success">
                    Connected {status.keyHint ? `· ${status.keyHint}` : ""}
                  </span>
                  {linkedRef ? (
                    <span className="ui-tag ui-tag-accent">App · {linkedRef}</span>
                  ) : (
                    <span className="ui-tag ui-tag-muted">No Supabase linked</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSetup((v) => !v)}
                    className="ui-btn-secondary !py-1.5 !px-3 text-[12px]"
                  >
                    {showSetup ? "Hide settings" : "Settings"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void loadReport();
                    }}
                    disabled={loadingReport}
                    className="ui-btn-primary !py-1.5 !px-3 text-[12px] disabled:opacity-60"
                  >
                    {loadingReport ? "Refreshing…" : "Refresh"}
                  </button>
                </>
              ) : (
                <span className="ui-tag ui-tag-muted">No Admin API key</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--foreground)]">AI Cost</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              OpenAI spend · tokens and cost per request
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status?.connected ? (
              <>
                <span className="ui-tag ui-tag-success">
                  Connected {status.keyHint ? `· ${status.keyHint}` : ""}
                </span>
                {!hideSetup ? (
                  <button
                    type="button"
                    onClick={() => setShowSetup((v) => !v)}
                    className="ui-btn-secondary !py-1.5 !px-3 text-[12px]"
                  >
                    {showSetup ? "Hide settings" : "Settings"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void loadReport();
                  }}
                  disabled={loadingReport}
                  className="ui-btn-primary !py-1.5 !px-3 text-[12px] disabled:opacity-60"
                >
                  {loadingReport ? "Refreshing…" : "Refresh"}
                </button>
              </>
            ) : (
              <span className="ui-tag ui-tag-muted">No Admin API key</span>
            )}
          </div>
        </div>
      )}

      <div className={embedded ? "min-h-0 flex-1 overflow-y-auto" : "min-h-0 flex-1 overflow-y-auto p-5"}>
        {error ? (
          <div className="mb-4 rounded-lg border border-[#f8d7da] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[#c5221f]">
            {error}
          </div>
        ) : null}

        {hideSetup && !status?.connected && !loadingStatus ? (
          <div className="mb-5 rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-12 text-center">
            <p className="text-[14px] font-semibold text-[var(--foreground)]">
              Connect OpenAI
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted)]">
              Add your Admin API key in Settings → API.
            </p>
            {settingsHref || onOpenSettings ? (
              settingsHref ? (
                <a
                  href={settingsHref}
                  className="ui-btn-primary mt-4 inline-flex"
                >
                  Open API settings
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="ui-btn-primary mt-4"
                >
                  Open API settings
                </button>
              )
            ) : null}
          </div>
        ) : null}

        {!hideSetup && (showSetup || !status?.connected) ? (
          <section className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
            <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] p-5">
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
                Connect OpenAI Admin API key
              </h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--muted)]">
                Create an Admin API key (
                <code className="text-[var(--foreground-soft)]">sk-admin…</code>) and paste it here
                to read Usage and Costs for your organization.
              </p>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <div className="flex flex-col justify-center gap-3 border-b border-[var(--border)] p-5 lg:border-b-0 lg:border-r">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Create the key in OpenAI
                </p>
                <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                  Open it in a new tab, create the Admin key, and copy it. It’s only
                  shown once.
                </p>
                <a
                  href={ADMIN_KEYS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                >
                  Open Admin keys
                  <span aria-hidden>↗</span>
                </a>
                <a
                  href={ADMIN_KEYS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[11px] text-[var(--muted-soft)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
                >
                  {ADMIN_KEYS_URL}
                </a>
              </div>

              <div className="p-5">
                {status?.connected ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#e6f4ea] bg-[#f6fbf7] px-3 py-3 text-[13px]">
                      <p className="font-semibold text-[#137333]">You’re already connected</p>
                      <p className="mt-1 text-[12px] text-[var(--foreground-soft)]">
                        Key: {status.keyHint}
                        {status.connectedAt
                          ? ` · since ${new Date(status.connectedAt).toLocaleString("en")}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDisconnect()}
                      disabled={saving}
                      className="rounded-lg border border-[#f8d7da] px-3 py-2 text-[12px] font-medium text-[#c5221f] hover:bg-[var(--danger-soft)] disabled:opacity-60"
                    >
                      Disconnect and delete key
                    </button>
                  </div>
                ) : null}

                <form onSubmit={handleConnect} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-[var(--foreground-soft)]">
                      Admin API key
                    </span>
                    <div className="flex gap-2">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-admin…"
                        autoComplete="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="shrink-0 rounded-lg border border-[var(--border)] px-3 text-[12px] text-[var(--muted)] hover:bg-[var(--background)]"
                      >
                        {showKey ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                  <p className="text-[11px] text-[var(--muted-soft)]">
                    Validated against OpenAI and encrypted on the server.
                  </p>
                  <button
                    type="submit"
                    disabled={saving || !apiKey.trim()}
                    className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Validating and saving…" : "Connect securely"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {status?.connected ? (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                  Period
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDays(opt.value)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                        days === opt.value
                          ? "bg-[var(--accent)] text-white"
                          : "border border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:bg-[var(--background)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="min-w-[200px] flex-1">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                  Filter model
                </span>
                <input
                  list="openai-models"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder="All models"
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
                />
                <datalist id="openai-models">
                  {modelOptions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
            </div>

            {loadingReport && !report ? (
              <div className="rounded-xl border border-[var(--border)] bg-white py-16 text-center text-[13px] text-[var(--muted)]">
                Loading usage from OpenAI…
              </div>
            ) : report ? (
              <>
                <section className="mb-4 overflow-hidden rounded-xl bg-[var(--surface-alt)]">
                  <div className="border-b border-[var(--border)]/80 px-5 py-3">
                    <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
                      Period summary
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      Billed OpenAI costs (Costs API) + completions usage
                    </p>
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <div className="border-b border-[var(--border)] px-4 py-3.5 sm:border-r xl:border-b-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        $/1M input
                      </p>
                      {perMillion?.inputPerMillion != null ? (
                        <FloatingTip
                          content={
                            <>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aab7c4]">
                                $/1M input
                              </p>
                              <p className="mt-1.5 text-[12px] leading-relaxed text-white/90">
                                Spend attributed to input ÷ (input tokens /
                                1,000,000).
                              </p>
                              <div className="mt-2.5 space-y-1 rounded-lg bg-white/5 px-2.5 py-2 font-mono text-[11px] tabular-nums text-white">
                                <p>
                                  {formatUsdPrecise(perMillion.costInputUsd, 6)} ÷ (
                                  {formatCount(perMillion.inputTokens)} / 1M)
                                </p>
                                <p className="font-semibold text-[var(--accent)]">
                                  = {formatUsdPrecise(perMillion.inputPerMillion, 6)}
                                </p>
                              </div>
                            </>
                          }
                        >
                          <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-[var(--accent)] underline decoration-dotted decoration-[#c1c9d2] underline-offset-2">
                            {formatUsdPrecise(perMillion.inputPerMillion, 4)}
                          </p>
                        </FloatingTip>
                      ) : (
                        <p className="mt-1 text-[16px] font-semibold text-[#c1c9d2]">—</p>
                      )}
                    </div>
                    <div className="border-b border-[var(--border)] px-4 py-3.5 lg:border-r xl:border-b-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        $/1M output
                      </p>
                      {perMillion?.outputPerMillion != null ? (
                        <FloatingTip
                          content={
                            <>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aab7c4]">
                                $/1M output
                              </p>
                              <p className="mt-1.5 text-[12px] leading-relaxed text-white/90">
                                Spend attributed to output ÷ (output tokens /
                                1,000,000).
                              </p>
                              <div className="mt-2.5 space-y-1 rounded-lg bg-white/5 px-2.5 py-2 font-mono text-[11px] tabular-nums text-white">
                                <p>
                                  {formatUsdPrecise(perMillion.costOutputUsd, 6)} ÷ (
                                  {formatCount(perMillion.outputTokens)} / 1M)
                                </p>
                                <p className="font-semibold text-[var(--accent)]">
                                  = {formatUsdPrecise(perMillion.outputPerMillion, 6)}
                                </p>
                              </div>
                            </>
                          }
                        >
                          <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-[var(--foreground)] underline decoration-dotted decoration-[#c1c9d2] underline-offset-2">
                            {formatUsdPrecise(perMillion.outputPerMillion, 4)}
                          </p>
                        </FloatingTip>
                      ) : (
                        <p className="mt-1 text-[16px] font-semibold text-[#c1c9d2]">—</p>
                      )}
                    </div>
                    <div className="border-b border-[var(--border)] px-4 py-3.5 sm:border-r xl:border-b-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        Total spend
                      </p>
                      <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-[var(--accent)]">
                        {formatUsdPrecise(report.totals.costUsd, 4)}
                      </p>
                    </div>
                    <div className="border-b border-[var(--border)] px-4 py-3.5 lg:border-r xl:border-b-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        Per request
                      </p>
                      {costPerRequest?.cost != null ? (
                        <FloatingTip
                          content={
                            <>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aab7c4]">
                                How it’s calculated
                              </p>
                              <p className="mt-1.5 text-[12px] leading-relaxed text-white/90">
                                OpenAI spend for the period ÷ Completions requests
                                in the same period.
                              </p>
                              <div className="mt-2.5 space-y-1 rounded-lg bg-white/5 px-2.5 py-2 font-mono text-[11px] tabular-nums text-white">
                                <p>
                                  {formatUsdPrecise(costPerRequest.totalCost, 6)} ÷{" "}
                                  {formatCount(costPerRequest.count)}
                                </p>
                                <p className="font-semibold text-[var(--accent)]">
                                  = {formatUsdPrecise(costPerRequest.cost, 6)} /
                                  request
                                </p>
                              </div>
                            </>
                          }
                        >
                          <p className="mt-1 text-[16px] font-semibold tabular-nums text-[var(--foreground)] underline decoration-dotted decoration-[#c1c9d2] underline-offset-2">
                            {formatUsdPrecise(costPerRequest.cost, 4)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--muted-soft)]">
                            ÷ {formatCount(costPerRequest.count)}
                          </p>
                        </FloatingTip>
                      ) : (
                        <p className="mt-1 text-[16px] font-semibold text-[#c1c9d2]">—</p>
                      )}
                    </div>
                    <div className="border-b border-[var(--border)] px-4 py-3.5 sm:border-r xl:border-b-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        Tokens
                      </p>
                      <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                        {formatCount(report.totals.totalTokens)}
                      </p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[var(--muted-soft)]">
                        {formatCount(report.totals.inputTokens)} in ·{" "}
                        {formatCount(report.totals.outputTokens)} out
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        Requests
                      </p>
                      <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                        {formatCount(report.totals.requests)}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="mb-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(50,50,93,0.04)]">
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">
                      Spend by day
                    </h3>
                    <DayCostChart
                      days={report.byDay.map((d) => ({
                        date: d.date,
                        costUsd: d.costUsd,
                        tokens: d.tokens,
                        requests: d.requests,
                      }))}
                    />
                  </section>
                  <section className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(50,50,93,0.04)]">
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">
                      Spend by model
                    </h3>
                    <ModelBars
                      items={filteredModels.map((m) => ({
                        label: m.model,
                        tokens: m.tokens,
                        costUsd: m.costUsd,
                      }))}
                    />
                  </section>
                </div>

                <section className="mb-4 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(50,50,93,0.04)]">
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                      Day breakdown
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-[12px]">
                      <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Day</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Tokens</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Requests</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Spend</th>
                          <th className="px-4 py-2.5 font-semibold text-right">$/request</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...byDay].reverse().map((d) => (
                          <tr key={d.date} className="border-t border-[#eef1f5]">
                            <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                              {formatDay(d.date)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-soft)]">
                              {formatCount(d.tokens)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-soft)]">
                              {formatCount(d.requests)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--foreground)]">
                              {formatUsdPrecise(d.costUsd, 6)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--muted)]">
                              {d.costPerRequest != null ? (
                                <FloatingTip
                                  align="right"
                                  content={
                                    <>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aab7c4]">
                                        Day calculation
                                      </p>
                                      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-white">
                                        {formatUsdPrecise(d.costUsd, 6)} ÷{" "}
                                        {formatCount(d.requests)} ={" "}
                                        {formatUsdPrecise(d.costPerRequest, 6)}
                                      </p>
                                    </>
                                  }
                                >
                                  <span className="underline decoration-dotted decoration-[#c1c9d2] underline-offset-2">
                                    {formatUsdPrecise(d.costPerRequest, 6)}
                                  </span>
                                </FloatingTip>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(50,50,93,0.04)]">
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                      Usage rows (model × day)
                    </h3>
                    <p className="text-[11px] text-[var(--muted-soft)]">
                      {filteredRows.length} rows
                      {modelFilter ? ` · filter “${modelFilter}”` : ""}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-[12px]">
                      <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Day</th>
                          <th className="px-4 py-2.5 font-semibold">Model</th>
                          <th className="px-4 py-2.5 font-semibold text-right">In</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Out</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Requests</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredRows].reverse().map((row, i) => (
                          <tr
                            key={`${row.date}-${row.model}-${i}`}
                            className="border-t border-[#eef1f5]"
                          >
                            <td className="px-4 py-2.5 text-[var(--foreground-soft)]">
                              {formatDay(row.date)}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                              {row.model ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-soft)]">
                              {formatCount(row.inputTokens)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-soft)]">
                              {formatCount(row.outputTokens)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-soft)]">
                              {formatCount(row.requests)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--foreground)]">
                              {formatUsdPrecise(row.costUsd, 6)}
                              {row.estimated ? (
                                <span className="ml-1 text-[10px] font-normal text-[var(--muted-soft)]">
                                  est.
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-white py-16 text-center text-[13px] text-[var(--muted)]">
                No data yet. Hit Refresh or check your settings.
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
