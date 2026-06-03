import { z } from "zod";

import { ASSEMBLY_CATEGORIES, type AssemblyCategory } from "@/types";

export { ASSEMBLY_CATEGORIES, type AssemblyCategory };

export const MAX_ASSEMBLY_LAYERS = 20;

const assemblyCategorySchema = z.enum(ASSEMBLY_CATEGORIES);

function refineUniqueLayerOrder(data: { layers: { layer_order: number }[] }, ctx: z.RefinementCtx): void {
  const orders = data.layers.map((layer) => layer.layer_order);
  if (new Set(orders).size !== orders.length) {
    ctx.addIssue({
      code: "custom",
      message: "Layer order values must be unique",
      path: ["layers"],
    });
  }
}

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

export const assemblyCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Assembly name is required")
      .max(120, "Assembly name must be 120 characters or fewer"),
    category: assemblyCategorySchema,
    layers: z
      .array(assemblyLayerSchema)
      .min(1, "At least one layer is required")
      .max(MAX_ASSEMBLY_LAYERS, `At most ${MAX_ASSEMBLY_LAYERS} layers are allowed`),
  })
  .superRefine(refineUniqueLayerOrder);

export const assemblyUpdateSchema = assemblyCreateSchema;

export type AssemblyLayerInput = z.infer<typeof assemblyLayerSchema>;
export type AssemblyCreateInput = z.infer<typeof assemblyCreateSchema>;
export type AssemblyUpdateInput = z.infer<typeof assemblyUpdateSchema>;
