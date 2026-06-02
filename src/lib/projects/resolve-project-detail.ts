import type { AstroCookies } from "astro";

import { createClient } from "@/lib/supabase";
import type { AppSupabaseClient } from "@/lib/database-client";
import { listAssembliesWithLayers, type AssemblyWithLayers } from "@/lib/services/assemblies";
import { getProjectById } from "@/lib/services/projects";
import { getProjectHasClimate } from "@/lib/services/project-climate";
import { projectIdSchema } from "@/lib/validation/project";
import type { Project } from "@/types";

export type ResolveProjectDetailResult =
  | { status: "redirect"; location: string }
  | { status: "ok"; project: Project; assemblies: AssemblyWithLayers[]; hasClimate: boolean };

const NOT_FOUND = "/dashboard?error=Project%20not%20found";
const LOAD_FAILED = "/dashboard?error=Could%20not%20load%20project.%20Please%20try%20again.";

export async function loadProjectBuildingParameters(
  supabase: AppSupabaseClient,
  projectId: string,
): Promise<{ assemblies: AssemblyWithLayers[]; hasClimate: boolean }> {
  const project = await getProjectById(supabase, projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const assemblies = await listAssembliesWithLayers(supabase, projectId);

  return {
    assemblies,
    hasClimate: getProjectHasClimate(project),
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

    const { assemblies, hasClimate } = await loadProjectBuildingParameters(supabase, parsedId.data);

    return { status: "ok", project, assemblies, hasClimate };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("resolveProjectDetail failed:", error);
    return { status: "redirect", location: LOAD_FAILED };
  }
}
