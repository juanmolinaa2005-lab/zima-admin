export type BlitzPickAsset = {
  id: string;
  publicUrl: string;
  hashtag: string | null;
  name: string;
  folderId: string;
  folderName: string;
};

export type PickedCarousel = {
  folderId: string;
  folderName: string;
  slides: BlitzPickAsset[];
};

function tokenize(raw: string): Set<string> {
  return new Set(
    raw
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñü]+/i)
      .filter((w) => w.length > 3)
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function randomInt(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickFromFolder(
  pool: BlitzPickAsset[],
  count: number,
  used: Set<string>
): BlitzPickAsset[] {
  const available = shuffle(pool.filter((a) => !used.has(a.id)));
  const fallback = available.length ? available : shuffle(pool);
  if (fallback.length < 2) return [];
  const k = Math.min(count, fallback.length);
  const seeded = fallback.filter((a) => a.hashtag);
  const seed = seeded[0] ?? fallback[0]!;
  const seedTok = tokenize(seed.hashtag || seed.name);
  const rest = fallback
    .filter((a) => a.id !== seed.id)
    .map((a) => ({
      a,
      s: overlap(seedTok, tokenize(a.hashtag || a.name)),
    }))
    .sort((x, y) => y.s - x.s);
  return [seed, ...rest.slice(0, k - 1).map((x) => x.a)];
}

export function pickBlitzCarousels(
  assets: BlitzPickAsset[],
  opts: { count: number; photosMin: number; photosMax: number }
): PickedCarousel[] {
  const byFolder = new Map<string, BlitzPickAsset[]>();
  for (const asset of assets) {
    const list = byFolder.get(asset.folderId) ?? [];
    list.push(asset);
    byFolder.set(asset.folderId, list);
  }

  const folderIds = shuffle(
    [...byFolder.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([id]) => id)
  );
  if (!folderIds.length) return [];

  const used = new Set<string>();
  const out: PickedCarousel[] = [];
  let guard = 0;
  while (out.length < opts.count && guard < opts.count * 6) {
    guard += 1;
    const folderId = folderIds[out.length % folderIds.length]!;
    const pool = byFolder.get(folderId) ?? [];
    const want = randomInt(opts.photosMin, opts.photosMax);
    let slides = pickFromFolder(pool, want, used);
    if (slides.length < Math.min(opts.photosMin, 2)) {
      slides = pickFromFolder(pool, want, new Set());
    }
    if (slides.length < 2) continue;
    for (const slide of slides) used.add(slide.id);
    out.push({
      folderId,
      folderName: slides[0]?.folderName || pool[0]?.folderName || "Galería",
      slides,
    });
  }
  return out;
}
