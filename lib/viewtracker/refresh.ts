import { fetchPublicVideoStats } from "./stats";
import { fetchVideoPreview, parseVideoUrl } from "./video";

export async function statsPatch(url: string, platform: string | null, videoId: string | null, currentViews: number) {
  const parsed = parseVideoUrl(url);
  const plat = parsed?.platform ?? "web";
  const preview = await fetchVideoPreview(url, plat, parsed?.videoId ?? videoId);
  const stats = await fetchPublicVideoStats(url, plat, preview.thumbnailUrl);
  const nextViews = stats.views ?? currentViews;
  return {
    title: stats.title || preview.title,
    author: stats.author || preview.author,
    thumbnail_url: stats.thumbnailUrl || preview.thumbnailUrl,
    views: nextViews,
    views_prev: currentViews,
    likes: stats.likes ?? 0,
    comments: stats.comments ?? 0,
    shares: stats.shares ?? 0,
    saves: stats.saves ?? 0,
    duration_seconds: stats.durationSeconds,
    posted_at: stats.postedAt,
    last_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
