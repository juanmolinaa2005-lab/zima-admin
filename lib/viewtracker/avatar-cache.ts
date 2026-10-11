export function publicProfileUrl(platform: string | null, username: string | null): string | null {
  const user = (username || "").replace(/^@/, "").trim();
  if (!user || !platform) return null;
  const handle = encodeURIComponent(user);
  if (platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (platform === "instagram") return `https://www.instagram.com/${handle}/`;
  if (platform === "youtube") return `https://www.youtube.com/@${handle}`;
  if (platform === "x" || platform === "twitter") return `https://x.com/${handle}`;
  return null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer,
        opts: { contentType: string; upsert: boolean }
      ) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

export function isHostedAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname;
    return path.includes("/storage/v1/object/public/gallery/") && path.includes("/avatars/");
  } catch {
    return false;
  }
}

function slug(platform: string | null, username: string | null): string | null {
  const user = (username || "").replace(/^@/, "").trim().toLowerCase();
  if (!user) return null;
  const host = (platform || "web").toLowerCase().replace(/[^a-z0-9]/g, "") || "web";
  const handle = user.replace(/[^a-z0-9._-]/g, "");
  if (!handle) return null;
  return `${host}-${handle}`.slice(0, 80);
}

async function hostedCopy(supabase: StorageClient, projectId: string, name: string): Promise<string | null> {
  const checks = await Promise.all(
    ["jpg", "png", "webp"].map(async (ext) => {
      const url = supabase.storage.from("gallery").getPublicUrl(`${projectId}/avatars/${name}.${ext}`).data
        .publicUrl;
      try {
        const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4_000) });
        const type = head.headers.get("content-type") || "";
        if (head.ok && type.startsWith("image/")) return url;
      } catch {
        /* try the next extension */
      }
      return null;
    })
  );
  return checks.find(Boolean) ?? null;
}

/** Copy a profile photo into our public gallery so the UI does not depend on expiring CDN links. */
export async function persistProfileAvatar(
  supabase: StorageClient,
  opts: {
    projectId: string;
    platform: string | null;
    username: string | null;
    sourceUrl: string | null;
    reuse?: boolean;
  }
): Promise<string | null> {
  const name = slug(opts.platform, opts.username);
  if (!name) return null;
  if (opts.reuse) {
    const existing = await hostedCopy(supabase, opts.projectId, name);
    if (existing) return existing;
  }
  const source = (opts.sourceUrl || "").trim();
  if (!source.startsWith("http") || source.includes("unavatar.io") || isHostedAvatar(source)) {
    return isHostedAvatar(source) ? source : null;
  }
  try {
    const res = await fetch(source, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": UA,
        Referer: "https://www.tiktok.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength < 400 || bytes.byteLength > 2_000_000) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${opts.projectId}/avatars/${name}.${ext}`;
    const { error } = await supabase.storage.from("gallery").upload(path, bytes, {
      contentType: type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    const publicUrl = supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl;
    return `${publicUrl}?v=${Date.now()}`;
  } catch {
    return null;
  }
}
