export type ProductPage = {
  slug: string;
  published: boolean;
  title: string | null;
  tagline: string | null;
  description: string | null;
  website_url: string | null;
  ios_url: string | null;
  android_url: string | null;
  collect_emails: boolean;
  accent: string;
};

export type PageUpdate = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export type PageSubscriber = {
  id: string;
  email: string;
  created_at: string;
};

export const PAGE_COLUMNS =
  "slug, published, title, tagline, description, website_url, ios_url, android_url, collect_emails, accent";

/** Top-level paths owned by the app; a product page can never use them. */
export const RESERVED_SLUGS = new Set([
  "api",
  "app",
  "auth",
  "admin",
  "data-deletion",
  "docs",
  "legal",
  "login",
  "osg",
  "p",
  "privacy",
  "projects",
  "settings",
  "terms",
  "www",
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PAGE_HOST = "vantko.com";
