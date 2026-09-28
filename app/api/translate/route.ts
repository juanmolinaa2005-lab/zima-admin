import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  htmlToPlainText,
  isLikelySpanish,
  translateText,
} from "@/lib/translate/google";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    subject?: string;
    text?: string;
    html?: string;
    target?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const target = (body.target || "es").slice(0, 8);
  const subject = body.subject?.trim() || "";
  const plain =
    body.text?.trim() ||
    (body.html ? htmlToPlainText(body.html) : "") ||
    "";

  if (!subject && !plain) {
    return NextResponse.json(
      { error: "No hay texto para traducir" },
      { status: 400 }
    );
  }

  try {
    const [subjectResult, bodyResult] = await Promise.all([
      subject
        ? translateText(subject, target)
        : Promise.resolve({
            translatedText: "",
            detectedSourceLanguage: null as string | null,
          }),
      plain
        ? translateText(plain, target)
        : Promise.resolve({
            translatedText: "",
            detectedSourceLanguage: null as string | null,
          }),
    ]);

    const detected =
      bodyResult.detectedSourceLanguage ||
      subjectResult.detectedSourceLanguage;

    if (isLikelySpanish(detected) && target.startsWith("es")) {
      return NextResponse.json({
        skipped: true,
        detectedSourceLanguage: detected,
        subject,
        text: plain,
      });
    }

    return NextResponse.json({
      skipped: false,
      detectedSourceLanguage: detected,
      subject: subjectResult.translatedText || subject,
      text: bodyResult.translatedText || plain,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo traducir";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
