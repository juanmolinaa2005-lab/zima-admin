import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { hydrateMissingAvatar } from "@/lib/redes/avatar-server";
import { evaluateIsolation } from "@/lib/redes/isolation";
import {
  encryptTokensPayload,
  toPublicAccount,
  toPublicProxy,
  type AccountRow,
  type ProxyRow,
} from "@/lib/redes/serialize";
import {
  isSocialPlatform,
  type SocialAccountStatus,
  type SocialAuthMethod,
  type SocialPlatform,
} from "@/lib/redes/types";

type Params = { params: Promise<{ id: string }> };

async function loadIsolationContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  userId: string
) {
  const [{ data: proxies }, { data: accounts }] = await Promise.all([
    supabase
      .from("project_social_proxies")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId),
    supabase
      .from("project_social_accounts")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId),
  ]);

  const accountRows = (accounts ?? []) as AccountRow[];
  const assignMap = new Map<string, string>();
  for (const a of accountRows) {
    if (a.proxy_id) assignMap.set(a.proxy_id, a.id);
  }

  return {
    proxies: ((proxies ?? []) as ProxyRow[]).map((p) =>
      toPublicProxy(p, assignMap.get(p.id) ?? null)
    ),
    accounts: accountRows.map(toPublicAccount),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_social_accounts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as AccountRow[]).slice(0, 40);
  const withAvatars = await Promise.all(
    rows.map(async (row) => {
      const avatarUrl = await hydrateMissingAvatar({
        id: row.id,
        platform: row.platform,
        username: row.username,
        avatarUrl: row.avatar_url,
        tokensCipher: row.tokens_ciphertext,
        save: async (next) => {
          await supabase
            .from("project_social_accounts")
            .update({ avatar_url: next, updated_at: new Date().toISOString() })
            .eq("id", row.id);
        },
      });
      return toPublicAccount({ ...row, avatar_url: avatarUrl });
    })
  );

  return NextResponse.json({
    accounts: withAvatars,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    platform?: string;
    username?: string;
    displayName?: string;
    proxyId?: string | null;
    authMethod?: SocialAuthMethod;
    sessionPayload?: unknown;
    notes?: string;
    force?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.platform || !isSocialPlatform(body.platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  const platform: SocialPlatform = body.platform;
  const username = (body.username || "").trim().replace(/^@/, "") || null;
  const proxyId = body.proxyId || null;
  const authMethod: SocialAuthMethod =
    body.authMethod === "session" || body.authMethod === "oauth"
      ? body.authMethod
      : body.sessionPayload
        ? "session"
        : "pending";

  const ctx = await loadIsolationContext(supabase, projectId, user.id);
  const warnings = evaluateIsolation({
    platform,
    proxyId,
    proxies: ctx.proxies,
    accounts: ctx.accounts,
    username,
  });

  const hard = warnings.filter((w) => w.severity === "error");
  if (hard.length) {
    return NextResponse.json(
      { error: hard[0]!.message, warnings },
      { status: 400 }
    );
  }
  if (warnings.length && !body.force) {
    return NextResponse.json(
      { error: warnings[0]!.message, warnings, needsConfirm: true },
      { status: 409 }
    );
  }

  let tokensCipher: string | null = null;
  let status: SocialAccountStatus = "pending";
  let connectedAt: string | null = null;

  if (authMethod === "session" && body.sessionPayload) {
    tokensCipher = encryptTokensPayload(body.sessionPayload);
    status = "active";
    connectedAt = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("project_social_accounts")
    .insert({
      project_id: projectId,
      user_id: user.id,
      platform,
      username,
      display_name: (body.displayName || "").trim() || username,
      auth_method: authMethod,
      status,
      proxy_id: proxyId,
      tokens_ciphertext: tokensCipher,
      connected_at: connectedAt,
      notes: (body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (proxyId) {
    await supabase
      .from("project_social_proxies")
      .update({ status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", proxyId)
      .eq("project_id", projectId);
  }

  return NextResponse.json({
    account: toPublicAccount(data as AccountRow),
    warnings,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    id?: string;
    status?: SocialAccountStatus;
    proxyId?: string | null;
    username?: string;
    displayName?: string;
    notes?: string;
    sessionPayload?: unknown;
    force?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing, error: exErr } = await supabase
    .from("project_social_accounts")
    .select("*")
    .eq("id", body.id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = existing as AccountRow;
  const nextProxy =
    body.proxyId === undefined ? row.proxy_id : body.proxyId || null;

  if (body.proxyId !== undefined || body.username !== undefined) {
    const ctx = await loadIsolationContext(supabase, projectId, user.id);
    const warnings = evaluateIsolation({
      platform: row.platform,
      proxyId: nextProxy,
      proxies: ctx.proxies,
      accounts: ctx.accounts,
      username: body.username ?? row.username,
      excludeAccountId: row.id,
    });
    const hard = warnings.filter((w) => w.severity === "error");
    if (hard.length) {
      return NextResponse.json(
        { error: hard[0]!.message, warnings },
        { status: 400 }
      );
    }
    if (warnings.length && !body.force) {
      return NextResponse.json(
        { error: warnings[0]!.message, warnings, needsConfirm: true },
        { status: 409 }
      );
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status) patch.status = body.status;
  if (body.proxyId !== undefined) patch.proxy_id = nextProxy;
  if (body.username !== undefined) {
    patch.username = body.username.trim().replace(/^@/, "") || null;
  }
  if (body.displayName !== undefined) {
    patch.display_name = body.displayName.trim() || null;
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes.trim() || null;
  }
  if (body.sessionPayload !== undefined) {
    patch.tokens_ciphertext = encryptTokensPayload(body.sessionPayload);
    patch.auth_method = "session";
    patch.status = body.status || "active";
    patch.connected_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("project_social_accounts")
    .update(patch)
    .eq("id", body.id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync proxy assignment flags
  if (row.proxy_id && row.proxy_id !== nextProxy) {
    await supabase
      .from("project_social_proxies")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", row.proxy_id);
  }
  if (nextProxy) {
    await supabase
      .from("project_social_proxies")
      .update({ status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", nextProxy);
  }

  return NextResponse.json({ account: toPublicAccount(data as AccountRow) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const accountId = url.searchParams.get("id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("project_social_accounts")
    .select("proxy_id")
    .eq("id", accountId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("project_social_accounts")
    .delete()
    .eq("id", accountId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing?.proxy_id) {
    await supabase
      .from("project_social_proxies")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", existing.proxy_id);
  }

  return NextResponse.json({ ok: true });
}
