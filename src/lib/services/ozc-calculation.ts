import type { AppSupabaseClient } from "@/lib/database-client";
import { listAssembliesWithLayers } from "@/lib/services/assemblies";
import { getEditorState } from "@/lib/services/project-editor";
import { getProjectById } from "@/lib/services/projects";
import { calculateOzc } from "@/lib/thermal/calculate-ozc";
import { toOzcCalcResultDisplay, type OzcCalcResultDisplay } from "@/lib/thermal/calc-display";
import type { OzcCalcResult, ValidatableOzcInput } from "@/lib/thermal/calc-types";
import type { Project } from "@/types";

export interface OzcCalcInputLoad {
  input: ValidatableOzcInput;
  assembliesCount: number;
}

export async function loadOzcCalcInput(
  supabase: AppSupabaseClient,
  projectId: string,
  knownProject?: Project,
): Promise<OzcCalcInputLoad> {
  const project = knownProject ?? (await getProjectById(supabase, projectId));
  if (!project) {
    throw new Error("Project not found");
  }

  const [{ data: editor }, assemblies] = await Promise.all([
    getEditorState(supabase, project),
    listAssembliesWithLayers(supabase, projectId),
  ]);

  return {
    assembliesCount: assemblies.length,
    input: {
      external_design_temp_c: project.external_design_temp_c,
      storey_height_m: project.storey_height_m,
      assemblies: assemblies.map((assembly) => ({
        id: assembly.id,
        category: assembly.category,
        layers: assembly.layers.map((layer) => ({
          lambda_w_mk: layer.lambda_w_mk,
          thickness_mm: layer.thickness_mm,
        })),
      })),
      scale: editor.scale,
      nodes: editor.nodes,
      segments: editor.segments,
      rooms: editor.rooms,
    },
  };
}

export async function calculateProjectOzc(supabase: AppSupabaseClient, projectId: string): Promise<OzcCalcResult> {
  const { input } = await loadOzcCalcInput(supabase, projectId);
  return calculateOzc(input);
}

export async function calculateAndFormatProjectOzc(
  supabase: AppSupabaseClient,
  projectId: string,
  knownProject?: Project,
): Promise<OzcCalcResultDisplay> {
  const { input } = await loadOzcCalcInput(supabase, projectId, knownProject);
  const result = calculateOzc(input);
  return toOzcCalcResultDisplay(result, input.rooms);
}
