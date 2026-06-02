import type { APIRoute } from "astro";

import {
  isProjectRouteOk,
  projectMutationErrorRedirect,
  resolveProjectRouteContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { createAssemblyWithLayers } from "@/lib/services/assemblies";
import { getProjectHasClimate } from "@/lib/services/project-climate";
import { assemblyCreateSchema } from "@/lib/validation/assembly";
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

  const form = await context.request.formData();
  const parsed = assemblyCreateSchema.safeParse(parseAssemblyFormData(form));

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid assembly data";
    return context.redirect(projectMutationErrorRedirect(projectId, message));
  }

  try {
    await createAssemblyWithLayers(supabase, projectId, parsed.data);
    return context.redirect(`/projects/${projectId}?saved=assembly`);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("createAssemblyWithLayers failed:", error);
    return context.redirect(projectMutationErrorRedirect(projectId, "Failed to create assembly"));
  }
};
