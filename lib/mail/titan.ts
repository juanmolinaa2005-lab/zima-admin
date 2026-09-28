import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { MAIL_DEFAULTS } from "@/lib/mail/defaults";
import {
  customFolderPath,
  isSystemMailBox,
  type MailBox,
  type SystemMailBox,
} from "@/lib/mail/boxes";

export { MAIL_DEFAULTS };
export type { MailBox } from "@/lib/mail/boxes";

export type MailAccountCreds = {
  email: string;
  password: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
};

export type MailListItem = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
  snippet: string;
  mailboxPath?: string;
};

export type MailMessage = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string | null;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
};

function clientFor(creds: MailAccountCreds) {
  return new ImapFlow({
    host: creds.imapHost || MAIL_DEFAULTS.imapHost,
    port: creds.imapPort || MAIL_DEFAULTS.imapPort,
    secure: true,
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 25_000,
  });
}

type PoolSlot = {
  client: ImapFlow | null;
  chain: Promise<void>;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const imapPool = new Map<string, PoolSlot>();
const POOL_IDLE_MS = 45_000;

function poolKey(creds: MailAccountCreds) {
  return [
    creds.email,
    creds.imapHost || MAIL_DEFAULTS.imapHost,
    creds.imapPort || MAIL_DEFAULTS.imapPort,
  ].join("\0");
}

function destroySlot(key: string, slot: PoolSlot) {
  if (slot.idleTimer) {
    clearTimeout(slot.idleTimer);
    slot.idleTimer = null;
  }
  if (slot.client) {
    try {
      slot.client.close();
    } catch {
      /* ignore */
    }
    slot.client = null;
  }
  imapPool.delete(key);
}

function scheduleIdleClose(key: string, slot: PoolSlot) {
  if (slot.idleTimer) clearTimeout(slot.idleTimer);
  slot.idleTimer = setTimeout(() => {
    const current = imapPool.get(key);
    if (current === slot) destroySlot(key, slot);
  }, POOL_IDLE_MS);
}

async function withImap<T>(
  creds: MailAccountCreds,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const key = poolKey(creds);
  let slot = imapPool.get(key);
  if (!slot) {
    slot = { client: null, chain: Promise.resolve(), idleTimer: null };
    imapPool.set(key, slot);
  }

  let release!: () => void;
  const prev = slot.chain.catch(() => undefined);
  slot.chain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;

  try {
    if (!slot.client?.usable) {
      if (slot.client) {
        try {
          slot.client.close();
        } catch {
          /* ignore */
        }
      }
      const client = clientFor(creds);
      await client.connect();
      slot.client = client;
    }
    const result = await fn(slot.client);
    scheduleIdleClose(key, slot);
    return result;
  } catch (err) {
    const broken = !slot.client?.usable;
    if (broken) destroySlot(key, slot);
    else scheduleIdleClose(key, slot);
    throw err;
  } finally {
    release();
  }
}

async function closeClient(client: ImapFlow) {
  try {
    client.close();
  } catch {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

export async function verifyMailCredentials(
  creds: MailAccountCreds
): Promise<void> {
  const client = clientFor(creds);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    lock.release();
  } finally {
    await closeClient(client);
  }
}

function addrList(
  value:
    | { text?: string; value?: { address?: string; name?: string }[] }
    | undefined
): string {
  if (!value) return "";
  if (value.text) return value.text;
  if (value.value?.length) {
    return value.value
      .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address || ""))
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function envelopeAddrs(
  list: { name?: string | null; address?: string | null }[] | undefined
): string {
  if (!list?.length) return "";
  return list
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address || ""))
    .filter(Boolean)
    .join(", ");
}

const mailboxPathCache = new Map<string, { path: string; at: number }>();
const MAILBOX_PATH_TTL_MS = 30 * 60 * 1000;

type FolderSpec = {
  specialUse?: string;
  nameRe: RegExp;
  fallbacks: string[];
  optional?: boolean;
};

