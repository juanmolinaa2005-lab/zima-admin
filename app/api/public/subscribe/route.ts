import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_RE, SLUG_RE } from "@/lib/page/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: unknown; email?: unknown; website?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  // Honeypot: bots fill every field, people never see this one.
  if (typeof body?.website === "string" && body.website) return NextResponse.json({ ok: true });
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Escribe un email válido" }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { data: page } = await admin
    .from("product_pages")
    .select("project_id, published, collect_emails")
    .eq("slug", slug)
    .maybeSingle();
  if (!page?.published || !page.collect_emails) {
    return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
  }

  const { error } = await admin
    .from("page_subscribers")
    .upsert({ project_id: page.project_id, email }, { onConflict: "project_id,email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
