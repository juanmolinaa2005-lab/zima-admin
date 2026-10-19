"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  isSocialPlatform,
  PLATFORM_META,
  type SocialAccountPublic,
  type SocialPlatform,
} from "@/lib/redes/types";
import {
  displayNameFromMeta,
  parseProfileUrl,
  type ProfileMeta,
} from "@/lib/viewtracker/profile";
import { PlatformLogo } from "./vt-ui";

type MailAccount = { id: string; email: string };
type Channel = "email" | "profile";

type RequestSettings = {
  fromEmail: string;
  subject: string;
  template: string;
};

const DEFAULT_SETTINGS: RequestSettings = {
  fromEmail: "",
  subject: "Colaboración con #name",
  template: `Hola #name,

Me encantaría colaborar contigo.

Quedo atento a tu respuesta.

Un saludo,`,
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
      <p className="text-[12px] text-[#b45309]">Pega un link de perfil válido</p>
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
          {meta.username ? `@${meta.username}` : meta.platform || "Perfil"}
        </p>
        <p className="truncate text-[11px] text-[var(--muted-soft)]">
          {meta.platform ? `${meta.platform} · ` : ""}
          {meta.normalizedUrl}
        </p>
      </div>
    </div>
  );
}

const CONNECTORS: SocialPlatform[] = ["tiktok", "instagram", "youtube", "x", "facebook"];

/** Opens the DM thread directly where the network has a public link for it; otherwise the profile. */
function dmHref(meta: ProfileMeta) {
  if (meta.username && meta.platform === "instagram") return `https://ig.me/m/${encodeURIComponent(meta.username)}`;
  if (meta.username && meta.platform === "facebook") return `https://m.me/${encodeURIComponent(meta.username)}`;
  return meta.normalizedUrl;
}

