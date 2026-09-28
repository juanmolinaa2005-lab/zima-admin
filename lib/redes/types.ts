export const SOCIAL_PLATFORMS = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "x",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialAuthMethod = "oauth" | "session" | "pending";

export type SocialAccountStatus =
  | "pending"
  | "active"
  | "needs_reauth"
  | "limited"
  | "blocked"
  | "disconnected";

export type ProxyProtocol = "http" | "https" | "socks5";

export type ProxyStatus = "available" | "assigned" | "error";

export type SocialPlatformMeta = {
  id: SocialPlatform;
  label: string;
  /** Platforms that fingerprint / block shared IPs aggressively */
  requiresDedicatedProxy: boolean;
  /** Suggested minutes between new connections on same platform */
  connectCooldownMinutes: number;
  color: string;
};

export const PLATFORM_META: Record<SocialPlatform, SocialPlatformMeta> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    requiresDedicatedProxy: true,
    connectCooldownMinutes: 30,
    color: "#111827",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    requiresDedicatedProxy: true,
    connectCooldownMinutes: 20,
    color: "#e1306c",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    requiresDedicatedProxy: true,
    connectCooldownMinutes: 15,
    color: "#1877f2",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    requiresDedicatedProxy: false,
    connectCooldownMinutes: 5,
    color: "#ff0000",
  },
  x: {
    id: "x",
    label: "X",
    requiresDedicatedProxy: true,
    connectCooldownMinutes: 20,
    color: "#111827",
  },
};

export function isSocialPlatform(v: string): v is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(v);
}

export type SocialProxyPublic = {
  id: string;
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  hasAuth: boolean;
  country: string | null;
  provider: string | null;
  status: ProxyStatus;
  lastCheckAt: string | null;
  lastError: string | null;
  assignedAccountId: string | null;
  createdAt: string;
};

export type SocialAccountPublic = {
  id: string;
  platform: SocialPlatform;
  displayName: string | null;
  username: string | null;
  externalId: string | null;
  avatarUrl: string | null;
  authMethod: SocialAuthMethod;
  status: SocialAccountStatus;
  proxyId: string | null;
  fingerprintSeed: string;
  hasTokens: boolean;
  connectedAt: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IsolationWarning = {
  code:
    | "proxy_required"
    | "proxy_in_use"
    | "cooldown"
    | "duplicate_username"
    | "no_fingerprint";
  message: string;
  severity: "error" | "warning";
};
