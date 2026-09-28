export function socialAvatarFallback(
  platform: string | null | undefined,
  username: string | null | undefined
): string | null {
  const user = (username || "").replace(/^@/, "").trim();
  if (!user) return null;
  const host =
    platform === "x" || platform === "twitter"
      ? "twitter"
      : platform === "youtube"
        ? "youtube"
        : platform === "instagram"
          ? "instagram"
          : platform === "tiktok"
            ? "tiktok"
            : platform === "facebook"
              ? "facebook"
              : null;
  if (!host) return `https://unavatar.io/${encodeURIComponent(user)}`;
  return `https://unavatar.io/${host}/${encodeURIComponent(user)}`;
}

export function resolveSocialAvatar(opts: {
  platform?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}): string | null {
  const direct = (opts.avatarUrl || "").trim();
  if (direct.startsWith("http")) return direct;
  return socialAvatarFallback(opts.platform, opts.username);
}
