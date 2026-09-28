"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  engagementRate,
  formatCompact,
  timeAgo,
} from "@/lib/viewtracker/format";
import type { TrackedVideo } from "./VideosPage";
import {
  EmptyTable,
  Modal,
  PageHead,
  SparkBars,
  StatusOk,
  Toolbar,
} from "./vt-ui";

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

export function AccountsPage({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
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
    const [a, v, c] = await Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/accounts`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/videos`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/creators`).then((r) => r.json()),
    ]);
    if (a.error) throw new Error(a.error);
    setItems((a.items ?? []) as TrackedAccount[]);
    setVideos((v.items ?? []) as TrackedVideo[]);
    setCreators((c.items ?? []) as { id: string; name: string }[]);
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
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/accounts`, {
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

  async function remove(account: TrackedAccount) {
    setItems((prev) => prev.filter((a) => a.id !== account.id));
    setMenuId(null);
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/accounts?id=${encodeURIComponent(account.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) setItems((prev) => [account, ...prev]);
  }

  return (
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
          <span className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] text-[var(--muted)]">
            All time UTC
          </span>
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
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="border-b border-[var(--border)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Username</th>
                <th className="px-3 py-2.5 font-medium">Creator</th>
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
                <th className="px-3 py-2.5 font-medium">Last refresh</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const user = (account.username || "").toLowerCase();
                const related = videos.filter((v) => {
                  if (v.accountId && v.accountId === account.id) return true;
                  if (account.platform && v.platform !== account.platform) return false;
                  return handleOf(v) === user;
                });
                const views = related.reduce((s, v) => s + v.views, 0);
                const likes = related.reduce((s, v) => s + v.likes, 0);
                const comments = related.reduce((s, v) => s + v.comments, 0);
                const shares = related.reduce((s, v) => s + v.shares, 0);
                const saves = related.reduce((s, v) => s + v.saves, 0);
                const eng = engagementRate({ views, likes, comments, shares, saves });
                const avg = related.length ? Math.round(views / related.length) : 0;
                return (
                  <tr key={account.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <a
                        href={account.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={account.avatarUrl || "https://unavatar.io/fallback"}
                          alt=""
                          className="h-9 w-9 rounded-full bg-[var(--surface-alt)] object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-[var(--foreground)]">
                            @{account.username || "account"}
                          </span>
                          <span className="block text-[12px] text-[var(--muted-soft)]">
                            {account.displayName || account.platform || "—"}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={account.creatorName || ""}
                        onChange={(e) => void assignCreator(account, e.target.value)}
                        className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-[var(--foreground-soft)]"
                      >
                        <option value="">Assign</option>
                        {creators.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
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
  );
}
