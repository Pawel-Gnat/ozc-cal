import { VENTILATION_HEAT_FACTOR } from "@/lib/thermal/wt2021-constants";
import type { EditorRoomState } from "@/lib/services/project-editor";

export interface RoomVentilationInput {
  internal_temp_c: number;
  ventilation_supply: number | null;
  ventilation_exhaust: number | null;
  ventilation_natural: number | null;
}

export interface RoomVentilationResult {
  ventilationW: number;
  volumeM3h: number;
}

/** Sum room ventilation flow rates; null fields count as 0 m³/h. */
export function sumRoomVentilationVolumeM3h(
  room: Pick<EditorRoomState, "ventilation_supply" | "ventilation_exhaust" | "ventilation_natural">,
): number {
  return (room.ventilation_supply ?? 0) + (room.ventilation_exhaust ?? 0) + (room.ventilation_natural ?? 0);
}

/** Simplified gravity ventilation heat loss: Q = 0,33 × V [m³/h] × ΔT [K]. */
export function computeRoomVentilation(room: RoomVentilationInput, externalTempC: number): RoomVentilationResult {
  const volumeM3h = sumRoomVentilationVolumeM3h(room);

  if (volumeM3h === 0) {
    return { ventilationW: 0, volumeM3h: 0 };
  }

  const deltaT = room.internal_temp_c - externalTempC;
  const ventilationW = VENTILATION_HEAT_FACTOR * volumeM3h * deltaT;

  return { ventilationW, volumeM3h };
}

export function sumBuildingVentilation(roomResults: { ventilationW: number }[]): number {
  return roomResults.reduce((sum, result) => sum + result.ventilationW, 0);
}
