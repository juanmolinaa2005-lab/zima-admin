import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { BuildKind } from "@/components/dashboard/nav";

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
  const { data: profile } = await supabase.from("launch_profiles").select("product_type").eq("project_id", id).maybeSingle();
  const kind = (profile?.product_type as BuildKind | undefined) ?? null;

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
        userEmail={user?.email ?? null}
        kind={kind}
      />
    </Suspense>
  );
}
