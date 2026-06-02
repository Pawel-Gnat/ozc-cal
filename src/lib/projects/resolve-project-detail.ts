import type { AstroCookies } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { getProjectById } from "@/lib/services/projects";
import { projectIdSchema } from "@/lib/validation/project";
import type { Database, Project } from "@/types";

export type ResolveProjectDetailResult = { status: "redirect"; location: string } | { status: "ok"; project: Project };

const NOT_FOUND = "/dashboard?error=Project%20not%20found";
const LOAD_FAILED = "/dashboard?error=Could%20not%20load%20project.%20Please%20try%20again.";

export async function resolveProjectDetail(
  rawId: string | undefined,
  requestHeaders: Headers,
  cookies: AstroCookies,
): Promise<ResolveProjectDetailResult> {
  const parsedId = projectIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return { status: "redirect", location: NOT_FOUND };
  }

  const supabase = createClient(requestHeaders, cookies) as SupabaseClient<Database> | null;
  if (!supabase) {
    return { status: "redirect", location: "/dashboard?error=Supabase%20is%20not%20configured" };
  }

  try {
    const project = await getProjectById(supabase, parsedId.data);
    if (!project) {
      return { status: "redirect", location: NOT_FOUND };
    }
    return { status: "ok", project };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("getProjectById failed:", error);
    return { status: "redirect", location: LOAD_FAILED };
  }
}
