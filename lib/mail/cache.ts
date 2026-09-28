import type { MailListItem, MailMessage } from "@/lib/mail/titan";

type ListEntry = {
  at: number;
  messages: MailListItem[];
};

type MessageEntry = {
  at: number;
  message: MailMessage;
};

const LIST_FRESH_MS = 2 * 60_000;
const LIST_STALE_MS = 10 * 60_000;
const MESSAGE_TTL_MS = 5 * 60_000;

const listStore = new Map<string, ListEntry>();
const messageStore = new Map<string, MessageEntry>();

function listKey(accountId: string, box = "inbox") {
  return `${accountId}:${box}`;
}

function messageKey(accountId: string, box: string, uid: number) {
  return `${accountId}:${box}:${uid}`;
}

export function getInboxCacheEntry(accountId: string, box = "inbox") {
  const hit = listStore.get(listKey(accountId, box));
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age > LIST_STALE_MS) {
    listStore.delete(listKey(accountId, box));
    return null;
  }
  return { messages: hit.messages, at: hit.at, age, fresh: age < LIST_FRESH_MS };
}

export function getInboxCache(
  accountId: string,
  box = "inbox"
): MailListItem[] | null {
  return getInboxCacheEntry(accountId, box)?.messages ?? null;
}

export function setInboxCache(
  accountId: string,
  messages: MailListItem[],
  box = "inbox"
) {
  listStore.set(listKey(accountId, box), { at: Date.now(), messages });
}

export function clearInboxCache(accountId: string, box?: string) {
  if (box) {
    listStore.delete(listKey(accountId, box));
    const prefix = `${accountId}:${box}:`;
    for (const key of messageStore.keys()) {
      if (key.startsWith(prefix)) messageStore.delete(key);
    }
    return;
  }
  for (const key of listStore.keys()) {
    if (key === accountId || key.startsWith(`${accountId}:`)) {
      listStore.delete(key);
    }
  }
  for (const key of messageStore.keys()) {
    if (key.startsWith(`${accountId}:`)) messageStore.delete(key);
  }
}

export function getMessageCache(
  accountId: string,
  box: string,
  uid: number
): MailMessage | null {
  const hit = messageStore.get(messageKey(accountId, box, uid));
  if (!hit) return null;
  if (Date.now() - hit.at > MESSAGE_TTL_MS) {
    messageStore.delete(messageKey(accountId, box, uid));
    return null;
  }
  return hit.message;
}

export function setMessageCache(
  accountId: string,
  box: string,
  message: MailMessage
) {
  messageStore.set(messageKey(accountId, box, message.uid), {
    at: Date.now(),
    message,
  });
}
