import { z } from "zod";

import { CLIMATE_ZONE_IDS } from "@/types";

export const climateZoneSchema = z.enum(CLIMATE_ZONE_IDS);

/** Allowed override range for external design temperature (°C). */
export const EXTERNAL_DESIGN_TEMP_MIN_C = -30;
export const EXTERNAL_DESIGN_TEMP_MAX_C = -10;

export const climateUpdateSchema = z.object({
  climate_zone: climateZoneSchema,
  external_design_temp_c: z.coerce
    .number()
    .min(EXTERNAL_DESIGN_TEMP_MIN_C, `External design temperature must be at least ${EXTERNAL_DESIGN_TEMP_MIN_C} °C`)
    .max(EXTERNAL_DESIGN_TEMP_MAX_C, `External design temperature must be at most ${EXTERNAL_DESIGN_TEMP_MAX_C} °C`),
});

export type ClimateUpdateInput = z.infer<typeof climateUpdateSchema>;
