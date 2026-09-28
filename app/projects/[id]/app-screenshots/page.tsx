import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/app/actions/projects";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AppScreenshotsEditorPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <iframe
      src="/osg/"
      title="Editor"
      className="fixed inset-0 h-dvh w-dvw border-0 bg-[#f7f7f8]"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
