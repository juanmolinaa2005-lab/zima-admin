import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicConnectionStatus } from "@/lib/claude/user-key";
import { getOpenAIConnectionStatus } from "@/lib/openai/user-key";
import { getSuperwallConnectionStatus } from "@/lib/superwall/user-key";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { listProjectSources, seedBuiltins } from "@/lib/stats/store";
import type { StatsSource } from "@/lib/stats/types";

async function withLiveConnection(sources: StatsSource[]): Promise<StatsSource[]> {
  return Promise.all(
    sources.map(async (source) => {
      if (source.builtin === "superwall") {
        return { ...source, connected: (await getSuperwallConnectionStatus()).connected };
      }
      if (source.builtin === "openai") {
        return { ...source, connected: (await getOpenAIConnectionStatus()).connected };
      }
      if (source.builtin === "claude") {
        return { ...source, connected: (await getAnthropicConnectionStatus()).connected };
      }
      return source;
    })
  );
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireStatsUser();
    const projectId = new URL(request.url).searchParams.get("projectId") || "";
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);
    try {
      const admin = await createAdminClient();
      await seedBuiltins(admin);
    } catch {
      /* schema may already exist */
    }
    const sources = await withLiveConnection(
      await listProjectSources(supabase, projectId)
    );
    return NextResponse.json({ sources });
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudieron cargar las plataformas");
    return NextResponse.json({ error: message }, { status });
  }
}
