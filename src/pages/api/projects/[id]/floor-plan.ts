import type { APIRoute } from "astro";

import {
  isProjectRouteOk,
  projectMutationErrorRedirect,
  resolveProjectRouteContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import {
  createFloorPlanSignedUrl,
  deleteProjectFloorPlan,
  getProjectHasFloorPlan,
  uploadProjectFloorPlan,
} from "@/lib/services/project-floor-plan";
import { validateFloorPlanFile } from "@/lib/validation/floor-plan";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const route = await resolveProjectRouteContext(context, context.params.id);
  if (!isProjectRouteOk(route)) {
    return context.redirect(route.redirect);
  }

  const { supabase, project, projectId } = route;

  if (!getProjectHasFloorPlan(project)) {
    return context.redirect(projectMutationErrorRedirect(projectId, "No floor plan attached to this project"));
  }

  try {
    const signedUrl = await createFloorPlanSignedUrl(supabase, project);
    return context.redirect(signedUrl);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("createFloorPlanSignedUrl failed:", error);
    return context.redirect(projectMutationErrorRedirect(projectId, "Failed to open floor plan"));
  }
};

export const POST: APIRoute = async (context) => {
  const route = await resolveProjectRouteContext(context, context.params.id);
  if (!isProjectRouteOk(route)) {
    return context.redirect(route.redirect);
  }

  const { supabase, project, projectId } = route;

  if (!isSameOriginRequest(context.request)) {
    return context.redirect(projectMutationErrorRedirect(projectId, "Invalid request origin"));
  }

  const form = await context.request.formData();

  if (form.get("_action") === "delete") {
    try {
      await deleteProjectFloorPlan(supabase, project);
      return context.redirect(`/projects/${projectId}?saved=floor-plan-removed`);
    } catch (error) {
      // eslint-disable-next-line no-console -- server-side logging at DB boundary
      console.error("deleteProjectFloorPlan failed:", error);
      return context.redirect(projectMutationErrorRedirect(projectId, "Failed to remove floor plan"));
    }
  }

  const file = form.get("floor_plan_file");
  const validated = await validateFloorPlanFile(file);
  if (!validated.success) {
    return context.redirect(projectMutationErrorRedirect(projectId, validated.message));
  }

  try {
    await uploadProjectFloorPlan(supabase, projectId, validated.data, validated.data.name);
    return context.redirect(`/projects/${projectId}?saved=floor-plan`);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("uploadProjectFloorPlan failed:", error);
    return context.redirect(projectMutationErrorRedirect(projectId, "Failed to upload floor plan"));
  }
};
