import { getSurfaceResistancesForCategory, INTERNAL_PARTITION_RSI } from "@/lib/thermal/wt2021-constants";
import type { AssemblyCategory } from "@/types";

export interface AssemblyLayerInput {
  lambda_w_mk: number;
  thickness_mm: number;
}

export interface AssemblyUResult {
  rTotal: number;
  uValue: number;
}

/** Authoritative U-value from layer stack and assembly category (PN-EN ISO 6946). */
export function computeAssemblyU(layers: AssemblyLayerInput[], category: AssemblyCategory): AssemblyUResult {
  const layerResistance = layers.reduce((sum, layer) => {
    const thicknessM = layer.thickness_mm / 1000;
    return sum + thicknessM / layer.lambda_w_mk;
  }, 0);

  const surfaceResistances = getSurfaceResistancesForCategory(category);

  if (surfaceResistances === "internal_partition") {
    const rTotal = INTERNAL_PARTITION_RSI + layerResistance + INTERNAL_PARTITION_RSI;
    return { rTotal, uValue: 1 / rTotal };
  }

  const rTotal = surfaceResistances.rsi + layerResistance + surfaceResistances.rse;
  return { rTotal, uValue: 1 / rTotal };
}
