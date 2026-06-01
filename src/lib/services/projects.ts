import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Project, ProjectInsert } from "@/types";

type ProjectsClient = SupabaseClient<Database>;

export async function listProjects(supabase: ProjectsClient): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getProjectById(supabase: ProjectsClient, id: string): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProject(supabase: ProjectsClient, input: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase.from("projects").insert(input).select().single();

  if (error) {
    throw error;
  }

  return data;
}
