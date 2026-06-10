import { computeAssemblyU } from "@/lib/thermal/wt2021-u";
import type { AssemblyCategory } from "@/types";

export interface AssemblyPreviewLayer {
  lambda_w_mk: number;
  thickness_mm: number;
}

export interface AssemblyPreviewResult {
  rTotal: number;
  uValue: number;
}

/** Thermal resistance preview for assembly layer stacks (delegates to authoritative U module). */
export function computeAssemblyPreview(
  layers: AssemblyPreviewLayer[],
  category: AssemblyCategory,
): AssemblyPreviewResult {
  return computeAssemblyU(layers, category);
}
