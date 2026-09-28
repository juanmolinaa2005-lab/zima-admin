import { fetchHtml, fetchPublicAccountStats } from "@/lib/viewtracker/stats";
import type { TrackedPlatform } from "@/lib/viewtracker/video";

export type DiscoveredVideo = {
  url: string;
  videoId: string;
  platform: TrackedPlatform;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds: number | null;
  postedAt: string | null;
};

const MAX = 80;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function walk(value: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  const obj = asRecord(value);
  if (!obj) return;
  visit(obj);
  for (const v of Object.values(obj)) walk(v, visit);
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseViewsLabel(raw: string | null | undefined) {
  if (!raw) return 0;
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const u = (m[2] || "").toUpperCase();
  if (u === "K") return Math.round(n * 1_000);
  if (u === "M") return Math.round(n * 1_000_000);
  if (u === "B") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

function jsonScripts(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]*>\s*({[\s\S]*?})\s*<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (raw.length < 80 || raw.length > 2_000_000) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }
  const named = [
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i,
    /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i,
    /ytInitialData\s*=\s*({[\s\S]*?});/,
    /ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/,
  ];
  for (const pat of named) {
    const hit = html.match(pat);
    if (!hit?.[1]) continue;
    try {
      out.push(JSON.parse(hit[1]));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function add(
  map: Map<string, DiscoveredVideo>,
  item: DiscoveredVideo
) {
  if (!item.videoId || map.has(item.videoId)) return;
  if (map.size >= MAX) return;
  map.set(item.videoId, item);
}

function tiktokFromHtml(html: string, username: string) {
  const map = new Map<string, DiscoveredVideo>();
  const author = `@${username}`;
  for (const block of jsonScripts(html)) {
    walk(block, (obj) => {
      const id = String(obj.id || obj.aweme_id || obj.itemId || "");
      if (!/^\d{15,25}$/.test(id)) return;
      const stats = asRecord(obj.stats) || obj;
      const video = asRecord(obj.video);
      const cover =
        (typeof obj.cover === "string" && obj.cover) ||
        (typeof video?.cover === "string" && video.cover) ||
        (typeof video?.originCover === "string" && video.originCover) ||
        null;
      const duration = num(video?.duration || obj.duration);
      const createTime = num(obj.createTime || obj.create_time);
      add(map, {
        url: `https://www.tiktok.com/@${username}/video/${id}`,
        videoId: id,
        platform: "tiktok",
        title: typeof obj.desc === "string" ? obj.desc : null,
        author,
        thumbnailUrl: cover && cover.startsWith("http") ? cover : null,
        views: num(stats.playCount || stats.play_count),
        likes: num(stats.diggCount || stats.digg_count),
        comments: num(stats.commentCount || stats.comment_count),
        shares: num(stats.shareCount || stats.share_count),
        saves: num(stats.collectCount || stats.collect_count),
        durationSeconds: duration > 0 ? Math.round(duration > 1000 ? duration / 1000 : duration) : null,
        postedAt: createTime > 1_000_000_000 ? new Date(createTime * 1000).toISOString() : null,
      });
    });
  }
  for (const m of html.matchAll(/\/@([^/]+)\/video\/(\d{15,25})/g)) {
    add(map, {
      url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`,
      videoId: m[2],
      platform: "tiktok",
      title: null,
      author: `@${m[1]}`,
      thumbnailUrl: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      durationSeconds: null,
      postedAt: null,
    });
  }
  return [...map.values()];
}

function youtubeFromHtml(html: string, username: string | null) {
  const map = new Map<string, DiscoveredVideo>();
  const author = username ? `@${username}` : null;
  for (const block of jsonScripts(html)) {
    walk(block, (obj) => {
      const id = String(obj.videoId || "");
      if (!/^[\w-]{11}$/.test(id)) return;
      const titleObj = asRecord(obj.title);
      const title =
        (typeof obj.title === "string" && obj.title) ||
        (typeof titleObj?.simpleText === "string" && titleObj.simpleText) ||
        (Array.isArray(titleObj?.runs) &&
          typeof (titleObj.runs[0] as { text?: string } | undefined)?.text ===
            "string" &&
          (titleObj.runs[0] as { text: string }).text) ||
        null;
      const viewsObj = asRecord(obj.viewCountText) || asRecord(obj.shortViewCountText);
      const viewsLabel =
        (typeof viewsObj?.simpleText === "string" && viewsObj.simpleText) ||
        (Array.isArray(viewsObj?.runs) &&
          typeof (viewsObj.runs[0] as { text?: string } | undefined)?.text ===
            "string" &&
          (viewsObj.runs[0] as { text: string }).text) ||
        null;
      const thumbs = obj.thumbnail;
      let thumb: string | null = null;
      if (thumbs && typeof thumbs === "object") {
        const arr = (thumbs as { thumbnails?: { url?: string }[] }).thumbnails;
        thumb = arr?.at(-1)?.url || arr?.[0]?.url || null;
      }
      add(map, {
        url: `https://www.youtube.com/watch?v=${id}`,
        videoId: id,
        platform: "youtube",
        title,
        author,
        thumbnailUrl: thumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        views: parseViewsLabel(viewsLabel),
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        durationSeconds: null,
        postedAt: null,
      });
    });
  }
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) {
    add(map, {
      url: `https://www.youtube.com/watch?v=${m[1]}`,
      videoId: m[1],
      platform: "youtube",
      title: null,
      author,
      thumbnailUrl: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      durationSeconds: null,
      postedAt: null,
    });
  }
  return [...map.values()];
}

