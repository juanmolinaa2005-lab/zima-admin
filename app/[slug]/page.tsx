import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPageView } from "@/components/page/ProductPageView";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAGE_COLUMNS, isValidSlug, type PageUpdate, type ProductPage } from "@/lib/page/types";

type Params = { params: Promise<{ slug: string }> };

async function loadPage(slug: string) {
  if (!isValidSlug(slug)) return null;
  const admin = await createAdminClient();
  const { data } = await admin
    .from("product_pages")
    .select(`project_id, ${PAGE_COLUMNS}`)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!data) return null;
  const { project_id: projectId, ...page } = data as ProductPage & { project_id: string };

  const [{ data: updates }, { data: legal }] = await Promise.all([
    admin.from("page_updates").select("id, title, body, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    admin.from("project_app_legal").select("slug, published").eq("project_id", projectId).maybeSingle(),
  ]);

  return {
    page: page as ProductPage,
    updates: (updates ?? []) as PageUpdate[],
    legalSlug: legal?.published && legal.slug ? (legal.slug as string) : null,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPage(slug);
  if (!data) return { title: "Página no encontrada" };
  const name = data.page.title || "App";
  const description = data.page.tagline || data.page.description?.slice(0, 160) || undefined;
  return {
    title: data.page.tagline ? `${name} · ${data.page.tagline}` : name,
    description,
    openGraph: { title: name, description },
  };
}

export default async function ProductPublicPage({ params }: Params) {
  const { slug } = await params;
  const data = await loadPage(slug);
  if (!data) notFound();
  return (
    <main>
      <ProductPageView page={data.page} updates={data.updates} legalSlug={data.legalSlug} />
    </main>
  );
}
