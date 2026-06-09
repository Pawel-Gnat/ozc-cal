import type { AssemblyCategory } from "@/types";

/** PN-EN ISO 6946 heat-flow direction for surface resistance lookup. */
export type HeatFlowDirection = "horizontal" | "upward" | "downward";

/** Internal / external surface resistance pair (m²·K/W). */
export interface SurfaceResistances {
  rsi: number;
  rse: number;
}

/** ISO 6946 Table 1 — still air, high emissivity (MVP). */
export const ISO6946_SURFACE_RESISTANCES: Record<HeatFlowDirection, SurfaceResistances> = {
  horizontal: { rsi: 0.13, rse: 0.04 },
  upward: { rsi: 0.1, rse: 0.04 },
  downward: { rsi: 0.17, rse: 0.04 },
};

/** Both-side internal resistance for partitions between conditioned spaces (ISO 6946 §6.1). */
export const INTERNAL_PARTITION_RSI = 0.13;

/** Default vertical opening height when segment length defines width only (m). */
export const OPENING_DEFAULT_HEIGHT_M = 1.2;

/** Ventilation heat loss factor: Q [W] = VENTILATION_HEAT_FACTOR × V [m³/h] × ΔT [K]. */
export const VENTILATION_HEAT_FACTOR = 0.33;

const CATEGORY_HEAT_FLOW: Record<AssemblyCategory, HeatFlowDirection | "internal_partition"> = {
  external_wall: "horizontal",
  internal_partition: "internal_partition",
  floor: "downward",
  ceiling: "upward",
  roof: "upward",
  ground_floor: "downward",
  window: "horizontal",
  door: "horizontal",
};

export function getHeatFlowDirection(category: AssemblyCategory): HeatFlowDirection | "internal_partition" {
  return CATEGORY_HEAT_FLOW[category];
}

export function getSurfaceResistancesForCategory(
  category: AssemblyCategory,
): SurfaceResistances | "internal_partition" {
  const direction = getHeatFlowDirection(category);
  if (direction === "internal_partition") {
    return "internal_partition";
  }
  return ISO6946_SURFACE_RESISTANCES[direction];
}
