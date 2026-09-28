import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { PasswordSettings } from "@/components/settings/PasswordSettings";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PasswordSettingsRoute({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <PasswordSettings
      projectId={project.id}
      projectName={project.name}
      userEmail={user?.email ?? null}
    />
  );
}
