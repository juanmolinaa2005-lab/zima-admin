"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { isSocialPlatform, PLATFORM_META } from "@/lib/redes/types";
import { parseProfileUrl, type OutreachStatus, type ProfileMeta } from "@/lib/viewtracker/profile";
import { PlatformLogo } from "./vt-ui";

export type OutreachItem = {
  id: string;
  channel: "email" | "profile";
  status: OutreachStatus;
  recipient_name: string | null;
  to_email: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  platform: string | null;
  subject: string | null;
  body: string | null;
  from_email: string | null;
  created_at: string;
};

type Conversation = {
  key: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  platform: string | null;
  channel: "email" | "profile";
  toEmail: string | null;
  profileUrl: string | null;
  messages: OutreachItem[];
  last: OutreachItem;
};

const KNOWN_PLATFORM_LOGOS = new Set(["tiktok", "instagram", "youtube", "x", "facebook", "snapchat"]);

/** Opens the DM thread directly where the network has a public link for it; otherwise the profile. */
export function dmHref(meta: ProfileMeta) {
  if (meta.username && meta.platform === "instagram") return `https://ig.me/m/${encodeURIComponent(meta.username)}`;
  if (meta.username && meta.platform === "facebook") return `https://m.me/${encodeURIComponent(meta.username)}`;
  return meta.normalizedUrl;
}

function groupConversations(items: OutreachItem[]): Conversation[] {
  const map = new Map<string, OutreachItem[]>();
  for (const it of items) {
    const key = (it.profile_url || it.to_email || it.id).toLowerCase();
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  const out: Conversation[] = [];
  for (const [key, list] of map) {
    const messages = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = messages[messages.length - 1];
    const meta = last.profile_url ? parseProfileUrl(last.profile_url) : null;
    const withPlatform = [...messages].reverse().find((m) => m.platform);
    out.push({
      key,
      name:
        (last.recipient_name && /[\p{L}\p{N}]/u.test(last.recipient_name) ? last.recipient_name : null) ||
        meta?.username ||
        last.to_email ||
        "Sin nombre",
      handle: meta?.username ? `@${meta.username}` : last.to_email || last.profile_url || "",
      avatarUrl: [...messages].reverse().find((m) => m.avatar_url)?.avatar_url ?? null,
      platform: withPlatform?.platform ?? null,
      channel: last.channel,
      toEmail: [...messages].reverse().find((m) => m.to_email)?.to_email ?? null,
      profileUrl: last.profile_url,
      messages,
      last,
    });
  }
  return out.sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "numeric", year: "numeric" });
}

function longDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MailGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7.5 8 5.5 8-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChannelIcon({ convo, className = "h-3.5 w-3.5" }: { convo: Conversation; className?: string }) {
  if (convo.channel === "email") {
    return (
      <span title="Email" className="shrink-0 text-[var(--muted)]">
        <MailGlyph className={className} />
      </span>
    );
  }
  if (convo.platform && KNOWN_PLATFORM_LOGOS.has(convo.platform)) {
    const label = isSocialPlatform(convo.platform) ? PLATFORM_META[convo.platform].label : convo.platform;
    return (
      <span title={label} className="shrink-0">
        <PlatformLogo id={convo.platform} className={className} />
      </span>
    );
  }
  return null;
}

