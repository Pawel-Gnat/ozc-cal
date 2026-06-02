import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createProject } from "@/lib/services/projects";
import { isSameOriginRequest } from "@/lib/is-same-origin-request";
import { projectNameSchema } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  if (!isSameOriginRequest(context.request)) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Invalid request origin")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
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
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("createProject failed:", error);
    return context.redirect(`/dashboard?error=${encodeURIComponent("Failed to create project")}`);
  }
};
