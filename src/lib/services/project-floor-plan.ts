import type { AppSupabaseClient } from "@/lib/database-client";
import type { Project } from "@/types";

const FLOOR_PLAN_BUCKET = "floor-plans";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export function storagePathForProject(projectId: string): string {
  return `${projectId}/floor-plan.pdf`;
}

export function getProjectHasFloorPlan(project: Pick<Project, "floor_plan_storage_path">): boolean {
  return project.floor_plan_storage_path != null;
}

export async function uploadProjectFloorPlan(
  supabase: AppSupabaseClient,
  projectId: string,
  file: File,
  originalFilename: string,
): Promise<Project> {
  const path = storagePathForProject(projectId);
  const body = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(FLOOR_PLAN_BUCKET).upload(path, body, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: dbError } = await supabase
    .from("projects")
    .update({
      floor_plan_storage_path: path,
      floor_plan_filename: originalFilename,
      floor_plan_size_bytes: file.size,
      floor_plan_uploaded_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (dbError) {
    const { error: rollbackError } = await supabase.storage.from(FLOOR_PLAN_BUCKET).remove([path]);
    if (rollbackError) {
      // eslint-disable-next-line no-console -- server-side logging at DB boundary
      console.error("uploadProjectFloorPlan rollback delete failed:", rollbackError);
      throw rollbackError;
    }
    throw dbError;
  }

  return data;
}

export async function deleteProjectFloorPlan(supabase: AppSupabaseClient, project: Project): Promise<void> {
  const path = project.floor_plan_storage_path;
  if (!path) {
    return;
  }

  const { error: storageError } = await supabase.storage.from(FLOOR_PLAN_BUCKET).remove([path]);
  if (storageError) {
    throw storageError;
  }

  const clearMetadata = () =>
    supabase
      .from("projects")
      .update({
        floor_plan_storage_path: null,
        floor_plan_filename: null,
        floor_plan_size_bytes: null,
        floor_plan_uploaded_at: null,
      })
      .eq("id", project.id);

  let { error: dbError } = await clearMetadata();
  if (dbError) {
    ({ error: dbError } = await clearMetadata());
  }

  if (dbError) {
    // eslint-disable-next-line no-console -- server-side logging at DB boundary
    console.error("deleteProjectFloorPlan: storage removed but DB clear failed after retry:", dbError);
    throw dbError;
  }
}

export async function createFloorPlanSignedUrl(
  supabase: AppSupabaseClient,
  project: Project,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const path = project.floor_plan_storage_path;
  const expectedPath = storagePathForProject(project.id);
  if (!path || path !== expectedPath) {
    throw new Error("No floor plan attached to this project");
  }

  const { data, error } = await supabase.storage
    .from(FLOOR_PLAN_BUCKET)
    .createSignedUrl(expectedPath, expiresInSeconds);

  if (error) {
    throw error;
  }

  if (!data.signedUrl) {
    throw new Error("Failed to create signed URL");
  }

  return data.signedUrl;
}

export async function downloadProjectFloorPlan(
  supabase: AppSupabaseClient,
  project: Project,
): Promise<{ data: ArrayBuffer; filename: string } | null> {
  const path = project.floor_plan_storage_path;
  const expectedPath = storagePathForProject(project.id);
  if (!path || path !== expectedPath) {
    return null;
  }

  const { data, error } = await supabase.storage.from(FLOOR_PLAN_BUCKET).download(expectedPath);

  if (error) {
    throw error;
  }

  const filename = project.floor_plan_filename ?? "floor-plan.pdf";
  return { data: await data.arrayBuffer(), filename };
}
