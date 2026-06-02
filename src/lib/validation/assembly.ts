import { z } from "zod";

export const ASSEMBLY_CATEGORIES = [
  "external_wall",
  "internal_partition",
  "floor",
  "ceiling",
  "roof",
  "ground_floor",
  "window",
  "door",
] as const;

export type AssemblyCategory = (typeof ASSEMBLY_CATEGORIES)[number];

export const MAX_ASSEMBLY_LAYERS = 20;

const assemblyCategorySchema = z.enum(ASSEMBLY_CATEGORIES);

export const assemblyLayerSchema = z.object({
  layer_order: z.coerce.number().int().min(0, "Layer order must be 0 or greater"),
  material_name: z
    .string()
    .trim()
    .min(1, "Material name is required")
    .max(120, "Material name must be 120 characters or fewer"),
  lambda_w_mk: z.coerce.number().positive("Thermal conductivity must be greater than 0"),
  thickness_mm: z.coerce.number().positive("Thickness must be greater than 0"),
});

export const assemblyCreateSchema = z.object({
  name: z.string().trim().min(1, "Assembly name is required").max(120, "Assembly name must be 120 characters or fewer"),
  category: assemblyCategorySchema,
  layers: z
    .array(assemblyLayerSchema)
    .min(1, "At least one layer is required")
    .max(MAX_ASSEMBLY_LAYERS, `At most ${MAX_ASSEMBLY_LAYERS} layers are allowed`),
});

export const assemblyUpdateSchema = assemblyCreateSchema;

export type AssemblyLayerInput = z.infer<typeof assemblyLayerSchema>;
export type AssemblyCreateInput = z.infer<typeof assemblyCreateSchema>;
export type AssemblyUpdateInput = z.infer<typeof assemblyUpdateSchema>;
