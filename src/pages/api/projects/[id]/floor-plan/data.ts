import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api/json-response";
import { isProjectApiRouteOk, resolveProjectApiContext } from "@/lib/api/project-route-helpers";
import { downloadProjectFloorPlan } from "@/lib/services/project-floor-plan";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const route = await resolveProjectApiContext(context, context.params.id);
  if (!isProjectApiRouteOk(route)) {
    const { status, body } = route;
    return jsonError(status, body.error.message, body.error.code);
  }

  const { supabase, project } = route;

  try {
    const downloaded = await downloadProjectFloorPlan(supabase, project);
    if (!downloaded) {
      return jsonError(404, "No floor plan attached to this project", "NOT_FOUND");
    }

    return new Response(downloaded.data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${downloaded.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("downloadProjectFloorPlan failed:", error);
    return jsonError(500, "Failed to load floor plan", "INTERNAL_ERROR");
  }
};
