export type TrackedPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "snapchat"
  | "web";

export type VideoMeta = {
  platform: TrackedPlatform;
  videoId: string | null;
  url: string;
  username: string | null;
};

export function parseVideoUrl(raw: string): VideoMeta | null {
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

  if (host.includes("tiktok.com")) {
    const at = parts.find((p) => p.startsWith("@"));
    const videoIdx = parts.findIndex((p) => p === "video");
    const videoId = videoIdx >= 0 ? parts[videoIdx + 1] || null : parts.at(-1) || null;
    return {
      platform: "tiktok",
      videoId,
      url: url.toString(),
      username: at ? at.slice(1) : null,
    };
  }

  if (host.includes("instagram.com")) {
    const kind = parts[0];
    const code =
      kind === "reel" || kind === "reels" || kind === "p" || kind === "tv"
        ? parts[1] || null
        : parts[0] || null;
    return {
      platform: "instagram",
      videoId: code,
      url: url.toString(),
      username: null,
    };
  }

  if (host.includes("youtu.be")) {
    return {
      platform: "youtube",
      videoId: parts[0] || null,
      url: url.toString(),
      username: null,
    };
  }

  if (host.includes("youtube.com")) {
    const id =
      url.searchParams.get("v") ||
      (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live"
        ? parts[1] || null
        : null);
    return {
      platform: "youtube",
      videoId: id,
      url: url.toString(),
      username: parts[0]?.startsWith("@") ? parts[0].slice(1) : null,
    };
  }

  if (host.includes("x.com") || host.includes("twitter.com")) {
    const statusIdx = parts.findIndex((p) => p === "status");
    return {
      platform: "x",
      videoId: statusIdx >= 0 ? parts[statusIdx + 1] || null : null,
      url: url.toString(),
      username: (parts[0] || "").replace(/^@/, "") || null,
    };
  }

  if (host.includes("snapchat.com")) {
    return {
      platform: "snapchat",
      videoId: parts.at(-1) || null,
      url: url.toString(),
      username: parts[0] === "add" ? parts[1] || null : parts[0] || null,
    };
  }

  if (!/^https?:$/i.test(url.protocol)) return null;
  return {
    platform: "web",
    videoId: parts.at(-1) || null,
    url: url.toString(),
    username: null,
  };
}

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

export async function fetchVideoPreview(
  url: string,
  platform: TrackedPlatform,
  videoId: string | null
) {
  const youtubeThumb =
    platform === "youtube" && videoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
      : null;
  const endpoints: Partial<Record<TrackedPlatform, string>> = {
    youtube: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  };
  const endpoint = endpoints[platform];
  if (!endpoint) {
    return {
      title: null as string | null,
      author: null as string | null,
      thumbnailUrl: youtubeThumb,
    };
  }
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { title: null, author: null, thumbnailUrl: youtubeThumb };
    }
    const data = (await res.json()) as OEmbed;
    return {
      title: data.title?.trim() || null,
      author: data.author_name?.trim() || null,
      thumbnailUrl: data.thumbnail_url?.trim() || youtubeThumb,
    };
  } catch {
    return { title: null, author: null, thumbnailUrl: youtubeThumb };
  }
}
