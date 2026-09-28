import type { SocialPlatform } from "./types";

export type PlatformApiLinks = {
  portal: string;
  portalLabel: string;
  docs: string;
  posting?: string;
  oauthScopes: string[];
  canUploadVideo: boolean;
  notes: string;
};

export const PLATFORM_API: Record<SocialPlatform, PlatformApiLinks> = {
  tiktok: {
    portal: "https://developers.tiktok.com/apps/",
    portalLabel: "TikTok for Developers",
    docs: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    posting:
      "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post",
    oauthScopes: ["user.info.basic", "video.upload", "video.publish"],
    canUploadVideo: true,
    notes:
      "Create an app → add Content Posting API → request video.publish / video.upload. Unaudited apps can only post to private accounts.",
  },
  instagram: {
    portal: "https://developers.facebook.com/apps/",
    portalLabel: "Meta for Developers",
    docs: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/",
    posting:
      "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/",
    oauthScopes: [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ],
    canUploadVideo: true,
    notes:
      "Instagram API with Instagram Login. Use the Instagram App ID + Secret from the Instagram product panel (not only the Facebook App ID). Scopes: instagram_business_basic + instagram_business_content_publish.",
  },
  facebook: {
    portal: "https://developers.facebook.com/apps/",
    portalLabel: "Meta for Developers",
    docs: "https://developers.facebook.com/docs/graph-api/",
    posting: "https://developers.facebook.com/docs/video-api/guides/publishing",
    oauthScopes: ["pages_manage_posts", "pages_read_engagement", "publish_video"],
    canUploadVideo: true,
    notes:
      "Create a Meta app with Facebook Login + pages permissions. Upload via Graph Video API to a Page.",
  },
  youtube: {
    portal: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    portalLabel: "Google Cloud Console",
    docs: "https://developers.google.com/youtube/v3/docs/videos/insert",
    posting: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
    oauthScopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    canUploadVideo: true,
    notes:
      "Enable YouTube Data API v3, create OAuth 2.0 Client (Web) in Settings → API, add the Zima redirect URI. Do not use an API key — uploads need user OAuth.",
  },
  x: {
    portal: "https://developer.x.com/en/portal/dashboard",
    portalLabel: "X Developer Portal",
    docs: "https://developer.x.com/en/docs/x-api/media/introduction",
    posting: "https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets",
    oauthScopes: ["tweet.read", "tweet.write", "users.read", "media.write"],
    canUploadVideo: true,
    notes:
      "Create a Project + App with OAuth 2.0. Media upload + create tweet for video posts (API access tier required).",
  },
};
