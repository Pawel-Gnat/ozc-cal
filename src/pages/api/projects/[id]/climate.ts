import type { APIRoute } from "astro";

import {
  isProjectRouteOk,
  projectMutationErrorRedirect,
  resolveProjectRouteContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { updateProjectClimate } from "@/lib/services/project-climate";
import { climateUpdateSchema } from "@/lib/validation/climate";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const route = await resolveProjectRouteContext(context, context.params.id);
  if (!isProjectRouteOk(route)) {
    return context.redirect(route.redirect);
  }

  const { supabase, projectId } = route;

  if (!isSameOriginRequest(context.request)) {
    return context.redirect(projectMutationErrorRedirect(projectId, "Invalid request origin"));
  }

  const form = await context.request.formData();
  const parsed = climateUpdateSchema.safeParse({
    climate_zone: form.get("climate_zone"),
    external_design_temp_c: form.get("external_design_temp_c"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid climate settings";
    return context.redirect(projectMutationErrorRedirect(projectId, message));
  }

  try {
    await updateProjectClimate(supabase, projectId, parsed.data);
    return context.redirect(`/projects/${projectId}?saved=climate`);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("updateProjectClimate failed:", error);
    return context.redirect(projectMutationErrorRedirect(projectId, "Failed to save climate settings"));
  }
};
