import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, getProjectTools } from "@/app/actions/projects";
import { Dashboard } from "@/components/dashboard/Dashboard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const project = await getProject(id);
  if (!project) notFound();

  const tools = await getProjectTools(id);

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-[var(--background)] text-[13px] text-[var(--muted)]">
          Cargando…
        </div>
      }
    >
      <Dashboard
        project={project}
        initialTools={tools}
        userEmail={user?.email ?? null}
      />
    </Suspense>
  );
}
