import {
  COORD_EPSILON,
  findColocatedSegment,
  roomFloorAreaM2,
  segmentWallAreaM,
  type GeometryNode,
  type GeometrySegment,
  type RoomSegmentOwner,
} from "@/lib/editor/geometry";
import { resolveDeltaT } from "@/lib/thermal/wt2021-boundary";
import { computeAssemblyU } from "@/lib/thermal/wt2021-u";
import type { OzcAssemblyInput } from "@/lib/thermal/calc-types";
import type { EditorRoomState } from "@/lib/services/project-editor";
import type { AssemblyCategory } from "@/types";

const HORIZONTAL_SEGMENT_CATEGORIES: ReadonlySet<AssemblyCategory> = new Set([
  "floor",
  "ceiling",
  "roof",
  "ground_floor",
]);

export interface HorizontalAssemblies {
  floor: OzcAssemblyInput;
  ceiling: OzcAssemblyInput;
}

export interface TransmissionSurface {
  type: "perimeter" | "floor" | "ceiling";
  segmentId?: string;
  areaM2: number;
  uValue: number;
  deltaTK: number;
  heatLossW: number;
  assemblyId: string;
  category: AssemblyCategory;
}

export interface TransmissionContext {
  externalTempC: number;
  storeyHeightM: number;
  metersPerUnit: number;
  nodes: GeometryNode[];
  segments: GeometrySegment[];
  segmentToRoomId: Map<string, string>;
  assembliesById: Map<string, OzcAssemblyInput>;
  horizontalAssemblies: HorizontalAssemblies;
  roomsById: Map<string, EditorRoomState>;
  colocatedTolerancePx: number;
}

/**
 * Pick catalog assemblies for horizontal surfaces.
 * Precedence: ground_floor over floor; roof over ceiling.
 */
export function resolveHorizontalAssemblies(assemblies: OzcAssemblyInput[]): {
  floor: OzcAssemblyInput | null;
  ceiling: OzcAssemblyInput | null;
} {
  const floor =
    assemblies.find((assembly) => assembly.category === "ground_floor") ??
    assemblies.find((assembly) => assembly.category === "floor") ??
    null;

  const ceiling =
    assemblies.find((assembly) => assembly.category === "roof") ??
    assemblies.find((assembly) => assembly.category === "ceiling") ??
    null;

  return { floor, ceiling };
}

export function buildSegmentToRoomIdMap(rooms: RoomSegmentOwner[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const room of rooms) {
    for (const segmentId of room.segment_ids) {
      map.set(segmentId, room.id);
    }
  }

  return map;
}

function resolveNeighborTemp(segmentId: string, roomId: string, context: TransmissionContext): number | null {
  const colocatedId = findColocatedSegment(segmentId, context.segments, context.nodes, context.colocatedTolerancePx);
  if (!colocatedId) {
    return null;
  }

  const neighborRoomId = context.segmentToRoomId.get(colocatedId);
  if (!neighborRoomId || neighborRoomId === roomId) {
    return null;
  }

  return context.roomsById.get(neighborRoomId)?.internal_temp_c ?? null;
}

function addHorizontalSurface(
  surfaces: TransmissionSurface[],
  type: "floor" | "ceiling",
  areaM2: number | null,
  assembly: OzcAssemblyInput,
  roomTemp: number,
  externalTempC: number,
): void {
  if (areaM2 === null || areaM2 <= 0) {
    return;
  }

  const category = assembly.category;
  const deltaTK = resolveDeltaT(category, roomTemp, externalTempC, null);
  const { uValue } = computeAssemblyU(assembly.layers, category);
  const heatLossW = uValue * areaM2 * deltaTK;

  surfaces.push({
    type,
    areaM2,
    uValue,
    deltaTK,
    heatLossW,
    assemblyId: assembly.id,
    category,
  });
}

export function computeRoomTransmission(
  room: EditorRoomState,
  context: TransmissionContext,
): { transmissionW: number; surfaces: TransmissionSurface[] } {
  const surfaces: TransmissionSurface[] = [];
  const roomTemp = room.internal_temp_c;
  const { nodes, segments, storeyHeightM, metersPerUnit, externalTempC } = context;

  for (const segmentId of room.segment_ids) {
    const segment = segments.find((candidate) => candidate.id === segmentId);
    if (!segment) {
      continue;
    }

    const assembly = context.assembliesById.get(segment.assembly_id);
    if (!assembly) {
      continue;
    }

    const category = assembly.category;
    if (HORIZONTAL_SEGMENT_CATEGORIES.has(category)) {
      continue;
    }

    const areaM2 = segmentWallAreaM(segment, nodes, metersPerUnit, storeyHeightM, category);
    if (areaM2 === null) {
      continue;
    }

    const neighborTemp = category === "internal_partition" ? resolveNeighborTemp(segmentId, room.id, context) : null;
    const deltaTK = resolveDeltaT(category, roomTemp, externalTempC, neighborTemp);
    const { uValue } = computeAssemblyU(assembly.layers, category);
    const heatLossW = uValue * areaM2 * deltaTK;

    surfaces.push({
      type: "perimeter",
      segmentId,
      areaM2,
      uValue,
      deltaTK,
      heatLossW,
      assemblyId: assembly.id,
      category,
    });
  }

  const floorAreaM2 = roomFloorAreaM2(room, segments, nodes, metersPerUnit);
  addHorizontalSurface(surfaces, "floor", floorAreaM2, context.horizontalAssemblies.floor, roomTemp, externalTempC);
  addHorizontalSurface(surfaces, "ceiling", floorAreaM2, context.horizontalAssemblies.ceiling, roomTemp, externalTempC);

  const transmissionW = surfaces.reduce((sum, surface) => sum + surface.heatLossW, 0);
  return { transmissionW, surfaces };
}

export function sumBuildingTransmission(roomResults: { transmissionW: number }[]): number {
  return roomResults.reduce((sum, result) => sum + result.transmissionW, 0);
}

export function createTransmissionContext(params: {
  externalTempC: number;
  storeyHeightM: number;
  metersPerUnit: number;
  nodes: GeometryNode[];
  segments: GeometrySegment[];
  rooms: EditorRoomState[];
  assemblies: OzcAssemblyInput[];
  horizontalAssemblies: HorizontalAssemblies;
  colocatedTolerancePx?: number;
}): TransmissionContext {
  return {
    externalTempC: params.externalTempC,
    storeyHeightM: params.storeyHeightM,
    metersPerUnit: params.metersPerUnit,
    nodes: params.nodes,
    segments: params.segments,
    segmentToRoomId: buildSegmentToRoomIdMap(params.rooms),
    assembliesById: new Map(params.assemblies.map((assembly) => [assembly.id, assembly])),
    horizontalAssemblies: params.horizontalAssemblies,
    roomsById: new Map(params.rooms.map((room) => [room.id, room])),
    colocatedTolerancePx: params.colocatedTolerancePx ?? COORD_EPSILON,
  };
}
