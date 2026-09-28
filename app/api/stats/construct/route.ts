import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicConnectionStatus } from "@/lib/claude/user-key";
import { getOpenAIConnectionStatus } from "@/lib/openai/user-key";
import { getSuperwallConnectionStatus } from "@/lib/superwall/user-key";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { hostOf, matchBuiltin, normalizeWebsite } from "@/lib/stats/builtin";
import {
  analyzeWebsite,
  enrichConnectorGuide,
  guideIsThin,
} from "@/lib/stats/construct";
import {
  findConnectorByHost,
  listProjectSources,
  saveSharedConnector,
  seedBuiltins,
  slugFromHost,
  updateSharedConnector,
} from "@/lib/stats/store";
import type { ConstructPreview } from "@/lib/stats/types";

export const maxDuration = 60;

async function builtinConnected(slug: "superwall" | "openai" | "claude") {
  if (slug === "superwall") return (await getSuperwallConnectionStatus()).connected;
  if (slug === "openai") return (await getOpenAIConnectionStatus()).connected;
  return (await getAnthropicConnectionStatus()).connected;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireStatsUser();
    const body = (await request.json()) as { url?: string; projectId?: string };
    const projectId = body.projectId?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);

    const websiteUrl = normalizeWebsite(body.url || "");
    const host = hostOf(websiteUrl);
    if (!host) {
      return NextResponse.json({ error: "Pega una web válida." }, { status: 400 });
    }

    const admin = await createAdminClient();
    try {
      await seedBuiltins(admin);
    } catch {
      /* ignore */
    }

    const sources = await listProjectSources(supabase, projectId);
    const catalog = admin;
    const builtin = matchBuiltin(websiteUrl);
    if (builtin) {
      const existing = await findConnectorByHost(catalog, host);
      const alreadyAdded = sources.some((s) => s.slug === builtin.slug);
      const preview: ConstructPreview = {
        cached: true,
        alreadyAdded,
        alreadyConnected: await builtinConnected(builtin.slug),
        connector: {
          id: existing?.id || builtin.slug,
          slug: builtin.slug,
          name: builtin.name,
          websiteUrl: builtin.websiteUrl,
          host,
          kind: builtin.kind,
          summary: builtin.summary,
          builtin: builtin.slug,
          credentials: builtin.credentials,
          portalUrl: builtin.portalUrl,
          portalLabel: builtin.portalLabel,
          setupSteps: builtin.setupSteps,
          scopes: builtin.scopes,
          keyType: builtin.keyType,
          cached: true,
        },
      };
      return NextResponse.json(preview);
    }

    const cached = await findConnectorByHost(catalog, host);
    if (cached) {
      let connector = cached;
      if (guideIsThin(cached)) {
        try {
          const guide = await enrichConnectorGuide(cached.websiteUrl, cached.name);
          await updateSharedConnector(admin, cached.id, guide);
          connector = { ...cached, ...guide };
        } catch {
          /* keep the thin cached guide if enrich fails */
        }
      }
      const alreadyAdded = sources.some((s) => s.connectorId === cached.id);
      const preview: ConstructPreview = {
        cached: true,
        alreadyAdded,
        alreadyConnected: false,
        connector,
      };
      return NextResponse.json(preview);
    }

    const built = await analyzeWebsite(websiteUrl);
    let saved = null;
    try {
      saved = await saveSharedConnector(admin, user.id, {
        slug: slugFromHost(host),
        name: built.name,
        websiteUrl,
        host,
        kind: built.kind,
        summary: built.summary,
        credentials: built.credentials,
        fetchSpec: built.fetch,
        portalUrl: built.portalUrl,
        portalLabel: built.portalLabel,
        setupSteps: built.setupSteps,
        scopes: built.scopes,
        keyType: built.keyType,
      });
    } catch {
      /* the current user can still finish; next user may retry save */
    }

    const preview: ConstructPreview = {
      cached: Boolean(saved),
      alreadyAdded: false,
      alreadyConnected: false,
      connector: saved ?? {
        id: "",
        slug: slugFromHost(host),
        name: built.name,
        websiteUrl,
        host,
        kind: built.kind,
        summary: built.summary,
        builtin: null,
        credentials: built.credentials,
        portalUrl: built.portalUrl,
        portalLabel: built.portalLabel,
        setupSteps: built.setupSteps,
        scopes: built.scopes,
        keyType: built.keyType,
        cached: false,
      },
      spec: built.fetch,
    };
    return NextResponse.json({
      ...preview,
      constructed: built,
    });
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudo analizar esa web");
    return NextResponse.json({ error: message }, { status });
  }
}
