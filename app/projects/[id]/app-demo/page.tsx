import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { AppDemoCodeStudio } from "@/components/dashboard/estudio/app-demo/AppDemoCodeStudio";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AppDemoCodePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <AppDemoCodeStudio projectId={project.id} projectName={project.name} />
  );
}
