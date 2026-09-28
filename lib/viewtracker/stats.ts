import { parseIsoDuration } from "@/lib/viewtracker/format";
import type { TrackedPlatform } from "@/lib/viewtracker/video";

export type PublicVideoStats = {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  durationSeconds: number | null;
  postedAt: string | null;
};

export type PublicAccountStats = {
  displayName: string | null;
  followers: number | null;
  thumbnailUrl: string | null;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": UA,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return "";
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > 700_000 ? buf.slice(0, 700_000) : buf;
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1]);
  }
  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function walk(value: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    visit(obj);
    for (const v of Object.values(obj)) walk(v, visit);
  }
}

function numKey(html: string, keys: string[]) {
  for (const key of keys) {
    const m = html.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function strKey(html: string, keys: string[]) {
  for (const key of keys) {
    const m = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]{1,200})"`));
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function fetchPublicVideoStats(
  url: string,
  platform: TrackedPlatform,
  fallbackThumb: string | null
): Promise<PublicVideoStats> {
  const empty: PublicVideoStats = {
    title: null,
    author: null,
    thumbnailUrl: fallbackThumb,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    durationSeconds: null,
    postedAt: null,
  };
  try {
    const html = await fetchHtml(url);
    if (!html) return empty;

    let views: number | null = null;
    let likes: number | null = null;
    let comments: number | null = null;
    let durationSeconds: number | null = null;
    let postedAt: string | null = null;
    let title = meta(html, "og:title") || meta(html, "twitter:title");
    let author: string | null = null;
    let thumbnailUrl =
      meta(html, "og:image") || meta(html, "twitter:image") || fallbackThumb;

    for (const block of jsonLdBlocks(html)) {
      walk(block, (obj) => {
        const type = String(obj["@type"] || "");
        if (!/VideoObject|SocialMediaPosting/i.test(type) && !obj.interactionCount) {
          if (typeof obj.author === "string" && !author) author = obj.author;
          return;
        }
        if (typeof obj.name === "string" && !title) title = obj.name;
        if (typeof obj.uploadDate === "string") postedAt = obj.uploadDate;
        if (typeof obj.datePublished === "string" && !postedAt) {
          postedAt = obj.datePublished;
        }
        if (typeof obj.duration === "string") {
          durationSeconds = parseIsoDuration(obj.duration) ?? durationSeconds;
        }
        if (typeof obj.interactionCount === "string" || typeof obj.interactionCount === "number") {
          const n = Number(obj.interactionCount);
          if (Number.isFinite(n)) views = n;
        }
        const authorVal = obj.author;
        if (typeof authorVal === "string") author = authorVal;
        if (authorVal && typeof authorVal === "object") {
          const name = (authorVal as { name?: string }).name;
          if (name) author = name;
        }
      });
    }

    if (platform === "tiktok") {
      views = views ?? numKey(html, ["playCount", "play_count"]);
      likes = likes ?? numKey(html, ["diggCount", "digg_count"]);
      comments = comments ?? numKey(html, ["commentCount", "comment_count"]);
      empty.shares = numKey(html, ["shareCount", "share_count"]);
      empty.saves = numKey(html, ["collectCount", "collect_count"]);
      durationSeconds =
        durationSeconds ?? numKey(html, ["duration"]);
      author = author || strKey(html, ["uniqueId", "nickname"]);
      const createTime = numKey(html, ["createTime", "create_time"]);
      if (createTime && createTime > 1_000_000_000) {
        postedAt = postedAt || new Date(createTime * 1000).toISOString();
      }
    }

    if (platform === "youtube") {
      views = views ?? numKey(html, ["viewCount", "view_count"]);
      likes = likes ?? numKey(html, ["likeCount", "like_count"]);
      comments = comments ?? numKey(html, ["commentCount", "comment_count"]);
    }

    return {
      title: title || null,
      author: author || null,
      thumbnailUrl,
      views,
      likes,
      comments,
      shares: empty.shares,
      saves: empty.saves,
      durationSeconds,
      postedAt,
    };
  } catch {
    return empty;
  }
}

export async function fetchPublicAccountStats(
  url: string,
  platform: string | null
): Promise<PublicAccountStats> {
  try {
    const html = await fetchHtml(url);
    if (!html) return { displayName: null, followers: null, thumbnailUrl: null };
    const displayName =
      strKey(html, ["nickname", "full_name", "name"]) ||
      meta(html, "og:title");
    const followers =
      platform === "tiktok"
        ? numKey(html, ["followerCount", "follower_count"])
        : numKey(html, ["followerCount", "edge_followed_by", "subscriberCount"]);
    const thumbnailUrl = meta(html, "og:image");
    return { displayName, followers, thumbnailUrl };
  } catch {
    return { displayName: null, followers: null, thumbnailUrl: null };
  }
}
