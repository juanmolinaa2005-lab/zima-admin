import type {
  AuthClientUser,
  MailAccountPublic,
  MailListItem,
  SupabaseRemoteProject,
} from "@/lib/types";
import { fingerprint } from "@/lib/hash";

type CacheEnvelope<T> = {
  savedAt: number;
  fingerprint: string;
  data: T;
};

function read<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): CacheEnvelope<T> {
  const envelope: CacheEnvelope<T> = {
    savedAt: Date.now(),
    fingerprint: fingerprint(data),
    data,
  };
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // quota / private mode
  }
  return envelope;
}

export function clientsCacheKey(projectId: string, linkedRef: string) {
  return `zima:clients:${projectId}:${linkedRef}`;
}

export function remotesCacheKey(userKey = "default") {
  return `zima:supabase-remotes:${userKey}`;
}

export function remoteNamesCacheKey(userKey = "default") {
  return `zima:supabase-remote-names:${userKey}`;
}

export function loadClientsCache(projectId: string, linkedRef: string) {
  return read<AuthClientUser[]>(clientsCacheKey(projectId, linkedRef));
}

export function saveClientsCache(
  projectId: string,
  linkedRef: string,
  users: AuthClientUser[]
) {
  return write(clientsCacheKey(projectId, linkedRef), users);
}

export function loadRemotesCache(userKey = "default") {
  return read<SupabaseRemoteProject[]>(remotesCacheKey(userKey));
}

export function saveRemotesCache(
  remotes: SupabaseRemoteProject[],
  userKey = "default"
) {
  return write(remotesCacheKey(userKey), remotes);
}

export function loadRemoteNamesCache(userKey = "default") {
  return read<Record<string, string>>(remoteNamesCacheKey(userKey));
}

export function saveRemoteNamesCache(
  names: Record<string, string>,
  userKey = "default"
) {
  return write(remoteNamesCacheKey(userKey), names);
}

export function mailInboxCacheKey(
  projectId: string,
  accountId: string,
  box = "inbox"
) {
  return `zima:mail-inbox:${projectId}:${accountId}:${box}`;
}

export function loadMailInboxCache(
  projectId: string,
  accountId: string,
  box = "inbox"
) {
  return read<MailListItem[]>(mailInboxCacheKey(projectId, accountId, box));
}

export function saveMailInboxCache(
  projectId: string,
  accountId: string,
  messages: MailListItem[],
  box = "inbox"
) {
  return write(mailInboxCacheKey(projectId, accountId, box), messages);
}

export function mailAccountsCacheKey(projectId: string) {
  return `zima:mail-accounts:${projectId}`;
}

export function loadMailAccountsCache(projectId: string) {
  return read<MailAccountPublic[]>(mailAccountsCacheKey(projectId));
}

export function saveMailAccountsCache(
  projectId: string,
  accounts: MailAccountPublic[]
) {
  return write(mailAccountsCacheKey(projectId), accounts);
}

export function lastMailAccountKey(projectId: string) {
  return `zima:mail-last-account:${projectId}`;
}

export function loadLastMailAccountId(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(lastMailAccountKey(projectId));
  } catch {
    return null;
  }
}

export function saveLastMailAccountId(projectId: string, accountId: string) {
  try {
    localStorage.setItem(lastMailAccountKey(projectId), accountId);
  } catch {
    /* ignore */
  }
}

export function sameFingerprint(a: string | undefined, b: string | undefined) {
  return Boolean(a && b && a === b);
}

export function formatCacheAge(savedAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}