function ConnectorBar({
  accounts,
  connecting,
  onConnect,
}: {
  accounts: SocialAccountPublic[];
  connecting: SocialPlatform | null;
  onConnect: (platform: SocialPlatform) => void;
}) {
  return (
    <div className="grid grid-cols-5 overflow-hidden rounded-[20px] border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
      {CONNECTORS.map((platform, i) => {
        const account = accounts.find((a) => a.platform === platform && a.status === "active");
        const label = PLATFORM_META[platform].label;
        return (
          <button
            key={platform}
            type="button"
            onClick={() => onConnect(platform)}
            disabled={connecting === platform}
            title={account ? `${label} conectado${account.username ? ` como @${account.username}` : ""}` : `Conectar ${label}`}
            className={`group relative flex min-w-0 flex-col items-center gap-2 px-2 py-4 transition hover:bg-[var(--surface-alt)]/60 disabled:opacity-60 ${
              i > 0 ? "border-l border-[var(--border)]" : ""
            }`}
          >
            <span className="relative">
              <PlatformLogo id={platform} className={`h-7 w-7 transition ${account ? "" : "opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0"}`} />
              {account ? (
                <span className="absolute -bottom-1 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#16a34a]" aria-hidden />
              ) : null}
            </span>
            <span className="w-full min-w-0 text-center">
              <span className="block truncate text-[12px] font-semibold text-[var(--foreground)]">
                {account?.username ? `@${account.username}` : label}
              </span>
              <span className={`block truncate text-[11px] ${account ? "text-[#16a34a]" : "text-[var(--muted-soft)] group-hover:text-[var(--foreground)]"}`}>
                {connecting === platform ? "Conectando…" : account ? "Conectado" : "Conectar"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type RequestsPageProps = {
  projectId: string;
};

export function RequestsPage({ projectId }: RequestsPageProps) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("email");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SETTINGS.subject);
  const [template, setTemplate] = useState(DEFAULT_SETTINGS.template);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [social, setSocial] = useState<SocialAccountPublic[]>([]);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [savedFlash, setSavedFlash] = useState("");
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/viewtracker/requests`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo cargar la plantilla");

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
            err instanceof Error ? err.message : "No se pudo cargar la plantilla",
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

  const loadSocial = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/redes/accounts`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.accounts)) setSocial(data.accounts as SocialAccountPublic[]);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${projectId}/redes/accounts`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (live && Array.isArray(data?.accounts)) setSocial(data.accounts as SocialAccountPublic[]);
      })
      .catch(() => {});
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; ok?: boolean; message?: string } | null;
      if (msg?.type !== "zima-redes-oauth") return;
      setConnecting(null);
      if (msg.ok) {
        toast.success("Cuenta conectada");
        void loadSocial();
      } else if (msg.message) {
        toast.error(msg.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      live = false;
      window.removeEventListener("message", onMessage);
    };
  }, [projectId, loadSocial]);

  useEffect(() => {
    if (!templateOpen) return;
    const onDown = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) setTemplateOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTemplateOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [templateOpen]);

  async function connect(platform: SocialPlatform) {
    const url = `/api/projects/${projectId}/redes/oauth/${platform}/start`;
    setConnecting(platform);
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.type !== "opaqueredirect" && !res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo conectar ${PLATFORM_META[platform].label}`, {
          description: data.error || "Revisa sus credenciales en Ajustes → API.",
        });
        setConnecting(null);
        return;
      }
    } catch {
      /* the popup below surfaces any real failure */
    }
    const w = window.open(url, `zima-${platform}-oauth`, "width=640,height=760");
    if (!w) {
      window.location.href = url;
      return;
    }
    const timer = window.setInterval(() => {
      if (w.closed) {
        window.clearInterval(timer);
        setConnecting(null);
        void loadSocial();
      }
    }, 800);
  }

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
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      clearLegacyLocal(projectId);
      setSavedFlash("Guardado");
      window.setTimeout(() => setSavedFlash(""), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
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

  const dmPlatform = profileMeta?.platform && isSocialPlatform(profileMeta.platform) ? profileMeta.platform : null;
  const dmAccount = dmPlatform ? social.find((a) => a.platform === dmPlatform && a.status === "active") ?? null : null;

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
        setError(`Rellena #${tag} antes de enviar.`);
        return;
      }
    }

    if (channel === "email") {
      const to = toEmail.trim();
      if (!to) {
        setError("Falta el email del destinatario.");
        return;
      }
      if (!fromEmail.trim()) {
        setError("Elige tu email de envío en Plantilla.");
        setTemplateOpen(true);
        return;
      }
      if (!fromAccount) {
        setError(`Conecta “${fromEmail}” en Emails primero: los envíos salen desde ese buzón.`);
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
        if (!res.ok) throw new Error(data.error || "No se pudo enviar");

        await logOutreach({
          channel: "email",
          status: "pending",
          toEmail: to,
          profileUrl: profileUrl.trim() || undefined,
        });

        setOk(`Enviado a ${to}. Lo verás en Respuestas.`);
        setToEmail("");
        setProfileUrl("");
        setTagValues({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo enviar");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!profileUrl.trim() || !profileMeta) {
      setError("Pega un link de perfil válido.");
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

      window.open(dmHref(profileMeta), "_blank", "noopener,noreferrer");
      setOk(
        dmAccount?.username
          ? `Mensaje copiado. Pégalo y envíalo desde @${dmAccount.username}. Lo verás en Respuestas.`
          : "Mensaje copiado. Pégalo en el chat y envíalo. Lo verás en Respuestas.",
      );
      setTagValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el mensaje");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)] focus:bg-white";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-[13px] text-[var(--muted-soft)]">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Mensajes
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Conecta tus redes y escribe a los creadores por email o DM. Cada mensaje queda registrado.
          </p>
        </div>

        <div ref={templateRef} className="relative">
          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            aria-expanded={templateOpen}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition ${
              templateOpen
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path
                d="M4.5 19.5h3.75L18.6 9.15a2.12 2.12 0 0 0-3-3L5.25 16.5zM13.5 8.25l3 3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Plantilla
            <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform duration-200 ${templateOpen ? "rotate-180" : ""}`} fill="none" aria-hidden>
              <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {templateOpen ? (
            <div className="animate-scale-in absolute right-0 top-full z-30 mt-2 w-[min(520px,calc(100vw-32px))] origin-top-right rounded-[20px] border border-[var(--border)] bg-white p-4 shadow-[0_24px_60px_-12px_rgba(17,24,39,0.35)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-[var(--foreground)]">Plantilla del mensaje</p>
                <span className={`text-[12px] font-medium ${savedFlash ? "text-[#16a34a]" : "text-[var(--muted-soft)]"}`}>
                  {saving ? "Guardando…" : savedFlash || "Se guarda sola"}
                </span>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Desde (email)</span>
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
                      <option value="">Elige tu email…</option>
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
                      placeholder="tu@empresa.com"
                      className={inputClass}
                    />
                  )}
                  {fromEmail && !fromAccount && accounts.length > 0 ? (
                    <span className="mt-1 block text-[11px] text-[#b45309]">Conecta este buzón en Emails para enviar</span>
                  ) : accounts.length === 0 ? (
                    <span className="mt-1 block text-[11px] text-[var(--muted-soft)]">Conecta un buzón en Emails para enviar</span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Asunto</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onBlur={() => void persist({ subject })}
                    placeholder="Colaboración con #name"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Mensaje</span>
                    <span className="text-[11px] text-[var(--muted-soft)]">
                      {tags.length ? tags.map((t) => `#${t}`).join(", ") : "Usa etiquetas como #name"}
                    </span>
                  </span>
                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    onBlur={() => void persist({ template })}
                    rows={9}
                    spellCheck
                    placeholder={`Hola #name,\n\nEscribe tu mensaje…`}
                    className={`${inputClass} min-h-[180px] resize-y leading-relaxed`}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    await persist({ fromEmail, subject, template });
                    setTemplateOpen(false);
                  }}
                  className="rounded-xl bg-[var(--foreground)] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  Listo
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConnectorBar accounts={social} connecting={connecting} onConnect={(p) => void connect(p)} />

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

      <form onSubmit={handleSend} className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <FieldCard label="Enviar por" hint="Email o DM">
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-0.5">
              {(["email", "profile"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChannel(id)}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    channel === id
                      ? "bg-[var(--foreground)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {id === "email" ? "Email" : "DM"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
              {channel === "email"
                ? "Se envía desde tu buzón conectado y queda registrado."
                : "Abre el chat con el creador y copia el mensaje para que solo tengas que pegarlo y enviarlo."}
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
                    placeholder={`Valor de #${tag}`}
                    className={inputClass}
                  />
                </FieldCard>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[13px] text-[var(--muted-soft)]">
              La plantilla no tiene etiquetas. Añade por ejemplo #name en Plantilla.
            </div>
          )}

          {channel === "email" ? (
            <FieldCard label="Para" hint="Email del creador">
              <input
                type="email"
                required
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="creador@email.com"
                className={inputClass}
              />
            </FieldCard>
          ) : null}

          <FieldCard
            label="Perfil del creador"
            hint={channel === "profile" ? "Obligatorio" : "Opcional, para el registro"}
          >
            <input
              type="url"
              required={channel === "profile"}
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://instagram.com/usuario"
              className={inputClass}
            />
            {profileUrl.trim() ? <ProfilePreview url={profileUrl} /> : null}
            {channel === "profile" && dmPlatform ? (
              dmAccount ? (
                <p className="mt-2 text-[12px] text-[#16a34a]">
                  Se enviará desde {dmAccount.username ? `@${dmAccount.username}` : `tu cuenta de ${PLATFORM_META[dmPlatform].label}`}
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[#b45309]">
                  Conecta tu cuenta de {PLATFORM_META[dmPlatform].label} arriba para enviar desde ella.
                </p>
              )
            ) : null}
          </FieldCard>
        </div>

        <FieldCard label="Vista previa" className="lg:col-start-2 lg:row-start-1">
          <p className="text-[12px] text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground-soft)]">Por</span>{" "}
            {channel === "email" ? "Email" : "DM"}
            {channel === "email" ? (
              <>
                <span className="mx-2 text-[#d1d5db]">·</span>
                <span className="font-medium text-[var(--foreground-soft)]">Desde</span>{" "}
                {fromEmail || "—"}
                <span className="mx-2 text-[#d1d5db]">·</span>
                <span className="font-medium text-[var(--foreground-soft)]">Para</span>{" "}
                {toEmail || "—"}
              </>
            ) : (
              <>
                <span className="mx-2 text-[#d1d5db]">·</span>
                <span className="font-medium text-[var(--foreground-soft)]">Desde</span>{" "}
                {dmAccount?.username ? `@${dmAccount.username}` : "—"}
                <span className="mx-2 text-[#d1d5db]">·</span>
                <span className="font-medium text-[var(--foreground-soft)]">Para</span>{" "}
                {profileMeta?.username ? `@${profileMeta.username}` : profileUrl || "—"}
              </>
            )}
          </p>
          {channel === "email" ? (
            <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">
              {filledSubject || "—"}
            </p>
          ) : null}
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--foreground-soft)]">
            {filledBody || "—"}
          </pre>
        </FieldCard>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {sending
              ? channel === "email"
                ? "Enviando…"
                : "Abriendo…"
              : channel === "email"
                ? "Enviar email"
                : "Abrir chat y copiar mensaje"}
          </button>
          {channel === "profile" ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(filledBody);
                  setOk("Mensaje copiado.");
                  setError("");
                } catch {
                  setError("No se pudo copiar.");
                }
              }}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--foreground-soft)] hover:bg-[var(--background)]"
            >
              Copiar
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
