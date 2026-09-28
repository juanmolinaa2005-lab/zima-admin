const CACHE_NAME = "zima-blitz-images-v1";
const MEMORY_LIMIT = 60;

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const lru: string[] = [];
const pinned = new Set<string>();
const listeners = new Set<(url: string) => void>();

function notify(url: string) {
  listeners.forEach((fn) => fn(url));
}

export function subscribeBlitzImageCache(fn: (url: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function cachedBlitzSrc(url: string): string | null {
  if (!url) return null;
  return memory.get(url) ?? null;
}

export function pinBlitzImages(urls: string[]) {
  pinned.clear();
  for (const url of urls) {
    if (url && !url.startsWith("blob:")) pinned.add(url);
  }
}

function touch(url: string) {
  const i = lru.indexOf(url);
  if (i >= 0) lru.splice(i, 1);
  lru.push(url);
  while (lru.length > MEMORY_LIMIT) {
    const oldest = lru.find((u) => !pinned.has(u)) ?? lru[0];
    if (!oldest || pinned.has(oldest)) break;
    lru.splice(lru.indexOf(oldest), 1);
    const blobUrl = memory.get(oldest);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    memory.delete(oldest);
  }
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function decodeObjectUrl(objectUrl: string) {
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
  } catch {
    /* ignore */
  }
}

function remember(url: string, blobUrl: string) {
  const prev = memory.get(url);
  if (prev && prev !== blobUrl) URL.revokeObjectURL(prev);
  memory.set(url, blobUrl);
  touch(url);
  notify(url);
}

export async function cacheBlitzImage(url: string): Promise<string | null> {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url || null;
  const hit = memory.get(url);
  if (hit) {
    touch(url);
    return hit;
  }
  const pending = inflight.get(url);
  if (pending) return pending;

  const job = (async () => {
    try {
      const cache = await openCache();
      let blob: Blob | null = null;
      const cached = cache ? await cache.match(url) : undefined;
      if (cached?.ok) {
        blob = await cached.blob();
      } else {
        const res = await fetch(url, {
          mode: "cors",
          credentials: "omit",
          cache: "force-cache",
        });
        if (!res.ok) throw new Error("fetch failed");
        blob = await res.blob();
        if (cache && blob.size) {
          try {
            await cache.put(
              url,
              new Response(blob, {
                headers: {
                  "Content-Type": blob.type || "image/jpeg",
                  "Cache-Control": "max-age=31536000, immutable",
                },
              })
            );
          } catch {
            /* quota */
          }
        }
      }
      if (!blob?.size) return null;
      const objectUrl = URL.createObjectURL(blob);
      remember(url, objectUrl);
      await decodeObjectUrl(objectUrl);
      return objectUrl;
    } catch {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, job);
  return job;
}

export async function prefetchBlitzImages(urls: string[]) {
  const unique = [
    ...new Set(
      urls.filter((u) => u && !u.startsWith("blob:") && !u.startsWith("data:"))
    ),
  ];
  if (!unique.length) return;
  const concurrency = 4;
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const url = unique[i++];
      if (!url) break;
      await cacheBlitzImage(url);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker())
  );
}
