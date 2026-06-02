/**
 * Polish winter climate zones (I–V) with external design temperature presets.
 * Values follow PN-EN 12831-1:2017-08 Polish national annex for MVP presets.
 */
export const CLIMATE_ZONES = [
  { id: "I", label: "Zone I", defaultTempC: -16 },
  { id: "II", label: "Zone II", defaultTempC: -18 },
  { id: "III", label: "Zone III", defaultTempC: -20 },
  { id: "IV", label: "Zone IV", defaultTempC: -22 },
  { id: "V", label: "Zone V", defaultTempC: -24 },
] as const;

export type ClimateZoneId = (typeof CLIMATE_ZONES)[number]["id"];

const zoneById = new Map(CLIMATE_ZONES.map((zone) => [zone.id, zone]));

export function getDefaultTempForZone(zone: ClimateZoneId): number {
  const match = zoneById.get(zone);
  if (!match) {
    throw new Error(`Unknown climate zone: ${zone}`);
  }
  return match.defaultTempC;
}
