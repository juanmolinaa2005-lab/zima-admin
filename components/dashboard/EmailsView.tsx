"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  MailAccountPublic,
  MailListItem,
  MailMessage,
} from "@/lib/types";
import {
  customFolderBox,
  mailBoxLabel,
  type MailBox,
} from "@/lib/mail/boxes";
import {
  loadLastMailAccountId,
  loadMailAccountsCache,
  loadMailInboxCache,
  saveLastMailAccountId,
  saveMailAccountsCache,
  saveMailInboxCache,
} from "@/lib/client-cache";
import { MAIL_DEFAULTS } from "@/lib/mail/defaults";

type EmailsViewProps = {
  projectId: string;
};

type Mode = "list" | "read" | "compose" | "reply";

function formatListDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function senderName(from: string) {
  const named = from.match(/^([^<]+)</);
  if (named?.[1]?.trim()) return named[1].trim().replace(/^"|"$/g, "");
  return from.replace(/<|>/g, "").trim() || "Unknown";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function avatarColor(seed: string) {
  const colors = [
    "#d93025",
    "#e37400",
    "#f9ab00",
    "#188038",
    "#1a73e8",
    "#a142f4",
    "#d01884",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % colors.length;
  return colors[h];
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z" />
    </svg>
  );
}

function SentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L14 10h6V4l-2.35 2.35z" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 9.24 14.81 8.62 12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" />
    </svg>
  );
}

function ChevronIcon({
  className,
  up,
}: {
  className?: string;
  up?: boolean;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        d={
          up
            ? "M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"
            : "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"
        }
      />
    </svg>
  );
}

function SpamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM12 17.3c-.72 0-1.3-.58-1.3-1.3s.58-1.3 1.3-1.3 1.3.58 1.3 1.3-.58 1.3-1.3 1.3zm1-4.3h-2V7h2v6z" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.54 5.23 19.15 3.55A2 2 0 0 0 17.53 3H6.47a2 2 0 0 0-1.62.55L3.46 5.23A2 2 0 0 0 3 6.63V7h18v-.37a2 2 0 0 0-.46-1.4zM5.12 5l.81-.97h12.14l.81.97H5.12zM3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H3v10zm9-1-4-4h2.5V11h3v3H16l-4 4z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h-4V7h2v4h2z" />
    </svg>
  );
}

function DraftsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 13 3.74 7.84 12 3l8.26 4.84L12 13z" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function MailFolderButton({
  label,
  count,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  icon: (props: { className?: string }) => ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
          : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count ? (
        <span
          className={`text-[12px] tabular-nums ${
            active ? "text-[var(--foreground)]" : "text-[var(--muted-soft)]"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
      {children}
    </p>
  );
}

const openMessageCache = new Map<string, MailMessage>();

function openMessageKey(
  projectId: string,
  accountId: string,
  box: string,
  uid: number
) {
  return `${projectId}:${accountId}:${box}:${uid}`;
}

function hydrateMail(projectId: string) {
  const accounts = loadMailAccountsCache(projectId)?.data ?? [];
  const lastId = loadLastMailAccountId(projectId);
  const accountId =
    (lastId && accounts.some((a) => a.id === lastId) ? lastId : accounts[0]?.id) ??
    null;
  const messages = accountId
    ? loadMailInboxCache(projectId, accountId, "inbox")?.data ?? []
    : [];
  return { accounts, accountId, messages };
}

export function EmailsView({ projectId }: EmailsViewProps) {
  const hydrated = useMemo(() => hydrateMail(projectId), [projectId]);
  const [accounts, setAccounts] = useState<MailAccountPublic[]>(
    () => hydrated.accounts
  );
  const [accountId, setAccountId] = useState<string | null>(
    () => hydrated.accountId
  );
  const [messages, setMessages] = useState<MailListItem[]>(
    () => hydrated.messages
  );
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [mailbox, setMailbox] = useState<MailBox>("inbox");
  const [moreOpen, setMoreOpen] = useState(true);
  const [customFolders, setCustomFolders] = useState<{ path: string; name: string }[]>([]);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [query, setQuery] = useState("");

  const [loadingAccounts, setLoadingAccounts] = useState(
    () => hydrated.accounts.length === 0
  );
  const [loadingMessages, setLoadingMessages] = useState(
    () => Boolean(hydrated.accountId) && hydrated.messages.length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [connectOpen, setConnectOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapHost, setImapHost] = useState<string>(MAIL_DEFAULTS.imapHost);
  const [imapPort, setImapPort] = useState(String(MAIL_DEFAULTS.imapPort));
  const [smtpHost, setSmtpHost] = useState<string>(MAIL_DEFAULTS.smtpHost);
  const [smtpPort, setSmtpPort] = useState(String(MAIL_DEFAULTS.smtpPort));

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedSubject, setTranslatedSubject] = useState("");
  const [translatedBody, setTranslatedBody] = useState("");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [translateSkipped, setTranslateSkipped] = useState(false);

  const activeAccount =
    accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;

  const unread = useMemo(
    () =>
      mailbox === "inbox" ? messages.filter((m) => !m.seen).length : 0,
    [messages, mailbox]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        (m.to ?? "").toLowerCase().includes(q)
    );
  }, [messages, query]);

  const loadAccounts = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/mail/accounts`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load accounts");
        return;
      }
      const next = (data.accounts ?? []) as MailAccountPublic[];
      setAccounts(next);
      saveMailAccountsCache(projectId, next);
      setAccountId((prev) => {
        if (prev && next.some((a) => a.id === prev)) return prev;
        const last = loadLastMailAccountId(projectId);
        if (last && next.some((a) => a.id === last)) return last;
        return next[0]?.id ?? null;
      });
    } catch {
      setError("Network error loading accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }, [projectId]);

  const loadMessages = useCallback(
    async (id: string, opts?: { force?: boolean; box?: MailBox }) => {
      const box = opts?.box ?? mailbox;
      setError("");

      const cached = loadMailInboxCache(projectId, id, box);
      const hasCache = Boolean(cached?.data?.length);
      if (hasCache && !opts?.force) {
        setMessages(cached!.data);
        setLoadingMessages(false);
        setRefreshing(true);
      } else if (!hasCache) {
        setLoadingMessages(true);
        if (!cached) setMessages([]);
      } else {
        setRefreshing(true);
      }

      try {
        const params = new URLSearchParams({ limit: "25", box });
        if (opts?.force) params.set("force", "1");
        const res = await fetch(
          `/api/projects/${projectId}/mail/accounts/${id}/messages?${params}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not read mailbox");
          if (!hasCache) setMessages([]);
          return;
        }
        const next = (data.messages ?? []) as MailListItem[];
        setMessages(next);
        saveMailInboxCache(projectId, id, next, box);
      } catch {
        setError("Network error reading mailbox");
      } finally {
        setLoadingMessages(false);
        setRefreshing(false);
      }
    },
    [projectId, mailbox]
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accountId) {
      saveLastMailAccountId(projectId, accountId);
      const cached = loadMailInboxCache(projectId, accountId, mailbox);
      const cacheFresh =
        Boolean(cached) && Date.now() - cached!.savedAt < 10 * 60_000;
      void loadMessages(accountId, {
        box: mailbox,
        force: mailbox !== "inbox" && !cacheFresh ? true : undefined,
      });
    }
  }, [accountId, mailbox, loadMessages, projectId]);

  useEffect(() => {
    if (!accountId) {
      setCustomFolders([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/mail/accounts/${accountId}/folders`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setCustomFolders(Array.isArray(data.folders) ? data.folders : []);
      })
      .catch(() => {
        if (!cancelled) setCustomFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, projectId]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = () => setAccountMenuOpen(false);
    const t = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("click", close);
    };
  }, [accountMenuOpen]);

  async function connectAccount(e: FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/mail/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
          imapHost,
          imapPort: Number(imapPort) || MAIL_DEFAULTS.imapPort,
          smtpHost,
          smtpPort: Number(smtpPort) || MAIL_DEFAULTS.smtpPort,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not connect");
        return;
      }
      setConnectOpen(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      const account = data.account as MailAccountPublic;
      setAccounts((prev) => {
        const without = prev.filter((a) => a.id !== account.id);
        return [...without, account];
      });
      setAccountId(account.id);
    } catch {
      setError("Network error connecting");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectAccount(id: string) {
    if (!confirm("Disconnect this email account?")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/mail/accounts/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not disconnect");
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (accountId === id) {
        setAccountId(null);
        setMessages([]);
        setMessage(null);
      }
    } catch {
      setError("Network error disconnecting");
    }
  }

  async function translateMessage(msg: MailMessage) {
    setTranslating(true);
    setShowTranslated(false);
    setTranslateSkipped(false);
    setTranslatedSubject("");
    setTranslatedBody("");
    setDetectedLang(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          target: "es",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not translate");
        return;
      }
      setDetectedLang(data.detectedSourceLanguage ?? null);
      if (data.skipped) {
        setTranslateSkipped(true);
        setShowTranslated(false);
        return;
      }
      setTranslatedSubject(data.subject || msg.subject);
      setTranslatedBody(data.text || "");
      setShowTranslated(true);
    } catch {
      setError("Network error translating");
    } finally {
      setTranslating(false);
    }
  }

  async function openMessage(uid: number) {
    if (!accountId) return;
    setSelectedUid(uid);
    setMode("read");
    setError("");
    setShowTranslated(false);
    setTranslateSkipped(false);
    setTranslatedSubject("");
    setTranslatedBody("");
    setDetectedLang(null);

    const cacheKey = openMessageKey(projectId, accountId, mailbox, uid);
    const local = openMessageCache.get(cacheKey);
    if (local) {
      setMessage(local);
      setLoadingMessage(false);
      setMessages((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m))
      );
      void translateMessage(local);
      return;
    }

    setLoadingMessage(true);
    try {
      const listed = messages.find((m) => m.uid === uid);
      const params = new URLSearchParams({ box: mailbox });
      if (listed?.mailboxPath) params.set("path", listed.mailboxPath);
      const res = await fetch(
        `/api/projects/${projectId}/mail/accounts/${accountId}/messages/${uid}?${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not open message");
        setMessage(null);
        return;
      }
      const msg = data.message as MailMessage;
      openMessageCache.set(cacheKey, msg);
      setMessage(msg);
      setMessages((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m))
      );
      void translateMessage(msg);
    } catch {
      setError("Network error opening message");
    } finally {
      setLoadingMessage(false);
    }
  }

  const langLabel = (code: string | null) => {
    if (!code) return "another language";
    const map: Record<string, string> = {
      en: "English",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      zh: "Chinese",
      ja: "Japanese",
      ko: "Korean",
      ru: "Russian",
      ar: "Arabic",
      nl: "Dutch",
      pl: "Polish",
      tr: "Turkish",
      hi: "Hindi",
      es: "Spanish",
    };
    return map[code.toLowerCase().slice(0, 2)] || code;
  };

  function startCompose() {
    setMode("compose");
    setTo("");
    setSubject("");
    setBody("");
  }

  function startReply() {
    if (!message) return;
    setMode("reply");
    const fromAddr =
      message.from.match(/<([^>]+)>/)?.[1] || message.from.trim();
    setTo(fromAddr);
    setSubject(
      message.subject.toLowerCase().startsWith("re:")
        ? message.subject
        : `Re: ${message.subject}`
    );
    setBody(
      `\n\n---\nOn ${formatFullDate(message.date)}, ${message.from} wrote:\n${
        message.text || ""
      }`
    );
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/mail/accounts/${accountId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject,
            text: body,
            inReplyTo: mode === "reply" ? message?.messageId : undefined,
            references: mode === "reply" ? message?.messageId : undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send");
        return;
      }
      setMode(message ? "read" : "list");
      setTo("");
      setSubject("");
      setBody("");
      if (accountId) void loadMessages(accountId, { force: true });
    } catch {
      setError("Network error sending");
    } finally {
      setSending(false);
    }
  }

  const composing = mode === "compose" || mode === "reply";

  function openBox(box: MailBox) {
    setMailbox(box);
    setMode("list");
    setSelectedUid(null);
    setMessage(null);
    if (accountId) {
      const cached = loadMailInboxCache(projectId, accountId, box);
      if (cached?.data?.length) setMessages(cached.data);
    }
  }

  async function createFolder(e: FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    const name = newFolderName.trim();
    if (!name) return;
    setSavingFolder(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/mail/accounts/${accountId}/folders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la carpeta");
      const folder = data.folder as { path: string; name: string };
      setCustomFolders((prev) =>
        prev.some((f) => f.path === folder.path) ? prev : [...prev, folder]
      );
      setNewFolderName("");
      setAddingFolder(false);
      openBox(customFolderBox(folder.path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la carpeta");
    } finally {
      setSavingFolder(false);
    }
  }

  function selectAccount(id: string) {
    setAccountMenuOpen(false);
    setAccountId(id);
    setMode("list");
    setSelectedUid(null);
    setMessage(null);
    const cached = loadMailInboxCache(projectId, id, mailbox);
    if (cached?.data?.length) setMessages(cached.data);
  }

  function accountMenu(placement: "rail" | "header") {
    if (!accountMenuOpen || !activeAccount) return null;
    return (
    <div
      className={`absolute z-30 w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-white py-3 shadow-[0_8px_24px_rgba(17,24,39,0.12)] ${
        placement === "rail"
          ? "right-full top-0 mr-2"
          : "right-0 top-full mt-2"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center px-4 pb-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold text-white"
          style={{ background: avatarColor(activeAccount.email) }}
        >
          {initials(
            activeAccount.display_name || activeAccount.email.split("@")[0]
          )}
        </div>
        <p className="mt-2 text-[14px] font-medium text-[var(--foreground)]">
          {activeAccount.display_name || activeAccount.email.split("@")[0]}
        </p>
        <p className="truncate text-[12px] text-[var(--muted)]">
          {activeAccount.email}
        </p>
      </div>
      <div className="border-t border-[var(--border)] px-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setAccountMenuOpen(false);
            setConnectOpen(true);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--foreground)] hover:bg-[var(--background)]"
        >
          <PlusIcon className="h-4 w-4 text-[var(--muted)]" />
          Añadir cuenta
        </button>
        <button
          type="button"
          onClick={() => {
            setAccountMenuOpen(false);
            void disconnectAccount(activeAccount.id);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#d93025] hover:bg-[#fce8e6]"
        >
          <TrashIcon className="h-4 w-4" />
          Desconectar
        </button>
      </div>
    </div>
    );
  }

  function renderAccountButtons(prefix: string, showName = false) {
    return accounts.map((account) => {
    const local = account.email.split("@")[0];
    const domain = account.email.includes("@")
      ? `@${account.email.split("@")[1]}`
      : "";
    const label = account.display_name || local;
    const active = account.id === activeAccount?.id;
    return (
      <button
        key={`${prefix}-${account.id}`}
        type="button"
        title={account.email}
        onClick={(e) => {
          e.stopPropagation();
          if (active) setAccountMenuOpen((v) => !v);
          else selectAccount(account.id);
        }}
        className={`flex flex-col items-center gap-1 ${
          showName ? "w-full px-1" : ""
        }`}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white transition ${
            active
              ? "ring-2 ring-[var(--accent)] ring-offset-2"
              : "opacity-80 hover:opacity-100"
          }`}
          style={{ background: avatarColor(account.email) }}
        >
          {initials(label)}
        </span>
        {showName ? (
          <span className="w-full text-center leading-tight">
            <span
              className={`block truncate text-[10px] ${
                active ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--muted)]"
              }`}
            >
              {label}
            </span>
            {domain ? (
              <span className="block truncate text-[9px] text-[var(--muted-soft)]">
                {domain}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    );
  });
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
            {activeAccount
              ? initials(activeAccount.display_name || activeAccount.email.split("@")[0])
              : "E"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
              Emails
            </p>
            <p className="truncate text-[11px] text-[var(--muted-soft)]">
              {activeAccount?.email || "Sin cuenta"}
            </p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <button
            type="button"
            disabled={!activeAccount}
            onClick={startCompose}
            className="mb-2 flex w-full items-center gap-2.5 rounded-lg bg-[#c2e7ff] px-2.5 py-2 text-left text-[13px] font-semibold text-[#001d35] disabled:opacity-40"
          >
            <PenIcon className="h-4 w-4" />
            Redactar
          </button>
          <MailFolderButton
            label="Bandeja de entrada"
            count={unread || undefined}
            active={mailbox === "inbox" && !composing}
            icon={InboxIcon}
            onClick={() => openBox("inbox")}
          />
          <MailFolderButton
            label="Marcado como favorito"
            active={mailbox === "starred" && !composing}
            icon={StarIcon}
            onClick={() => openBox("starred")}
          />
          <MailFolderButton
            label="Enviado"
            active={mailbox === "sent" && !composing}
            icon={SentIcon}
            onClick={() => openBox("sent")}
          />
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            <ChevronIcon className="h-4 w-4 shrink-0" up={moreOpen} />
            {moreOpen ? "Menos" : "Más"}
          </button>
          {moreOpen ? (
            <>
              <SectionLabel>Carpetas</SectionLabel>
              <MailFolderButton
                label="Spam"
                active={mailbox === "spam" && !composing}
                icon={SpamIcon}
                onClick={() => openBox("spam")}
              />
              <MailFolderButton
                label="Archivar"
                active={mailbox === "archive" && !composing}
                icon={ArchiveIcon}
                onClick={() => openBox("archive")}
              />
              <MailFolderButton
                label="Papelera"
                active={mailbox === "trash" && !composing}
                icon={TrashIcon}
                onClick={() => openBox("trash")}
              />
              <MailFolderButton
                label="Programado"
                active={mailbox === "scheduled" && !composing}
                icon={ClockIcon}
                onClick={() => openBox("scheduled")}
              />
              <MailFolderButton
                label="Borradores"
                active={mailbox === "drafts" && !composing}
                icon={DraftsIcon}
                onClick={() => openBox("drafts")}
              />
              {customFolders.map((folder) => (
                <MailFolderButton
                  key={folder.path}
                  label={folder.name}
                  active={mailbox === customFolderBox(folder.path) && !composing}
                  icon={FolderIcon}
                  onClick={() => openBox(customFolderBox(folder.path))}
                />
              ))}
              {addingFolder ? (
                <form onSubmit={(e) => void createFolder(e)} className="px-1.5 py-1">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nombre de carpeta"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
                  />
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="submit"
                      disabled={savingFolder || !newFolderName.trim()}
                      className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
                    >
                      {savingFolder ? "…" : "Crear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingFolder(false);
                        setNewFolderName("");
                      }}
                      className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--background)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <MailFolderButton
                  label="Añadir carpeta"
                  active={false}
                  icon={PlusIcon}
                  onClick={() => activeAccount && setAddingFolder(true)}
                />
              )}
            </>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 px-4 py-3">
          <label className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-soft)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar correo"
              className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
            />
          </label>
          <button
            type="button"
            disabled={!activeAccount || loadingMessages || refreshing}
            onClick={() =>
              activeAccount &&
              void loadMessages(activeAccount.id, {
                force: true,
                box: mailbox,
              })
            }
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:opacity-40"
            title="Refresh"
          >
            <RefreshIcon
              className={`h-4 w-4 ${refreshing || loadingMessages ? "animate-spin" : ""}`}
            />
          </button>
          {loadingAccounts ? (
            <span className="text-[12px] text-[#5f6368]">Loading…</span>
          ) : null}
          <div className="relative flex shrink-0 items-center gap-1.5 md:hidden">
            {renderAccountButtons("header")}
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              title="Añadir cuenta"
              aria-label="Añadir cuenta"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--muted-soft)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            {accountMenu("header")}
          </div>
        </header>

        <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-3 pb-2 md:hidden">
          <button
            type="button"
            disabled={!activeAccount}
            onClick={startCompose}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#c2e7ff] px-3 text-[13px] font-semibold text-[#001d35] disabled:opacity-40"
          >
            <PenIcon className="h-4 w-4" />
            Redactar
          </button>
          {(
            [
              ["inbox", "Entrada"],
              ["starred", "Favoritos"],
              ["sent", "Enviado"],
              ["spam", "Spam"],
              ["trash", "Papelera"],
              ["drafts", "Borradores"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => openBox(id)}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] ${
                mailbox === id
                  ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
                  : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
              {id === "inbox" && unread > 0 ? (
                <span className="text-[12px]">{unread}</span>
              ) : null}
            </button>
          ))}
        </div>

        <main className="mx-4 mb-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
          {mode === "read" ? (
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setMode("list");
                  setSelectedUid(null);
                  setMessage(null);
                }}
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                title="Back"
              >
                <BackIcon className="h-5 w-5" />
              </button>
              <span className="text-[13px] font-medium text-[var(--muted)]">
                {mailBoxLabel(mailbox)}
              </span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <span className="text-[13px] font-semibold text-[var(--foreground)]">
                {mailBoxLabel(mailbox)}
              </span>
              {mailbox === "inbox" && unread > 0 ? (
                <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                  {unread} nuevos
                </span>
              ) : null}
            </div>
          )}

        {error ? (
          <div className="border-b border-[#fad2cf] bg-[#fce8e6] px-4 py-2 text-[13px] text-[#d93025]">
            {error}
          </div>
        ) : null}

        {mode === "read" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {loadingMessage ? (
              <div className="flex flex-1 items-center justify-center text-[14px] text-[#5f6368]">
                Opening message…
              </div>
            ) : message ? (
              <>
                {(translating || showTranslated || translateSkipped) && (
                  <div className="flex items-center justify-between gap-3 border-b border-[#d2e3fc] bg-[#e8f0fe] px-6 py-2.5 text-[13px] text-[#174ea6]">
                    <span>
                      {translating
                        ? "Translating with Google…"
                        : translateSkipped
                          ? "This message already appears to be in Spanish"
                          : `Translated from ${langLabel(detectedLang)} with Google`}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {!translating && !translateSkipped ? (
                        <button
                          type="button"
                          onClick={() => setShowTranslated((v) => !v)}
                          className="rounded-full px-3 py-1 font-medium text-[#0b57d0] hover:bg-white/70"
                        >
                          {showTranslated ? "View original" : "View translation"}
                        </button>
                      ) : null}
                      {!translating && translateSkipped ? (
                        <button
                          type="button"
                          onClick={() => void translateMessage(message)}
                          className="rounded-full px-3 py-1 font-medium text-[#0b57d0] hover:bg-white/70"
                        >
                          Translate anyway
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                  <h1 className="text-[22px] font-normal leading-tight text-[#202124]">
                    {showTranslated && translatedSubject
                      ? translatedSubject
                      : message.subject}
                  </h1>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={translating}
                      onClick={() => void translateMessage(message)}
                      className="rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe] disabled:opacity-50"
                    >
                      {translating ? "Translating…" : "Translate"}
                    </button>
                    <button
                      type="button"
                      onClick={startReply}
                      className="rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
                    >
                      Reply
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-b border-[#eeeeee] px-6 py-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-medium text-white"
                    style={{
                      background: avatarColor(senderName(message.from)),
                    }}
                  >
                    {initials(senderName(message.from))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14px] font-semibold">
                        {senderName(message.from)}
                      </span>
                      <span className="text-[12px] text-[#5f6368]">
                        &lt;{message.from.match(/<([^>]+)>/)?.[1] || message.from}&gt;
                      </span>
                      <span className="ml-auto text-[12px] text-[#5f6368]">
                        {formatFullDate(message.date)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#5f6368]">
                      to {message.to || "me"}
                    </p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  {showTranslated && translatedBody ? (
                    <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[#202124]">
                      {translatedBody}
                    </pre>
                  ) : message.html ? (
                    <iframe
                      title="Message"
                      sandbox=""
                      className="h-full min-h-[360px] w-full border-0"
                      srcDoc={message.html}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[#202124]">
                      {message.text || "(no content)"}
                    </pre>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!activeAccount ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="text-[18px] text-[#202124]">No accounts</p>
                <p className="mt-1 max-w-sm text-[14px] text-[#5f6368]">
                  Connect your Hostinger email.
                </p>
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="mt-4 rounded-lg bg-[var(--accent)] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  Connect email
                </button>
              </div>
            ) : loadingMessages && messages.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-[14px] text-[#5f6368]">
                Loading messages…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-[14px] text-[#5f6368]">
                {query
                  ? "Sin resultados"
                  : mailbox === "inbox"
                    ? "La bandeja está vacía"
                    : `No hay correos en ${mailBoxLabel(mailbox).toLowerCase()}`}
              </div>
            ) : (
              <ul>
                {filtered.map((m) => {
                  const name = senderName(
                    mailbox === "sent" ? m.to || m.from : m.from
                  );
                  const active = m.uid === selectedUid;
                  const snippet = (m.snippet || "").replace(/\s+/g, " ").trim();
                  return (
                    <li key={m.uid}>
                      <button
                        type="button"
                        onClick={() => void openMessage(m.uid)}
                        className={`group flex h-11 w-full items-center gap-1 border-b border-[var(--border)] px-2 text-left text-[13px] transition hover:bg-[var(--background)] ${
                          active ? "bg-[var(--surface-alt)]" : "bg-white"
                        }`}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center">
                          <StarIcon className="h-4 w-4 text-[#e5e7eb] group-hover:text-[var(--muted-soft)]" />
                        </span>
                        <span
                          className={`w-[168px] shrink-0 truncate pr-3 ${
                            m.seen
                              ? "font-medium text-[var(--muted)]"
                              : "font-semibold text-[var(--foreground)]"
                          }`}
                        >
                          {mailbox === "sent" ? `To: ${name}` : name}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
              <span className={m.seen ? "font-medium" : "font-semibold"}>
                            {m.subject}
                          </span>
                          {snippet ? (
                            <span className="text-[#5f6368]">
                              {" — "}
                              {snippet}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`w-[88px] shrink-0 pr-2 text-right text-[12px] ${
                            m.seen
                              ? "font-medium text-[var(--muted-soft)]"
                              : "font-semibold text-[var(--foreground)]"
                          }`}
                        >
                          {formatListDate(m.date)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </main>
      </div>

      <aside className="relative hidden w-24 shrink-0 flex-col items-center gap-3 border-l border-[var(--border)] bg-white py-3 md:flex">
        {renderAccountButtons("rail", true)}
        <button
          type="button"
          onClick={() => {
            setAccountMenuOpen(false);
            setConnectOpen(true);
          }}
          title="Añadir cuenta"
          aria-label="Añadir cuenta"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--muted-soft)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
        {accountMenu("rail")}
      </aside>

      {/* Compose window — Gmail floating card */}
      {composing ? (
        <form
          onSubmit={(e) => void sendMessage(e)}
          className="absolute bottom-0 right-24 z-20 flex h-[480px] w-[520px] flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_8px_10px_1px_rgba(0,0,0,0.14),0_3px_14px_2px_rgba(0,0,0,0.12),0_5px_5px_-3px_rgba(0,0,0,0.2)]"
        >
          <div className="flex items-center justify-between bg-[#404040] px-4 py-2.5 text-white">
            <p className="text-[14px] font-medium">
              {mode === "reply" ? "Reply" : "New message"}
            </p>
            <button
              type="button"
              onClick={() => setMode(message ? "read" : "list")}
              className="rounded p-1 hover:bg-white/10"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-[#eceff1] px-4">
            <label className="flex items-center gap-2 py-2 text-[14px]">
              <span className="w-10 text-[#5f6368]">To</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                className="min-w-0 flex-1 outline-none"
              />
            </label>
          </div>
          <div className="border-b border-[#eceff1] px-4">
            <label className="flex items-center gap-2 py-2 text-[14px]">
              <span className="w-10 text-[#5f6368]">Subject</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="min-w-0 flex-1 outline-none"
              />
            </label>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className="min-h-0 flex-1 resize-none px-4 py-3 text-[14px] leading-relaxed outline-none"
            placeholder="Compose your message"
          />
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-[var(--accent)] px-6 py-2 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setMode(message ? "read" : "list")}
              className="rounded-full px-3 py-2 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              Discard
            </button>
          </div>
        </form>
      ) : null}

      {connectOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => void connectAccount(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-[20px] font-normal text-[#202124]">
              Connect email
            </h3>
            <p className="mt-1 text-[13px] text-[#5f6368]">
              IMAP Hostinger · imap.hostinger.com:993 · smtp.hostinger.com:465
            </p>
            <div className="mt-5 space-y-3">
              <label className="block text-[13px] font-medium text-[#3c4043]">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-[#dadce0] px-3 py-2 text-[14px] outline-none focus:border-[#1a73e8]"
                  placeholder="legal@moun.app"
                />
              </label>
              <label className="block text-[13px] font-medium text-[#3c4043]">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded border border-[#dadce0] px-3 py-2 text-[14px] outline-none focus:border-[#1a73e8]"
                />
              </label>
              <label className="block text-[13px] font-medium text-[#3c4043]">
                Name (optional)
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded border border-[#dadce0] px-3 py-2 text-[14px] outline-none focus:border-[#1a73e8]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-4 text-[13px] font-medium text-[#1a73e8]"
            >
              {showAdvanced ? "Hide" : "Show"} advanced settings
            </button>
            {showAdvanced ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[12px] text-[#5f6368]">
                  IMAP host
                  <input
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="mt-1 w-full rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                  />
                </label>
                <label className="text-[12px] text-[#5f6368]">
                  IMAP port
                  <input
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    className="mt-1 w-full rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                  />
                </label>
                <label className="text-[12px] text-[#5f6368]">
                  SMTP host
                  <input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="mt-1 w-full rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                  />
                </label>
                <label className="text-[12px] text-[#5f6368]">
                  SMTP port
                  <input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="mt-1 w-full rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                  />
                </label>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConnectOpen(false);
                  setError("");
                }}
                className="rounded-full px-4 py-2 text-[14px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={connecting}
                className="rounded-full bg-[#0b57d0] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#0842a0] disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
