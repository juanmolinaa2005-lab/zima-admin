import { NextResponse } from "next/server";
import {
  PRODUCT_SUMMARY_MAX,
  clipProductSummary,
} from "@/lib/creator/estudio-v1";
import { requireProjectOwner } from "@/lib/mail/access";
import { openaiChatJson } from "@/lib/openai/chat";
import { getOpenAIApiKey } from "@/lib/openai/user-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: { productContext?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const source = (body.productContext || "").trim();
  if (!source) {
    return NextResponse.json(
      { error: "Pega primero los detalles del producto." },
      { status: 400 }
    );
  }

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta OpenAI en Supabase → Secrets para generar el resumen.",
      },
      { status: 403 }
    );
  }

  try {
    const out = await openaiChatJson<{ summary?: string }>(apiKey, {
      model: "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 400,
      system: `You compress a product brief into a tiny UGC brief for a talking-head iPhone video.
Return JSON: {"summary":"..."}.
Rules:
- Language: same as the source (usually Spanish).
- Hard max ${PRODUCT_SUMMARY_MAX} characters including spaces.
- Include only: product/app name, who it is for, one pain, one promise, one CTA.
- No quotes, no bullets, no hashtags, no marketing fluff.`,
      user: source,
    });
    const summary = clipProductSummary(out.summary || "");
    if (!summary) {
      return NextResponse.json(
        { error: "ChatGPT devolvió un resumen vacío" },
        { status: 502 }
      );
    }
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo generar el resumen",
      },
      { status: 502 }
    );
  }
}
