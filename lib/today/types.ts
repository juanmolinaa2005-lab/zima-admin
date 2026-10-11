export type TodayVideo = {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  platform: string | null;
  thumbnailUrl: string | null;
  views: number;
  postedAt: string | null;
};

export type TodayData = {
  views: {
    total: number;
    last7d: number | null;
    series: { day: string; views: number }[];
  };
  videos: {
    tracked: number;
    posted7d: number;
    median: number;
    hits: number;
    top: TodayVideo[];
  };
  accounts: { total: number; platforms: string[] };
  publishing: {
    flows: number;
    active: number;
    queued: number;
    toReview: number;
    nextAt: string | null;
    lastError: string | null;
  };
  revenue: {
    connected: boolean;
    net: number | null;
    newUsers: number | null;
    mrr: number | null;
    days: number;
  };
  page: { published: boolean; slug: string | null; subscribers: number };
  productType: "app" | "web" | "both" | null;
  onboarded: boolean;
  pitch: string | null;
  answers: Record<string, string | string[]>;
  plan: Record<string, string>;
};
