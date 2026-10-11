import { decryptTokenBundle, fetchProfileHint } from "@/lib/redes/oauth";
import { isSocialPlatform } from "@/lib/redes/types";
import { isHostedAvatar, persistProfileAvatar, publicProfileUrl } from "@/lib/viewtracker/avatar-cache";
import { fetchPublicAccountStats } from "@/lib/viewtracker/stats";

export async function hydrateMissingAvatar(opts: {
  id: string;
  platform: string;
  username: string | null;
  avatarUrl: string | null;
  tokensCipher: string | null;
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  save: (avatarUrl: string) => Promise<void>;
}): Promise<string | null> {
  if (isHostedAvatar(opts.avatarUrl)) return opts.avatarUrl ?? null;

  const cached = await persistProfileAvatar(opts.supabase, {
    projectId: opts.projectId,
    platform: opts.platform,
    username: opts.username,
    sourceUrl: null,
    reuse: true,
  });
  if (cached) {
    if (cached !== opts.avatarUrl) await opts.save(cached);
    return cached;
  }

  let source: string | null = null;
  if (opts.tokensCipher && isSocialPlatform(opts.platform)) {
    try {
      const tokens = decryptTokenBundle(opts.tokensCipher);
      const profile = await fetchProfileHint(opts.platform, tokens);
      if (profile.avatarUrl?.startsWith("http")) source = profile.avatarUrl;
    } catch {
      /* ignore */
    }
  }
  if (!source && opts.platform !== "instagram") {
    const page = publicProfileUrl(opts.platform, opts.username);
    if (page) {
      const stats = await fetchPublicAccountStats(page, opts.platform);
      if (stats.thumbnailUrl) source = stats.thumbnailUrl;
    }
  }
  if (!source && opts.avatarUrl?.startsWith("http") && !opts.avatarUrl.includes("unavatar.io")) {
    source = opts.avatarUrl;
  }

  const hosted = await persistProfileAvatar(opts.supabase, {
    projectId: opts.projectId,
    platform: opts.platform,
    username: opts.username,
    sourceUrl: source,
    reuse: true,
  });
  if (hosted) {
    if (hosted !== opts.avatarUrl) await opts.save(hosted);
    return hosted;
  }
  return null;
}
