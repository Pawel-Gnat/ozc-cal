import type { APIContext } from "astro";

import type { ApiErrorBody } from "@/lib/api/json-response";
import { jsonError } from "@/lib/api/json-response";
import { createClient } from "@/lib/supabase";
import type { AppSupabaseClient } from "@/lib/database-client";
import { countProjectAssemblies, getProjectEditorReady } from "@/lib/services/project-editor";
import { getProjectById } from "@/lib/services/projects";
import { projectIdSchema } from "@/lib/validation/project";
import type { Project } from "@/types";

const NOT_FOUND = "/dashboard?error=Project%20not%20found";

export interface ProjectRouteOk {
  ok: true;
  supabase: AppSupabaseClient;
  project: Project;
  projectId: string;
}

type ProjectRouteContext = { ok: false; redirect: string } | ProjectRouteOk;

export interface ProjectApiRouteOk {
  ok: true;
  supabase: AppSupabaseClient;
  project: Project;
  projectId: string;
}

export type ProjectApiRouteContext = { ok: false; status: number; body: ApiErrorBody } | ProjectApiRouteOk;

export function isProjectRouteOk(route: ProjectRouteContext): route is ProjectRouteOk {
  return route.ok;
}

export function isProjectApiRouteOk(route: ProjectApiRouteContext): route is ProjectApiRouteOk {
  return route.ok;
}

export async function ensureProjectEditorReady(
  supabase: AppSupabaseClient,
  project: Project,
): Promise<Response | null> {
  const assembliesCount = await countProjectAssemblies(supabase, project.id);
  if (!getProjectEditorReady(project, assembliesCount)) {
    return jsonError(
      422,
      "Save climate settings, add at least one assembly, and upload a floor plan before using the editor",
      "PRECONDITION_FAILED",
    );
  }

  return null;
}

export async function resolveProjectApiContext(
  context: APIContext,
  rawProjectId: string | undefined,
): Promise<ProjectApiRouteContext> {
  const user = context.locals.user;
  if (!user) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
    };
  }

  const parsedId = projectIdSchema.safeParse(rawProjectId);
  if (!parsedId.success) {
    return {
      ok: false,
      status: 404,
      body: { error: { message: "Project not found", code: "NOT_FOUND" } },
    };
  }

  const supabase: AppSupabaseClient | null = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return {
      ok: false,
      status: 500,
      body: { error: { message: "Supabase is not configured", code: "INTERNAL_ERROR" } },
    };
  }

  try {
    const project = await getProjectById(supabase, parsedId.data);
    if (!project) {
      return {
        ok: false,
        status: 404,
        body: { error: { message: "Project not found", code: "NOT_FOUND" } },
      };
    }

    return {
      ok: true,
      supabase,
      project,
      projectId: parsedId.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("resolveProjectApiContext getProjectById failed:", error);
    return {
      ok: false,
      status: 500,
      body: { error: { message: "Could not load project. Please try again.", code: "INTERNAL_ERROR" } },
    };
  }
}

export async function resolveProjectRouteContext(
  context: APIContext,
  rawProjectId: string | undefined,
): Promise<ProjectRouteContext> {
  const user = context.locals.user;
  if (!user) {
    return { ok: false, redirect: "/auth/signin" };
  }

  const parsedId = projectIdSchema.safeParse(rawProjectId);
  if (!parsedId.success) {
    return { ok: false, redirect: NOT_FOUND };
  }

  const supabase: AppSupabaseClient | null = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return {
      ok: false,
      redirect: `/projects/${parsedId.data}?error=${encodeURIComponent("Supabase is not configured")}`,
    };
  }

  try {
    const project = await getProjectById(supabase, parsedId.data);
    if (!project) {
      return { ok: false, redirect: NOT_FOUND };
    }

    const success: ProjectRouteOk = {
      ok: true,
      supabase,
      project,
      projectId: parsedId.data,
    };
    return success;
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("getProjectById failed:", error);
    return {
      ok: false,
      redirect: `/projects/${parsedId.data}?error=${encodeURIComponent("Could not load project. Please try again.")}`,
    };
  }
}

export function projectMutationErrorRedirect(projectId: string, message: string): string {
  return `/projects/${projectId}?error=${encodeURIComponent(message)}`;
}
