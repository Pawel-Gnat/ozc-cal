import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { createProject } from "@/lib/services/projects";
import { projectNameSchema } from "@/lib/validation/project";
import type { Database } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies) as SupabaseClient<Database> | null;
  if (!supabase) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const form = await context.request.formData();
  const parsed = projectNameSchema.safeParse({ name: form.get("name") });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid project name";
    return context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }

  try {
    const project = await createProject(supabase, {
      name: parsed.data.name,
      owner_id: user.id,
    });
    return context.redirect(`/projects/${project.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    return context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
};
