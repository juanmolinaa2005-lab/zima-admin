export type OutreachChannel = "email" | "profile";

export type OutreachStatus = "pending" | "approved" | "declined";

export type ProfileMeta = {
  platform: string | null;
  username: string | null;
  avatarUrl: string | null;
  normalizedUrl: string;
};

/** Best-effort profile URL parse + avatar via unavatar.io */
export function parseProfileUrl(raw: string): ProfileMeta | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  let platform: string | null = null;
  let username: string | null = null;

  if (host.includes("instagram.com")) {
    platform = "instagram";
    username = (parts[0] || "").replace(/^@/, "") || null;
  } else if (host.includes("tiktok.com")) {
    platform = "tiktok";
    const handle = parts[0] || "";
    username = handle.replace(/^@/, "") || null;
  } else if (host.includes("youtube.com") || host.includes("youtu.be")) {
    platform = "youtube";
    if (parts[0]?.startsWith("@")) {
      username = parts[0].slice(1);
    } else if (parts[0] === "channel" || parts[0] === "c" || parts[0] === "user") {
      username = parts[1] || null;
    }
  } else if (host.includes("x.com") || host.includes("twitter.com")) {
    platform = "x";
    username = (parts[0] || "").replace(/^@/, "") || null;
  } else if (host.includes("snapchat.com")) {
    platform = "snapchat";
    username = parts[0] === "add" ? parts[1] || null : parts[0] || null;
  } else {
    platform = host.split(".")[0] || "web";
    username = parts[0]?.replace(/^@/, "") || null;
  }

  let avatarUrl: string | null = null;
  if (platform && username) {
    avatarUrl = `https://unavatar.io/${platform}/${encodeURIComponent(username)}`;
  } else {
    avatarUrl = `https://unavatar.io/${encodeURIComponent(host)}`;
  }

  return {
    platform,
    username,
    avatarUrl,
    normalizedUrl: url.toString(),
  };
}

export function displayNameFromMeta(
  meta: ProfileMeta | null,
  fallback?: string | null
): string {
  if (fallback?.trim()) return fallback.trim();
  if (meta?.username) return `@${meta.username}`;
  return "Unknown";
}
