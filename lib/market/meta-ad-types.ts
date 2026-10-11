export const META_AD_COUNTRIES = [
  { code: "US", name: "Estados Unidos" },
  { code: "ALL", name: "Todo el mundo" },
  { code: "GB", name: "Reino Unido" },
  { code: "CA", name: "Canadá" },
  { code: "MX", name: "México" },
  { code: "BR", name: "Brasil" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "ES", name: "España" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "NL", name: "Países Bajos" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Irlanda" },
  { code: "PL", name: "Polonia" },
  { code: "SE", name: "Suecia" },
  { code: "BE", name: "Bélgica" },
  { code: "AT", name: "Austria" },
  { code: "JP", name: "Japón" },
  { code: "IN", name: "India" },
] as const;

export type AdMedia = { video: string | null; image: string | null; avatar: string | null };
export type MetaAd = {
  id: string;
  pageId: string;
  pageName: string;
  bodies: string[];
  titles: string[];
  descriptions: string[];
  captions: string[];
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string | null;
  platforms: string[];
  languages: string[];
  reach: number | null;
  libraryUrl: string;
  active?: boolean;
  media?: AdMedia;
};

export type AdSearchParams = { q: string; countries: string[]; active: boolean; after?: string; pageId?: string };
export type AdCollection = {
  ads: MetaAd[];
  after: string | null;
  source: "meta_api" | "meta_public";
  partial: boolean;
};
export type AdSearchResult = {
  ads: MetaAd[];
  after: string | null;
  state: "queued" | "running" | "ready" | "error";
  fetchedAt: string | null;
  stale: boolean;
  partial: boolean;
  notice: string | null;
  source: "meta_api" | "meta_public" | "catalog" | null;
};
