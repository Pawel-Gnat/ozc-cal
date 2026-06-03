import { z } from "zod";

export const FLOOR_PLAN_MAX_BYTES = 52428800;

const PDF_MAGIC = "%PDF-";

function hasPdfMagicBytes(header: Uint8Array): boolean {
  if (header.length < PDF_MAGIC.length) {
    return false;
  }

  return PDF_MAGIC === new TextDecoder().decode(header.slice(0, PDF_MAGIC.length));
}

export const floorPlanFileSchema = z
  .instanceof(File, { message: "A PDF file is required" })
  .refine((file) => file.size > 0, "PDF file cannot be empty")
  .refine((file) => file.size <= FLOOR_PLAN_MAX_BYTES, "PDF file must be 50 MiB or smaller")
  .refine((file) => file.name.toLowerCase().endsWith(".pdf"), "Filename must end with .pdf")
  .refine((file) => file.type === "" || file.type === "application/pdf", "File must be a PDF (application/pdf)");

export async function validateFloorPlanFile(
  file: unknown,
): Promise<{ success: true; data: File } | { success: false; message: string }> {
  const parsed = floorPlanFileSchema.safeParse(file);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid PDF file" };
  }

  const header = new Uint8Array(await parsed.data.slice(0, PDF_MAGIC.length).arrayBuffer());
  if (!hasPdfMagicBytes(header)) {
    return { success: false, message: "File content is not a valid PDF" };
  }

  return { success: true, data: parsed.data };
}
