export function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function engagementRate(input: {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
}) {
  if (input.views <= 0) return 0;
  return (
    ((input.likes + input.comments + input.shares + (input.saves ?? 0)) /
      input.views) *
    100
  );
}

export function growthMultiplier(current: number, previous: number) {
  if (previous <= 0) return null;
  return current / previous;
}

export function timeAgo(raw: string | null | undefined) {
  if (!raw) return "—";
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(raw).toLocaleDateString();
}

export function formatPostedAt(raw: string | null | undefined) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseIsoDuration(value: string | null | undefined) {
  if (!value) return null;
  const m = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  const total = h * 3600 + min * 60 + s;
  return total > 0 ? total : null;
}
