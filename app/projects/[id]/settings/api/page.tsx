import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { SettingsShell } from "@/components/settings/SettingsShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ApiSettingsRoute({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <SettingsShell
      projectId={project.id}
      projectName={project.name}
      userEmail={user?.email ?? null}
      title="API"
      subtitle="Central place for all provider keys."
      backHref={`/projects/${project.id}/settings`}
      backLabel="← Settings"
    >
      <ApiSettings />
    </SettingsShell>
  );
}
