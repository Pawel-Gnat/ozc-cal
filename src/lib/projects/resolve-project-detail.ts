import type { AstroCookies } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { getProjectById } from "@/lib/services/projects";
import { projectIdSchema } from "@/lib/validation/project";
import type { Database, Project } from "@/types";

export type ResolveProjectDetailResult = { status: "redirect"; location: string } | { status: "ok"; project: Project };

const NOT_FOUND = "/dashboard?error=Project%20not%20found";

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
  } catch {
    return { status: "redirect", location: NOT_FOUND };
  }
}
