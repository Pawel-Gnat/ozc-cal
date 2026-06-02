import type { APIContext } from "astro";

import { createClient } from "@/lib/supabase";
import type { AppSupabaseClient } from "@/lib/database-client";
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

export function isProjectRouteOk(route: ProjectRouteContext): route is ProjectRouteOk {
  return route.ok;
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
