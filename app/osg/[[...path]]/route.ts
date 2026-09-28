import { NextResponse } from "next/server";
import { injectSkin, OSG_UPSTREAM, rewriteAssetPaths } from "@/lib/osg/skin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ path?: string[] }> };

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "content-encoding",
  "content-length",
]);

function upstreamUrl(path: string[], search: string) {
  const suffix = path.length ? `/${path.join("/")}` : "/";
  return `${OSG_UPSTREAM}${suffix}${search}`;
}

function passHeaders(upstream: Headers) {
  const headers = new Headers();
  upstream.forEach((value, key) => {
    if (HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "x-frame-options") return;
    if (key.toLowerCase() === "content-security-policy") return;
    headers.set(key, value);
  });
  headers.set("cache-control", "public, max-age=3600");
  return headers;
}

async function proxy(request: Request, context: Params) {
  const { path = [] } = await context.params;
  const url = new URL(request.url);
  const target = upstreamUrl(path, url.search);
  const upstream = await fetch(target, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: request.headers.get("accept") ?? "*/*",
      "accept-language": request.headers.get("accept-language") ?? "es,en;q=0.8",
      "user-agent":
        request.headers.get("user-agent") ??
        "Mozilla/5.0 (compatible; Capturas)",
    },
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = injectSkin(await upstream.text());
    return new NextResponse(html, {
      status: upstream.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store, no-cache, must-revalidate",
        pragma: "no-cache",
      },
    });
  }

  if (
    contentType.includes("javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("application/json") ||
    contentType.includes("text/plain")
  ) {
    const body = rewriteAssetPaths(await upstream.text());
    const headers = passHeaders(upstream.headers);
    headers.set("content-type", contentType);
    return new NextResponse(body, { status: upstream.status, headers });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: passHeaders(upstream.headers),
  });
}

export async function GET(request: Request, context: Params) {
  return proxy(request, context);
}

export async function HEAD(request: Request, context: Params) {
  return proxy(request, context);
}
