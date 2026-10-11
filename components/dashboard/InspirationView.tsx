"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type InspirationLink = {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  platform: "youtube" | "tiktok" | "instagram" | "other";
  thumbnailUrl: string | null;
  createdAt: string;
};

const PLATFORM_LABEL: Record<InspirationLink["platform"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};

const PLATFORM_COLOR: Record<InspirationLink["platform"], string> = {
  youtube: "#ff0000",
  tiktok: "#111827",
  instagram: "#e1306c",
  other: "#6b7280",
};

export function InspirationView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [links, setLinks] = useState<InspirationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/redes/inspiration`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setLinks((data.links ?? []) as InspirationLink[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/redes/inspiration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), note: note.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save link");
      setUrl("");
      setNote("");
      setOk("Saved.");
      setLinks((prev) => [data.link as InspirationLink, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this link?")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/redes/inspiration?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete");
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-semibold text-[var(--accent)]"
        >
          ← Back
        </button>
      </div>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          Saved inspiration
        </h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Save links to videos you found interesting.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </div>
      ) : null}

      <form
        onSubmit={save}
        className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-white p-4"
      >
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
            Video link
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… or TikTok / Instagram"
            required
            className="ui-input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
            Note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this one?"
            className="ui-input"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="ui-btn-primary !py-2 text-[13px]"
        >
          {saving ? "Saving…" : "Save link"}
        </button>
      </form>

      {loading ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Loading…
        </p>
      ) : links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-12 text-center">
          <p className="text-[14px] font-medium text-[var(--foreground)]">
            No inspiration yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
            Paste a YouTube, TikTok, or Instagram video URL above.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
            >
              <div className="flex gap-3 p-3">
                {link.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={link.thumbnailUrl}
                    alt=""
                    className="h-16 w-24 shrink-0 rounded-lg object-cover bg-[var(--surface-alt)]"
                  />
                ) : (
                  <span
                    className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ background: PLATFORM_COLOR[link.platform] }}
                  >
                    {PLATFORM_LABEL[link.platform]}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="ui-tag ui-tag-muted"
                      style={{ color: PLATFORM_COLOR[link.platform] }}
                    >
                      {PLATFORM_LABEL[link.platform]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--foreground)]">
                    {link.title || link.url}
                  </p>
                  {link.note ? (
                    <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                      {link.note}
                    </p>
                  ) : null}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block truncate text-[11px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    Open →
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(link.id)}
                  className="self-start text-[11px] font-semibold text-[var(--danger)]"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
