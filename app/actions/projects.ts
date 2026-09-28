"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listRemoteSupabaseProjects } from "@/lib/supabase/management";
import { getCurrentUserSupabaseAccessToken } from "@/lib/supabase/user-token";
import { normalizeUrl } from "@/lib/types";
import type { Project, ProjectTool } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, user };
}

export async function getProjects(): Promise<Project[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Project | null;
}

export async function getProjectTools(projectId: string): Promise<ProjectTool[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("project_tools")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectTool[];
}

export async function createProject(input: {
  name: string;
  description?: string;
  supabase_project_ref?: string | null;
}): Promise<Project> {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      description: input.description?.trim() || null,
      supabase_project_ref: input.supabase_project_ref || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as Project;
}

export async function deleteProject(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function updateProjectLink(
  projectId: string,
  supabase_project_ref: string | null
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ supabase_project_ref })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}

export async function createProjectTool(
  projectId: string,
  name: string,
  url: string,
  toolKind: "app" | "social" = "app"
): Promise<ProjectTool> {
  const { supabase } = await requireUser();
  const trimmedName = name.trim();
  const normalized = normalizeUrl(url);
  if (!trimmedName) throw new Error("Nombre obligatorio");
  if (!normalized) throw new Error("Link obligatorio");

  const { data, error } = await supabase
    .from("project_tools")
    .insert({
      project_id: projectId,
      name: trimmedName,
      url: normalized,
      tool_kind: toolKind,
      direct_access: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  return data as ProjectTool;
}

export async function deleteProjectTool(projectId: string, toolId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("project_tools")
    .delete()
    .eq("id", toolId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}

export async function setToolDirectAccess(
  projectId: string,
  toolId: string,
  directAccess: boolean
): Promise<ProjectTool> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("project_tools")
    .update({ direct_access: directAccess })
    .eq("id", toolId)
    .eq("project_id", projectId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  return data as ProjectTool;
}

export async function setToolIconUrl(
  projectId: string,
  toolId: string,
  iconUrl: string | null
): Promise<ProjectTool> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("project_tools")
    .update({ icon_url: iconUrl })
    .eq("id", toolId)
    .eq("project_id", projectId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  return data as ProjectTool;
}

export async function fetchRemoteSupabaseProjects() {
  const token = await getCurrentUserSupabaseAccessToken();
  if (!token) {
    throw new Error("NOT_CONNECTED");
  }
  return listRemoteSupabaseProjects(token);
}
