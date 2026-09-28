"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  engagementRate,
  formatCompact,
} from "@/lib/viewtracker/format";
import type { TrackedAccount } from "./AccountsPage";
import type { TrackedVideo } from "./VideosPage";
import { EmptyTable, PageHead, SparkBars } from "./vt-ui";

type TrackedCreator = {
  id: string;
  name: string;
  email: string | null;
  labels: string | null;
  status: string;
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

export function CreatorsPage({ projectId }: { projectId: string }) {
  const [creators, setCreators] = useState<TrackedCreator[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    const [c, a, v] = await Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/creators`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/accounts`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/videos`).then((r) => r.json()),
    ]);
    setCreators((c.items ?? []) as TrackedCreator[]);
    setAccounts((a.items ?? []) as TrackedAccount[]);
    setVideos((v.items ?? []) as TrackedVideo[]);
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
    if (!q) return creators;
    return creators.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [creators, search]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Pon el nombre del creator.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/creators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo añadir");
      setCreators((prev) => [data.item as TrackedCreator, ...prev]);
      setName("");
      setEmail("");
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setAdding(false);
    }
  }

  async function remove(creator: TrackedCreator) {
    setCreators((prev) => prev.filter((c) => c.id !== creator.id));
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/creators?id=${encodeURIComponent(creator.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) setCreators((prev) => [creator, ...prev]);
  }

  return (
    <div className="space-y-4">
      <PageHead
        title="Creators"
        subtitle="Manage creators linked to your tracked accounts."
        action={
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            + Add creator
          </button>
        }
      />

      {formOpen ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--border)] bg-white p-4"
        >
          <label className="text-[12px] font-medium text-[var(--foreground-soft)]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-48 rounded-xl border border-[var(--border)] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--foreground-soft)]">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-56 rounded-xl border border-[var(--border)] px-3 py-2 text-[13px]"
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or handle"
        className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-[var(--muted-soft)]"
      />

      {loading ? (
        <EmptyTable message="Cargando…" />
      ) : filtered.length === 0 ? (
        <EmptyTable
          message={
            creators.length === 0
              ? "Añade un creator y asígnalo a una cuenta."
              : "No creators match your filters."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-[var(--border)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Creator</th>
                <th className="px-3 py-2.5 font-medium">Accounts</th>
                <th className="px-3 py-2.5 font-medium">Labels</th>
                <th className="px-3 py-2.5 font-medium">Post activity</th>
                <th className="px-3 py-2.5 font-medium">Videos</th>
                <th className="px-3 py-2.5 font-medium">Followers</th>
                <th className="px-3 py-2.5 font-medium">Views</th>
                <th className="px-3 py-2.5 font-medium">Likes</th>
                <th className="px-3 py-2.5 font-medium">Comments</th>
                <th className="px-3 py-2.5 font-medium">Eng.</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Added</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((creator) => {
                const linked = accounts.filter(
                  (a) => a.creatorName === creator.name
                );
                const handles = new Set(
                  linked.map((a) => (a.username || "").toLowerCase())
                );
                const related = videos.filter((v) =>
                  handles.has((v.author || "").replace(/^@/, "").toLowerCase())
                );
                const views = related.reduce((s, v) => s + v.views, 0);
                const likes = related.reduce((s, v) => s + v.likes, 0);
                const comments = related.reduce((s, v) => s + v.comments, 0);
                const shares = related.reduce((s, v) => s + v.shares, 0);
                const followers = linked.reduce((s, a) => s + a.followers, 0);
                const eng = engagementRate({
                  views,
                  likes,
                  comments,
                  shares,
                  saves: related.reduce((s, v) => s + v.saves, 0),
                });
                return (
                  <tr key={creator.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">
                        {creator.name}
                      </p>
                      <p className="text-[12px] text-[var(--muted-soft)]">
                        {creator.email || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {linked.length
                        ? linked.map((a) => a.platform || "web").join(" · ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted-soft)]">
                      {creator.labels || "—"}
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
                      {formatCompact(followers)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(views)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(likes)}</td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {formatCompact(comments)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{eng.toFixed(1)}%</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {creator.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {new Date(creator.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void remove(creator)}
                        className="text-[12px] text-[var(--muted-soft)] hover:text-red-600"
                      >
                        Remove
                      </button>
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
