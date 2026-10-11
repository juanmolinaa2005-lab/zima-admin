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

function add(map: Map<string, DiscoveredVideo>, item: DiscoveredVideo) {
  if (!item.videoId) return;
  const prev = map.get(item.videoId);
  if (!prev) {
    map.set(item.videoId, item);
    return;
  }
  map.set(item.videoId, {
    ...prev,
    title: prev.title || item.title,
    author: prev.author || item.author,
    thumbnailUrl: prev.thumbnailUrl || item.thumbnailUrl,
    views: prev.views || item.views,
    likes: prev.likes || item.likes,
    comments: prev.comments || item.comments,
    shares: prev.shares || item.shares,
    saves: prev.saves || item.saves,
    durationSeconds: prev.durationSeconds ?? item.durationSeconds,
    postedAt: prev.postedAt || item.postedAt,
  });
}

function coverFrom(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("http")) return value;
  const rec = asRecord(value);
  if (!rec) return null;
  if (typeof rec.url === "string" && rec.url.startsWith("http")) return rec.url;
  const list = rec.url_list ?? rec.urlList;
  if (Array.isArray(list)) {
    const first = list.find((item) => typeof item === "string" && item.startsWith("http"));
    if (typeof first === "string") return first;
  }
  return null;
}

function tiktokItem(obj: Record<string, unknown>, username: string): DiscoveredVideo | null {
  const id = String(obj.id || obj.aweme_id || obj.itemId || "");
  if (!/^\d{15,25}$/.test(id)) return null;
  const stats = asRecord(obj.stats);
  const video = asRecord(obj.video);
  const isPost =
    typeof obj.desc === "string" ||
    Boolean(video) ||
    Boolean(stats && ("playCount" in stats || "play_count" in stats));
  if (!isPost) return null;
  const counts = stats || obj;
  const duration = num(video?.duration || obj.duration);
  const createTime = num(obj.createTime || obj.create_time);
  return {
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    videoId: id,
    platform: "tiktok",
    title: typeof obj.desc === "string" ? obj.desc : null,
    author: `@${username}`,
    thumbnailUrl:
      coverFrom(obj.cover) ||
      coverFrom(video?.cover) ||
      coverFrom(video?.originCover) ||
      coverFrom(video?.dynamicCover),
    views: num(counts.playCount || counts.play_count),
    likes: num(counts.diggCount || counts.digg_count),
    comments: num(counts.commentCount || counts.comment_count),
    shares: num(counts.shareCount || counts.share_count),
    saves: num(counts.collectCount || counts.collect_count),
    durationSeconds: duration > 0 ? Math.round(duration > 1000 ? duration / 1000 : duration) : null,
    postedAt: createTime > 1_000_000_000 ? new Date(createTime * 1000).toISOString() : null,
  };
}

async function tiktokRest(
  secUid: string,
  username: string,
  map: Map<string, DiscoveredVideo>
) {
  let cursor = "0";
  const seen = new Set<string>();
  while (!seen.has(cursor)) {
    seen.add(cursor);
    let data: Record<string, unknown> | null = null;
    try {
      const res = await fetch(
        `https://www.tiktok.com/api/creator/item_list/?aid=1988&count=15&type=1&cursor=${encodeURIComponent(cursor)}&secUid=${encodeURIComponent(secUid)}`,
        {
          headers: {
            Accept: "application/json",
            Referer: `https://www.tiktok.com/@${username}`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(12_000),
        }
      );
      if (!res.ok) break;
      data = asRecord(await res.json());
    } catch {
      break;
    }
    if (!data) break;
    const list = Array.isArray(data.itemList) ? data.itemList : [];
    if (list.length === 0) break;
    const before = map.size;
    for (const raw of list) {
      const obj = asRecord(raw);
      if (!obj) continue;
      const item = tiktokItem(obj, username);
      if (item) add(map, item);
    }
    if (data.hasMorePrevious === false) break;
    const last = asRecord(list.at(-1));
    const createTime = num(last?.createTime || last?.create_time);
    const next = createTime > 0 ? String(createTime * 1000) : "";
    if (!next || next === cursor || map.size === before) break;
    cursor = next;
  }
}

function tiktokFromHtml(html: string, username: string) {
  const map = new Map<string, DiscoveredVideo>();
  for (const block of jsonScripts(html)) {
    walk(block, (obj) => {
      const item = tiktokItem(obj, username);
      if (item) add(map, item);
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

function youtubeFromValue(value: unknown, username: string | null) {
  const map = new Map<string, DiscoveredVideo>();
  const author = username ? `@${username}` : null;
  walk(value, (obj) => {
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
  return [...map.values()];
}

function youtubeFromHtml(html: string, username: string | null) {
  const map = new Map<string, DiscoveredVideo>();
  for (const block of jsonScripts(html)) {
    for (const item of youtubeFromValue(block, username)) add(map, item);
  }
  const author = username ? `@${username}` : null;
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

function continuationTokens(value: unknown) {
  const tokens: string[] = [];
  walk(value, (obj) => {
    const cmd = asRecord(obj.continuationCommand);
    if (typeof cmd?.token === "string" && cmd.token.length > 30) tokens.push(cmd.token);
  });
  return tokens;
}

async function youtubeBrowse(token: string) {
  const res = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20250925.01.00",
          hl: "en",
          gl: "US",
        },
      },
      continuation: token,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  return asRecord(await res.json());
}

async function youtubeRest(
  html: string,
  username: string | null,
  map: Map<string, DiscoveredVideo>
) {
  const seen = new Set<string>();
  const fromHtml = jsonScripts(html).flatMap((block) => continuationTokens(block));
  const fromText = [...html.matchAll(/"token":"(4qmF[^"]+)"/g)].map((match) => match[1]);
  let token = fromHtml.at(-1) || fromText.at(-1) || null;
  while (token && !seen.has(token)) {
    seen.add(token);
    let data: Record<string, unknown> | null = null;
    try {
      data = await youtubeBrowse(token);
    } catch {
      break;
    }
    if (!data) break;
    const before = map.size;
    for (const item of youtubeFromValue(data, username)) add(map, item);
    token = continuationTokens(data).find((next) => !seen.has(next)) ?? null;
    if (map.size === before) break;
  }
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
    try {
      await youtubeRest(profileHtml + videosHtml, username, map);
    } catch {
      /* first page still stands */
    }
  } else if (platform === "tiktok" && username) {
    const html = await fetchHtml(`https://www.tiktok.com/@${username}`, 2_500_000);
    for (const item of tiktokFromHtml(html, username)) add(map, item);
    const secUid = html.match(/"secUid":"([^"]+)"/)?.[1];
    if (secUid) {
      try {
        await tiktokRest(secUid, username, map);
      } catch {
        /* first page still stands */
      }
    }
    const safeUser = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const profileId = html.match(
      new RegExp(`"id":"(\\d{15,25})"\\s*,\\s*"shortId":"[^"]*"\\s*,\\s*"uniqueId":"${safeUser}"`)
    )?.[1];
    if (profileId) map.delete(profileId);
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

  return [...map.values()];
}
