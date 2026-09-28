import { NextResponse } from "next/server";
import type { AppDemoSpec } from "@/lib/creator/app-demo";
import { resolveProduct } from "@/lib/creator/app-demo-2/catalog";
import { planDemo } from "@/lib/creator/app-demo-2/planner";
import { isDemoStyle } from "@/lib/creator/app-demo-2/validate";
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

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: {
    prompt?: string;
    productNotes?: string;
    durationTarget?: number;
    style?: string;
    productId?: string;
    appSpec?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Describe el demo que quieres." },
      { status: 400 }
    );
  }

  const durationTarget = Number(body.durationTarget);
  const style = isDemoStyle(body.style) ? body.style : "normal";
  const adapter = resolveProduct({
    productId: body.productId,
    appSpec: asAppSpec(body.appSpec),
  });

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta OpenAI en Ajustes → API para generar el demo.",
      },
      { status: 403 }
    );
  }

  try {
    const out = await planDemo({
      apiKey,
      prompt,
      productNotes: body.productNotes,
      durationTarget:
        durationTarget === 5 ||
        durationTarget === 6 ||
        durationTarget === 7 ||
        durationTarget === 8
          ? durationTarget
          : 6,
      style,
      adapter,
    });
    return NextResponse.json({ bundle: out.bundle });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo generar el demo",
      },
      { status: 502 }
    );
  }
}