async function youtubeFromRss(channelId: string, username: string | null) {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    { signal: AbortSignal.timeout(8000), headers: { Accept: "application/atom+xml" } }
  );
  if (!res.ok) return [] as DiscoveredVideo[];
  const xml = await res.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  const author = username ? `@${username}` : null;
  const out: DiscoveredVideo[] = [];
  for (const entry of entries) {
    const block = entry[1];
    const id = block.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    if (!id) continue;
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || null;
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1] || null;
    const thumb =
      block.match(/url="(https:\/\/i\.ytimg\.com[^"]+)"/)?.[1] ||
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    out.push({
      url: `https://www.youtube.com/watch?v=${id}`,
      videoId: id,
      platform: "youtube",
      title,
      author,
      thumbnailUrl: thumb,
      views: parseViewsLabel(block.match(/views[^>]*>.*?(\d[\d,]*)/)?.[1]),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      durationSeconds: null,
      postedAt: published,
    });
  }
  return out;
}

function instagramFromHtml(html: string, username: string | null) {
  const map = new Map<string, DiscoveredVideo>();
  const author = username ? `@${username}` : null;
  for (const m of html.matchAll(/\/(reel|reels|p)\/([A-Za-z0-9_-]{5,})/g)) {
    const code = m[2];
    add(map, {
      url: `https://www.instagram.com/${m[1] === "p" ? "p" : "reel"}/${code}/`,
      videoId: code,
      platform: "instagram",
      title: null,
      author,
      thumbnailUrl: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      durationSeconds: null,
      postedAt: null,
    });
  }
  return [...map.values()];
}

function xFromHtml(html: string, username: string | null) {
  const map = new Map<string, DiscoveredVideo>();
  const author = username ? `@${username}` : null;
  for (const m of html.matchAll(/\/status\/(\d{15,})/g)) {
    add(map, {
      url: `https://x.com/${username || "i"}/status/${m[1]}`,
      videoId: m[1],
      platform: "x",
      title: null,
      author,
      thumbnailUrl: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      durationSeconds: null,
      postedAt: null,
    });
  }
  return [...map.values()];
}

export async function discoverAccountVideos(opts: {
  url: string;
  platform: string | null;
  username: string | null;
}): Promise<DiscoveredVideo[]> {
  const platform = (opts.platform || "").toLowerCase();
  const username = (opts.username || "").replace(/^@/, "") || null;
  const map = new Map<string, DiscoveredVideo>();

  if (platform === "youtube") {
    const profileHtml = await fetchHtml(opts.url);
    const videosUrl = username
      ? `https://www.youtube.com/@${username}/videos`
      : opts.url.replace(/\/?$/, "/videos");
    const videosHtml = await fetchHtml(videosUrl);
    for (const item of youtubeFromHtml(profileHtml + videosHtml, username)) {
      add(map, item);
    }
    const channelId =
      (profileHtml + videosHtml).match(/"channelId":"(UC[\w-]{20,})"/)?.[1] ||
      (profileHtml + videosHtml).match(/\/channel\/(UC[\w-]{20,})/)?.[1] ||
      null;
    if (channelId) {
      try {
        for (const item of await youtubeFromRss(channelId, username)) {
          const prev = map.get(item.videoId);
          map.set(item.videoId, {
            ...item,
            title: prev?.title || item.title,
            views: prev?.views || item.views,
            thumbnailUrl: prev?.thumbnailUrl || item.thumbnailUrl,
            postedAt: prev?.postedAt || item.postedAt,
          });
        }
      } catch {
        /* rss optional */
      }
    }
  } else if (platform === "tiktok" && username) {
    const html = await fetchHtml(`https://www.tiktok.com/@${username}`);
    for (const item of tiktokFromHtml(html, username)) add(map, item);
  } else if (platform === "instagram" && username) {
    const html =
      (await fetchHtml(`https://www.instagram.com/${username}/reels/`)) ||
      (await fetchHtml(`https://www.instagram.com/${username}/`));
    for (const item of instagramFromHtml(html, username)) add(map, item);
  } else if (platform === "x" && username) {
    const html = await fetchHtml(`https://x.com/${username}`);
    for (const item of xFromHtml(html, username)) add(map, item);
  } else {
    const html = await fetchHtml(opts.url);
    for (const item of tiktokFromHtml(html, username || "user")) add(map, item);
    for (const item of youtubeFromHtml(html, username)) add(map, item);
    for (const item of instagramFromHtml(html, username)) add(map, item);
  }

  return [...map.values()].slice(0, MAX);
}
