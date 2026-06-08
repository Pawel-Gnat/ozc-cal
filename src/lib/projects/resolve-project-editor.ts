import type { AstroCookies } from "astro";

import { createClient } from "@/lib/supabase";
import type { AppSupabaseClient } from "@/lib/database-client";
import { loadProjectBuildingParameters } from "@/lib/projects/resolve-project-detail";
import { getProjectById } from "@/lib/services/projects";
import { scaleFromProject, type EditorScaleState } from "@/lib/services/project-editor";
import { projectIdSchema } from "@/lib/validation/project";
import type { AssemblyCategory, Project } from "@/types";

export interface EditorAssemblySummary {
  id: string;
  name: string;
  category: AssemblyCategory;
}

export type ResolveProjectEditorResult =
  | { status: "redirect"; location: string }
  | {
      status: "ok";
      project: Project;
      assemblies: EditorAssemblySummary[];
      initialScale: EditorScaleState | null;
    };

const NOT_FOUND = "/dashboard?error=Project%20not%20found";
const LOAD_FAILED = "/dashboard?error=Could%20not%20load%20project.%20Please%20try%20again.";

function prerequisiteRedirect(projectId: string, message: string): ResolveProjectEditorResult {
  return {
    status: "redirect",
    location: `/projects/${projectId}?error=${encodeURIComponent(message)}`,
  };
}

export async function resolveProjectEditor(
  rawId: string | undefined,
  requestHeaders: Headers,
  cookies: AstroCookies,
): Promise<ResolveProjectEditorResult> {
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

    if (!hasClimate) {
      return prerequisiteRedirect(project.id, "Save climate settings before opening the editor");
    }
    if (assemblies.length === 0) {
      return prerequisiteRedirect(project.id, "Add at least one assembly before opening the editor");
    }
    if (!hasFloorPlan) {
      return prerequisiteRedirect(project.id, "Upload a floor plan before opening the editor");
    }

    return {
      status: "ok",
      project,
      assemblies: assemblies.map((assembly) => ({
        id: assembly.id,
        name: assembly.name,
        category: assembly.category,
      })),
      initialScale: scaleFromProject(project),
    };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("resolveProjectEditor failed:", error);
    return { status: "redirect", location: LOAD_FAILED };
  }
}
