const BASE = "https://backend.blotato.com/v2";

export type BlotatoAccount = {
  id: string;
  platform: string;
  nickname: string | null;
  username: string | null;
  avatarUrl: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickHttp(obj: Record<string, unknown> | null, keys: string[]) {
  if (!obj) return null;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }
  return null;
}

function mapBlotatoAccount(raw: unknown): BlotatoAccount | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = obj.id != null ? String(obj.id) : "";
  if (!id) return null;
  const nested =
    asRecord(obj.data) ||
    asRecord(obj.account) ||
    asRecord(obj.profile) ||
    asRecord(obj.user);
  const avatarKeys = [
    "avatarUrl",
    "avatar_url",
    "avatar",
    "profilePicture",
    "profile_picture_url",
    "picture",
    "image",
  ];
  return {
    id,
    platform: String(obj.platform || "").toLowerCase(),
    nickname:
      (typeof obj.nickname === "string" && obj.nickname) ||
      (typeof nested?.nickname === "string" && nested.nickname) ||
      null,
    username:
      (typeof obj.username === "string" && obj.username) ||
      (typeof nested?.username === "string" && nested.username) ||
      null,
    avatarUrl: pickHttp(obj, avatarKeys) || pickHttp(nested, avatarKeys),
  };
}

export type BlotatoPlatform = "tiktok" | "instagram" | "youtube";

export type BlotatoPublishInput = {
  accountId: string;
  platform: BlotatoPlatform;
  text: string;
  mediaUrls: string[];
  privacyLevel?:
    | "SELF_ONLY"
    | "PUBLIC_TO_EVERYONE"
    | "MUTUAL_FOLLOW_FRIENDS"
    | "FOLLOWER_OF_CREATOR";
  isDraft?: boolean;
  /** YouTube title (defaults to text) */
  title?: string;
  youtubePrivacy?: "private" | "public" | "unlisted";
};

async function blotatoFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "blotato-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.message || data.error || `Blotato error (${res.status})`
    );
  }
  return data;
}

export async function blotatoListAccounts(
  apiKey: string,
  platform?: string
): Promise<BlotatoAccount[]> {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  const data = await blotatoFetch<{ items?: unknown[] }>(
    `/users/me/accounts${qs}`,
    apiKey,
    { method: "GET" }
  );
  return (data.items ?? [])
    .map(mapBlotatoAccount)
    .filter((a): a is BlotatoAccount => Boolean(a));
}

export async function blotatoValidateKey(apiKey: string): Promise<boolean> {
  await blotatoListAccounts(apiKey);
  return true;
}

function buildTarget(input: BlotatoPublishInput): Record<string, unknown> {
  if (input.platform === "tiktok") {
    return {
      targetType: "tiktok",
      privacyLevel: input.privacyLevel ?? "PUBLIC_TO_EVERYONE",
      disabledComments: false,
      disabledDuet: false,
      disabledStitch: false,
      isBrandedContent: false,
      isYourBrand: false,
      isAiGenerated: false,
      isDraft: input.isDraft ?? false,
    };
  }
  if (input.platform === "instagram") {
    return {
      targetType: "instagram",
      mediaType: "reel",
      shareToFeed: true,
    };
  }
  return {
    targetType: "youtube",
    title: (input.title || input.text || "Video").slice(0, 100),
    privacyStatus: input.youtubePrivacy ?? "public",
    shouldNotifySubscribers: true,
    isMadeForKids: false,
  };
}

export async function blotatoPublish(
  apiKey: string,
  input: BlotatoPublishInput
) {
  return blotatoFetch<unknown>("/posts", apiKey, {
    method: "POST",
    body: JSON.stringify({
      post: {
        accountId: input.accountId,
        content: {
          text: input.text,
          mediaUrls: input.mediaUrls,
          platform: input.platform,
        },
        target: buildTarget(input),
      },
    }),
  });
}

/** @deprecated use blotatoPublish */
export async function blotatoPublishTikTok(
  apiKey: string,
  input: Omit<BlotatoPublishInput, "platform">
) {
  return blotatoPublish(apiKey, { ...input, platform: "tiktok" });
}
