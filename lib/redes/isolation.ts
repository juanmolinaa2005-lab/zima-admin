import {
  PLATFORM_META,
  type IsolationWarning,
  type SocialAccountPublic,
  type SocialPlatform,
  type SocialProxyPublic,
} from "./types";

/** Minutes since last account creation on a platform */
export function minutesSince(
  iso: string | null | undefined,
  now = Date.now()
): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now - t) / 60_000;
}

/**
 * Anti-detection checks before connecting / activating an account.
 * Proxy is optional for a few accounts; recommended when scaling.
 */
export function evaluateIsolation(input: {
  platform: SocialPlatform;
  proxyId: string | null | undefined;
  proxies: SocialProxyPublic[];
  accounts: SocialAccountPublic[];
  username?: string | null;
  excludeAccountId?: string;
}): IsolationWarning[] {
  const warnings: IsolationWarning[] = [];
  const meta = PLATFORM_META[input.platform];
  const others = input.accounts.filter(
    (a) => a.id !== input.excludeAccountId
  );

  // Soft tip only when scaling same-platform accounts without proxies
  const samePlatformNoProxy = others.filter(
    (a) => a.platform === input.platform && !a.proxyId
  ).length;
  if (
    meta.requiresDedicatedProxy &&
    !input.proxyId &&
    samePlatformNoProxy >= 2
  ) {
    warnings.push({
      code: "proxy_required",
      severity: "warning",
      message: `You already have ${samePlatformNoProxy + 1} ${meta.label} accounts without a proxy. A dedicated proxy helps when you scale up.`,
    });
  }

  if (input.proxyId) {
    const proxy = input.proxies.find((p) => p.id === input.proxyId);
    if (!proxy) {
      warnings.push({
        code: "proxy_in_use",
        severity: "error",
        message: "Selected proxy was not found.",
      });
    } else if (
      proxy.assignedAccountId &&
      proxy.assignedAccountId !== input.excludeAccountId
    ) {
      warnings.push({
        code: "proxy_in_use",
        severity: "error",
        message:
          "That proxy is already assigned to another account. Never share a proxy across accounts.",
      });
    }
  }

  const uname = input.username?.trim().toLowerCase();
  if (uname) {
    const dup = others.find(
      (a) =>
        a.platform === input.platform &&
        a.username?.trim().toLowerCase() === uname
    );
    if (dup) {
      warnings.push({
        code: "duplicate_username",
        severity: "error",
        message: `A ${meta.label} account @${uname} is already connected.`,
      });
    }
  }

  const samePlatform = others
    .filter((a) => a.platform === input.platform)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = samePlatform[0];
  const mins = minutesSince(newest?.createdAt);
  if (
    mins != null &&
    mins < meta.connectCooldownMinutes &&
    !input.excludeAccountId
  ) {
    const wait = Math.ceil(meta.connectCooldownMinutes - mins);
    warnings.push({
      code: "cooldown",
      severity: "warning",
      message: `Wait ~${wait} min before adding another ${meta.label} account from this workspace (anti-link cooldown).`,
    });
  }

  return warnings;
}

export function availableProxies(
  proxies: SocialProxyPublic[],
  excludeAccountId?: string
): SocialProxyPublic[] {
  return proxies.filter(
    (p) =>
      p.status !== "error" &&
      (!p.assignedAccountId || p.assignedAccountId === excludeAccountId)
  );
}
