import { createHash, randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { PLATFORM_API } from "./platforms";
import type { SocialPlatform } from "./types";

export type OAuthTokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
  raw?: unknown;
};

export type SocialAppRow = {
  id: string;
  project_id: string;
  user_id: string;
  platform: SocialPlatform;
  client_id: string;
  client_secret_ciphertext: string;
  redirect_uri: string | null;
  scopes: string[] | null;
  connected_at: string | null;
};

export function encryptTokenBundle(bundle: OAuthTokenBundle): string {
  return encryptSecret(JSON.stringify(bundle));
}

export function decryptTokenBundle(cipher: string): OAuthTokenBundle {
  return JSON.parse(decryptSecret(cipher)) as OAuthTokenBundle;
}

export function defaultRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/redes/oauth/callback`;
}

export function buildOAuthState(payload: {
  projectId: string;
  userId: string;
  platform: SocialPlatform;
  nonce: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseOAuthState(state: string): {
  projectId: string;
  userId: string;
  platform: SocialPlatform;
  nonce: string;
} | null {
  try {
    const raw = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as {
      projectId?: string;
      userId?: string;
      platform?: SocialPlatform;
      nonce?: string;
    };
    if (!raw.projectId || !raw.userId || !raw.platform || !raw.nonce) {
      return null;
    }
    return {
      projectId: raw.projectId,
      userId: raw.userId,
      platform: raw.platform,
      nonce: raw.nonce,
    };
  } catch {
    return null;
  }
}

export function normalizeScopeList(
  scope: unknown,
  fallback: string[] = []
): string[] {
  if (Array.isArray(scope)) {
    return scope.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof scope === "string" && scope.trim()) {
    return scope.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(input: {
  platform: SocialPlatform;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const api = PLATFORM_API[input.platform];
  const scopes = (input.scopes?.length ? input.scopes : api.oauthScopes).join(
    input.platform === "youtube" ? " " : ","
  );

  if (input.platform === "tiktok") {
    const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.searchParams.set("client_key", input.clientId);
    u.searchParams.set("scope", scopes);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", input.redirectUri);
    u.searchParams.set("state", input.state);
    return u.toString();
  }

  if (input.platform === "youtube") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", input.clientId);
    u.searchParams.set("redirect_uri", input.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", scopes);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", input.state);
    return u.toString();
  }

  if (input.platform === "instagram") {
    // Instagram API with Instagram Login (Business Login for Instagram)
    const u = new URL("https://www.instagram.com/oauth/authorize");
    u.searchParams.set("client_id", input.clientId);
    u.searchParams.set("redirect_uri", input.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", scopes);
    u.searchParams.set("state", input.state);
    return u.toString();
  }

  if (input.platform === "facebook") {
    const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    u.searchParams.set("client_id", input.clientId);
    u.searchParams.set("redirect_uri", input.redirectUri);
    u.searchParams.set("state", input.state);
    u.searchParams.set("scope", scopes);
    u.searchParams.set("response_type", "code");
    return u.toString();
  }

  // X OAuth 2.0 PKCE-ish authorize (code challenge simplified for server apps)
  const u = new URL("https://twitter.com/i/oauth2/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("scope", scopes.replace(/,/g, " "));
  u.searchParams.set("state", input.state);
  const verifier = createHash("sha256").update(input.state).digest("base64url");
  u.searchParams.set("code_challenge", verifier);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeCodeForTokens(input: {
  platform: SocialPlatform;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  state?: string;
}): Promise<OAuthTokenBundle> {
  if (input.platform === "tiktok") {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
      message?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(
        data.error_description ||
          data.error ||
          data.message ||
          "TikTok token exchange failed"
      );
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
      open_id: data.open_id,
      scope: data.scope,
      token_type: data.token_type,
      raw: data,
    };
  }

  if (input.platform === "youtube") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(
        data.error_description || data.error || "YouTube token exchange failed"
      );
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
      scope: data.scope,
      token_type: data.token_type,
      raw: data,
    };
  }

  if (input.platform === "instagram") {
    // Short-lived token via Instagram Login
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
        code: input.code.replace(/#_$/, ""),
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      user_id?: number | string;
      permissions?: string | string[];
      error_type?: string;
      error_message?: string;
      code?: number;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(
        data.error_message ||
          data.error_type ||
          "Instagram token exchange failed"
      );
    }

    let accessToken = data.access_token;
    let expiresAt: number | undefined;
    try {
      const ll = new URL("https://graph.instagram.com/access_token");
      ll.searchParams.set("grant_type", "ig_exchange_token");
      ll.searchParams.set("client_secret", input.clientSecret);
      ll.searchParams.set("access_token", data.access_token);
      const llRes = await fetch(ll.toString());
      const llData = (await llRes.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (llRes.ok && llData.access_token) {
        accessToken = llData.access_token;
        expiresAt = llData.expires_in
          ? Date.now() + llData.expires_in * 1000
          : undefined;
      }
    } catch {
      /* keep short-lived */
    }

    const scopeList = normalizeScopeList(data.permissions);
    return {
      access_token: accessToken,
      expires_at: expiresAt,
      open_id: data.user_id != null ? String(data.user_id) : undefined,
      scope: scopeList.length ? scopeList.join(",") : undefined,
      raw: { ...data, provider: "instagram_login" },
    };
  }

  if (input.platform === "facebook") {
    const u = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    u.searchParams.set("client_id", input.clientId);
    u.searchParams.set("client_secret", input.clientSecret);
    u.searchParams.set("redirect_uri", input.redirectUri);
    u.searchParams.set("code", input.code);
    const res = await fetch(u.toString());
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || "Meta token exchange failed");
    }

    let accessToken = data.access_token;
    let expiresAt = data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined;
    try {
      const ll = new URL(
        "https://graph.facebook.com/v21.0/oauth/access_token"
      );
      ll.searchParams.set("grant_type", "fb_exchange_token");
      ll.searchParams.set("client_id", input.clientId);
      ll.searchParams.set("client_secret", input.clientSecret);
      ll.searchParams.set("fb_exchange_token", data.access_token);
      const llRes = await fetch(ll.toString());
      const llData = (await llRes.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (llRes.ok && llData.access_token) {
        accessToken = llData.access_token;
        expiresAt = llData.expires_in
          ? Date.now() + llData.expires_in * 1000
          : expiresAt;
      }
    } catch {
      /* keep short-lived */
    }

    return {
      access_token: accessToken,
      expires_at: expiresAt,
      token_type: data.token_type,
      raw: data,
    };
  }

  // X
  const basic = Buffer.from(
    `${input.clientId}:${input.clientSecret}`
  ).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code_verifier: input.state
        ? createHash("sha256").update(input.state).digest("base64url")
        : "challenge",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "X token exchange failed"
    );
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
    scope: data.scope,
    token_type: data.token_type,
    raw: data,
  };
}

export async function refreshYoutubeAccessToken(
  tokens: OAuthTokenBundle,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenBundle> {
  if (!tokens.refresh_token) return tokens;
  if (tokens.expires_at && tokens.expires_at > Date.now() + 60_000) {
    return tokens;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "YouTube token refresh failed. Reconnect the channel."
    );
  }
  return {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
    scope: data.scope || tokens.scope,
    token_type: data.token_type || tokens.token_type,
  };
}

export async function fetchProfileHint(
  platform: SocialPlatform,
  tokens: OAuthTokenBundle
): Promise<{ username?: string; displayName?: string; avatarUrl?: string; externalId?: string }> {
  try {
    if (platform === "tiktok" && tokens.access_token) {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );
      const data = (await res.json()) as {
        data?: {
          user?: {
            open_id?: string;
            display_name?: string;
            avatar_url?: string;
            username?: string;
          };
        };
      };
      const user = data.data?.user;
      return {
        username: user?.username,
        displayName: user?.display_name,
        avatarUrl: user?.avatar_url,
        externalId: user?.open_id || tokens.open_id,
      };
    }
    if (platform === "youtube") {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const data = (await res.json()) as {
        items?: {
          id?: string;
          snippet?: {
            title?: string;
            thumbnails?: {
              default?: { url?: string };
              medium?: { url?: string };
              high?: { url?: string };
            };
          };
        }[];
      };
      const ch = data.items?.[0];
      const thumbs = ch?.snippet?.thumbnails;
      return {
        displayName: ch?.snippet?.title,
        username: ch?.snippet?.title,
        avatarUrl:
          thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url,
        externalId: ch?.id,
      };
    }

    if (platform === "instagram") {
      const meRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,account_type,profile_picture_url&access_token=${encodeURIComponent(tokens.access_token)}`
      );
      const me = (await meRes.json()) as {
        user_id?: string;
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
      return {
        username: me.username,
        displayName: me.name || me.username,
        avatarUrl: me.profile_picture_url,
        externalId: me.user_id || me.id || tokens.open_id,
      };
    }

    if (platform === "facebook") {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(tokens.access_token)}`
      );
      const pagesData = (await pagesRes.json()) as {
        data?: {
          id?: string;
          name?: string;
          instagram_business_account?: {
            id?: string;
            username?: string;
            name?: string;
            profile_picture_url?: string;
          };
        }[];
      };
      for (const page of pagesData.data ?? []) {
        const ig = page.instagram_business_account;
        if (ig?.id) {
          return {
            username: ig.username,
            displayName: ig.name || ig.username || page.name,
            avatarUrl: ig.profile_picture_url,
            externalId: ig.id,
          };
        }
      }

      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)&access_token=${encodeURIComponent(tokens.access_token)}`
      );
      const me = (await meRes.json()) as {
        id?: string;
        name?: string;
        picture?: { data?: { url?: string } };
      };
      return {
        displayName: me.name,
        username: me.name,
        avatarUrl: me.picture?.data?.url,
        externalId: me.id,
      };
    }
  } catch {
    /* ignore profile fetch errors */
  }
  return { externalId: tokens.open_id };
}
