import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicLegalDocument } from "@/components/legal/PublicLegalDocument";
import {
  fillLegalText,
  LEGAL_DOCS,
  legalPublicSlug,
  parsePublication,
  type LegalDocId,
} from "@/lib/creator/app-legal";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string; doc: string }> };

function docFromPath(path: string) {
  return LEGAL_DOCS.find((doc) => doc.path === path) ?? null;
}

async function loadPublished(projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("project_app_legal")
    .select("published")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return parsePublication(data.published);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { projectId, doc } = await params;
  const meta = docFromPath(doc);
  const published = meta ? await loadPublished(projectId) : null;
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

export default async function PublicLegalPage({ params }: Params) {
  const { projectId, doc } = await params;
  const meta = docFromPath(doc);
  if (!meta) notFound();
  const published = await loadPublished(projectId);
  if (!published) notFound();
  const slug = legalPublicSlug(published.profile);
  if (slug) redirect(`/${slug}/${meta.path}`);
  return <PublicLegalDocument published={published} docId={meta.id as LegalDocId} />;
}
