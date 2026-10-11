export type MarketChart = "free" | "paid" | "grossing";

export type MarketApp = {
  id: string;
  name: string;
  seller: string;
  icon: string | null;
  genre: string;
  genreId: string | null;
  price: number;
  formattedPrice: string;
  rating: number | null;
  ratingCount: number;
  releasedAt: string | null;
  updatedAt: string | null;
  url: string;
  rank?: number;
};

export type MarketAppDetail = MarketApp & {
  description: string;
  releaseNotes: string;
  version: string;
  sizeBytes: number;
  minimumOs: string;
  contentRating: string;
  languages: string[];
  screenshots: string[];
  ipadScreenshots: string[];
  sellerUrl: string | null;
  bundleId: string;
  devices: number;
};

export type MarketReview = {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  version: string;
  updatedAt: string;
};

export const MARKET_COUNTRIES = [
  { code: "us", name: "Estados Unidos" },
  { code: "mx", name: "México" },
  { code: "es", name: "España" },
  { code: "gb", name: "Reino Unido" },
  { code: "ca", name: "Canadá" },
  { code: "br", name: "Brasil" },
  { code: "ar", name: "Argentina" },
  { code: "co", name: "Colombia" },
  { code: "cl", name: "Chile" },
  { code: "de", name: "Alemania" },
  { code: "fr", name: "Francia" },
  { code: "it", name: "Italia" },
  { code: "au", name: "Australia" },
  { code: "jp", name: "Japón" },
  { code: "in", name: "India" },
] as const;

export const MARKET_GENRES = [
  { id: "6000", name: "Negocios" },
  { id: "6018", name: "Libros" },
  { id: "6026", name: "Herramientas para desarrolladores" },
  { id: "6017", name: "Educación" },
  { id: "6016", name: "Entretenimiento" },
  { id: "6015", name: "Finanzas" },
  { id: "6023", name: "Comida y bebida" },
  { id: "6014", name: "Juegos" },
  { id: "6027", name: "Gráficos y diseño" },
  { id: "6013", name: "Salud y forma física" },
  { id: "6012", name: "Estilo de vida" },
  { id: "6020", name: "Medicina" },
  { id: "6011", name: "Música" },
  { id: "6010", name: "Navegación" },
  { id: "6009", name: "Noticias" },
  { id: "6008", name: "Foto y video" },
  { id: "6007", name: "Productividad" },
  { id: "6006", name: "Referencia" },
  { id: "6024", name: "Compras" },
  { id: "6005", name: "Redes sociales" },
  { id: "6004", name: "Deportes" },
  { id: "6003", name: "Viajes" },
  { id: "6002", name: "Utilidades" },
  { id: "6001", name: "Clima" },
] as const;

const CHART_FEED: Record<MarketChart, string> = {
  free: "topfreeapplications",
  paid: "toppaidapplications",
  grossing: "topgrossingapplications",
};

const HOUR = 3600;

export function safeCountry(raw: string | null | undefined) {
  const code = (raw || "us").toLowerCase();
  return MARKET_COUNTRIES.some((c) => c.code === code) ? code : "us";
}

export function safeGenre(raw: string | null | undefined) {
  return raw && MARKET_GENRES.some((g) => g.id === raw) ? raw : null;
}

export function safeChart(raw: string | null | undefined): MarketChart {
  return raw === "paid" || raw === "grossing" ? raw : "free";
}

