import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLegalDocument } from "@/components/legal/PublicLegalDocument";
import {
  fillLegalText,
  LEGAL_DOCS,
  parsePublication,
  type LegalDocId,
} from "@/lib/creator/app-legal";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ slug: string; doc: string }> };

function docFromPath(path: string) {
  return LEGAL_DOCS.find((doc) => doc.path === path) ?? null;
}

async function loadPublished(slug: string) {
  if (!/^[a-z0-9]+$/.test(slug)) return null;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("project_app_legal")
    .select("published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return parsePublication(data.published);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, doc } = await params;
  const meta = docFromPath(doc);
  const published = meta ? await loadPublished(slug) : null;
  if (!meta || !published) return { title: "Documento legal" };
  const title = fillLegalText(
    published.docs[meta.id].title,
    published.profile,
    published.publishedAt
  );
  return {
    title: `${title} · ${published.profile.appName || "App"}`,
    description: `Versión ${published.version} de ${title}.`,
  };
}

export default async function AppLegalPage({ params }: Params) {
  const { slug, doc } = await params;
  const meta = docFromPath(doc);
  if (!meta) notFound();
  const published = await loadPublished(slug);
  if (!published) notFound();
  return <PublicLegalDocument published={published} docId={meta.id as LegalDocId} />;
}
