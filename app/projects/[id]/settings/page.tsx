import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { SettingsHome } from "@/components/settings/SettingsHome";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectSettingsRoute({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <SettingsHome
      projectId={project.id}
      projectName={project.name}
      userEmail={user?.email ?? null}
    />
  );
}
