import { NextResponse } from "next/server";
import type { AppDemoSpec } from "@/lib/creator/app-demo";
import { resolveProduct } from "@/lib/creator/app-demo-2/catalog";
import { planVariations } from "@/lib/creator/app-demo-2/planner";
import type { DemoSpec } from "@/lib/creator/app-demo-2/types";
import { requireProjectOwner } from "@/lib/mail/access";
import { getOpenAIApiKey } from "@/lib/openai/user-key";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function asAppSpec(raw: unknown): AppDemoSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const screens = (raw as { screens?: unknown }).screens;
  if (!Array.isArray(screens) || screens.length === 0) return null;
  return raw as AppDemoSpec;
}

function asDemoSpec(raw: unknown): DemoSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Partial<DemoSpec>;
  if (typeof o.id !== "string" || !o.id) return null;
  if (!Array.isArray(o.steps) || o.steps.length === 0) return null;
  return o as DemoSpec;
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: {
    count?: number;
    demo?: unknown;
    productId?: string;
    appSpec?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const demo = asDemoSpec(body.demo);
  if (!demo) {
    return NextResponse.json(
      { error: "Falta el demo original para variar." },
      { status: 400 }
    );
  }

  const count =
    body.count === 5 || body.count === 10 || body.count === 20 ? body.count : 3;
  const adapter = resolveProduct({
    productId: body.productId,
    appSpec: asAppSpec(body.appSpec),
  });

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta OpenAI en Supabase → Secrets para generar variaciones.",
      },
      { status: 403 }
    );
  }

  try {
    const bundles = await planVariations({
      apiKey,
      count,
      source: demo,
      adapter,
    });
    return NextResponse.json({ bundles });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudieron generar variaciones",
      },
      { status: 502 }
    );
  }
}
