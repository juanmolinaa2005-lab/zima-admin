import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchClaudeUsageReport } from "@/lib/claude/admin";
import { getAnthropicAdminKey } from "@/lib/claude/user-key";

export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const adminKey = await getAnthropicAdminKey();
  if (!adminKey) {
    return NextResponse.json(
      { error: "NOT_CONNECTED", message: "Conecta tu Admin API key de Anthropic." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(31, Math.max(1, Number(searchParams.get("days") || 7)));
  const bucketWidth = searchParams.get("bucket") === "1h" ? "1h" : "1d";
  const model = searchParams.get("model")?.trim();

  const ending = new Date();
  ending.setUTCHours(23, 59, 59, 999);
  const starting = new Date(ending.getTime() - days * 24 * 60 * 60 * 1000);
  starting.setUTCHours(0, 0, 0, 0);

  try {
    const report = await fetchClaudeUsageReport(adminKey, {
      startingAt: starting.toISOString(),
      endingAt: ending.toISOString(),
      bucketWidth,
      models: model ? [model] : undefined,
    });
    return NextResponse.json({ report });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo cargar el uso de Claude";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
