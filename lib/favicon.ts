export function faviconUrl(pageUrl?: string | null, size = 64): string | null {
  try {
    if (!pageUrl) return null;
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return null;
  }
}
