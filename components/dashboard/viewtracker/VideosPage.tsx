"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  engagementRate,
  formatCompact,
  formatDuration,
  formatPostedAt,
  growthMultiplier,
  timeAgo,
} from "@/lib/viewtracker/format";
import {
  AddLinksForm,
  EmptyTable,
  GrowthPill,
  PageHead,
  StatusOk,
  Toolbar,
  VT_PLATFORMS,
} from "./vt-ui";
import { NetworkAccountsAside, relatedVideos, type TrackedAccount } from "./AccountsPage";

export type TrackedVideo = {
  id: string;
  url: string;
  platform: string | null;
  videoId: string | null;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds: number | null;
  postedAt: string | null;
  lastRefreshedAt: string | null;
  viewsPrev: number;
  accountId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export { formatCompact };

function platformLabel(id: string | null) {
  if (id === "tiktok") return "TikTok";
  if (id === "instagram") return "Instagram";
  if (id === "youtube") return "YouTube";
  if (id === "snapchat") return "Snapchat";
  if (id === "x") return "X";
  return id || "Web";
}

export function VideosPage({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TrackedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);

  async function load() {
    const [res, accountsData] = await Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/videos`),
      fetch(`/api/projects/${projectId}/viewtracker/accounts`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] })),
    ]);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los videos");
    setItems((data.items ?? []) as TrackedVideo[]);
    setAccounts((accountsData.items ?? []) as TrackedAccount[]);
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

  const accountVideos = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const account of accounts) {
      map.set(account.id, new Set(relatedVideos(account, items).map((v) => v.id)));
    }
    return map;
  }, [accounts, items]);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => !platform || account.platform === platform)
        .map((account) => ({ account, count: accountVideos.get(account.id)?.size ?? 0 }))
        .sort((a, b) => b.count - a.count),
    [accounts, accountVideos, platform]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allowed = accountIds.length
      ? new Set(accountIds.flatMap((id) => [...(accountVideos.get(id) ?? [])]))
      : null;
    return items.filter((v) => {
      if (platform && v.platform !== platform) return false;
      if (allowed && !allowed.has(v.id)) return false;
      if (!q) return true;
      return (
        (v.title || "").toLowerCase().includes(q) ||
        (v.author || "").toLowerCase().includes(q) ||
        v.url.toLowerCase().includes(q)
      );
    });
  }, [items, search, platform, accountIds, accountVideos]);

  function toggleAccount(id: string) {
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    const raw = url.trim();
    if (!raw) {
      setError("Pega un link de TikTok, Instagram, YouTube o X.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo añadir");
      const created = (data.items ?? []) as TrackedVideo[];
      setItems((prev) => [
        ...created,
        ...prev.filter((v) => !created.some((c) => c.id === v.id)),
      ]);
      setUrl("");
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setAdding(false);
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/videos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshAll: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo refrescar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo refrescar");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove(video: TrackedVideo) {
    setItems((prev) => prev.filter((v) => v.id !== video.id));
    setMenuId(null);
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/videos?id=${encodeURIComponent(video.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) setItems((prev) => [video, ...prev]);
  }

  const networkGroups = useMemo(() => {
    const known = new Set<string>(VT_PLATFORMS.map((p) => p.id));
    const groups = VT_PLATFORMS.map((p) => ({ id: p.id as string, label: p.label as string, list: accountOptions.filter((o) => o.account.platform === p.id) }));
    const others = accountOptions.filter((o) => !known.has(o.account.platform || ""));
    if (others.length) groups.push({ id: "web", label: "Otras", list: others });
    return groups;
  }, [accountOptions]);

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
    <div className="space-y-4">
      <PageHead
        title="Videos"
        subtitle="View and analyze performance metrics across your tracked videos."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-soft)] disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              Tracking Options
            </button>
          </div>
        }
      />

      {formOpen ? (
        <AddLinksForm
          label="Video links"
          placeholder={"https://www.tiktok.com/@user/video/…\nhttps://www.youtube.com/watch?v=…"}
          value={url}
          onChange={setUrl}
          onSubmit={handleAdd}
          onCancel={() => setFormOpen(false)}
          submitting={adding}
          submitLabel="Track videos"
        />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search videos"
        platform={platform}
        onPlatform={(next) => {
          setPlatform(next);
          setAccountIds([]);
        }}
        extra={
          <span className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] tabular-nums text-[var(--muted)]">
            {filtered.length === items.length ? `${items.length} videos` : `${filtered.length} de ${items.length} videos`}
          </span>
        }
      />


      {loading ? (
        <EmptyTable message="Cargando videos…" />
      ) : filtered.length === 0 ? (
        <EmptyTable
          message={
            items.length === 0
              ? "Pega un link en Tracking Options para empezar."
              : "No videos match your filters."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="border-b border-[var(--border)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Video</th>
                <th className="px-3 py-2.5 font-medium">Platform</th>
                <th className="px-3 py-2.5 font-medium">Posted at</th>
                <th className="px-3 py-2.5 font-medium">Duration</th>
                <th className="px-3 py-2.5 font-medium">Views</th>
                <th className="px-3 py-2.5 font-medium" />
                <th className="px-3 py-2.5 font-medium">Likes</th>
                <th className="px-3 py-2.5 font-medium">Comments</th>
                <th className="px-3 py-2.5 font-medium">Shares</th>
                <th className="px-3 py-2.5 font-medium">Saves</th>
                <th className="px-3 py-2.5 font-medium">Eng.</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Last refresh</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((video) => {
                const eng = engagementRate(video);
                const growth = growthMultiplier(video.views, video.viewsPrev);
                return (
                  <tr key={video.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5"
                      >
                        <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-[#111827]">
                          {video.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-1 text-[13px] font-medium text-[var(--foreground)]">
                            {video.title || video.url}
                          </span>
                          <span className="block text-[12px] text-[var(--muted-soft)]">
                            {video.author || "—"}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-[var(--foreground-soft)]">
                      {platformLabel(video.platform)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {formatPostedAt(video.postedAt || video.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-[var(--foreground-soft)]">
                      {formatDuration(video.durationSeconds)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--foreground)]">
                      {formatCompact(video.views)}
                    </td>
                    <td className="px-3 py-2.5">
                      <GrowthPill value={growth} />
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(video.likes)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(video.comments)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(video.shares)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(video.saves)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{eng.toFixed(1)}%</td>
                    <td className="px-3 py-2.5">
                      <StatusOk />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {timeAgo(video.lastRefreshedAt || video.updatedAt)}
                    </td>
                    <td className="relative px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setMenuId((id) => (id === video.id ? null : video.id))}
                        className="px-1 text-[var(--muted-soft)]"
                        aria-label="More"
                      >
                        ⋯
                      </button>
                      {menuId === video.id ? (
                        <div className="absolute right-3 z-10 mt-1 w-32 rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => void remove(video)}
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
    </div>
    <NetworkAccountsAside
      overviewLabel="Todas las cuentas"
      overviewSubtitle={`${items.length} videos`}
      overviewActive={accountIds.length === 0}
      onOverview={() => setAccountIds([])}
      groups={networkGroups.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.list.map(({ account, count }) => ({
          id: account.id,
          handle: (account.username || account.displayName || "cuenta").replace(/^@/, ""),
          avatarUrl: account.avatarUrl,
          active: accountIds.includes(account.id),
          trailing: (
            <span
              className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                accountIds.includes(account.id) ? "bg-[#111113] text-white" : "bg-black/[0.05] text-[var(--muted)]"
              }`}
            >
              {count}
            </span>
          ),
        })),
      }))}
      onSelect={toggleAccount}
    />
    </div>
  );
}
