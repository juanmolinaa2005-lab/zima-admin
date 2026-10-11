"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  displayNameFromMeta,
  parseProfileUrl,
} from "@/lib/viewtracker/profile";

type MailAccount = { id: string; email: string };
type Channel = "email" | "profile";

type RequestSettings = {
  fromEmail: string;
  subject: string;
  template: string;
};

const DEFAULT_SETTINGS: RequestSettings = {
  fromEmail: "",
  subject: "Collaboration request — #name",
  template: `Hi #name,

I'd love to collaborate with you on ViewTracker.

Looking forward to hearing from you.

Best,`,
};

function legacyStorageKey(projectId: string) {
  return `zima-vt-requests-${projectId}`;
}

function readLegacyLocal(projectId: string): RequestSettings | null {
  try {
    const raw = localStorage.getItem(legacyStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RequestSettings>;
    return {
      fromEmail: parsed.fromEmail ?? "",
      subject: parsed.subject ?? DEFAULT_SETTINGS.subject,
      template: parsed.template ?? DEFAULT_SETTINGS.template,
    };
  } catch {
    return null;
  }
}

function clearLegacyLocal(projectId: string) {
  try {
    localStorage.removeItem(legacyStorageKey(projectId));
  } catch {
    /* ignore */
  }
}

export function extractHashtags(text: string): string[] {
  const re = /#([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)/g;
  const seen = new Set<string>();
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tag = m[1];
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

export function fillTemplate(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(/#([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)/g, (full, tag: string) => {
    const v = values[tag.toLowerCase()];
    return v != null && v !== "" ? v : full;
  });
}

function labelForTag(tag: string): string {
  return tag.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldCard({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)] ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
          {label}
        </p>
        {hint ? (
          <p className="text-[11px] text-[var(--muted-soft)]">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ProfilePreview({ url }: { url: string }) {
  const meta = useMemo(() => parseProfileUrl(url), [url]);
  const [broken, setBroken] = useState(false);

  if (!meta) {
    return (
      <p className="text-[12px] text-[#b45309]">Enter a valid profile URL</p>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
      {meta.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.avatarUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12px] font-bold text-[var(--accent)]">
          {(meta.username?.[0] || "?").toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
          {meta.username ? `@${meta.username}` : meta.platform || "Profile"}
        </p>
        <p className="truncate text-[11px] text-[var(--muted-soft)]">
          {meta.platform ? `${meta.platform} · ` : ""}
          {meta.normalizedUrl}
        </p>
      </div>
    </div>
  );
}

type Mode = "template" | "preview";

type RequestsPageProps = {
  projectId: string;
};

export function RequestsPage({ projectId }: RequestsPageProps) {
  const [mode, setMode] = useState<Mode>("preview");
  const [channel, setChannel] = useState<Channel>("email");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SETTINGS.subject);
  const [template, setTemplate] = useState(DEFAULT_SETTINGS.template);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [toEmail, setToEmail] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/viewtracker/requests`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load template");

        const remote = data.template as {
          fromEmail: string;
          subject: string;
          body: string;
          exists: boolean;
        };

        if (!cancelled) {
          if (remote.exists) {
            setFromEmail(remote.fromEmail || "");
            setSubject(remote.subject || DEFAULT_SETTINGS.subject);
            setTemplate(remote.body || DEFAULT_SETTINGS.template);
          } else {
            const legacy = readLegacyLocal(projectId);
            if (legacy) {
              setFromEmail(legacy.fromEmail);
              setSubject(legacy.subject);
              setTemplate(legacy.template);
              const put = await fetch(
                `/api/projects/${projectId}/viewtracker/requests`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fromEmail: legacy.fromEmail,
                    subject: legacy.subject,
                    body: legacy.template,
                  }),
                },
              );
              if (put.ok) clearLegacyLocal(projectId);
            } else {
              setFromEmail("");
              setSubject(DEFAULT_SETTINGS.subject);
              setTemplate(DEFAULT_SETTINGS.template);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load template",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/mail/accounts`);
        const data = await res.json();
        if (!res.ok) return;
        const list = (data.accounts ?? []) as MailAccount[];
        setAccounts(
          Array.isArray(list)
            ? list.map((a) => ({ id: a.id, email: a.email }))
            : [],
        );
      } catch {
        /* ignore */
      }
    })();
  }, [projectId]);

  async function persist(next: Partial<RequestSettings>) {
    const settings: RequestSettings = {
      fromEmail: (next.fromEmail ?? fromEmail).trim(),
      subject: (next.subject ?? subject).trim() || DEFAULT_SETTINGS.subject,
      template: next.template ?? template,
    };
    setFromEmail(settings.fromEmail);
    setSubject(settings.subject);
    setTemplate(settings.template);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/viewtracker/requests`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromEmail: settings.fromEmail,
            subject: settings.subject,
            body: settings.template,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      clearLegacyLocal(projectId);
      setSavedFlash("Saved");
      window.setTimeout(() => setSavedFlash(""), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const tags = useMemo(
    () => extractHashtags(`${subject}\n${template}`),
    [subject, template],
  );

  const filledSubject = useMemo(
    () => fillTemplate(subject, tagValues),
    [subject, tagValues],
  );
  const filledBody = useMemo(
    () => fillTemplate(template, tagValues),
    [template, tagValues],
  );

  const fromAccount = useMemo(() => {
    const email = fromEmail.trim().toLowerCase();
    if (!email) return null;
    return accounts.find((a) => a.email.toLowerCase() === email) ?? null;
  }, [accounts, fromEmail]);

  const profileMeta = useMemo(
    () => (profileUrl.trim() ? parseProfileUrl(profileUrl) : null),
    [profileUrl],
  );

  async function logOutreach(input: {
    channel: Channel;
    status: "pending";
    toEmail?: string;
    profileUrl?: string;
  }) {
    const nameTag = tagValues.name || tagValues.Name;
    await fetch(`/api/projects/${projectId}/viewtracker/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: input.channel,
        status: input.status,
        toEmail: input.toEmail,
        profileUrl: input.profileUrl,
        recipientName: displayNameFromMeta(
          input.profileUrl ? parseProfileUrl(input.profileUrl) : null,
          nameTag,
        ),
        subject: filledSubject,
        body: filledBody,
        fromEmail: fromEmail || undefined,
      }),
    });
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");

    for (const tag of tags) {
      if (!tagValues[tag.toLowerCase()]?.trim()) {
        setError(`Fill in #${tag} before sending.`);
        return;
      }
    }

    if (channel === "email") {
      const to = toEmail.trim();
      if (!to) {
        setError("Recipient email is required.");
        return;
      }
      if (!fromEmail.trim()) {
        setError("Set your From email in Template first.");
        return;
      }
      if (!fromAccount) {
        setError(
          `Connect “${fromEmail}” in Emails first — sends use that mailbox.`,
        );
        return;
      }

      setSending(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/mail/accounts/${fromAccount.id}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to,
              subject: filledSubject,
              text: filledBody,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send");

        await logOutreach({
          channel: "email",
          status: "pending",
          toEmail: to,
          profileUrl: profileUrl.trim() || undefined,
        });

        setOk(`Sent to ${to}. Logged in Responses.`);
        setToEmail("");
        setProfileUrl("");
        setTagValues({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!profileUrl.trim() || !profileMeta) {
      setError("Paste a valid profile URL.");
      return;
    }

    setSending(true);
    try {
      await logOutreach({
        channel: "profile",
        status: "pending",
        profileUrl: profileMeta.normalizedUrl,
      });

      try {
        await navigator.clipboard.writeText(filledBody);
      } catch {
        /* ignore */
      }

      window.open(profileMeta.normalizedUrl, "_blank", "noopener,noreferrer");
      setOk(
        "Request logged. Profile opened — paste the message and send the DM. Track it in Responses.",
      );
      setTagValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save request");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)] focus:bg-white";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-[13px] text-[var(--muted-soft)]">
        Loading template…
      </div>
    );
  }

  return (
    <div
      className={`mx-auto space-y-4 ${mode === "preview" ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Requests
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {mode === "template"
              ? "Edit and save your fixed From, subject, and message in Supabase."
              : "Send by email or open a profile to DM — every request is logged."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedFlash && mode === "template" ? (
            <span className="text-[12px] font-medium text-[#16a34a]">
              {saving ? "Saving…" : savedFlash}
            </span>
          ) : saving && mode === "template" ? (
            <span className="text-[12px] font-medium text-[var(--muted-soft)]">
              Saving…
            </span>
          ) : null}
          {mode === "template" ? (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                await persist({ fromEmail, subject, template });
                setMode("preview");
                setError("");
                setOk("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              Aceptar
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("template");
                setError("");
                setOk("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2 text-[12px] font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-alt)]"
            >
              Editar
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path
                  d="M4.5 19.5h3.75L18.6 9.15a2.12 2.12 0 0 0-3-3L5.25 16.5zM13.5 8.25l3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
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

      {mode === "template" ? (
        <div className="space-y-3">
          <FieldCard label="From" hint="Saved in Supabase">
            {accounts.length > 0 ? (
              <select
                value={fromEmail}
                onChange={(e) => {
                  const v = e.target.value;
                  setFromEmail(v);
                  void persist({ fromEmail: v });
                }}
                className={inputClass}
              >
                <option value="">Select your email…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.email}>
                    {a.email}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                onBlur={() => void persist({ fromEmail })}
                placeholder="you@company.com"
                className={inputClass}
              />
            )}
            {fromEmail && !fromAccount && accounts.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-[#b45309]">
                Connect this mailbox in Emails to send
              </p>
            ) : accounts.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-[var(--muted-soft)]">
                Connect a mailbox in Emails to send
              </p>
            ) : null}
          </FieldCard>

          <FieldCard label="Subject" hint="Saved in Supabase">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => void persist({ subject })}
              placeholder="Collaboration request — #name"
              className={inputClass}
            />
          </FieldCard>

          <FieldCard
            label="Message"
            hint={
              tags.length
                ? `Tags: ${tags.map((t) => `#${t}`).join(", ")}`
                : "Add #name style tags"
            }
          >
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              onBlur={() => void persist({ template })}
              rows={12}
              spellCheck
              placeholder={`Hi #name,\n\nWrite your message…`}
              className={`${inputClass} min-h-[220px] resize-y leading-relaxed`}
            />
          </FieldCard>

        </div>
      ) : (
        <form onSubmit={handleSend} className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <FieldCard label="Send via" hint="Email or profile DM">
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-0.5">
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    channel === "email"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("profile")}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    channel === "profile"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Profile
                </button>
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
                {channel === "email"
                  ? "Sends with your connected mailbox and logs the request."
                  : "Opens the profile so you can DM manually. Message is copied and the request is logged."}
              </p>
            </FieldCard>

            {tags.length > 0 ? (
              <div className={`grid gap-3 ${tags.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {tags.map((tag) => (
                  <FieldCard
                    key={tag}
                    label={`#${tag}`}
                    hint={labelForTag(tag)}
                  >
                    <input
                      type="text"
                      value={tagValues[tag.toLowerCase()] ?? ""}
                      onChange={(e) =>
                        setTagValues((prev) => ({
                          ...prev,
                          [tag.toLowerCase()]: e.target.value,
                        }))
                      }
                      placeholder={`Value for #${tag}`}
                      className={inputClass}
                    />
                  </FieldCard>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[13px] text-[var(--muted-soft)]">
                No #tags in the template — add e.g. #name in Template.
              </div>
            )}

            {channel === "email" ? (
              <FieldCard label="To" hint="Recipient email">
                <input
                  type="email"
                  required
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="creator@email.com"
                  className={inputClass}
                />
              </FieldCard>
            ) : null}

            <FieldCard
              label="Profile link"
              hint={
                channel === "profile" ? "Required" : "Optional — for tracking"
              }
            >
              <input
                type="url"
                required={channel === "profile"}
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://instagram.com/username"
                className={inputClass}
              />
              {profileUrl.trim() ? <ProfilePreview url={profileUrl} /> : null}
            </FieldCard>
          </div>

          <FieldCard label="Preview" className="lg:col-start-2 lg:row-start-1">
            <p className="text-[12px] text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground-soft)]">
                Via
              </span>{" "}
              {channel === "email" ? "Email" : "Profile"}
              {channel === "email" ? (
                <>
                  <span className="mx-2 text-[#d1d5db]">·</span>
                  <span className="font-medium text-[var(--foreground-soft)]">
                    From
                  </span>{" "}
                  {fromEmail || "—"}
                  <span className="mx-2 text-[#d1d5db]">·</span>
                  <span className="font-medium text-[var(--foreground-soft)]">
                    To
                  </span>{" "}
                  {toEmail || "—"}
                </>
              ) : (
                <>
                  <span className="mx-2 text-[#d1d5db]">·</span>
                  <span className="font-medium text-[var(--foreground-soft)]">
                    Profile
                  </span>{" "}
                  {profileMeta?.username
                    ? `@${profileMeta.username}`
                    : profileUrl || "—"}
                </>
              )}
            </p>
            <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">
              {filledSubject || "—"}
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--foreground-soft)]">
              {filledBody || "—"}
            </pre>
          </FieldCard>

          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {sending
                ? channel === "email"
                  ? "Sending…"
                  : "Opening…"
                : channel === "email"
                  ? "Send request"
                  : "Go to profile"}
            </button>
            {channel === "profile" ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(filledBody);
                    setOk("Message copied (text only).");
                    setError("");
                  } catch {
                    setError("Could not copy to clipboard.");
                  }
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--foreground-soft)] hover:bg-[var(--background)]"
              >
                Copy
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
