import { NextResponse } from "next/server";
import { blotatoListAccounts } from "@/lib/blotato/client";
import { getBlotatoApiKey } from "@/lib/blotato/user-key";
import { requireProjectOwner } from "@/lib/mail/access";
import { resolveSocialAvatar } from "@/lib/redes/avatar";
import { hydrateMissingAvatar } from "@/lib/redes/avatar-server";
import { isSocialPlatform, type SocialPlatform } from "@/lib/redes/types";

type Params = { params: Promise<{ id: string }> };

type CredMeta = {
  platform: string;
  source: string;
  external_key: string;
  login_user_ciphertext: string | null;
  login_password_ciphertext: string | null;
};

export type UnifiedAccount = {
  key: string;
  platform: SocialPlatform;
  source: "native" | "blotato";
  externalKey: string;
  label: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  connectedAt: string | null;
  hasLoginCredentials: boolean;
};

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const accounts: UnifiedAccount[] = [];

  const { data: nativeRows, error: nativeErr } = await supabase
    .from("project_social_accounts")
    .select(
      "id, platform, display_name, username, avatar_url, status, connected_at, created_at, tokens_ciphertext"
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (nativeErr) {
    return NextResponse.json({ error: nativeErr.message }, { status: 500 });
  }

  for (const row of nativeRows ?? []) {
    const platform = row.platform as string;
    if (!isSocialPlatform(platform)) continue;
    const avatarUrl = await hydrateMissingAvatar({
      id: row.id as string,
      platform,
      username: (row.username as string) || null,
      avatarUrl: (row.avatar_url as string) || null,
      tokensCipher: (row.tokens_ciphertext as string) || null,
      save: async (next) => {
        await supabase
          .from("project_social_accounts")
          .update({ avatar_url: next, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      },
    });
    accounts.push({
      key: `native:${row.id}`,
      platform,
      source: "native",
      externalKey: row.id as string,
      label:
        (row.display_name as string) ||
        (row.username
          ? `@${row.username}`
          : `Account ${String(row.id).slice(0, 6)}`),
      username: (row.username as string) || null,
      displayName: (row.display_name as string) || null,
      avatarUrl,
      status: (row.status as string) || "active",
      connectedAt:
        (row.connected_at as string) || (row.created_at as string) || null,
      hasLoginCredentials: false,
    });
  }

  try {
    const apiKey = await getBlotatoApiKey();
    if (apiKey) {
      const list = await blotatoListAccounts(apiKey);
      for (const a of list) {
        const platform = (a.platform || "").toLowerCase();
        if (!isSocialPlatform(platform)) continue;
        if (!["tiktok"].includes(platform)) continue;
        const id = String(a.id ?? "");
        if (!id) continue;
        accounts.push({
          key: `blotato:${id}`,
          platform,
          source: "blotato",
          externalKey: id,
          label:
            a.nickname ||
            (a.username ? `@${a.username}` : `Blotato ${id.slice(0, 6)}`),
          username: a.username || null,
          displayName: a.nickname || null,
          avatarUrl: resolveSocialAvatar({
            platform,
            username: a.username || null,
            avatarUrl: a.avatarUrl,
          }),
          status: "active",
          connectedAt: null,
          hasLoginCredentials: false,
        });
      }
    }
  } catch {
    /* Blotato optional */
  }

  const { data: credRows } = await supabase
    .from("project_account_credentials")
    .select(
      "platform, source, external_key, login_user_ciphertext, login_password_ciphertext"
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  const credMap = new Map<string, CredMeta>();
  for (const c of (credRows ?? []) as CredMeta[]) {
    credMap.set(`${c.source}:${c.external_key}:${c.platform}`, c);
  }

  for (const a of accounts) {
    const hit = credMap.get(`${a.source}:${a.externalKey}:${a.platform}`);
    a.hasLoginCredentials = Boolean(
      hit?.login_user_ciphertext || hit?.login_password_ciphertext
    );
  }

  accounts.sort((x, y) => {
    if (x.platform !== y.platform) return x.platform.localeCompare(y.platform);
    return x.label.localeCompare(y.label);
  });

  return NextResponse.json({ accounts });
}
