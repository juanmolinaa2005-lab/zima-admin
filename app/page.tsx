import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/app/actions/projects";
import { getSupabaseConnectionStatus } from "@/app/actions/supabase-account";
import { ProjectsPage } from "@/components/projects/ProjectsPage";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LandingPage />;

  const [projects, connection] = await Promise.all([
    getProjects(),
    getSupabaseConnectionStatus(),
  ]);

  return (
    <ProjectsPage
      projects={projects}
      userEmail={user.email ?? null}
      supabaseConnected={connection.connected}
    />
  );
}