async function getJson<T>(url: string, revalidate = HOUR): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: { "User-Agent": "Mozilla/5.0 (Zima Market)" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type LookupResult = {
  trackId: number;
  trackName: string;
  sellerName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
  primaryGenreName?: string;
  primaryGenreId?: number;
  price?: number;
  formattedPrice?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  releaseDate?: string;
  currentVersionReleaseDate?: string;
  trackViewUrl?: string;
  description?: string;
  releaseNotes?: string;
  version?: string;
  fileSizeBytes?: string;
  minimumOsVersion?: string;
  contentAdvisoryRating?: string;
  languageCodesISO2A?: string[];
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  sellerUrl?: string;
  bundleId?: string;
  supportedDevices?: string[];
  wrapperType?: string;
  kind?: string;
};

function toApp(row: LookupResult): MarketApp {
  return {
    id: String(row.trackId),
    name: row.trackName,
    seller: row.sellerName || row.artistName || "",
    icon: row.artworkUrl512 || row.artworkUrl100 || null,
    genre: row.primaryGenreName || "",
    genreId: row.primaryGenreId ? String(row.primaryGenreId) : null,
    price: row.price ?? 0,
    formattedPrice: row.formattedPrice || (row.price ? `$${row.price}` : "Gratis"),
    rating: typeof row.averageUserRating === "number" ? row.averageUserRating : null,
    ratingCount: row.userRatingCount ?? 0,
    releasedAt: row.releaseDate || null,
    updatedAt: row.currentVersionReleaseDate || null,
    url: row.trackViewUrl || `https://apps.apple.com/app/id${row.trackId}`,
  };
}

function toDetail(row: LookupResult): MarketAppDetail {
  return {
    ...toApp(row),
    description: row.description || "",
    releaseNotes: row.releaseNotes || "",
    version: row.version || "",
    sizeBytes: Number(row.fileSizeBytes || 0),
    minimumOs: row.minimumOsVersion || "",
    contentRating: row.contentAdvisoryRating || "",
    languages: row.languageCodesISO2A || [],
    screenshots: row.screenshotUrls || [],
    ipadScreenshots: row.ipadScreenshotUrls || [],
    sellerUrl: row.sellerUrl || null,
    bundleId: row.bundleId || "",
    devices: row.supportedDevices?.length ?? 0,
  };
}

async function lookupRows(ids: string[], country: string) {
  const rows: LookupResult[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const data = await getJson<{ results: LookupResult[] }>(
      `https://itunes.apple.com/lookup?id=${chunk.join(",")}&country=${country}&entity=software`
    );
    rows.push(...(data?.results ?? []).filter((r) => r.wrapperType === "software" || r.kind === "software"));
  }
  return rows;
}

type FeedEntry = {
  id: { attributes: { "im:id": string } };
  "im:name": { label: string };
  "im:artist"?: { label: string };
  "im:image"?: { label: string }[];
  category?: { attributes: { label: string; "im:id": string } };
  "im:price"?: { attributes: { amount: string } ; label: string };
  "im:releaseDate"?: { label: string };
  link?: { attributes: { href: string } } | { attributes: { href: string } }[];
};

export async function chartIds(chart: MarketChart, country: string, genre: string | null, limit = 100) {
  const genrePart = genre ? `/genre=${genre}` : "";
  const data = await getJson<{ feed: { entry?: FeedEntry[] | FeedEntry } }>(
    `https://itunes.apple.com/${country}/rss/${CHART_FEED[chart]}/limit=${limit}${genrePart}/json`
  );
  const raw = data?.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.map((entry) => ({
    id: entry.id.attributes["im:id"],
    name: entry["im:name"].label,
    seller: entry["im:artist"]?.label || "",
    icon: entry["im:image"]?.at(-1)?.label || null,
    genre: entry.category?.attributes.label || "",
    genreId: entry.category?.attributes["im:id"] || null,
  }));
}

export async function topChart(chart: MarketChart, country: string, genre: string | null, limit = 100) {
  const entries = await chartIds(chart, country, genre, limit);
  const rows = await lookupRows(entries.map((e) => e.id), country);
  const byId = new Map(rows.map((row) => [String(row.trackId), row]));
  return entries.map((entry, index): MarketApp => {
    const row = byId.get(entry.id);
    if (row) return { ...toApp(row), rank: index + 1 };
    return {
      id: entry.id,
      name: entry.name,
      seller: entry.seller,
      icon: entry.icon,
      genre: entry.genre,
      genreId: entry.genreId,
      price: 0,
      formattedPrice: "",
      rating: null,
      ratingCount: 0,
      releasedAt: null,
      updatedAt: null,
      url: `https://apps.apple.com/${country}/app/id${entry.id}`,
      rank: index + 1,
    };
  });
}

export async function searchApps(term: string, country: string, limit = 100) {
  const data = await getJson<{ results: LookupResult[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${limit}`,
    HOUR / 2
  );
  return (data?.results ?? []).map(toApp);
}

export async function lookupApps(ids: string[], country: string) {
  const rows = await lookupRows(ids, country);
  const byId = new Map(rows.map((row) => [String(row.trackId), toApp(row)]));
  return ids.map((id) => byId.get(id)).filter((app): app is MarketApp => Boolean(app));
}

export async function appDetail(id: string, country: string) {
  const rows = await lookupRows([id], country);
  if (rows.length) return toDetail(rows[0]);
  if (country !== "us") {
    const fallback = await lookupRows([id], "us");
    if (fallback.length) return toDetail(fallback[0]);
  }
  return null;
}

type ReviewEntry = {
  id: { label: string };
  author?: { name?: { label: string } };
  "im:rating"?: { label: string };
  "im:version"?: { label: string };
  title?: { label: string };
  content?: { label: string };
  updated?: { label: string };
};

export async function appReviews(id: string, country: string, pages = 3) {
  const recent = await reviewPages(id, country, pages, "mostrecent");
  if (recent.length) return recent;
  const helpful = await reviewPages(id, country, pages, "mosthelpful");
  if (helpful.length) return helpful;
  return storePageReviews(id, country);
}

async function storePageReviews(id: string, country: string): Promise<MarketReview[]> {
  try {
    const res = await fetch(`https://apps.apple.com/${country}/app/id${id}?see-all=reviews`, {
      next: { revalidate: HOUR / 2 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];
    const found = new Map<string, MarketReview>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (record.$kind === "Review" && typeof record.id === "string" && !found.has(record.id)) {
        found.set(record.id, {
          id: record.id,
          author: String(record.reviewerName || ""),
          rating: Number(record.rating || 0),
          title: String(record.title || ""),
          content: String(record.contents || ""),
          version: "",
          updatedAt: String(record.date || ""),
        });
      }
      Object.values(record).forEach(walk);
    };
    walk(JSON.parse(match[1]));
    return [...found.values()].filter((review) => review.rating > 0);
  } catch {
    return [];
  }
}

async function reviewPages(id: string, country: string, pages: number, sort: "mostrecent" | "mosthelpful") {
  const all: MarketReview[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await getJson<{ feed: { entry?: ReviewEntry[] | ReviewEntry } }>(
      `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`,
      HOUR / 2
    );
    const raw = data?.feed?.entry;
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const reviews = entries
      .filter((entry) => entry["im:rating"])
      .map((entry) => ({
        id: entry.id.label,
        author: entry.author?.name?.label || "",
        rating: Number(entry["im:rating"]?.label || 0),
        title: entry.title?.label || "",
        content: entry.content?.label || "",
        version: entry["im:version"]?.label || "",
        updatedAt: entry.updated?.label || "",
      }));
    all.push(...reviews);
    if (reviews.length < 50) break;
  }
  return all;
}

export async function countryRanks(id: string) {
  const charts: MarketChart[] = ["free", "grossing"];
  const jobs = MARKET_COUNTRIES.flatMap((country) =>
    charts.map(async (chart) => {
      const entries = await chartIds(chart, country.code, null, 200);
      const index = entries.findIndex((entry) => entry.id === id);
      return index >= 0 ? { country: country.code as string, chart, rank: index + 1 } : null;
    })
  );
  const found = (await Promise.all(jobs)).filter(
    (item): item is { country: string; chart: MarketChart; rank: number } => Boolean(item)
  );
  return found.sort((a, b) => a.rank - b.rank);
}