const FOLDER_SPEC: Record<Exclude<SystemMailBox, "inbox">, FolderSpec> = {
  sent: {
    specialUse: "\\Sent",
    nameRe: /(sent|enviad)/i,
    fallbacks: [
      "INBOX.Sent",
      "INBOX/Sent",
      "Sent",
      "Enviados",
      "INBOX.Enviados",
      "INBOX/Enviados",
    ],
  },
  starred: {
    specialUse: "\\Flagged",
    nameRe: /(starred|favorit|flagged)/i,
    fallbacks: ["Starred", "Flagged", "Favoritos"],
    optional: true,
  },
  spam: {
    specialUse: "\\Junk",
    nameRe: /(spam|junk|no deseado|correo no deseado)/i,
    fallbacks: ["Spam", "Junk", "INBOX.Spam", "INBOX/Spam", "Correo no deseado"],
    optional: true,
  },
  archive: {
    specialUse: "\\Archive",
    nameRe: /(archive|archivo|all mail)/i,
    fallbacks: ["Archive", "Archivo", "INBOX.Archive", "All Mail"],
    optional: true,
  },
  trash: {
    specialUse: "\\Trash",
    nameRe: /(trash|papelera|deleted|bin|papelera de reciclaje)/i,
    fallbacks: [
      "Trash",
      "Papelera",
      "Deleted",
      "INBOX.Trash",
      "INBOX/Trash",
      "INBOX.Papelera",
    ],
    optional: true,
  },
  scheduled: {
    nameRe: /(scheduled|programad|snooze)/i,
    fallbacks: ["Scheduled", "Programado", "Snoozed", "INBOX.Scheduled"],
    optional: true,
  },
  drafts: {
    specialUse: "\\Drafts",
    nameRe: /(draft|borrador)/i,
    fallbacks: ["Drafts", "Borradores", "INBOX.Drafts", "INBOX/Drafts"],
    optional: true,
  },
};

const SYSTEM_FOLDER_RE =
  /(inbox|sent|enviad|starred|favorit|flagged|spam|junk|no deseado|archive|archivo|trash|papelera|deleted|draft|borrador|scheduled|programad|snooze)/i;

function toListItem(msg: {
  uid?: number;
  envelope?: {
    subject?: string | null;
    from?: { name?: string | null; address?: string | null }[];
    to?: { name?: string | null; address?: string | null }[];
    date?: Date | string | null;
  } | null;
  flags?: Set<string>;
}): MailListItem {
  return {
    uid: msg.uid || 0,
    subject: msg.envelope?.subject || "(sin asunto)",
    from: envelopeAddrs(msg.envelope?.from) || "(sin remitente)",
    to: envelopeAddrs(msg.envelope?.to) || "(sin destinatario)",
    date: msg.envelope?.date
      ? new Date(msg.envelope.date).toISOString()
      : null,
    seen: msg.flags?.has("\\Seen") ?? false,
    snippet: "",
  };
}

async function fetchLatestMessages(
  client: ImapFlow,
  limit: number
): Promise<MailListItem[]> {
  const items: MailListItem[] = [];
  const total =
    client.mailbox && typeof client.mailbox === "object"
      ? client.mailbox.exists
      : 0;
  if (total === 0) return [];
  const start = Math.max(1, total - limit + 1);
  for await (const msg of client.fetch(`${start}:*`, {
    uid: true,
    flags: true,
    envelope: true,
  })) {
    items.push(toListItem(msg));
  }
  items.sort((a, b) => {
    const at = a.date ? Date.parse(a.date) : 0;
    const bt = b.date ? Date.parse(b.date) : 0;
    return bt - at;
  });
  return items.slice(0, limit);
}

async function fetchUidMessages(
  client: ImapFlow,
  uids: number[],
  limit: number
): Promise<MailListItem[]> {
  const picked = uids.slice(-limit);
  if (!picked.length) return [];
  const items: MailListItem[] = [];
  for await (const msg of client.fetch(picked.join(","), {
    uid: true,
    flags: true,
    envelope: true,
  }, { uid: true })) {
    items.push(toListItem(msg));
  }
  items.sort((a, b) => {
    const at = a.date ? Date.parse(a.date) : 0;
    const bt = b.date ? Date.parse(b.date) : 0;
    return bt - at;
  });
  return items.slice(0, limit);
}

function withMailboxPath(
  items: MailListItem[],
  mailboxPath: string
): MailListItem[] {
  return items.map((item) => ({ ...item, mailboxPath }));
}

