import type { APIRoute } from "astro";

import { jsonError, jsonOk } from "@/lib/api/json-response";
import {
  ensureProjectEditorReady,
  isProjectApiRouteOk,
  resolveProjectApiContext,
} from "@/lib/api/project-route-helpers";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { getEditorState, replaceEditorState } from "@/lib/services/project-editor";
import { editorStateSchema } from "@/lib/validation/editor";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const route = await resolveProjectApiContext(context, context.params.id);
  if (!isProjectApiRouteOk(route)) {
    const { status, body } = route;
    return jsonError(status, body.error.message, body.error.code);
  }

  const { supabase, project } = route;

  try {
    const precondition = await ensureProjectEditorReady(supabase, project);
    if (precondition) {
      return precondition;
    }

    const result = await getEditorState(supabase, project);
    return jsonOk(result.data, result.meta);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("GET editor state failed:", error);
    return jsonError(500, "Could not load editor state. Please try again.", "INTERNAL_ERROR");
  }
};

export const PUT: APIRoute = async (context) => {
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

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return jsonError(400, "Request body must be valid JSON", "VALIDATION_ERROR");
    }

    const parsed = editorStateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        400,
        "Invalid editor state",
        "VALIDATION_ERROR",
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      );
    }

    try {
      const result = await replaceEditorState(supabase, projectId, parsed.data);
      return jsonOk(result.data, result.meta);
    } catch (error) {
      if (error instanceof Error && error.message.includes("assemblies do not belong")) {
        return jsonError(400, error.message, "VALIDATION_ERROR");
      }
      throw error;
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("PUT editor state failed:", error);
    return jsonError(500, "Could not save editor state. Please try again.", "INTERNAL_ERROR");
  }
};
