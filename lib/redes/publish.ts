import { decryptSecret } from "@/lib/crypto";
import type { OAuthTokenBundle } from "./oauth";
import type { SocialPlatform } from "./types";
import {
  publishYouTubeVideo,
  type YoutubePrivacy,
} from "@/lib/youtube/upload";

export type PublishResult = {
  externalId?: string;
  status: "published" | "uploading" | "failed";
  message?: string;
  raw?: unknown;
};

type GraphHost = "graph.instagram.com" | "graph.facebook.com";

/** Publish a publicly reachable video URL to the connected account. */
export async function publishVideo(input: {
  platform: SocialPlatform;
  tokens: OAuthTokenBundle;
  videoUrl: string;
  caption: string;
  youtubePrivacy?: YoutubePrivacy;
}): Promise<PublishResult> {
  if (input.platform === "tiktok") {
    return publishTikTok(input.tokens, input.videoUrl, input.caption);
  }
  if (input.platform === "youtube") {
    return publishYouTubeVideo(
      input.tokens,
      input.videoUrl,
      input.caption,
      input.youtubePrivacy || "public"
    );
  }
  if (input.platform === "instagram") {
    return publishInstagramReel(input.tokens, input.videoUrl, input.caption);
  }
  if (input.platform === "facebook") {
    return {
      status: "failed",
      message:
        "Facebook Page video upload requires a Page access token + page id. Connect via Meta and map a Page next.",
    };
  }
  return {
    status: "failed",
    message:
      "X video publish needs chunked media upload. Wire media/upload + tweets create next.",
  };
}

async function publishTikTok(
  tokens: OAuthTokenBundle,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  const initRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    }
  );
  const initData = (await initRes.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (!initRes.ok || initData.error?.code) {
    const direct = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: caption.slice(0, 2200),
            privacy_level: "SELF_ONLY",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      }
    );
    const directData = (await direct.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (!direct.ok || directData.error?.code) {
      return {
        status: "failed",
        message:
          directData.error?.message ||
          initData.error?.message ||
          "TikTok publish failed. Check app audit + scopes video.upload / video.publish.",
        raw: { initData, directData },
      };
    }
    return {
      status: "uploading",
      externalId: directData.data?.publish_id,
      message: "TikTok accepted the video (direct post). Processing on TikTok.",
      raw: directData,
    };
  }

  return {
    status: "uploading",
    externalId: initData.data?.publish_id,
    message:
      "Sent to TikTok inbox as draft. Open TikTok to finish editing/publishing.",
    raw: initData,
  };
}

async function resolveInstagramTarget(tokens: OAuthTokenBundle): Promise<
  | { igUserId: string; pageToken: string; graphHost: GraphHost }
  | { error: string; raw?: unknown }
> {
  const isIgLogin =
    (tokens.raw as { provider?: string } | undefined)?.provider ===
    "instagram_login";

  if (isIgLogin || tokens.open_id) {
    if (tokens.open_id) {
      return {
        igUserId: tokens.open_id,
        pageToken: tokens.access_token,
        graphHost: "graph.instagram.com",
      };
    }
    const meRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${encodeURIComponent(tokens.access_token)}`
    );
    const me = (await meRes.json()) as {
      user_id?: string;
      id?: string;
      error?: { message?: string };
    };
    if (meRes.ok && (me.user_id || me.id)) {
      return {
        igUserId: me.user_id || me.id!,
        pageToken: tokens.access_token,
        graphHost: "graph.instagram.com",
      };
    }
  }

  const accountsRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(tokens.access_token)}`
  );
  const accountsData = (await accountsRes.json()) as {
    data?: { id?: string; name?: string; access_token?: string }[];
    error?: { message?: string };
  };

  for (const page of accountsData.data ?? []) {
    if (!page.id) continue;
    const pageToken = page.access_token || tokens.access_token;
    const pRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id}&access_token=${encodeURIComponent(pageToken)}`
    );
    const pData = (await pRes.json()) as {
      instagram_business_account?: { id?: string };
    };
    if (pData.instagram_business_account?.id) {
      return {
        igUserId: pData.instagram_business_account.id,
        pageToken,
        graphHost: "graph.facebook.com",
      };
    }
  }

  // Try Instagram Graph with the same token (Explorer IG user tokens)
  const igMe = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${encodeURIComponent(tokens.access_token)}`
  );
  const igData = (await igMe.json()) as {
    user_id?: string;
    id?: string;
    error?: { message?: string };
  };
  if (igMe.ok && (igData.user_id || igData.id)) {
    return {
      igUserId: igData.user_id || igData.id!,
      pageToken: tokens.access_token,
      graphHost: "graph.instagram.com",
    };
  }

  return {
    error:
      accountsData.error?.message ||
      igData.error?.message ||
      "No Instagram account found for this token. Reconnect with Instagram Login OAuth (scopes instagram_business_basic + instagram_business_content_publish).",
    raw: { accountsData, igData },
  };
}

async function waitForIgContainer(
  graphHost: GraphHost,
  containerId: string,
  pageToken: string,
  attempts = 24,
  delayMs = 2500
): Promise<{ ok: true } | { ok: false; message: string; raw?: unknown }> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(
      `https://${graphHost}/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(pageToken)}`
    );
    const data = (await res.json()) as {
      status_code?: string;
      status?: string;
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      return {
        ok: false,
        message:
          data.error?.message || "Could not check Instagram container status",
        raw: data,
      };
    }
    const code = (data.status_code || "").toUpperCase();
    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR" || code === "EXPIRED") {
      return {
        ok: false,
        message: data.status || `Instagram container ${code}`,
        raw: data,
      };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return {
    ok: false,
    message:
      "Instagram is still processing the video. Wait a bit and try publishing again.",
  };
}

async function publishInstagramReel(
  tokens: OAuthTokenBundle,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  const target = await resolveInstagramTarget(tokens);
  if ("error" in target) {
    return { status: "failed", message: target.error, raw: target.raw };
  }

  const { igUserId, pageToken, graphHost } = target;
  const base = `https://${graphHost}/v21.0`;

  const containerRes = await fetch(`${base}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: "true",
      access_token: pageToken,
    }),
  });
  const container = (await containerRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!containerRes.ok || !container.id) {
    return {
      status: "failed",
      message: container.error?.message || "Instagram container create failed",
      raw: container,
    };
  }

  const ready = await waitForIgContainer(graphHost, container.id, pageToken);
  if (!ready.ok) {
    return {
      status: "uploading",
      externalId: container.id,
      message: ready.message,
      raw: { container, ready },
    };
  }

  const publishRes = await fetch(`${base}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: pageToken,
    }),
  });
  const published = (await publishRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!publishRes.ok || !published.id) {
    return {
      status: "failed",
      message:
        published.error?.message ||
        "Instagram media_publish failed after container was ready.",
      raw: { container, published },
    };
  }

  return {
    status: "published",
    externalId: published.id,
    message: "Published to Instagram Reels.",
    raw: published,
  };
}

export function decryptAppSecret(ciphertext: string): string {
  return decryptSecret(ciphertext);
}
