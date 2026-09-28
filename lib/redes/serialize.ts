import { encryptSecret } from "@/lib/crypto";
import type {
  ProxyProtocol,
  ProxyStatus,
  SocialAccountPublic,
  SocialAccountStatus,
  SocialAuthMethod,
  SocialPlatform,
  SocialProxyPublic,
} from "./types";

export type ProxyRow = {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username_ciphertext: string | null;
  password_ciphertext: string | null;
  country: string | null;
  provider: string | null;
  status: ProxyStatus;
  last_check_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  project_id: string;
  user_id: string;
  platform: SocialPlatform;
  display_name: string | null;
  username: string | null;
  external_id: string | null;
  avatar_url: string | null;
  auth_method: SocialAuthMethod;
  status: SocialAccountStatus;
  proxy_id: string | null;
  fingerprint_seed: string;
  tokens_ciphertext: string | null;
  scopes: string[] | null;
  connected_at: string | null;
  last_used_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function toPublicProxy(
  row: ProxyRow,
  assignedAccountId: string | null = null
): SocialProxyPublic {
  return {
    id: row.id,
    label: row.label,
    protocol: row.protocol,
    host: row.host,
    port: row.port,
    hasAuth: Boolean(row.username_ciphertext || row.password_ciphertext),
    country: row.country,
    provider: row.provider,
    status: assignedAccountId ? "assigned" : row.status === "assigned" ? "available" : row.status,
    lastCheckAt: row.last_check_at,
    lastError: row.last_error,
    assignedAccountId,
    createdAt: row.created_at,
  };
}

export function toPublicAccount(row: AccountRow): SocialAccountPublic {
  return {
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    username: row.username,
    externalId: row.external_id,
    avatarUrl: row.avatar_url,
    authMethod: row.auth_method,
    status: row.status,
    proxyId: row.proxy_id,
    fingerprintSeed: row.fingerprint_seed,
    hasTokens: Boolean(row.tokens_ciphertext),
    connectedAt: row.connected_at,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function encryptTokensPayload(payload: unknown): string {
  return encryptSecret(JSON.stringify(payload));
}

export function parseProxyEndpoint(raw: string): {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // user:pass@host:port
  // host:port
  // protocol://user:pass@host:port
  try {
    const withScheme = /^[a-z]+:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    const u = new URL(withScheme);
    const protocol = (u.protocol.replace(":", "") || "http") as ProxyProtocol;
    if (!["http", "https", "socks5"].includes(protocol)) return null;
    const host = u.hostname;
    const port = u.port ? Number(u.port) : protocol === "https" ? 443 : 80;
    if (!host || !port) return null;
    return {
      protocol,
      host,
      port,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    const parts = trimmed.split(":");
    if (parts.length >= 2) {
      const host = parts[0]!;
      const port = Number(parts[1]);
      if (host && port > 0) {
        return {
          protocol: "http",
          host,
          port,
          username: parts[2],
          password: parts[3],
        };
      }
    }
    return null;
  }
}
