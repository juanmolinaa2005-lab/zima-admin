import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { classifyAppUrl } from "@/lib/creator/simulator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPublicHttpUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return null;
  }
  if (/^(10|127|169\.254)\./.test(host)) return null;
  if (/^192\.168\./.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null;
  return parsed;
}

function absUrl(base: URL, value: string | undefined) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() ?? "";
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = isPublicHttpUrl((body.url || "").trim());
  if (!parsed) {
    return NextResponse.json({ error: "URL no válida." }, { status: 400 });
  }

  let html = "";
  try {
    const res = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html")) {
      html = (await res.text()).slice(0, 180_000);
    }
  } catch {
    html = "";
  }

  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*>/i)?.[0] ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "";
  const ogTitle = title.includes("content=")
    ? attr(title, "content")
    : title.trim();

  const iconTag =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0] ||
    html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i)?.[0] ||
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i)?.[0] ||
    "";

  const icon =
    absUrl(parsed, attr(iconTag, "content") || attr(iconTag, "href")) ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`;

  return NextResponse.json({
    title: ogTitle.replace(/\s+/g, " ").trim().slice(0, 80) || parsed.hostname,
    icon,
    kind: classifyAppUrl(parsed.toString()),
  });
}
