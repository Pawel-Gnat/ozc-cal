import { z } from "zod";

import { CLIMATE_ZONE_IDS } from "@/types";

export const climateZoneSchema = z.enum(CLIMATE_ZONE_IDS);

/** Allowed override range for external design temperature (°C). */
export const EXTERNAL_DESIGN_TEMP_MIN_C = -30;
export const EXTERNAL_DESIGN_TEMP_MAX_C = -10;

/** Storey height range for OZC geometry (m). */
export const STOREY_HEIGHT_MIN_M = 2.0;
export const STOREY_HEIGHT_MAX_M = 4.0;
export const STOREY_HEIGHT_DEFAULT_M = 2.6;

export const climateUpdateSchema = z.object({
  climate_zone: climateZoneSchema,
  external_design_temp_c: z.coerce
    .number()
    .min(EXTERNAL_DESIGN_TEMP_MIN_C, `External design temperature must be at least ${EXTERNAL_DESIGN_TEMP_MIN_C} °C`)
    .max(EXTERNAL_DESIGN_TEMP_MAX_C, `External design temperature must be at most ${EXTERNAL_DESIGN_TEMP_MAX_C} °C`),
  storey_height_m: z.coerce
    .number()
    .min(STOREY_HEIGHT_MIN_M, `Storey height must be at least ${STOREY_HEIGHT_MIN_M} m`)
    .max(STOREY_HEIGHT_MAX_M, `Storey height must be at most ${STOREY_HEIGHT_MAX_M} m`),
});

export type ClimateUpdateInput = z.infer<typeof climateUpdateSchema>;
