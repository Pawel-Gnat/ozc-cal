import { isClosedChain } from "@/lib/editor/room-detection";
import type { OzcCalcError, ValidatableOzcInput } from "@/lib/thermal/calc-types";
import { resolveHorizontalAssemblies } from "@/lib/thermal/wt2021-transmission";

export function validateOzcInput(input: ValidatableOzcInput): OzcCalcError[] {
  const errors: OzcCalcError[] = [];

  if (input.scale === null) {
    errors.push({
      code: "missing_scale",
      message: "Floor plan scale is not set. Calibrate scale in the editor before calculating.",
    });
  }

  if (input.external_design_temp_c === null) {
    errors.push({
      code: "missing_climate",
      message: "External design temperature is not set. Save climate parameters on the project first.",
    });
  }

  if (input.rooms.length === 0) {
    errors.push({
      code: "no_rooms",
      message: "No rooms defined. Draw at least one closed room in the floor plan editor.",
    });
  }

  const assembliesById = new Map(input.assemblies.map((assembly) => [assembly.id, assembly]));
  const segmentById = new Map(input.segments.map((segment) => [segment.id, segment]));

  for (const assembly of input.assemblies) {
    if (assembly.layers.length === 0) {
      errors.push({
        code: "missing_assembly_layers",
        message: `Assembly "${assembly.id}" has no layers.`,
      });
    }
  }

  const horizontal = resolveHorizontalAssemblies(input.assemblies);
  if (!horizontal.floor) {
    errors.push({
      code: "missing_floor_assembly",
      message: "Catalog must include a floor or ground_floor assembly for horizontal floor losses.",
    });
  }
  if (!horizontal.ceiling) {
    errors.push({
      code: "missing_ceiling_assembly",
      message: "Catalog must include a ceiling or roof assembly for horizontal ceiling losses.",
    });
  }

  for (const room of input.rooms) {
    if (!isClosedChain(room.segment_ids, input.segments)) {
      errors.push({
        code: "unclosed_room",
        message: `Room "${room.name ?? room.id}" does not form a closed segment chain.`,
        roomId: room.id,
      });
    }

    for (const segmentId of room.segment_ids) {
      const segment = segmentById.get(segmentId);
      if (!segment) {
        errors.push({
          code: "missing_segment_assembly",
          message: `Room "${room.name ?? room.id}" references unknown segment ${segmentId}.`,
          roomId: room.id,
          segmentId,
        });
        continue;
      }

      if (!assembliesById.has(segment.assembly_id)) {
        errors.push({
          code: "missing_segment_assembly",
          message: `Segment in room "${room.name ?? room.id}" has no matching catalog assembly.`,
          roomId: room.id,
          segmentId,
        });
      }
    }
  }

  return errors;
}
