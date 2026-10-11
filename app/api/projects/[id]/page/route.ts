import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAGE_COLUMNS,
  cleanText,
  cleanUrl,
  isValidSlug,
  slugify,
  type PageSubscriber,
  type PageUpdate,
  type ProductPage,
} from "@/lib/page/types";

type Params = { params: Promise<{ id: string }> };

async function slugTaken(slug: string, projectId: string): Promise<boolean> {
  const admin = await createAdminClient();
  const [page, legal] = await Promise.all([
    admin.from("product_pages").select("project_id").eq("slug", slug).neq("project_id", projectId).maybeSingle(),
    admin.from("project_app_legal").select("project_id").eq("slug", slug).neq("project_id", projectId).maybeSingle(),
  ]);
  return Boolean(page.data || legal.data);
}

async function suggestSlug(base: string, projectId: string): Promise<string> {
  let root = slugify(base);
  if (root.length < 3) root = `app-${projectId.slice(0, 6)}`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 36)}-${i + 1}`;
    if (isValidSlug(candidate) && !(await slugTaken(candidate, projectId))) return candidate;
  }
  return `app-${projectId.slice(0, 8)}`;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const db = gate.supabase;

  const [page, subscribers, updates] = await Promise.all([
    db.from("product_pages").select(PAGE_COLUMNS).eq("project_id", projectId).maybeSingle(),
    db
      .from("page_subscribers")
      .select("id, email, created_at", { count: "exact" })
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1000),
    db.from("page_updates").select("id, title, body, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);
  const failed = [page, subscribers, updates].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  let current = page.data as ProductPage | null;
  if (!current) {
    const [{ data: project }, { data: profile }, { data: legal }] = await Promise.all([
      db.from("projects").select("name, description").eq("id", projectId).maybeSingle(),
      db.from("launch_profiles").select("pitch, answers").eq("project_id", projectId).maybeSingle(),
      db.from("project_app_legal").select("slug").eq("project_id", projectId).maybeSingle(),
    ]);
    const name = (project?.name as string | undefined) ?? "Mi app";
    const legalSlug = legal?.slug as string | null | undefined;
    const answers = (profile?.answers ?? {}) as Record<string, unknown>;
    const fromAnswers = (key: string) => (typeof answers[key] === "string" && answers[key] !== "none" ? (answers[key] as string) : null);
    current = {
      slug: legalSlug && isValidSlug(legalSlug) ? legalSlug : await suggestSlug(name, projectId),
      published: false,
      title: (fromAnswers("appName") ?? name).slice(0, 80),
      tagline: (profile?.pitch as string | null | undefined)?.slice(0, 160) ?? null,
      description: (fromAnswers("appDescription") ?? (project?.description as string | null | undefined))?.slice(0, 1000) ?? null,
      website_url: cleanUrl(fromAnswers("url")),
      ios_url: cleanUrl(fromAnswers("appUrl")),
      android_url: null,
      collect_emails: true,
      accent: "#111114",
    };
  }

  return NextResponse.json({
    page: current,
    saved: Boolean(page.data),
    subscribers: (subscribers.data ?? []) as PageSubscriber[],
    subscriberCount: subscribers.count ?? 0,
    updates: (updates.data ?? []) as PageUpdate[],
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Partial<ProductPage> | null;
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "El enlace debe tener entre 3 y 40 letras, números o guiones." }, { status: 400 });
  }
  if (await slugTaken(slug, projectId)) {
    return NextResponse.json({ error: "Ese enlace ya está en uso. Prueba otro." }, { status: 409 });
  }

  const accent = typeof body.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accent) ? body.accent : "#111114";
  const row = {
    project_id: projectId,
    slug,
    published: Boolean(body.published),
    title: cleanText(body.title, 80),
    tagline: cleanText(body.tagline, 160),
    description: cleanText(body.description, 1000),
    website_url: cleanUrl(body.website_url),
    ios_url: cleanUrl(body.ios_url),
    android_url: cleanUrl(body.android_url),
    collect_emails: body.collect_emails !== false,
    accent,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await gate.supabase
    .from("product_pages")
    .upsert(row, { onConflict: "project_id" })
    .select(PAGE_COLUMNS)
    .single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "Ese enlace ya está en uso. Prueba otro." : error.message }, { status });
  }
  return NextResponse.json({ page: data as ProductPage });
}
