"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutreachStatus } from "@/lib/viewtracker/profile";

type OutreachItem = {
  id: string;
  channel: "email" | "profile";
  status: OutreachStatus;
  recipient_name: string | null;
  to_email: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  platform: string | null;
  subject: string | null;
  from_email: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

function statusTone(status: OutreachStatus) {
  if (status === "approved") return "ui-tag ui-tag-success";
  if (status === "declined") return "ui-tag ui-tag-danger";
  return "ui-tag ui-tag-muted";
}

function Avatar({ item }: { item: OutreachItem }) {
  const [broken, setBroken] = useState(false);
  const letter = (
    item.recipient_name?.[1] ||
    item.recipient_name?.[0] ||
    item.to_email?.[0] ||
    "?"
  ).toUpperCase();

  if (item.avatar_url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.avatar_url}
        alt=""
        className="h-11 w-11 rounded-full object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[13px] font-bold text-[var(--accent)]">
      {letter}
    </span>
  );
}

export function ResponsesPage({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | OutreachStatus>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/viewtracker/outreach`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems((data.items ?? []) as OutreachItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: OutreachStatus) {
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/outreach`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update");
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === id ? (data.item as OutreachItem) : it))
    );
  }

  const visible = items.filter(
    (it) => filter === "all" || it.status === filter
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Responses
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Track every request you sent and mark Pending, Approved, or Declined.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-white p-0.5">
            {(
              [
                ["all", "All"],
                ["pending", "Pending"],
                ["approved", "Approved"],
                ["declined", "Declined"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  filter === id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="ui-btn-secondary !py-1.5 text-[12px]"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Loading responses…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-12 text-center text-[13px] text-[var(--muted-soft)]">
          No requests yet. Send one from Requests — by email or profile.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Avatar item={item} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">
                      {item.recipient_name || item.to_email || "Unknown"}
                    </p>
                    <span className={statusTone(item.status)}>
                      {STATUS_OPTIONS.find((s) => s.value === item.status)
                        ?.label || item.status}
                    </span>
                    <span className="ui-tag ui-tag-muted capitalize">
                      {item.channel}
                    </span>
                    {item.platform ? (
                      <span className="ui-tag ui-tag-muted capitalize">
                        {item.platform}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    {item.to_email ? <span>{item.to_email}</span> : null}
                    {item.to_email && item.subject ? (
                      <span className="mx-1.5 text-[#d1d5db]">·</span>
                    ) : null}
                    {item.subject ? (
                      <span className="font-medium text-[var(--foreground-soft)]">
                        {item.subject}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-soft)]">
                    {new Date(item.created_at).toLocaleString()}
                    {item.from_email ? ` · from ${item.from_email}` : ""}
                  </p>
                </div>

                {item.profile_url ? (
                  <a
                    href={item.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ui-btn-primary !py-1.5 text-center text-[12px]"
                  >
                    Open profile
                  </a>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-end border-t border-[var(--border)] pt-3">
                <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  <span className="font-medium">Status</span>
                  <select
                    value={item.status}
                    onChange={(e) =>
                      void updateStatus(
                        item.id,
                        e.target.value as OutreachStatus
                      )
                    }
                    className="ui-input !w-auto !min-w-[140px] !rounded-lg !py-1.5 !text-[12px]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
