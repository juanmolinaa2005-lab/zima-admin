import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { parseViralResult, viralPrompt } from "@/lib/creator/viral-content";
import {
  FAL_GROK_MODEL,
  FAL_OPENROUTER,
  falWaitForOutput,
} from "@/lib/fal/client";
import { getFalApiKey } from "@/lib/fal/user-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const apiKey = await getFalApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta fal.ai en Ajustes → API para usar Grok.",
      },
      { status: 403 }
    );
  }

  const prompt = viralPrompt(new Date());

  try {
    const output = await falWaitForOutput(
      apiKey,
      FAL_OPENROUTER,
      {
        prompt,
        system_prompt:
          "Eres un investigador de growth en short-form. Usa búsqueda en vivo de X y web. Links reales. No inventes views ni URLs. Si no hay video, dilo. Responde SOLO JSON válido.",
        model: FAL_GROK_MODEL,
        enable_web_search: true,
        web_search_options: { engine: "native", max_results: 10 },
        temperature: 0.3,
        max_tokens: 8000,
      },
      { timeoutMs: 110_000, intervalMs: 2500 }
    );

    const result = parseViralResult(output);
    if (!result.report && result.items.length === 0) {
      return NextResponse.json(
        {
          error: "Grok no devolvió formatos. Prueba de nuevo.",
          raw: output.slice(0, 1200),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      report: result.report,
      items: result.items,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo buscar contenido viral",
      },
      { status: 500 }
    );
  }
}
