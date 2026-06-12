import type { APIRoute } from "astro";

import { jsonError, jsonOk } from "@/lib/api/json-response";
import {
  ensureProjectEditorReady,
  isProjectApiRouteOk,
  resolveProjectApiContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { calculateAndFormatProjectOzc } from "@/lib/services/ozc-calculation";
import { OzcValidationError } from "@/lib/thermal/calc-types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const route = await resolveProjectApiContext(context, context.params.id);
  if (!isProjectApiRouteOk(route)) {
    const { status, body } = route;
    return jsonError(status, body.error.message, body.error.code);
  }

  const { supabase, project, projectId } = route;

  if (!isSameOriginRequest(context.request)) {
    return jsonError(403, "Invalid request origin", "FORBIDDEN");
  }

  try {
    const precondition = await ensureProjectEditorReady(supabase, project);
    if (precondition) {
      return precondition;
    }

    const result = await calculateAndFormatProjectOzc(supabase, projectId);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof OzcValidationError) {
      return jsonError(
        422,
        error.message,
        "VALIDATION_ERROR",
        error.errors.map((issue) => ({
          path: [issue.roomId ?? issue.segmentId ?? issue.code],
          message: issue.message,
        })),
      );
    }

    if (error instanceof Error && error.message === "Project not found") {
      return jsonError(404, "Project not found", "NOT_FOUND");
    }

    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("POST calc failed:", error);
    return jsonError(500, "Could not run calculation. Please try again.", "INTERNAL_ERROR");
  }
};
