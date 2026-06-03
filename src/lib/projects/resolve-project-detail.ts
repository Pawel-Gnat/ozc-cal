import type { AstroCookies } from "astro";

import { createClient } from "@/lib/supabase";
import type { AppSupabaseClient } from "@/lib/database-client";
import { listAssembliesWithLayers, type AssemblyWithLayers } from "@/lib/services/assemblies";
import { getProjectById } from "@/lib/services/projects";
import { getProjectHasClimate } from "@/lib/services/project-climate";
import { getProjectHasFloorPlan } from "@/lib/services/project-floor-plan";
import { projectIdSchema } from "@/lib/validation/project";
import type { Project } from "@/types";

export type ResolveProjectDetailResult =
  | { status: "redirect"; location: string }
  | { status: "ok"; project: Project; assemblies: AssemblyWithLayers[]; hasClimate: boolean; hasFloorPlan: boolean };

const NOT_FOUND = "/dashboard?error=Project%20not%20found";
const LOAD_FAILED = "/dashboard?error=Could%20not%20load%20project.%20Please%20try%20again.";

export async function loadProjectBuildingParameters(
  supabase: AppSupabaseClient,
  project: Project,
): Promise<{ assemblies: AssemblyWithLayers[]; hasClimate: boolean; hasFloorPlan: boolean }> {
  const hasClimate = getProjectHasClimate(project);
  const hasFloorPlan = getProjectHasFloorPlan(project);
  const assemblies = hasClimate ? await listAssembliesWithLayers(supabase, project.id) : [];

  return {
    assemblies,
    hasClimate,
    hasFloorPlan,
  };
}

export async function resolveProjectDetail(
  rawId: string | undefined,
  requestHeaders: Headers,
  cookies: AstroCookies,
): Promise<ResolveProjectDetailResult> {
  const parsedId = projectIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return { status: "redirect", location: NOT_FOUND };
  }

  const supabase: AppSupabaseClient | null = createClient(requestHeaders, cookies);
  if (!supabase) {
    return { status: "redirect", location: "/dashboard?error=Supabase%20is%20not%20configured" };
  }

  try {
    const project = await getProjectById(supabase, parsedId.data);
    if (!project) {
      return { status: "redirect", location: NOT_FOUND };
    }

    const { assemblies, hasClimate, hasFloorPlan } = await loadProjectBuildingParameters(supabase, project);

    return { status: "ok", project, assemblies, hasClimate, hasFloorPlan };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("resolveProjectDetail failed:", error);
    return { status: "redirect", location: LOAD_FAILED };
  }
}