function Avatar({ convo, size = "h-11 w-11" }: { convo: Conversation; size?: string }) {
  const [broken, setBroken] = useState(false);
  const letter = (convo.name.replace(/^@/, "")[0] || "?").toUpperCase();
  if (convo.avatarUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={convo.avatarUrl}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[14px] font-bold text-[var(--accent)]`}>
      {letter}
    </span>
  );
}

const STATUS_LABEL: Record<OutreachStatus, string> = {
  pending: "Pendiente",
  approved: "Aceptado",
  declined: "Rechazado",
};

type Props = {
  projectId: string;
  items: OutreachItem[];
  loading: boolean;
  fromEmail: string;
  fromAccountId: string | null;
  onChanged: () => void;
  onRequireFromEmail: () => void;
  newMessageButton: ReactNode;
};

export function MessagesInbox({
  projectId,
  items,
  loading,
  fromEmail,
  fromAccountId,
  onChanged,
  onRequireFromEmail,
  newMessageButton,
}: Props) {
  const conversations = useMemo(() => groupConversations(items), [items]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.key === selectedKey) ?? conversations[0] ?? null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.key, selected?.messages.length]);

  async function updateStatus(status: OutreachStatus) {
    if (!selected) return;
    const res = await fetch(`/api/projects/${projectId}/viewtracker/outreach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.last.id, status }),
    });
    if (res.ok) onChanged();
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!selected || !text || sending) return;
    setError("");
    setSending(true);
    try {
      const subject = selected.last.subject
        ? /^re:/i.test(selected.last.subject)
          ? selected.last.subject
          : `Re: ${selected.last.subject}`
        : "";

      if (selected.channel === "email") {
        if (!selected.toEmail) throw new Error("Esta conversación no tiene email.");
        if (!fromEmail || !fromAccountId) {
          onRequireFromEmail();
          throw new Error("Elige y conecta tu email de envío en Plantilla.");
        }
        const res = await fetch(`/api/projects/${projectId}/mail/accounts/${fromAccountId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: selected.toEmail, subject, text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo enviar");
      } else {
        const meta = selected.profileUrl ? parseProfileUrl(selected.profileUrl) : null;
        if (!meta) throw new Error("Esta conversación no tiene un perfil válido.");
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* ignore */
        }
        window.open(dmHref(meta), "_blank", "noopener,noreferrer");
      }

      await fetch(`/api/projects/${projectId}/viewtracker/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: selected.channel,
          status: "pending",
          toEmail: selected.toEmail || undefined,
          profileUrl: selected.profileUrl || undefined,
          recipientName: selected.name,
          subject: subject || undefined,
          body: text,
          fromEmail: fromEmail || undefined,
        }),
      });
      setDraft("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] h-[calc(100dvh-190px)] min-h-[460px] xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside
        className={`relative min-h-0 min-w-0 flex-col border-[var(--border)] xl:flex xl:border-r ${mobileThread ? "hidden" : "flex"}`}
      >
        <div className="pb-2 pt-1">
          <p className="text-[17px] font-semibold text-[var(--foreground)]">Conversaciones</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-24 xl:pr-3">
          {loading ? (
            <p className="px-2 py-6 text-[13px] text-[var(--muted-soft)]">Cargando…</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-6 text-[13px] text-[var(--muted-soft)]">
              Aún no has escrito a nadie. Pulsa el botón redondo para empezar.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => {
                const active = selected?.key === c.key;
                const snippet = (c.last.body || c.last.subject || "").replace(/\s+/g, " ").trim();
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(c.key);
                        setMobileThread(true);
                        setError("");
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                        active ? "bg-white shadow-[0_1px_2px_rgba(17,24,39,0.06)]" : "hover:bg-white/70"
                      }`}
                    >
                      <Avatar convo={c} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">{c.name}</p>
                          <ChannelIcon convo={c} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--muted)]">{snippet || "—"}</p>
                          <span suppressHydrationWarning className="shrink-0 text-[11px] text-[var(--muted-soft)]">{shortDate(c.last.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="absolute bottom-4 right-4">{newMessageButton}</div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-col xl:flex ${mobileThread ? "flex" : "hidden"}`}>
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--border)] pb-3 xl:pl-5">
              <button
                type="button"
                onClick={() => setMobileThread(false)}
                aria-label="Volver"
                className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-alt)] xl:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="m14.5 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Avatar convo={selected} size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{selected.name}</p>
                  <ChannelIcon convo={selected} className="h-4 w-4" />
                </div>
                {selected.handle ? (
                  <p className="truncate text-[12px] text-[var(--muted-soft)]">{selected.handle}</p>
                ) : null}
              </div>
              <select
                value={selected.last.status}
                onChange={(e) => void updateStatus(e.target.value as OutreachStatus)}
                aria-label="Estado"
                className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] font-medium text-[var(--foreground)] outline-none"
              >
                {(Object.keys(STATUS_LABEL) as OutreachStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              {selected.profileUrl ? (
                <a
                  href={selected.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir perfil"
                  aria-label="Abrir perfil"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                    <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ) : null}
            </header>

            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto py-5 xl:pl-5">
              <div className="mt-auto space-y-3">
                {selected.messages.map((m, i) => {
                  const prev = selected.messages[i - 1];
                  const showDate =
                    !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 60 * 60 * 1000;
                  return (
                    <div key={m.id}>
                      {showDate ? (
                        <p suppressHydrationWarning className="mb-3 text-center text-[11px] text-[var(--muted-soft)]">{longDate(m.created_at)}</p>
                      ) : null}
                      <div className="flex justify-end">
                        <div className="max-w-[min(420px,85%)] rounded-2xl rounded-br-md bg-[var(--foreground)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                          {m.channel === "email" && m.subject ? (
                            <p className="mb-1 font-semibold">{m.subject}</p>
                          ) : null}
                          <p className="whitespace-pre-wrap">{m.body || "—"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={send} className="pt-3 xl:pl-5">
              {error ? <p className="mb-2 px-1 text-[12px] text-[var(--danger)]">{error}</p> : null}
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-white py-1.5 pl-3.5 pr-1.5 focus-within:border-[var(--border-strong)]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  placeholder={selected.channel === "email" ? "Escribe un email…" : "Escribe un mensaje…"}
                  className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Enviar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-white transition hover:opacity-90 disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                    <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {selected.channel === "profile" ? (
                <p className="mt-1.5 px-1 text-[11px] text-[var(--muted-soft)]">
                  Se copia el mensaje y se abre el chat para que lo pegues.
                </p>
              ) : null}
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] text-[var(--muted-soft)]">
            Tus conversaciones aparecerán aquí.
          </div>
        )}
      </section>
    </div>
  );
}
