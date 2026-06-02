import { z } from "zod";

import { CLIMATE_ZONES, type ClimateZoneId } from "@/lib/climate/poland-zones";

const climateZoneIds = CLIMATE_ZONES.map((zone) => zone.id) as [ClimateZoneId, ...ClimateZoneId[]];

export const climateZoneSchema = z.enum(climateZoneIds);

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
