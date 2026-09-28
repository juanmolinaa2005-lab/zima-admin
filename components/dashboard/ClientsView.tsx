"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  AuthClientUser,
  MailAccountPublic,
  SupabaseRemoteProject,
} from "@/lib/types";
import {
  fetchRemoteSupabaseProjects,
  updateProjectLink,
} from "@/app/actions/projects";
import {
  formatCacheAge,
  loadClientsCache,
  loadRemotesCache,
  saveClientsCache,
  saveRemotesCache,
} from "@/lib/client-cache";
import { ConnectSupabaseModal } from "@/components/projects/ConnectSupabaseModal";

type ClientsViewProps = {
  projectId: string;
  linkedRef: string | null;
  userEmail: string | null;
  onLinked: (ref: string | null) => void;
};

function defaultMailKey(projectId: string) {
  return `zima:default-mail:${projectId}`;
}

export function ClientsView({
  projectId,
  linkedRef,
  userEmail,
  onLinked,
}: ClientsViewProps) {
  const userKey = userEmail ?? "default";
  const [users, setUsers] = useState<AuthClientUser[]>([]);
  const [fingerprint, setFingerprint] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(linkedRef));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [remotes, setRemotes] = useState<SupabaseRemoteProject[]>([]);
  const [savingLink, setSavingLink] = useState(false);
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const [mailAccounts, setMailAccounts] = useState<MailAccountPublic[]>([]);
  const [defaultMailId, setDefaultMailId] = useState<string>("");
  const [composeFor, setComposeFor] = useState<AuthClientUser | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendOk, setSendOk] = useState("");

  const loadMailAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/mail/accounts`);
      const data = await res.json();
      if (!res.ok) {
        setMailAccounts([]);
        return;
      }
      const list = (data.accounts ?? []) as MailAccountPublic[];
      setMailAccounts(list);

      let stored = "";
      try {
        stored = localStorage.getItem(defaultMailKey(projectId)) ?? "";
      } catch {
        /* ignore */
      }
      if (stored && list.some((a) => a.id === stored)) {
        setDefaultMailId(stored);
      } else if (list[0]) {
        setDefaultMailId(list[0].id);
        try {
          localStorage.setItem(defaultMailKey(projectId), list[0].id);
        } catch {
          /* ignore */
        }
      } else {
        setDefaultMailId("");
      }
    } catch {
      setMailAccounts([]);
    }
  }, [projectId]);

  const loadUsers = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!linkedRef) {
        setUsers([]);
        setFingerprint("");
        setSavedAt(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const cached = loadClientsCache(projectId, linkedRef);
      if (cached && !opts?.force) {
        setUsers(cached.data);
        setFingerprint(cached.fingerprint);
        setSavedAt(cached.savedAt);
        setLoading(false);
        setRefreshing(true);
      } else if (!cached) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();
        if (opts?.force) params.set("force", "1");
        const fp = opts?.force ? "" : cached?.fingerprint || "";
        if (fp) params.set("fp", fp);

        const res = await fetch(
          `/api/projects/${projectId}/clients?${params.toString()}`
        );
        const data = await res.json();

        if (!res.ok) {
          if (data.error === "NOT_CONNECTED") {
            setConnected(false);
            setError("");
            if (!cached) setUsers([]);
            return;
          }
          setError(data.error || data.message || "Could not load clients");
          if (!cached) setUsers([]);
          return;
        }

        setConnected(true);

        if (data.unchanged) {
          setFingerprint(data.fingerprint ?? fp);
          if (cached) setSavedAt(cached.savedAt);
          return;
        }

        const nextUsers = (data.users ?? []) as AuthClientUser[];
        setUsers(nextUsers);
        const saved = saveClientsCache(projectId, linkedRef, nextUsers);
        setFingerprint(saved.fingerprint);
        setSavedAt(saved.savedAt);
      } catch {
        setError("Network error loading clients");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId, linkedRef]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadMailAccounts();
  }, [loadMailAccounts]);

  useEffect(() => {
    const cached = loadRemotesCache(userKey);
    if (cached) setRemotes(cached.data);

    fetchRemoteSupabaseProjects()
      .then((list) => {
        setConnected(true);
        const saved = saveRemotesCache(list, userKey);
        if (saved.fingerprint !== cached?.fingerprint) {
          setRemotes(list);
        } else if (!cached) {
          setRemotes(list);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "NOT_CONNECTED") {
          setConnected(false);
          setRemotes([]);
          return;
        }
        if (!cached) setRemotes([]);
      });
  }, [userKey]);

  function setDefaultMail(id: string) {
    setDefaultMailId(id);
    try {
      localStorage.setItem(defaultMailKey(projectId), id);
    } catch {
      /* ignore */
    }
  }

  async function handleLink(ref: string) {
    setSavingLink(true);
    setError("");
    try {
      const value = ref || null;
      await updateProjectLink(projectId, value);
      onLinked(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link project");
    } finally {
      setSavingLink(false);
    }
  }

  function openCompose(user: AuthClientUser) {
    if (!user.email) {
      setError("This client has no email");
      return;
    }
    if (!defaultMailId) {
      setError(
        "Choose a default email (connect one in Emails first)."
      );
      return;
    }
    setSendError("");
    setSendOk("");
    setComposeSubject("");
    setComposeBody("");
    setComposeFor(user);
  }

  async function sendToClient(e: FormEvent) {
    e.preventDefault();
    if (!composeFor?.email || !defaultMailId) return;
    setSending(true);
    setSendError("");
    setSendOk("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/mail/accounts/${defaultMailId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: composeFor.email,
            subject: composeSubject,
            text: composeBody,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "Could not send");
        return;
      }
      setSendOk(`Email sent to ${composeFor.email}`);
      setComposeFor(null);
    } catch {
      setSendError("Network error sending email");
    } finally {
      setSending(false);
    }
  }

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const defaultMail =
    mailAccounts.find((a) => a.id === defaultMailId) ?? null;

  function formatDate(value: string | null) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("en", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--surface-alt)]">
      <div className="mx-auto max-w-5xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="ui-tag ui-tag-accent">Built-in tool</span>
            <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-[var(--foreground)]">
              Clients
            </h1>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Auth users from the linked Supabase project.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!connected ? (
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="ui-btn-primary"
              >
                Connect Supabase
              </button>
            ) : (
              <select
                value={linkedRef ?? ""}
                disabled={savingLink}
                onChange={(e) => handleLink(e.target.value)}
                className="ui-input !w-auto !rounded-full"
              >
                <option value="">Link Supabase project…</option>
                {remotes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => loadUsers({ force: true })}
              disabled={!linkedRef || loading || refreshing || !connected}
              className="ui-btn-secondary disabled:opacity-50"
            >
              {refreshing ? "Comparing…" : "Refresh"}
            </button>
          </div>
        </div>

        {!connected ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-[var(--accent-border)] bg-[var(--surface-alt)] px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--foreground)]">
              Connect your Supabase account
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              You’ll only see projects from your own account.
            </p>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="ui-btn-primary mt-4"
            >
              Connect Supabase
            </button>
          </div>
        ) : !linkedRef ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-[#d8dce6] bg-white px-6 py-10 text-center">
            <p className="text-[14px] text-[var(--muted)]">
              Link one of your Supabase projects to list its users.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email, phone, or id…"
                className="ui-input min-w-[220px] flex-1 !rounded-full !text-[14px]"
              />
              <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[12px] text-[var(--muted)]">
                <span className="shrink-0 font-medium text-[var(--muted-soft)]">
                  Default email
                </span>
                <select
                  value={defaultMailId}
                  onChange={(e) => setDefaultMail(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[var(--foreground)] outline-none"
                >
                  {mailAccounts.length === 0 ? (
                    <option value="">No accounts — go to Emails</option>
                  ) : (
                    mailAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {savedAt ? (
                <span className="text-[12px] text-[var(--muted-soft)]">
                  Saved {formatCacheAge(savedAt)}
                  {refreshing ? " · syncing…" : ""}
                </span>
              ) : refreshing || loading ? (
                <span className="text-[12px] text-[var(--muted-soft)]">
                  Syncing…
                </span>
              ) : null}
            </div>

            {defaultMail ? (
              <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
                Emails to clients will send from{" "}
                <span className="font-medium text-[var(--foreground-soft)]">
                  {defaultMail.email}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-[#cd3d64]">
                Connect an account in Emails to message your
                clients.
              </p>
            )}

            {error ? (
              <p className="mt-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[#cd3d64]">
                {error}
              </p>
            ) : null}
            {sendOk ? (
              <p className="mt-4 rounded-lg bg-[#e6ffed] px-3 py-2 text-[13px] text-[#0d7a3e]">
                {sendOk}
              </p>
            ) : null}

            {loading && users.length === 0 ? (
              <p className="mt-8 text-[13px] text-[var(--muted)]">Loading clients…</p>
            ) : (
              <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[var(--surface-alt)] text-[11px] uppercase tracking-[0.06em] text-[var(--muted-soft)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Last sign-in</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-[var(--muted)]"
                        >
                          No users in this Auth project.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((u) => (
                        <tr
                          key={u.id}
                          className="border-t border-[var(--border)] text-[var(--foreground)]"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium">
                              {u.email || u.phone || "No email"}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-soft)]">
                              {u.id.slice(0, 8)}…
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[var(--foreground-soft)]">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-4 py-3 text-[var(--foreground-soft)]">
                            {formatDate(u.last_sign_in_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                u.email_confirmed_at
                                  ? "bg-[#e6ffed] text-[#0d7a3e]"
                                  : "bg-[var(--background)] text-[var(--muted)]"
                              }`}
                            >
                              {u.email_confirmed_at
                                ? "Confirmed"
                                : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={!u.email || !defaultMailId}
                              onClick={() => openCompose(u)}
                              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Send email
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {(!loading || users.length > 0) && linkedRef ? (
              <p className="mt-3 text-[12px] text-[var(--muted-soft)]">
                {filtered.length} of {users.length} users
                {fingerprint ? ` · sync ok` : ""}
              </p>
            ) : null}
          </>
        )}
      </div>

      {composeFor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0a2540]/40 p-4">
          <form
            onSubmit={(e) => void sendToClient(e)}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
          >
            <h3 className="text-[16px] font-semibold text-[var(--foreground)]">
              Send email
            </h3>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              From{" "}
              <span className="font-medium text-[var(--foreground-soft)]">
                {defaultMail?.email ?? "—"}
              </span>{" "}
              →{" "}
              <span className="font-medium text-[var(--foreground-soft)]">
                {composeFor.email}
              </span>
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Subject
                <input
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Message
                <textarea
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={8}
                  className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
            {sendError ? (
              <p className="mt-3 text-[12px] text-[#cd3d64]">{sendError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposeFor(null)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConnectSupabaseModal
        open={connectOpen}
        connected={connected}
        onClose={() => setConnectOpen(false)}
        onChanged={(value) => {
          setConnected(value);
          if (value) {
            void loadUsers({ force: true });
            fetchRemoteSupabaseProjects()
              .then((list) => {
                saveRemotesCache(list, userKey);
                setRemotes(list);
              })
              .catch(() => setRemotes([]));
          } else {
            setRemotes([]);
            setUsers([]);
          }
        }}
      />
    </div>
  );
}
