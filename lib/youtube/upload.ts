import type { OAuthTokenBundle } from "@/lib/redes/oauth";

type PublishResult = {
  externalId?: string;
  status: "published" | "uploading" | "failed";
  message?: string;
  raw?: unknown;
};

export type YoutubePrivacy = "public" | "unlisted" | "private";

const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_BYTES = 256 * 1024 * 1024;

function splitTitleDescription(caption: string): {
  title: string;
  description: string;
} {
  const text = caption.trim();
  if (!text) return { title: "Video", description: "" };
  const nl = text.indexOf("\n");
  if (nl > 0) {
    return {
      title: text.slice(0, Math.min(nl, 100)).trim() || "Video",
      description: text.slice(nl + 1).trim(),
    };
  }
  return {
    title: text.slice(0, 100),
    description: text.length > 100 ? text : "",
  };
}

async function startResumableSession(input: {
  accessToken: string;
  title: string;
  description: string;
  privacy: YoutubePrivacy;
  mimeType: string;
  contentLength: number;
}): Promise<string> {
  const url =
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.mimeType,
      "X-Upload-Content-Length": String(input.contentLength),
    },
    body: JSON.stringify({
      snippet: {
        title: input.title,
        description: input.description,
        categoryId: "22",
      },
      status: {
        privacyStatus: input.privacy,
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  const location = res.headers.get("location") || res.headers.get("Location");
  if (!res.ok || !location) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      data.error?.message ||
        `YouTube could not start the upload session (${res.status}).`
    );
  }
  return location;
}

async function uploadChunks(
  sessionUrl: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<{ id?: string; error?: { message?: string } }> {
  const total = bytes.byteLength;
  let offset = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = bytes.slice(offset, end);
    const res = await fetch(sessionUrl, {
      method: "PUT",
      redirect: "manual",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    if (end < total) {
      if (res.status !== 308 && res.status !== 0 && !res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          data.error?.message || `YouTube chunk upload failed (${res.status}).`
        );
      }
      offset = end;
      continue;
    }

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.id) {
      throw new Error(
        data.error?.message || `YouTube upload failed (${res.status}).`
      );
    }
    return data;
  }

  throw new Error("YouTube upload ended without a video id.");
}

export async function publishYouTubeVideo(
  tokens: OAuthTokenBundle,
  videoUrl: string,
  caption: string,
  privacy: YoutubePrivacy = "public"
): Promise<PublishResult> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    return {
      status: "failed",
      message: `Could not download the video to upload (${videoRes.status}).`,
    };
  }

  const mimeType = (videoRes.headers.get("content-type") || "video/mp4")
    .split(";")[0]!
    .trim();
  const buf = new Uint8Array(await videoRes.arrayBuffer());
  if (!buf.byteLength) {
    return { status: "failed", message: "The video file is empty." };
  }
  if (buf.byteLength > MAX_BYTES) {
    return {
      status: "failed",
      message: "Video is larger than 256 MB. Compress it and try again.",
    };
  }

  const { title, description } = splitTitleDescription(caption);

  try {
    const sessionUrl = await startResumableSession({
      accessToken: tokens.access_token,
      title,
      description,
      privacy,
      mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4",
      contentLength: buf.byteLength,
    });
    const uploaded = await uploadChunks(
      sessionUrl,
      buf,
      mimeType.startsWith("video/") ? mimeType : "video/mp4"
    );
    return {
      status: "published",
      externalId: uploaded.id,
      message: `Published to YouTube (${privacy}).`,
      raw: uploaded,
    };
  } catch (e) {
    return {
      status: "failed",
      message:
        e instanceof Error
          ? e.message
          : "YouTube Data API v3 upload failed.",
    };
  }
}
