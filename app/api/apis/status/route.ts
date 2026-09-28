import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_PROVIDERS, type ApiProviderId } from "@/lib/apis/registry";
import { getBlotatoConnectionStatus } from "@/lib/blotato/user-key";
import { getOpenAIApiConnectionStatus, getOpenAIConnectionStatus } from "@/lib/openai/user-key";
import { getSuperwallConnectionStatus } from "@/lib/superwall/user-key";
import { getHiggsfieldConnectionStatus } from "@/lib/higgsfield/user-key";
import { getFalConnectionStatus } from "@/lib/fal/user-key";
import { getReplicateConnectionStatus } from "@/lib/replicate/user-key";
import { getAnthropicConnectionStatus } from "@/lib/claude/user-key";
import { getMetaConnectionStatus } from "@/lib/meta/user-key";
import { getYouTubeConnectionStatus } from "@/lib/youtube/user-key";

export type ApiStatusItem = {
  id: ApiProviderId;
  name: string;
  usedBy: string;
  description: string;
  portalUrl: string;
  portalLabel: string;
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const [meta, youtube, blotato, openai, openaiApi, superwall, higgsfield, replicate, fal, claude] =
    await Promise.all([
      getMetaConnectionStatus(),
      getYouTubeConnectionStatus(),
      getBlotatoConnectionStatus(),
      getOpenAIConnectionStatus(),
      getOpenAIApiConnectionStatus(),
      getSuperwallConnectionStatus(),
      getHiggsfieldConnectionStatus(),
      getReplicateConnectionStatus(),
      getFalConnectionStatus(),
      getAnthropicConnectionStatus(),
    ]);

  const statusMap: Record<
    ApiProviderId,
    { connected: boolean; connectedAt: string | null; keyHint: string | null }
  > = {
    meta,
    youtube,
    blotato,
    openai,
    "openai-api": openaiApi,
    superwall,
    higgsfield,
    replicate,
    fal,
    claude,
  };

  const apis: ApiStatusItem[] = API_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    usedBy: p.usedBy,
    description: p.description,
    portalUrl: p.portalUrl,
    portalLabel: p.portalLabel,
    ...statusMap[p.id],
  }));

  return NextResponse.json({ apis });
}
