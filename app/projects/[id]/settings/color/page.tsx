import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ColorSettingsRoute({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/${id}/settings`);
}
