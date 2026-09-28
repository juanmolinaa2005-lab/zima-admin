import type { DiscoveredVideo } from "@/lib/viewtracker/account-feed";

export async function ingestDiscoveredVideos(
  supabase: { from: (table: string) => unknown },
  opts: {
    projectId: string;
    userId: string;
    accountId: string;
    items: DiscoveredVideo[];
  }
) {
  if (opts.items.length === 0) return { inserted: 0, total: 0 };
  const now = new Date().toISOString();
  const rows = opts.items.map((item) => ({
    project_id: opts.projectId,
    user_id: opts.userId,
    account_id: opts.accountId,
    url: item.url,
    platform: item.platform,
    video_id: item.videoId,
    title: item.title,
    author: item.author,
    thumbnail_url: item.thumbnailUrl,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    saves: item.saves,
    duration_seconds: item.durationSeconds,
    posted_at: item.postedAt,
    last_refreshed_at: now,
    updated_at: now,
  }));

  const chunkSize = 40;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const table = supabase.from("project_tracked_videos") as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
    const { error } = await table.upsert(chunk, {
      onConflict: "project_id,user_id,url",
    });
    if (error) throw new Error(error.message);
    inserted += chunk.length;
  }
  return { inserted, total: opts.items.length };
}
