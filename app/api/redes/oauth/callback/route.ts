import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import {
  defaultRedirectUri,
  decryptTokenBundle,
  exchangeCodeForTokens,
  encryptTokenBundle,
  fetchProfileHint,
  normalizeScopeList,
  parseOAuthState,
  type OAuthTokenBundle,
  type SocialAppRow,
} from "@/lib/redes/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");
  const errorMessage = url.searchParams.get("error_message");
  const errorCode = url.searchParams.get("error_code");
  const errorReason = url.searchParams.get("error_reason");

  const state = stateRaw ? parseOAuthState(stateRaw) : null;
  const projectId = state?.projectId;
  const platform = state?.platform;

  if (errorParam || errorMessage || errorCode) {
    return htmlClose(
      `OAuth error: ${
        errorDesc ||
        errorMessage ||
        errorReason ||
        errorParam ||
        `code ${errorCode}`
      }`,
      false,
      projectId,
      platform
    );
  }
  if (!code || !stateRaw) {
    return htmlClose("Missing code or state", false, projectId, platform);
  }

  if (!state) {
    return htmlClose("Invalid OAuth state", false);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return htmlClose("Not authenticated — open Redes and try Connect again.", false, state.projectId, state.platform);
  }

  const { data: app, error: appErr } = await supabase
    .from("project_social_apps")
    .select("*")
    .eq("project_id", state.projectId)
    .eq("user_id", user.id)
    .eq("platform", state.platform)
    .maybeSingle();

  if (appErr || !app) {
    return htmlClose(
      state.platform === "youtube"
        ? "YouTube app credentials not found. Save Google OAuth in Supabase → Secrets, then Connect again."
        : "App credentials not found. Save Meta in Supabase → Secrets, then Connect again.",
      false,
      state.projectId,
      state.platform
    );
  }

  const row = app as SocialAppRow;
  const origin = url.origin;
  const redirectUri = row.redirect_uri || defaultRedirectUri(origin);

  try {
    const tokens = await exchangeCodeForTokens({
      platform: state.platform,
      clientId: row.client_id,
      clientSecret: decryptSecret(row.client_secret_ciphertext),
      code,
      redirectUri,
      state: stateRaw,
    });

    const profile = await fetchProfileHint(state.platform, tokens);

    async function tokensWithPreservedRefresh(
      next: OAuthTokenBundle,
      accountId?: string
    ): Promise<OAuthTokenBundle> {
      if (next.refresh_token || !accountId) return next;
      const { data: prev } = await supabase
        .from("project_social_accounts")
        .select("tokens_ciphertext")
        .eq("id", accountId)
        .maybeSingle();
      const cipher = prev?.tokens_ciphertext as string | null | undefined;
      if (!cipher) return next;
      try {
        const old = decryptTokenBundle(cipher);
        if (old.refresh_token) {
          return { ...next, refresh_token: old.refresh_token };
        }
      } catch {
        /* ignore */
      }
      return next;
    }

    const accountPayload = {
      project_id: state.projectId,
      user_id: user.id,
      platform: state.platform,
      username: profile.username || null,
      display_name: profile.displayName || profile.username || null,
      avatar_url: profile.avatarUrl || null,
      external_id: profile.externalId || tokens.open_id || null,
      auth_method: "oauth" as const,
      status: "active" as const,
      scopes: normalizeScopeList(tokens.scope, row.scopes || []),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    };

    if (accountPayload.external_id) {
      const { data: existing } = await supabase
        .from("project_social_accounts")
        .select("id")
        .eq("project_id", state.projectId)
        .eq("user_id", user.id)
        .eq("platform", state.platform)
        .eq("external_id", accountPayload.external_id)
        .maybeSingle();

      if (existing?.id) {
        const merged = await tokensWithPreservedRefresh(tokens, existing.id);
        const { error: updErr } = await supabase
          .from("project_social_accounts")
          .update({
            ...accountPayload,
            tokens_ciphertext: encryptTokenBundle(merged),
          })
          .eq("id", existing.id);
        if (updErr) {
          return htmlClose(updErr.message, false, state.projectId, state.platform);
        }
        return htmlClose(
          `${state.platform} connected. You can close this window.`,
          true,
          state.projectId,
          state.platform
        );
      }
    }

    const { error: upsertErr } = await supabase
      .from("project_social_accounts")
      .insert({
        ...accountPayload,
        tokens_ciphertext: encryptTokenBundle(tokens),
      });

    if (upsertErr) {
      if (profile.username) {
        const { error: updErr } = await supabase
          .from("project_social_accounts")
          .update({
            ...accountPayload,
            tokens_ciphertext: encryptTokenBundle(tokens),
          })
          .eq("project_id", state.projectId)
          .eq("user_id", user.id)
          .eq("platform", state.platform)
          .ilike("username", profile.username);
        if (updErr) {
          return htmlClose(updErr.message, false, state.projectId, state.platform);
        }
      } else {
        return htmlClose(upsertErr.message, false, state.projectId, state.platform);
      }
    }

    return htmlClose(
      `${state.platform} connected. You can close this window.`,
      true,
      state.projectId,
      state.platform
    );
  } catch (e) {
    return htmlClose(
      e instanceof Error ? e.message : "Token exchange failed",
      false,
      state.projectId,
      state.platform
    );
  }
}

function htmlClose(
  message: string,
  ok: boolean,
  projectId?: string,
  platform?: string
) {
  const params = new URLSearchParams();
  params.set("view", "redes");
  if (platform) params.set("oauth_platform", platform);
  if (!ok) params.set("oauth_error", message.slice(0, 300));
  const redirect = projectId
    ? `/projects/${projectId}?${params.toString()}`
    : `/?oauth_error=${encodeURIComponent(message.slice(0, 300))}`;

  const html = `<!doctype html><html><body style="font-family:system-ui;padding:40px;text-align:center;background:#f7f7f8">
  <div style="max-width:420px;margin:40px auto;padding:24px;border-radius:16px;background:#fff;border:1px solid #e5e7eb">
  <p style="color:${ok ? "#15803d" : "#b91c1c"};font-size:15px;line-height:1.45;margin:0 0 12px">${escapeHtml(message)}</p>
  <p style="margin:0"><a href="${escapeHtml(redirect)}" style="color:#111827;font-weight:600">Volver a Redes</a></p>
  </div>
  <script>
    try { window.opener && window.opener.postMessage({ type: 'zima-redes-oauth', ok: ${ok ? "true" : "false"}, message: ${JSON.stringify(message)}, platform: ${JSON.stringify(platform || "")} }, '*'); } catch (e) {}
    setTimeout(function(){ window.location.href = ${JSON.stringify(redirect)}; }, ${ok ? 1200 : 2800});
  </script>
  </body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
