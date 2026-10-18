import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/app/actions/projects";
import { Dashboard } from "@/components/dashboard/Dashboard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-[var(--background)] text-[13px] text-[var(--muted)]">
          Cargando…
        </div>
      }
    >
      <Dashboard project={project} />
    </Suspense>
  );
}
