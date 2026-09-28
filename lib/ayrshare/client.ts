const BASE = "https://api.ayrshare.com/api";

export const AYRSHARE_PLATFORMS = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "twitter",
  "linkedin",
  "threads",
  "pinterest",
  "reddit",
  "snapchat",
  "telegram",
  "bluesky",
  "gmb",
] as const;

export type AyrsharePlatform = (typeof AYRSHARE_PLATFORMS)[number];

export function toAyrsharePlatform(p: string): string {
  if (p === "x") return "twitter";
  return p;
}

export function fromAyrsharePlatform(p: string): string {
  if (p === "twitter") return "x";
  return p;
}

type AyrshareError = {
  status?: string;
  message?: string;
  code?: number | string;
  errors?: unknown;
};

async function ayrshareFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit & { profileKey?: string | null }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.profileKey) {
    headers["Profile-Key"] = init.profileKey;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as T & AyrshareError;
  if (!res.ok || (data as AyrshareError).status === "error") {
    const msg =
      (data as AyrshareError).message ||
      `Ayrshare error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function ayrshareGetUser(
  apiKey: string,
  profileKey?: string | null
) {
  return ayrshareFetch<{
    activeSocialAccounts?: string[];
    displayNames?: Record<string, string | { displayName?: string }>;
    email?: string;
    title?: string;
  }>("/user", apiKey, { method: "GET", profileKey });
}

export async function ayrshareCreateProfile(
  apiKey: string,
  title: string
): Promise<{ profileKey: string; refId: string; title: string }> {
  const data = await ayrshareFetch<{
    profileKey?: string;
    refId?: string;
    title?: string;
  }>("/profiles", apiKey, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (!data.profileKey) {
    throw new Error("Ayrshare did not return a profileKey");
  }
  return {
    profileKey: data.profileKey,
    refId: data.refId || "",
    title: data.title || title,
  };
}

export async function ayrshareGenerateJwt(input: {
  apiKey: string;
  profileKey: string;
  privateKey: string;
  domain: string;
  redirectUrl?: string;
}): Promise<{ url: string }> {
  const data = await ayrshareFetch<{ url?: string; jwt?: string }>(
    "/profiles/generateJWT",
    input.apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        domain: input.domain,
        privateKey: input.privateKey,
        profileKey: input.profileKey,
        redirectUrl: input.redirectUrl,
      }),
    }
  );
  if (!data.url) {
    throw new Error("Ayrshare did not return a connect URL");
  }
  return { url: data.url };
}

export async function ayrsharePost(input: {
  apiKey: string;
  profileKey?: string | null;
  post: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduleDate?: string;
}) {
  return ayrshareFetch<{
    status?: string;
    id?: string;
    postIds?: unknown[];
    errors?: unknown;
  }>("/post", input.apiKey, {
    method: "POST",
    profileKey: input.profileKey,
    body: JSON.stringify({
      post: input.post,
      platforms: input.platforms.map(toAyrsharePlatform),
      mediaUrls: input.mediaUrls,
      scheduleDate: input.scheduleDate,
    }),
  });
}

export async function ayrshareValidateKey(apiKey: string): Promise<boolean> {
  await ayrshareGetUser(apiKey);
  return true;
}
