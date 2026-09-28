export type GalleryAsset = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "other";
  folderId: string | null;
  storagePath: string;
  publicUrl: string;
  hashtag: string | null;
  sortOrder: number;
  createdAt: string;
};

export const GALLERY_ASSET_SELECT =
  "id, name, mime_type, size_bytes, kind, folder_id, storage_path, public_url, hashtag, sort_order, created_at";

export function normalizeHashtag(
  raw: unknown,
  fallback = ""
): string | null {
  const text = (typeof raw === "string" ? raw : fallback)
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, 4000);
}

export function hashtagFromFileName(name: string): string | null {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return normalizeHashtag(base);
}

export function galleryStoragePathFromPublicUrl(
  publicUrl: string,
  projectId: string
): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = "/storage/v1/object/public/gallery/";
    const i = parsed.pathname.indexOf(marker);
    if (i < 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(i + marker.length));
    if (!path.startsWith(`${projectId}/`)) return null;
    return path;
  } catch {
    return null;
  }
}

export function mapGalleryAsset(row: {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
  folder_id: string | null;
  storage_path: string;
  public_url: string;
  hashtag?: string | null;
  sort_order?: number | null;
  created_at: string;
}): GalleryAsset {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    kind: (row.kind === "image" ||
    row.kind === "video" ||
    row.kind === "audio"
      ? row.kind
      : "other") as "image" | "video" | "audio" | "other",
    folderId: row.folder_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    hashtag: normalizeHashtag(row.hashtag),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}
