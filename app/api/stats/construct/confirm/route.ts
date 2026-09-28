import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/claude/admin";
import { saveAnthropicAdminKey } from "@/lib/claude/user-key";
import { verifyOpenAIAdminKey } from "@/lib/openai/admin";
import { saveOpenAIAdminKey } from "@/lib/openai/user-key";
import {
  listSuperwallApplications,
  verifySuperwallApiKey,
} from "@/lib/superwall/admin";
import { saveSuperwallConnection } from "@/lib/superwall/user-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireProject, requireStatsUser } from "@/lib/stats/auth";
import { hostOf, matchBuiltin } from "@/lib/stats/builtin";
import {
  parseConstructed,
  refineWebsite,
  type ConstructedSpec,
} from "@/lib/stats/construct";
import { executeFetchSpec } from "@/lib/stats/execute";
import {
  addSource,
  findConnectorByHost,
  findConnectorBySlug,
  saveSharedConnector,
  slugFromHost,
  updateSharedConnector,
} from "@/lib/stats/store";
import type { FetchSpec } from "@/lib/stats/types";

export const maxDuration = 60;

async function connectBuiltin(
  slug: "superwall" | "openai" | "claude",
  apiKey: string | undefined
) {
  if (!apiKey?.trim()) return;
  if (slug === "superwall") {
    const { orgs } = await verifySuperwallApiKey(apiKey);
    const orgId = String(orgs[0]!.id);
    const apps = await listSuperwallApplications(apiKey, orgId);
    await saveSuperwallConnection({
      apiKey,
      orgId,
      applicationId: apps[0]?.id ?? null,
    });
    return;
  }
  if (slug === "openai") {
    if (!apiKey.startsWith("sk-admin")) {
      throw new Error("Usa una Admin API key de OpenAI (sk-admin…).");
    }
    await verifyOpenAIAdminKey(apiKey);
    await saveOpenAIAdminKey(apiKey);
    return;
  }
  await verifyAdminKey(apiKey);
  await saveAnthropicAdminKey(apiKey);
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireStatsUser();
    const body = (await request.json()) as {
      projectId?: string;
      slug?: string;
      websiteUrl?: string;
      constructed?: ConstructedSpec;
      credentials?: Record<string, string>;
    };
    const projectId = body.projectId?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
    }
    await requireProject(supabase, user.id, projectId);
    const credentials = body.credentials ?? {};

    const builtin = body.slug ? matchBuiltin(body.slug) : null;
    const builtinFromUrl = body.websiteUrl ? matchBuiltin(body.websiteUrl) : null;
    const known = builtin || builtinFromUrl;

    if (known) {
      const existing = await findConnectorBySlug(supabase, known.slug);
      if (!existing) {
        return NextResponse.json(
          { error: "El conector built-in no está listo. Recarga e inténtalo de nuevo." },
          { status: 400 }
        );
      }
      await connectBuiltin(known.slug, credentials.apiKey);
      const sourceId = await addSource(supabase, {
        projectId,
        userId: user.id,
        connectorId: existing.id,
      });
      return NextResponse.json({ ok: true, sourceId, slug: known.slug });
    }

    const admin = await createAdminClient();

    if (body.slug) {
      const existing = await findConnectorBySlug(admin, body.slug);
      if (!existing?.fetchSpec) {
        return NextResponse.json({ error: "Conector no encontrado." }, { status: 404 });
      }
      try {
        await executeFetchSpec(existing.fetchSpec, credentials, 7);
      } catch (first) {
        const err = first instanceof Error ? first.message : "Falló la conexión";
        const refined = await refineWebsite(existing.websiteUrl, {
          name: existing.name,
          kind: existing.kind,
          summary: existing.summary || "",
          portalUrl: existing.portalUrl,
          portalLabel: existing.portalLabel,
          setupSteps: existing.setupSteps,
          scopes: existing.scopes,
          keyType: existing.keyType,
          credentials: existing.credentials,
          fetch: existing.fetchSpec,
        }, err);
        await updateSharedConnector(admin, existing.id, {
          fetchSpec: refined.fetch,
          credentials: refined.credentials,
          portalUrl: refined.portalUrl,
          portalLabel: refined.portalLabel,
          setupSteps: refined.setupSteps,
          scopes: refined.scopes,
          keyType: refined.keyType,
        });
        await executeFetchSpec(refined.fetch, credentials, 7);
      }
      const sourceId = await addSource(supabase, {
        projectId,
        userId: user.id,
        connectorId: existing.id,
        credentials,
      });
      return NextResponse.json({ ok: true, sourceId, slug: existing.slug });
    }

    if (!body.constructed || !body.websiteUrl) {
      return NextResponse.json(
        { error: "Falta el conector construido." },
        { status: 400 }
      );
    }

    let spec = parseConstructed(body.constructed);
    try {
      await executeFetchSpec(spec.fetch as FetchSpec, credentials, 7);
    } catch (first) {
      const err = first instanceof Error ? first.message : "Falló la conexión";
      spec = await refineWebsite(body.websiteUrl, spec, err);
      await executeFetchSpec(spec.fetch as FetchSpec, credentials, 7);
    }

    const host = hostOf(body.websiteUrl);
    const already = await findConnectorByHost(admin, host);
    const connector =
      already ??
      (await saveSharedConnector(admin, user.id, {
        slug: slugFromHost(host),
        name: spec.name,
        websiteUrl: body.websiteUrl,
        host,
        kind: spec.kind,
        summary: spec.summary,
        credentials: spec.credentials,
        fetchSpec: spec.fetch,
        portalUrl: spec.portalUrl,
        portalLabel: spec.portalLabel,
        setupSteps: spec.setupSteps,
        scopes: spec.scopes,
        keyType: spec.keyType,
      }));
    if (already) {
      await updateSharedConnector(admin, already.id, {
        fetchSpec: spec.fetch,
        credentials: spec.credentials,
        portalUrl: spec.portalUrl,
        portalLabel: spec.portalLabel,
        setupSteps: spec.setupSteps,
        scopes: spec.scopes,
        keyType: spec.keyType,
      });
    }
    const sourceId = await addSource(supabase, {
      projectId,
      userId: user.id,
      connectorId: connector.id,
      credentials,
    });
    return NextResponse.json({ ok: true, sourceId, slug: connector.slug });
  } catch (e) {
    const { message, status } = jsonError(e, "No se pudo conectar la plataforma");
    return NextResponse.json({ error: message }, { status });
  }
}