async function resolveMailboxPath(
  client: ImapFlow,
  box: MailBox,
  cacheKey?: string
): Promise<string | null> {
  const custom = customFolderPath(box);
  if (custom) return custom;
  if (box === "inbox") return "INBOX";
  if (!isSystemMailBox(box)) return null;

  const spec = FOLDER_SPEC[box];
  const cacheId = cacheKey ? `${cacheKey}:${box}` : "";
  if (cacheId) {
    const hit = mailboxPathCache.get(cacheId);
    if (hit && Date.now() - hit.at < MAILBOX_PATH_TTL_MS) return hit.path;
  }

  let folders: Awaited<ReturnType<ImapFlow["list"]>>;
  try {
    folders = await client.list();
  } catch {
    folders = [];
  }

  const special = spec.specialUse
    ? folders.find((f) => f.specialUse === spec.specialUse)
    : undefined;
  if (special?.path) {
    if (cacheId) mailboxPathCache.set(cacheId, { path: special.path, at: Date.now() });
    return special.path;
  }

  const named = folders.find((f) => {
    const label = `${f.path} ${f.name || ""}`;
    return spec.nameRe.test(f.path) || spec.nameRe.test(label);
  });
  if (named?.path) {
    if (cacheId) mailboxPathCache.set(cacheId, { path: named.path, at: Date.now() });
    return named.path;
  }

  for (const path of spec.fallbacks) {
    try {
      const lock = await client.getMailboxLock(path);
      lock.release();
      if (cacheId) mailboxPathCache.set(cacheId, { path, at: Date.now() });
      return path;
    } catch {
      /* try next */
    }
  }

  if (spec.optional) return null;
  throw new Error(`No se encontró la carpeta ${box} en esta cuenta de correo.`);
}

export type MailFolderInfo = {
  path: string;
  name: string;
};

export async function listCustomMailFolders(
  creds: MailAccountCreds
): Promise<MailFolderInfo[]> {
  return withImap(creds, async (client) => {
    let folders: Awaited<ReturnType<ImapFlow["list"]>>;
    try {
      folders = await client.list();
    } catch {
      return [];
    }
    return folders
      .filter((f) => {
        if (!f.path || f.path.toUpperCase() === "INBOX") return false;
        if (f.specialUse) return false;
        if (SYSTEM_FOLDER_RE.test(f.path) || SYSTEM_FOLDER_RE.test(f.name || "")) {
          return false;
        }
        return true;
      })
      .map((f) => ({
        path: f.path,
        name: f.name || f.path.split(/[./]/).pop() || f.path,
      }));
  });
}

export async function createMailFolder(creds: MailAccountCreds, name: string) {
  const safe = name.replace(/[/\0]/g, " ").replace(/\s+/g, " ").trim();
  if (!safe) throw new Error("Nombre de carpeta vacío");
  return withImap(creds, async (client) => {
    await client.mailboxCreate(safe);
    return { path: safe, name: safe };
  });
}

export async function listMailbox(
  creds: MailAccountCreds,
  opts?: { limit?: number; box?: MailBox }
): Promise<{ messages: MailListItem[]; mailboxPath: string }> {
  const limit = opts?.limit ?? 25;
  const box = opts?.box ?? "inbox";

  return withImap(creds, async (client) => {
    if (box === "starred") {
      const inboxLock = await client.getMailboxLock("INBOX");
      try {
        const found = await client.search({ flagged: true }, { uid: true });
        const uids = Array.isArray(found) ? found.map(Number).filter((n) => n > 0) : [];
        if (uids.length) {
          return {
            messages: withMailboxPath(
              await fetchUidMessages(client, uids, limit),
              "INBOX"
            ),
            mailboxPath: "INBOX",
          };
        }
      } catch {
        /* fall through to starred folder */
      } finally {
        inboxLock.release();
      }
    }

    const mailboxPath = await resolveMailboxPath(client, box, creds.email);
    if (!mailboxPath) {
      return { messages: [], mailboxPath: "" };
    }
    const lock = await client.getMailboxLock(mailboxPath);
    try {
      return {
        messages: withMailboxPath(
          await fetchLatestMessages(client, limit),
          mailboxPath
        ),
        mailboxPath,
      };
    } finally {
      lock.release();
    }
  });
}

/** @deprecated use listMailbox */
export async function listInbox(
  creds: MailAccountCreds,
  opts?: { limit?: number }
): Promise<MailListItem[]> {
  const { messages } = await listMailbox(creds, { ...opts, box: "inbox" });
  return messages;
}

