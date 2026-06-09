import type { AppSupabaseClient } from "@/lib/database-client";
import type { ClimateUpdateInput } from "@/lib/validation/climate";
import type { Project } from "@/types";

export function getProjectHasClimate(project: Pick<Project, "climate_zone" | "external_design_temp_c">): boolean {
  return project.climate_zone != null && project.external_design_temp_c != null;
}

export async function updateProjectClimate(
  supabase: AppSupabaseClient,
  projectId: string,
  input: ClimateUpdateInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      climate_zone: input.climate_zone,
      external_design_temp_c: input.external_design_temp_c,
      storey_height_m: input.storey_height_m,
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
