"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  engagementRate,
  formatCompact,
  timeAgo,
} from "@/lib/viewtracker/format";
import type { TrackedVideo } from "./VideosPage";
import { influencerCoverUrl, type EstudioInfluencer } from "@/lib/creator/estudio-v1";
import {
  EmptyTable,
  Modal,
  PageHead,
  PlatformLogo,
  SparkBars,
  StatusOk,
  Toolbar,
  VT_PLATFORMS,
} from "./vt-ui";

type CreatorOption = { id: string; name: string; photo?: string | null; ai?: boolean };

type LinkedAccount = {
  key: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  label: string;
  status: string;
};

type AccountEntry = {
  id: string;
  tracked: TrackedAccount | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  platform: string | null;
  access: "full" | "tracking";
};

function identityKey(platform: string | null, username: string | null) {
  const handle = (username || "").replace(/^@/, "").trim().toLowerCase();
  const net = (platform || "").trim().toLowerCase();
  if (!handle || !net) return "";
  return `${net}:${handle}`;
}

function AccessMark({ access }: { access: "full" | "tracking" }) {
  const full = access === "full";
  return (
    <span
      title={full ? "Acceso completo" : "Solo tracking"}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        full ? "bg-[var(--foreground)] text-white" : "bg-[var(--surface-alt)] text-[var(--muted)]"
      }`}
    >
      {full ? <KeyIcon /> : <EyeIcon />}
    </span>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
      <circle cx="8" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M11 14h9l-1.6-1.8M17.2 14v2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
      <path
        d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export type TrackedAccount = {
  id: string;
  url: string;
  platform: string | null;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  creatorName: string | null;
  followers: number;
  lastRefreshedAt: string | null;
  createdAt: string;
};

function weekdayBars(dates: string[]) {
  const buckets = Array.from({ length: 9 }, () => 0);
  const now = Date.now();
  for (const raw of dates) {
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    const ago = Math.floor((now - t) / 86_400_000);
    if (ago >= 0 && ago < 9) buckets[8 - ago] += 1;
  }
  return buckets;
}

function handleOf(video: TrackedVideo) {
  return (video.author || "").replace(/^@/, "").trim().toLowerCase();
}

export function relatedVideos(account: TrackedAccount, videos: TrackedVideo[]) {
  const user = (account.username || "").toLowerCase();
  return videos.filter((v) => {
    if (v.accountId && v.accountId === account.id) return true;
    if (account.platform && v.platform !== account.platform) return false;
    return handleOf(v) === user;
  });
}

function accountTotals(account: TrackedAccount, videos: TrackedVideo[]) {
  const related = relatedVideos(account, videos);
  const views = related.reduce((s, v) => s + v.views, 0);
  const likes = related.reduce((s, v) => s + v.likes, 0);
  const comments = related.reduce((s, v) => s + v.comments, 0);
  const shares = related.reduce((s, v) => s + v.shares, 0);
  const saves = related.reduce((s, v) => s + v.saves, 0);
  return {
    related,
    views,
    likes,
    comments,
    shares,
    saves,
    eng: engagementRate({ views, likes, comments, shares, saves }),
    avg: related.length ? Math.round(views / related.length) : 0,
  };
}

type MetricKey = "views" | "likes" | "comments" | "shares";

const METRICS: { id: MetricKey; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "shares", label: "Shares" },
];

function dailySeries(videos: TrackedVideo[], key: MetricKey) {
  const map = new Map<string, number>();
  for (const video of videos) {
    const raw = video.postedAt || video.createdAt;
    const time = new Date(raw).getTime();
    if (Number.isNaN(time)) continue;
    const day = new Date(time).toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + video[key]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }));
}

function AreaChart({ points }: { points: { day: string; value: number }[] }) {
  const width = 640;
  const height = 220;
  const pad = { l: 8, r: 8, t: 18, b: 28 };
  if (points.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-[13px] text-[var(--muted-soft)]">
        Sin datos para graficar.
      </p>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const coords = points.map((p, i) => {
    const x =
      pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (p.value / max) * innerH;
    return { x, y, ...p };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L${last.x} ${pad.t + innerH} L${coords[0].x} ${pad.t + innerH} Z`;
  const ticks = [coords[0], coords[Math.floor((coords.length - 1) / 2)], last].filter(
    (tick, index, list) => list.findIndex((item) => item.day === tick.day) === index
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
      <defs>
        <linearGradient id="vt-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b85ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b85ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#vt-area)" />
      <path d={line} fill="none" stroke="#6d66f5" strokeWidth="2.5" strokeLinejoin="round" />
      {coords.map((c) => (
        <circle key={c.day} cx={c.x} cy={c.y} r="3.5" fill="#fff" stroke="#6d66f5" strokeWidth="2" />
      ))}
      {ticks.map((tick) => (
        <text
          key={tick.day}
          x={tick.x}
          y={height - 8}
          textAnchor="middle"
          className="fill-[var(--muted-soft)]"
          fontSize="11"
        >
          {new Date(`${tick.day}T00:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      ))}
    </svg>
  );
}

export function AccountsPage({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TrackedAccount[]>([]);
  const [linked, setLinked] = useState<LinkedAccount[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [layout, setLayout] = useState<"cards" | "table">("cards");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>("views");
  const [ok, setOk] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("add") === "1") setFormOpen(true);
  }, [searchParams]);

  function closeModal() {
    setFormOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("add")) {
      params.delete("add");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  async function load() {
    const fresh = { cache: "no-store" as const };
    const [a, v, c, redes, inf] = await Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/accounts`, fresh).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/videos`, fresh).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/creators`, fresh).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/redes/all-accounts`, fresh)
        .then((r) => (r.ok ? r.json() : { accounts: [] }))
        .catch(() => ({ accounts: [] })),
      fetch(`/api/projects/${projectId}/creator/influencers`, fresh)
        .then((r) => (r.ok ? r.json() : { influencers: [] }))
        .catch(() => ({ influencers: [] })),
    ]);
    if (a.error) throw new Error(a.error);
    setItems((a.items ?? []) as TrackedAccount[]);
    setVideos((v.items ?? []) as TrackedVideo[]);
    const real = ((c.items ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, name: item.name }));
    const taken = new Set(real.map((item) => item.name.trim().toLowerCase()));
    const ai = ((inf.influencers ?? []) as EstudioInfluencer[])
      .filter((item) => item.name && !taken.has(item.name.trim().toLowerCase()))
      .map((item) => ({ id: `ai-${item.id}`, name: item.name, photo: influencerCoverUrl(item), ai: true }));
    setCreators([...ai, ...real]);
    setLinked((redes.accounts ?? []) as LinkedAccount[]);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (platform && a.platform !== platform) return false;
      if (!q) return true;
      return (
        (a.username || "").toLowerCase().includes(q) ||
        (a.displayName || "").toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q)
      );
    });
  }, [items, search, platform]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    const raw = url.trim();
    if (!raw) {
      setError("Pega el link del perfil (TikTok, Instagram, YouTube, X…).");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo añadir");
      const created = (data.items ?? []) as TrackedAccount[];
      setItems((prev) => [
        ...created,
        ...prev.filter((a) => !created.some((c) => c.id === a.id)),
      ]);
      setUrl("");
      closeModal();
      const n = Number(data.videosIngested || 0);
      setOk(
        n > 0
          ? `Cuenta añadida. ${n} video${n === 1 ? "" : "s"} trackeados.`
          : "Cuenta añadida. No encontramos videos públicos en el perfil."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setAdding(false);
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    setError("");
    const targets = items;
    const failed: string[] = [];
    try {
      for (const account of targets) {
        const mark = new Date().toISOString();
        setItems((prev) =>
          prev.map((row) => (row.id === account.id ? { ...row, lastRefreshedAt: mark } : row))
        );
        const res = await fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
          method: "PATCH",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: account.id, refresh: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed.push(account.username || account.displayName || "cuenta");
          continue;
        }
        if (data.item) {
          setItems((prev) => prev.map((row) => (row.id === account.id ? data.item : row)));
        }
      }
      await load();
      if (failed.length > 0) {
        setError(`No se pudo refrescar: ${failed.join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo refrescar");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshOne(account: TrackedAccount) {
    setRefreshingId(account.id);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, refresh: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo refrescar");
      if (data.item) setItems((prev) => prev.map((row) => (row.id === account.id ? data.item : row)));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo refrescar");
    } finally {
      setRefreshingId(null);
    }
  }

  async function assignCreator(account: TrackedAccount, name: string) {
    const res = await fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, creatorName: name || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.item) {
      setItems((prev) => prev.map((a) => (a.id === account.id ? data.item : a)));
    }
  }

  async function createCreator(name: string) {
    const res = await fetch(`/api/projects/${projectId}/viewtracker/creators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.item) return false;
    setCreators((prev) => [...prev, { id: data.item.id as string, name: data.item.name as string }]);
    return true;
  }

  async function remove(account: TrackedAccount) {
    setItems((prev) => prev.filter((a) => a.id !== account.id));
    setMenuId(null);
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/accounts?id=${encodeURIComponent(account.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) setItems((prev) => [account, ...prev]);
  }

  const entries = useMemo(() => {
    const fullKeys = new Set(
      linked
        .filter((account) => !account.status || account.status === "active")
        .map((account) => identityKey(account.platform, account.username))
        .filter(Boolean)
    );
    const seen = new Set<string>();
    const list: AccountEntry[] = items.map((account) => {
      const key = identityKey(account.platform, account.username);
      if (key) seen.add(key);
      return {
        id: account.id,
        tracked: account,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        platform: account.platform,
        access: key && fullKeys.has(key) ? "full" : "tracking",
      };
    });
    for (const account of linked) {
      if (account.status && account.status !== "active") continue;
      const key = identityKey(account.platform, account.username);
      if (key && seen.has(key)) {
        if (account.avatarUrl) {
          const existing = list.find((entry) => identityKey(entry.platform, entry.username) === key);
          if (existing && !existing.avatarUrl) existing.avatarUrl = account.avatarUrl;
        }
        continue;
      }
      if (key) seen.add(key);
      list.push({
        id: account.key,
        tracked: null,
        username: account.username,
        displayName: account.displayName || account.label,
        avatarUrl: account.avatarUrl,
        platform: account.platform,
        access: "full",
      });
    }
    return list;
  }, [items, linked]);

  const networkGroups = useMemo(() => {
    const known = new Set<string>(VT_PLATFORMS.map((p) => p.id));
    const groups: { id: string; label: string; list: AccountEntry[] }[] = VT_PLATFORMS.map((p) => ({
      id: p.id,
      label: p.label,
      list: entries.filter((entry) => entry.platform === p.id),
    }));
    const others = entries.filter((entry) => !known.has(entry.platform || ""));
    if (others.length) groups.push({ id: "web", label: "Otras", list: others });
    return groups;
  }, [entries]);

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const selected = selectedEntry?.tracked ?? null;
  const selectedStats = selected ? accountTotals(selected, videos) : null;
  const chartPoints = selectedStats ? dailySeries(selectedStats.related, metric) : [];
  const accessById = useMemo(() => {
    const map = new Map<string, "full" | "tracking">();
    for (const entry of entries) {
      if (entry.tracked) map.set(entry.tracked.id, entry.access);
    }
    return map;
  }, [entries]);

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
    {selected && selectedStats ? (
      <AccountCharts
        account={selected}
        stats={selectedStats}
        metric={metric}
        onMetric={setMetric}
        points={chartPoints}
        access={selectedEntry?.access ?? "tracking"}
      />
    ) : selectedEntry ? (
      <ConnectedOnly entry={selectedEntry} />
    ) : (
    <div className="space-y-4">
      <PageHead
        title="Accounts"
        subtitle="View and analyze performance metrics across your tracked accounts."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-soft)] disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh all"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              + Add account
            </button>
          </div>
        }
      />

      {formOpen ? (
        <Modal
          title="Add account"
          subtitle="Pega el link del perfil. Trackeamos la cuenta y todos los videos públicos que encontremos."
          onClose={closeModal}
        >
          <form onSubmit={handleAdd} className="space-y-3">
            <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
              Profile URL
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                placeholder="https://www.tiktok.com/@usuario"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
              />
            </label>
            <p className="text-[12px] text-[var(--muted-soft)]">
              TikTok, Instagram, YouTube o X. Overview, Videos y Creators se llenan con esos posts.
            </p>
            {error && formOpen ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={adding}
                className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {adding ? "Trackeando videos…" : "Track account"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-soft)]"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {ok ? (
        <p className="rounded-xl border border-[#bbf7d0] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </p>
      ) : null}

      {error && !formOpen ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search accounts"
        platform={platform}
        onPlatform={setPlatform}
        extra={
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] text-[var(--muted)]">
              Todo el historial
            </span>
            <div className="flex rounded-xl border border-[var(--border)] bg-white p-1" role="tablist" aria-label="Vista">
              {(
                [
                  { id: "cards", label: "Tarjetas" },
                  { id: "table", label: "Tabla" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={layout === option.id}
                  onClick={() => setLayout(option.id)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                    layout === option.id ? "ui-btn-primary text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {loading ? (
        <EmptyTable message="Cargando cuentas…" />
      ) : filtered.length === 0 ? (
        <EmptyTable
          message={
            items.length === 0
              ? "Pega el link de un perfil para trackear la cuenta."
              : "No accounts match your filters."
          }
        />
      ) : layout === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {[...filtered]
            .map((account) => ({ account, stats: accountTotals(account, videos) }))
            .sort((a, b) => b.stats.views - a.stats.views)
            .map(({ account, stats }, index, list) => (
              <AccountCard
                key={account.id}
                account={account}
                stats={stats}
                rank={index + 1}
                totalViews={list.reduce((sum, row) => sum + row.stats.views, 0)}
                access={accessById.get(account.id) ?? "tracking"}
                creators={creators}
                menuOpen={menuId === account.id}
                refreshing={refreshing || refreshingId === account.id}
                onMenu={() => setMenuId((id) => (id === account.id ? null : account.id))}
                onRemove={() => void remove(account)}
                onRefresh={() => void refreshOne(account)}
                onCreator={(name) => void assignCreator(account, name)}
                onCreateCreator={createCreator}
                onOpen={() => setSelectedId(account.id)}
              />
            ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="border-b border-[var(--border)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              <tr>
                <th className="min-w-[210px] px-3 py-2.5 font-medium">Username</th>
                <th className="w-[150px] px-3 py-2.5 font-medium">Creator</th>
                <th className="px-3 py-2.5 font-medium">Post activity</th>
                <th className="px-3 py-2.5 font-medium">Videos</th>
                <th className="px-3 py-2.5 font-medium">Followers</th>
                <th className="px-3 py-2.5 font-medium">Views</th>
                <th className="px-3 py-2.5 font-medium">Likes</th>
                <th className="px-3 py-2.5 font-medium">Comments</th>
                <th className="px-3 py-2.5 font-medium">Shares</th>
                <th className="px-3 py-2.5 font-medium">Saves</th>
                <th className="px-3 py-2.5 font-medium">Eng.</th>
                <th className="px-3 py-2.5 font-medium">Avg views</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    Last refresh
                    <button
                      type="button"
                      onClick={() => void refreshAll()}
                      disabled={refreshing}
                      aria-label="Refrescar todas las cuentas"
                      title="Refrescar todas"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--foreground)] transition hover:bg-[var(--surface-alt)] disabled:opacity-50"
                    >
                      <RefreshArrows className={refreshing ? "animate-spin" : ""} />
                    </button>
                  </span>
                </th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const { related, views, likes, comments, shares, saves, eng, avg } =
                  accountTotals(account, videos);
                return (
                  <tr key={account.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <a
                        href={account.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5"
                      >
                        <AvatarHover
                          src={account.avatarUrl}
                          label={account.username || account.displayName || "?"}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[var(--foreground)]">
                            @{account.username || "account"}
                            <AccessMark access={accessById.get(account.id) ?? "tracking"} />
                          </span>
                          <span className="block text-[12px] text-[var(--muted-soft)]">
                            {account.displayName || account.platform || "—"}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="w-[150px] px-3 py-2.5">
                      <CreatorSelect
                        compact
                        value={account.creatorName || ""}
                        creators={creators}
                        onChange={(name) => void assignCreator(account, name)}
                        onCreate={createCreator}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <SparkBars
                        values={weekdayBars(
                          related.map((v) => v.postedAt || v.createdAt)
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{related.length}</td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {formatCompact(account.followers)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(views)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(likes)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(comments)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(shares)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(saves)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{eng.toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(avg)}</td>
                    <td className="px-3 py-2.5">
                      <StatusOk />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {timeAgo(account.lastRefreshedAt || account.createdAt)}
                    </td>
                    <td className="relative px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuId((id) => (id === account.id ? null : account.id))
                        }
                        className="px-1 text-[var(--muted-soft)]"
                      >
                        ⋯
                      </button>
                      {menuId === account.id ? (
                        <div className="absolute right-3 z-10 mt-1 w-32 rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => void remove(account)}
                            className="block w-full px-3 py-1.5 text-left text-[13px] text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    )}
    </div>
    <NetworkAccountsAside
      overviewActive={!selected}
      overviewSubtitle={entries.length === 1 ? "1 cuenta" : `${entries.length} cuentas`}
      onOverview={() => setSelectedId(null)}
      groups={networkGroups.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.list.map((entry) => ({
          id: entry.id,
          handle: (entry.username || entry.displayName || "account").replace(/^@/, ""),
          avatarUrl: entry.avatarUrl,
          active: entry.id === selectedId,
          trailing: <AccessMark access={entry.access} />,
        })),
      }))}
      onSelect={setSelectedId}
    />
    </div>
  );
}

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  snapchat: "Snapchat",
};

function dailyCounts(videos: TrackedVideo[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, () => 0);
  for (const video of videos) {
    const date = new Date(video.postedAt || video.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    const index = days - 1 - Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (index >= 0 && index < days) buckets[index] += 1;
  }
  return buckets;
}

function CreatorSelect({
  value,
  creators,
  onChange,
  onCreate,
  compact = false,
}: {
  value: string;
  creators: CreatorOption[];
  onChange: (name: string) => void;
  onCreate: (name: string) => Promise<boolean>;
  compact?: boolean;
}) {
  const assigned = Boolean(value);
  const assignedPhoto = assigned ? creators.find((creator) => creator.name === value)?.photo : null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState("");

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 240;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom;
    setBox(below > 300 ? { left, top: rect.bottom + 6 } : { left, bottom: window.innerHeight - rect.top + 6 });
    setDraft("");
    setFailed("");
  }

  useEffect(() => {
    if (!box) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setBox(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setBox(null);
    }
    function onScroll(event: Event) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setBox(null);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [box]);

  function pick(name: string) {
    onChange(name);
    setBox(null);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || saving) return;
    const existing = creators.find((creator) => creator.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      pick(existing.name);
      return;
    }
    setSaving(true);
    setFailed("");
    const created = await onCreate(name);
    setSaving(false);
    if (created) pick(name);
    else setFailed("No se pudo crear el creator");
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (box ? setBox(null) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={Boolean(box)}
        aria-label={assigned ? `Creator: ${value}` : "Asignar creator"}
        className={`relative inline-flex min-w-0 shrink-0 items-center rounded-full border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 ${
          compact ? "h-7 max-w-[120px] gap-1 pl-0.5 pr-6 text-[11px]" : "h-8 max-w-[180px] gap-1.5 pl-1 pr-7 text-[12px]"
        } ${
          assigned
            ? "border-transparent bg-[#111113]/[0.06] text-[var(--foreground)] hover:bg-[#111113]/[0.09]"
            : "border-dashed border-black/15 bg-white text-[var(--muted)] hover:border-black/30 hover:text-[var(--foreground)]"
        } ${box ? "ring-2 ring-black/10" : ""}`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${compact ? "h-5 w-5" : "h-6 w-6"} ${
            assigned ? "bg-[#111113] text-white" : "bg-black/[0.05] text-[var(--muted)]"
          }`}
          aria-hidden
        >
          {assignedPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assignedPhoto} alt="" className="h-full w-full rounded-full object-cover" />
          ) : assigned ? (
            (value.trim()[0] || "?").toUpperCase()
          ) : (
            "+"
          )}
        </span>
        <span className="truncate">{assigned ? value : compact ? "Asignar" : "Asignar creator"}</span>
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute h-3.5 w-3.5 text-[var(--muted)] transition-transform ${compact ? "right-2" : "right-2.5"} ${box ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden
        >
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {box
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ left: box.left, top: box.top, bottom: box.bottom }}
              className="fixed z-[80] w-[240px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-[0_18px_48px_rgba(17,24,39,0.18)]"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-[var(--muted-soft)]">Creator de la cuenta</p>
              <div className="max-h-52 overflow-y-auto">
                {creators.map((creator) => {
                  const active = creator.name === value;
                  return (
                    <button
                      key={creator.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => pick(creator.name)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${
                        active ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-soft)]"
                      }`}
                    >
                      {creator.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={creator.photo} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111113] text-[10px] font-bold text-white">
                          {(creator.name.trim()[0] || "?").toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{creator.name}</span>
                      {creator.ai ? (
                        <span className="ai-rainbow-btn shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">AI</span>
                      ) : null}
                      {active ? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
                          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
                {creators.length === 0 ? (
                  <p className="px-2.5 py-2 text-[12px] text-[var(--muted)]">Aún no hay creators. Crea el primero aquí abajo.</p>
                ) : null}
                {assigned ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => pick("")}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-red-600 transition hover:bg-red-50"
                  >
                    Quitar creator
                  </button>
                ) : null}
              </div>
              <form onSubmit={create} className="mt-1 border-t border-[var(--border)] p-1.5 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Nuevo creator"
                    aria-label="Nombre del nuevo creator"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-2.5 text-[13px] outline-none focus:border-black/30"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || saving}
                    className="ui-btn-primary h-8 shrink-0 rounded-lg px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "…" : "Crear"}
                  </button>
                </div>
                {failed ? <p className="mt-1.5 text-[11px] text-red-600">{failed}</p> : null}
              </form>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function CardStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-black/[0.04]" title={hint}>
      <p className="truncate text-[11px] text-[var(--muted-soft)]">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold leading-tight tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function AccountCard({
  account,
  stats,
  rank,
  totalViews,
  access,
  creators,
  menuOpen,
  refreshing,
  onMenu,
  onRemove,
  onRefresh,
  onCreator,
  onCreateCreator,
  onOpen,
}: {
  account: TrackedAccount;
  stats: ReturnType<typeof accountTotals>;
  rank: number;
  totalViews: number;
  access: "full" | "tracking";
  creators: CreatorOption[];
  menuOpen: boolean;
  refreshing: boolean;
  onMenu: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  onCreator: (name: string) => void;
  onCreateCreator: (name: string) => Promise<boolean>;
  onOpen: () => void;
}) {
  const handle = (account.username || "account").replace(/^@/, "");
  const recent = [...stats.related]
    .sort((a, b) => new Date(b.postedAt || b.createdAt).getTime() - new Date(a.postedAt || a.createdAt).getTime())
    .filter((video) => video.thumbnailUrl)
    .slice(0, 4);
  const activity = dailyCounts(stats.related);
  const activityMax = Math.max(1, ...activity);
  const posted14 = activity.reduce((sum, value) => sum + value, 0);
  const share = totalViews > 0 ? (stats.views / totalViews) * 100 : 0;
  const metal = rank === 1 ? "vt-metal-gold" : rank === 2 ? "vt-metal-silver" : rank === 3 ? "vt-metal-bronze" : "";
  const interactions = [
    { label: "Likes", value: stats.likes, path: "M12 19s-6.5-3.9-6.5-8.3C5.5 8 7.2 6.3 9.4 6.3c1.3 0 2.2.6 2.6 1.6.4-1 1.3-1.6 2.6-1.6 2.2 0 3.9 1.7 3.9 4.4C18.5 15.1 12 19 12 19Z" },
    { label: "Comentarios", value: stats.comments, path: "M6 17.5 4.5 20V7.5A2 2 0 0 1 6.5 5.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6Z" },
    { label: "Compartidos", value: stats.shares, path: "M14 6.5 19 11l-5 4.5M19 11h-8.5A5 5 0 0 0 5.5 16v1.5" },
    { label: "Guardados", value: stats.saves, path: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" },
  ];

  return (
    <article className="vt-liquid-glass group relative flex flex-col overflow-hidden rounded-[24px] backdrop-blur-2xl transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-[#e9ebf2] to-[#f6f7fb]">
        {recent.length > 0 ? (
          <div className="grid h-full grid-cols-4">
            {recent.map((video) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={video.id}
                src={video.thumbnailUrl || ""}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ))}
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-white/80" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5">
          {metal ? (
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${metal}`}>{rank}</span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-[11px] font-bold text-[var(--muted)]">{rank}</span>
          )}
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {PLATFORM_NAMES[account.platform || ""] || account.platform || "Web"}
          </span>
        </span>
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Opciones de la cuenta"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-[var(--foreground)] shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <circle cx="6" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="18" cy="12" r="1.6" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[0_12px_32px_rgba(17,24,39,0.16)]">
              <a href={account.url} target="_blank" rel="noreferrer" className="block px-3 py-1.5 text-[13px] text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                Abrir perfil
              </a>
              <button type="button" onClick={onRemove} className="block w-full px-3 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50">
                Quitar cuenta
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative -mt-8 flex items-end gap-3 px-5">
        <AvatarHover
          src={account.avatarUrl}
          label={handle}
          className="h-16 w-16 shrink-0 rounded-full object-cover text-[18px] ring-4 ring-white shadow-[0_6px_16px_rgba(17,24,39,0.18)]"
        />
        <div className="min-w-0 pb-1">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--foreground)]">
            <span className="truncate">@{handle}</span>
            <AccessMark access={access} />
          </p>
          <p className="truncate text-[12px] text-[var(--muted-soft)]">{account.displayName || handle}</p>
        </div>
      </div>

      <div className="relative px-5 pt-5">
        <p className="text-[12px] font-medium text-[var(--muted)]">Views totales</p>
        <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
          {formatCompact(stats.views)}
        </p>
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#3a3a40] to-[#111113] transition-[width] duration-700"
            style={{ width: `${stats.views > 0 ? Math.max(2, share) : 0}%` }}
          />
        </span>
        <p className="mt-1.5 text-[11px] text-[var(--muted-soft)]">
          <span className="font-semibold tabular-nums text-[var(--foreground-soft)]">
            {share >= 10 ? share.toFixed(0) : share.toFixed(1)}%
          </span>{" "}
          de las views de todas las cuentas
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <CardStat label="Videos" value={String(stats.related.length)} hint="Videos trackeados de esta cuenta" />
          <CardStat label="Seguidores" value={formatCompact(account.followers)} hint="Seguidores actuales del perfil" />
          <CardStat label="Views por video" value={formatCompact(stats.avg)} hint="Views totales ÷ videos" />
          <CardStat label="Engagement" value={`${stats.eng.toFixed(1)}%`} hint="(Likes + comentarios + shares + guardados) ÷ views" />
        </div>

        <p className="mt-5 text-[12px] font-medium text-[var(--muted)]">Interacciones</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {interactions.map((item) => (
            <li key={item.label} className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[var(--muted)]" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                  <path d={item.path} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] font-semibold tabular-nums text-[var(--foreground)]">{formatCompact(item.value)}</span>
                <span className="block truncate text-[11px] text-[var(--muted-soft)]">{item.label}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--muted)]">Posts por día</span>
            <span className="text-[12px] font-semibold tabular-nums text-[var(--foreground)]">
              {posted14} {posted14 === 1 ? "post" : "posts"}
            </span>
          </div>
          <div className="flex h-10 items-end gap-[3px]">
            {activity.map((value, index) => (
              <span
                key={index}
                className="flex-1 rounded-[3px]"
                title={`${value} ${value === 1 ? "post" : "posts"}`}
                style={{
                  height: `${value > 0 ? Math.max(18, (value / activityMax) * 100) : 10}%`,
                  background: value > 0 ? "linear-gradient(180deg, #6366f1, #a5b4fc)" : "rgba(17,24,39,0.07)",
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--muted-soft)]">
            <span>hace 14 días</span>
            <span>hoy</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.05] px-5 py-3">
        <div className="flex min-w-0 flex-1 basis-[150px]">
          <CreatorSelect value={account.creatorName || ""} creators={creators} onChange={onCreator} onCreate={onCreateCreator} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refrescar esta cuenta"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] text-[var(--muted)] transition hover:bg-black/[0.04] hover:text-[var(--foreground)] disabled:opacity-60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
          {refreshing ? "Refrescando…" : timeAgo(account.lastRefreshedAt || account.createdAt)}
          <RefreshArrows className={refreshing ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="ui-btn-primary flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-white"
        >
          Detalle
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        </div>
      </div>
    </article>
  );
}

function avatarInitial(label: string) {
  const clean = label.replace(/^@/, "").trim();
  return (clean[0] || "?").toUpperCase();
}

function stableAvatar(src: string | null | undefined) {
  if (!src || src.includes("unavatar.io")) return null;
  return src;
}

export function AvatarHover({
  src,
  label = "",
  preview = true,
  className = "h-9 w-9 rounded-full bg-[var(--surface-alt)] object-cover",
}: {
  src: string | null;
  label?: string;
  preview?: boolean;
  className?: string;
}) {
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const photo = failed ? null : stableAvatar(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span
      className="relative shrink-0"
      onMouseEnter={(event) => {
        if (!preview || !photo) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const size = 320;
        const gap = 12;
        let left = rect.right + gap;
        if (left + size > window.innerWidth - 8) left = rect.left - size - gap;
        let top = rect.top + rect.height / 2 - size / 2;
        top = Math.max(8, Math.min(top, window.innerHeight - size - 8));
        setBox({ left, top });
      }}
      onMouseLeave={() => setBox(null)}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          referrerPolicy="no-referrer"
          className={className}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`inline-flex items-center justify-center bg-[var(--surface-alt)] font-semibold text-[var(--muted)] ${className}`}
        >
          {avatarInitial(label)}
        </span>
      )}
      {preview && box && photo ? (
        <span
          className="pointer-events-none fixed z-50"
          style={{ left: box.left, top: box.top, width: 320, height: 320 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-2xl bg-white object-cover shadow-[0_16px_40px_rgba(17,24,39,0.22)] ring-1 ring-black/10"
          />
        </span>
      ) : null}
    </span>
  );
}

function RefreshArrows({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className ?? ""}`} fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 0 1-13.7 5.6L4 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20v-4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12a8 8 0 0 1 13.7-5.6L20 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverviewMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 16.5 9 11l3.5 3.5L20 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.5 7H20v5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ConnectedOnly({ entry }: { entry: AccountEntry }) {
  const handle = (entry.username || entry.displayName || "account").replace(/^@/, "");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AvatarHover
          src={entry.avatarUrl}
          label={handle}
          className="h-12 w-12 rounded-full object-cover"
        />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            @{handle}
            <AccessMark access="full" />
          </h1>
          <p className="text-[13px] text-[var(--muted)]">
            {entry.displayName || entry.platform || "Cuenta"} · acceso completo
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-8 text-[13px] text-[var(--muted)]">
        Esta cuenta está conectada en Redes. Todavía no tiene tracking, así que no hay gráficas.
      </div>
    </div>
  );
}

function AccountCharts({
  account,
  stats,
  metric,
  onMetric,
  points,
  access,
}: {
  account: TrackedAccount;
  stats: ReturnType<typeof accountTotals>;
  metric: MetricKey;
  onMetric: (metric: MetricKey) => void;
  points: { day: string; value: number }[];
  access: "full" | "tracking";
}) {
  const tiles = [
    { label: "Followers", value: formatCompact(account.followers) },
    { label: "Views", value: formatCompact(stats.views) },
    { label: "Likes", value: formatCompact(stats.likes) },
    { label: "Comments", value: formatCompact(stats.comments) },
    { label: "Eng.", value: `${stats.eng.toFixed(1)}%` },
    { label: "Videos", value: String(stats.related.length) },
  ];
  const top = [...stats.related].sort((a, b) => b.views - a.views).slice(0, 6);
  const topMax = Math.max(1, ...top.map((video) => video.views));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AvatarHover
          src={account.avatarUrl}
          label={account.username || account.displayName || "?"}
          className="h-12 w-12 rounded-full object-cover"
        />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            @{account.username || "account"}
            <AccessMark access={access} />
          </h1>
          <p className="text-[13px] text-[var(--muted)]">
            {account.displayName || account.platform || "Cuenta"} · {stats.related.length} videos
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              {tile.label}
            </p>
            <p className="mt-1 text-[20px] font-semibold text-[var(--foreground)]">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">Actividad</p>
          <div className="flex rounded-full bg-[var(--surface-alt)] p-1">
            {METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onMetric(item.id)}
                className={`rounded-full px-3 py-1 text-[12px] ${
                  metric === item.id
                    ? "bg-white font-semibold text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart points={points} />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="text-[14px] font-semibold text-[var(--foreground)]">Videos con más views</p>
        {top.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--muted-soft)]">Esta cuenta todavía no tiene videos.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {top.map((video) => (
              <li key={video.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                  <span className="min-w-0 truncate text-[var(--foreground-soft)]">
                    {video.title || video.url}
                  </span>
                  <span className="shrink-0 font-semibold text-[var(--foreground)]">
                    {formatCompact(video.views)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div
                    className="h-full rounded-full bg-[#6d66f5]"
                    style={{ width: `${Math.max(4, (video.views / topMax) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type NetworkAsideItem = {
  id: string;
  handle: string;
  avatarUrl: string | null;
  active: boolean;
  trailing?: ReactNode;
};

export function NetworkAccountsAside({
  overviewLabel = "Vista general",
  overviewSubtitle,
  overviewActive,
  onOverview,
  groups,
  onSelect,
}: {
  overviewLabel?: string;
  overviewSubtitle: string;
  overviewActive: boolean;
  onOverview: () => void;
  groups: { id: string; label: string; items: NetworkAsideItem[] }[];
  onSelect: (id: string) => void;
}) {
  const [toggledNets, setToggledNets] = useState<string[]>([]);
  return (
    <aside className="flex max-h-72 w-full shrink-0 flex-col border-t border-[var(--border)] bg-[var(--background)] md:max-h-none md:w-[15.5rem] md:border-l md:border-t-0">
      <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-soft)]">
        Cuentas
      </p>
      <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-4">
        <button
          type="button"
          onClick={onOverview}
          aria-pressed={overviewActive}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
            overviewActive ? "bg-white shadow-[0_1px_2px_rgba(17,24,39,0.06)]" : "hover:bg-white"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--foreground)] shadow-[inset_0_0_0_1px_rgba(17,24,39,0.08)]">
            <OverviewMark />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{overviewLabel}</span>
            <span className="block text-[11px] text-[var(--muted)]">{overviewSubtitle}</span>
          </span>
        </button>
        {groups.map((group) => {
          const toggled = toggledNets.includes(group.id);
          const open = group.items.length > 0 ? !toggled : toggled;
          const hasSelected = group.items.some((item) => item.active);
          return (
            <div key={group.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setToggledNets((prev) => (prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]))
                }
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
                  hasSelected && !open ? "bg-white shadow-[0_1px_2px_rgba(17,24,39,0.06)]" : "hover:bg-white"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(17,24,39,0.08)]">
                  <PlatformLogo id={group.id} className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{group.label}</span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {group.items.length === 1 ? "1 cuenta" : `${group.items.length} cuentas`}
                  </span>
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-[var(--muted-soft)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="ml-4 space-y-0.5 border-l border-[var(--border)] py-1 pl-2">
                    {group.items.length === 0 ? (
                      <p className="px-2 py-1.5 text-[12px] text-[var(--muted-soft)]">Sin cuentas</p>
                    ) : (
                      group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item.id)}
                          aria-pressed={item.active}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                            item.active ? "bg-white" : "hover:bg-white"
                          }`}
                        >
                          <AvatarHover
                            src={item.avatarUrl}
                            label={item.handle}
                            preview={false}
                            className="h-[22px] w-[22px] shrink-0 rounded-full object-cover text-[9px]"
                          />
                          <span
                            className={`min-w-0 flex-1 truncate text-[12px] ${
                              item.active ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-soft)]"
                            }`}
                          >
                            @{item.handle}
                          </span>
                          {item.trailing}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
