import { decryptTokenBundle, fetchProfileHint } from "@/lib/redes/oauth";
import { isSocialPlatform } from "@/lib/redes/types";
import { resolveSocialAvatar } from "@/lib/redes/avatar";

export async function hydrateMissingAvatar(opts: {
  id: string;
  platform: string;
  username: string | null;
  avatarUrl: string | null;
  tokensCipher: string | null;
  save: (avatarUrl: string) => Promise<void>;
}): Promise<string | null> {
  if (opts.avatarUrl?.startsWith("http")) return opts.avatarUrl;
  if (opts.tokensCipher && isSocialPlatform(opts.platform)) {
    try {
      const tokens = decryptTokenBundle(opts.tokensCipher);
      const profile = await fetchProfileHint(opts.platform, tokens);
      if (profile.avatarUrl?.startsWith("http")) {
        await opts.save(profile.avatarUrl);
        return profile.avatarUrl;
      }
    } catch {
      /* ignore */
    }
  }
  return resolveSocialAvatar({
    platform: opts.platform,
    username: opts.username,
    avatarUrl: opts.avatarUrl,
  });
}
