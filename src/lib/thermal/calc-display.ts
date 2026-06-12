import type { EditorRoomState } from "@/lib/services/project-editor";
import type { OzcCalcResult, OzcRoomCalcResult } from "@/lib/thermal/calc-types";

export interface OzcRoomCalcResultDisplay extends OzcRoomCalcResult {
  name: string | null;
}

export interface OzcCalcResultDisplay {
  rooms: OzcRoomCalcResultDisplay[];
  buildingTransmissionW: number;
  buildingVentilationW: number;
  buildingTotalW: number;
}

export function toOzcCalcResultDisplay(result: OzcCalcResult, rooms: EditorRoomState[]): OzcCalcResultDisplay {
  const nameByRoomId = new Map(rooms.map((room) => [room.id, room.name]));

  return {
    buildingTransmissionW: result.buildingTransmissionW,
    buildingVentilationW: result.buildingVentilationW,
    buildingTotalW: result.buildingTotalW,
    rooms: result.rooms.map((roomResult) => ({
      ...roomResult,
      name: nameByRoomId.get(roomResult.roomId) ?? null,
    })),
  };
}
