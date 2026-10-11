import { searchApps, type MarketApp } from "./appstore";

const STOREFRONTS: Record<string, string> = {
  us: "143441",
  mx: "143468",
  es: "143454",
  gb: "143444",
  ca: "143455",
  br: "143503",
  ar: "143505",
  co: "143501",
  cl: "143483",
  de: "143443",
  fr: "143442",
  it: "143450",
  au: "143460",
  jp: "143462",
  in: "143467",
};

const DAY = 86_400;

export function normalizeKeyword(raw: string) {
  return raw.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Apple's App Store autocomplete, in the order Apple ranks them. */
export async function searchHints(term: string, country: string): Promise<string[]> {
  const storefront = STOREFRONTS[country] || STOREFRONTS.us;
  try {
    const res = await fetch(
      `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=${encodeURIComponent(term)}`,
      {
        next: { revalidate: DAY },
        headers: { "X-Apple-Store-Front": `${storefront}-1,29`, "User-Agent": "AppStore/3.0 iOS/17.0" },
      }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const terms: string[] = [];
    const re = /<key>term<\/key>\s*<string>([^<]*)<\/string>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml))) {
      terms.push(
        match[1]
          .replace(/&amp;/g, "&")
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .toLowerCase()
          .trim()
      );
    }
    return terms;
  } catch {
    return [];
  }
}

export type KeywordPopularity = {
  score: number;
  prefix: string | null;
  position: number | null;
};

/**
 * Popularity signal from Apple's autocomplete: the fewer letters needed for
 * Apple to suggest the keyword (and the higher it appears), the more people search it.
 */
export async function keywordPopularity(term: string, country: string): Promise<KeywordPopularity> {
  const lengths = [...new Set([1, 2, 3, 4, 6, 8, 11, term.length].filter((n) => n <= term.length))].sort((a, b) => a - b);
  for (const length of lengths) {
    const prefix = term.slice(0, length);
    if (!prefix.trim()) continue;
    const hints = await searchHints(prefix, country);
    const index = hints.indexOf(term);
    if (index >= 0) {
      const typed = length / term.length;
      const score = Math.round(Math.max(5, (1 - typed * 0.85) * (1 - index * 0.04) * 100));
      return { score: Math.min(100, score), prefix, position: index + 1 };
    }
  }
  return { score: 0, prefix: null, position: null };
}

export type KeywordDifficulty = {
  score: number;
  avgRatings: number;
  titleMatches: number;
  sample: number;
};

/** Difficulty from who already ranks: how established the top 10 is and how many target the word in their name. */
export function keywordDifficulty(term: string, results: MarketApp[]): KeywordDifficulty {
  const top = results.slice(0, 10);
  if (top.length === 0) return { score: 0, avgRatings: 0, titleMatches: 0, sample: 0 };
  const words = term.split(" ").filter((word) => word.length > 1);
  const titleMatches = top.filter((app) => {
    const name = app.name.toLowerCase();
    return words.every((word) => name.includes(word));
  }).length;
  const strength =
    top.reduce((sum, app) => sum + Math.min(1, Math.log10(app.ratingCount + 1) / 6), 0) / top.length;
  const avgRatings = Math.round(top.reduce((sum, app) => sum + app.ratingCount, 0) / top.length);
  const score = Math.round(strength * 75 + (titleMatches / top.length) * 25);
  return { score: Math.min(100, score), avgRatings, titleMatches, sample: top.length };
}

export async function analyzeKeyword(rawTerm: string, country: string) {
  const term = normalizeKeyword(rawTerm);
  const [results, popularity, related] = await Promise.all([
    searchApps(term, country, 200),
    keywordPopularity(term, country),
    searchHints(term, country),
  ]);
  return {
    term,
    country,
    popularity,
    difficulty: keywordDifficulty(term, results),
    resultCount: results.length,
    top: results.slice(0, 10).map((app, index) => ({ ...app, rank: index + 1 })),
    ranking: results.map((app) => app.id),
    related: related.filter((value) => value !== term).slice(0, 12),
  };
}

export type KeywordAnalysis = Awaited<ReturnType<typeof analyzeKeyword>>;
