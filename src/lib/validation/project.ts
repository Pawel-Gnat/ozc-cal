import { z } from "zod";

export const projectNameSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120, "Project name must be 120 characters or fewer"),
});

export const projectIdSchema = z.uuid();

export type ProjectNameInput = z.infer<typeof projectNameSchema>;
