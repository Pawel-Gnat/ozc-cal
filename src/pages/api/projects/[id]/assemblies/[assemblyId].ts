import type { APIRoute } from "astro";

import {
  isProjectRouteOk,
  projectMutationErrorRedirect,
  resolveProjectRouteContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { deleteAssembly, getAssemblyById, updateAssemblyWithLayers } from "@/lib/services/assemblies";
import { getProjectHasClimate } from "@/lib/services/project-climate";
import { projectIdSchema } from "@/lib/validation/project";
import { assemblyUpdateSchema } from "@/lib/validation/assembly";
import { parseAssemblyFormData } from "@/lib/validation/parse-assembly-form";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const route = await resolveProjectRouteContext(context, context.params.id);
  if (!isProjectRouteOk(route)) {
    return context.redirect(route.redirect);
  }

  const { supabase, project, projectId } = route;

  if (!isSameOriginRequest(context.request)) {
    return context.redirect(projectMutationErrorRedirect(projectId, "Invalid request origin"));
  }

  if (!getProjectHasClimate(project)) {
    return context.redirect(
      projectMutationErrorRedirect(projectId, "Save climate settings before managing assemblies"),
    );
  }

  const parsedAssemblyId = projectIdSchema.safeParse(context.params.assemblyId);
  if (!parsedAssemblyId.success) {
    return context.redirect(projectMutationErrorRedirect(projectId, "Assembly not found"));
  }

  const assemblyId = parsedAssemblyId.data;
  const form = await context.request.formData();

  if (form.get("_action") === "delete") {
    try {
      const assembly = await getAssemblyById(supabase, assemblyId);
      if (assembly?.project_id !== projectId) {
        return context.redirect(projectMutationErrorRedirect(projectId, "Assembly not found"));
      }

      await deleteAssembly(supabase, assemblyId);
      return context.redirect(`/projects/${projectId}?saved=assembly`);
    } catch (error) {
      // eslint-disable-next-line no-console -- server-side logging at DB boundary
      console.error("deleteAssembly failed:", error);
      return context.redirect(projectMutationErrorRedirect(projectId, "Failed to delete assembly"));
    }
  }

  const parsed = assemblyUpdateSchema.safeParse(parseAssemblyFormData(form));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid assembly data";
    return context.redirect(projectMutationErrorRedirect(projectId, message));
  }

  try {
    const assembly = await getAssemblyById(supabase, assemblyId);
    if (assembly?.project_id !== projectId) {
      return context.redirect(projectMutationErrorRedirect(projectId, "Assembly not found"));
    }

    await updateAssemblyWithLayers(supabase, assemblyId, parsed.data);
    return context.redirect(`/projects/${projectId}?saved=assembly`);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("updateAssemblyWithLayers failed:", error);
    return context.redirect(projectMutationErrorRedirect(projectId, "Failed to update assembly"));
  }
};