export async function getMessage(
  creds: MailAccountCreds,
  uid: number,
  box: MailBox = "inbox",
  folderPath?: string | null
): Promise<MailMessage | null> {
  return withImap(creds, async (client) => {
    const resolved =
      (folderPath && folderPath.trim()) ||
      (await resolveMailboxPath(client, box, creds.email)) ||
      (box === "starred" ? "INBOX" : null);
    if (!resolved) return null;
    const lock = await client.getMailboxLock(resolved);
    try {
      const fetched = await client.fetchOne(
        String(uid),
        {
          uid: true,
          envelope: true,
          source: { maxLength: 220_000 },
        },
        { uid: true }
      );
      if (!fetched) return null;

      let parsedSource = fetched.source;
      if (!parsedSource) {
        const downloaded = await client.download(String(uid), undefined, {
          uid: true,
        });
        if (!downloaded) return null;
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of downloaded.content) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          chunks.push(buf);
          bytes += buf.length;
          if (bytes >= 220_000) break;
        }
        parsedSource = Buffer.concat(chunks);
      }

      let parsed;
      try {
        parsed = await simpleParser(parsedSource);
      } catch {
        parsed = {
          subject: fetched.envelope?.subject || "(sin asunto)",
          from: undefined,
          to: undefined,
          cc: undefined,
          date: fetched.envelope?.date ?? null,
          text: "",
          html: null,
          messageId: fetched.envelope?.messageId || null,
          inReplyTo: fetched.envelope?.inReplyTo || null,
        };
      }
      return {
        uid,
        subject: parsed.subject || fetched.envelope?.subject || "(sin asunto)",
        from:
          addrList(parsed.from) ||
          envelopeAddrs(fetched.envelope?.from) ||
          "",
        to:
          addrList(parsed.to as { text?: string }) ||
          envelopeAddrs(fetched.envelope?.to) ||
          "",
        cc: addrList(parsed.cc as { text?: string }),
        date: parsed.date
          ? parsed.date.toISOString()
          : fetched.envelope?.date
            ? new Date(fetched.envelope.date).toISOString()
            : null,
        text: parsed.text || "",
        html: typeof parsed.html === "string" ? parsed.html : null,
        messageId: parsed.messageId || fetched.envelope?.messageId || null,
        inReplyTo: Array.isArray(parsed.inReplyTo)
          ? parsed.inReplyTo[0] || null
          : parsed.inReplyTo || fetched.envelope?.inReplyTo || null,
      };
    } finally {
      lock.release();
    }
  });
}

async function appendToSent(
  creds: MailAccountCreds,
  raw: Buffer
): Promise<void> {
  await withImap(creds, async (client) => {
    const path = await resolveMailboxPath(client, "sent", creds.email);
    if (!path) return;
    await client.append(path, raw, ["\\Seen"]);
  });
}

export async function sendMail(
  creds: MailAccountCreds,
  input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    inReplyTo?: string | null;
    references?: string | null;
  }
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: creds.smtpHost || MAIL_DEFAULTS.smtpHost,
    port: creds.smtpPort || MAIL_DEFAULTS.smtpPort,
    secure: true,
    auth: {
      user: creds.email,
      pass: creds.password,
    },
  });

  await transporter.sendMail({
    from: creds.email,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo || undefined,
    references: input.references || undefined,
  });

  // SMTP no copia a Enviados: APPEND vía IMAP para que aparezca en la carpeta
  try {
    const subjectSafe = input.subject.replace(/[\r\n]+/g, " ");
    const body = input.html?.trim()
      ? [
          "MIME-Version: 1.0",
          'Content-Type: text/html; charset="UTF-8"',
          "Content-Transfer-Encoding: 8bit",
          "",
          input.html,
        ]
      : [
          "MIME-Version: 1.0",
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: 8bit",
          "",
          input.text,
        ];
    const lines = [
      `From: ${creds.email}`,
      `To: ${input.to}`,
      `Subject: ${subjectSafe}`,
      `Date: ${new Date().toUTCString()}`,
      ...body,
    ];
    await appendToSent(creds, Buffer.from(lines.join("\r\n"), "utf8"));
  } catch {
    /* el envío ya salió; no fallar si APPEND falla */
  }
}
