import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { DynamicsEditorApp } from "@/components/dashboard/estudio/DynamicsEditorApp";

type PageProps = {
  params: Promise<{ id: string; dynamicId: string }>;
};

export default async function DynamicsEditorPage({ params }: PageProps) {
  const { id, dynamicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  const safeId = decodeURIComponent(dynamicId || "").trim();
  if (!safeId) notFound();

  return <DynamicsEditorApp projectId={project.id} dynamicId={safeId} />;
}
