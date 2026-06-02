import type { AppSupabaseClient } from "@/lib/database-client";
import type { Project, ProjectInsert } from "@/types";

export async function listProjects(supabase: AppSupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getProjectById(supabase: AppSupabaseClient, id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Project | null, { merge: false }>();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProject(supabase: AppSupabaseClient, input: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase.from("projects").insert(input).select().single();

  if (error) {
    throw error;
  }

  return data;
}
