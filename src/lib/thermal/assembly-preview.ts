/**
 * Simplified thermal resistance preview for assembly layer stacks.
 * Not authoritative — F-03 may refine surface resistances and calculation method.
 */

/** Internal surface resistance (m²·K/W), vertical heat flow — preview only. */
export const R_SI_PREVIEW = 0.13;

/** External surface resistance (m²·K/W) — preview only. */
export const R_SE_PREVIEW = 0.04;

export interface AssemblyPreviewLayer {
  lambda_w_mk: number;
  thickness_mm: number;
}

export interface AssemblyPreviewResult {
  rTotal: number;
  uValue: number;
}

export function computeAssemblyPreview(layers: AssemblyPreviewLayer[]): AssemblyPreviewResult {
  const layerResistance = layers.reduce((sum, layer) => {
    const thicknessM = layer.thickness_mm / 1000;
    return sum + thicknessM / layer.lambda_w_mk;
  }, 0);

  const rTotal = R_SI_PREVIEW + layerResistance + R_SE_PREVIEW;
  const uValue = 1 / rTotal;

  return { rTotal, uValue };
}
