import { validateOzcInput } from "@/lib/thermal/calc-validate";
import { OzcValidationError, type OzcCalcResult, type ValidatableOzcInput } from "@/lib/thermal/calc-types";
import {
  computeRoomTransmission,
  createTransmissionContext,
  resolveHorizontalAssemblies,
  sumBuildingTransmission,
} from "@/lib/thermal/wt2021-transmission";
import { computeRoomVentilation, sumBuildingVentilation } from "@/lib/thermal/wt2021-ventilation";

/** Pure WT 2021 + gravity ventilation calculation. Throws OzcValidationError on invalid input. */
export function calculateOzc(input: ValidatableOzcInput): OzcCalcResult {
  const errors = validateOzcInput(input);
  if (errors.length > 0) {
    throw new OzcValidationError(errors);
  }

  const { scale, external_design_temp_c: externalTempC } = input;
  if (scale === null || externalTempC === null) {
    throw new OzcValidationError(errors);
  }

  const horizontal = resolveHorizontalAssemblies(input.assemblies);
  const floorAssembly = horizontal.floor;
  const ceilingAssembly = horizontal.ceiling;
  if (!floorAssembly || !ceilingAssembly) {
    throw new OzcValidationError(errors);
  }

  const transmissionContext = createTransmissionContext({
    externalTempC,
    storeyHeightM: input.storey_height_m,
    metersPerUnit: scale.meters_per_unit,
    nodes: input.nodes,
    segments: input.segments,
    rooms: input.rooms,
    assemblies: input.assemblies,
    horizontalAssemblies: {
      floor: floorAssembly,
      ceiling: ceilingAssembly,
    },
  });

  const sortedRooms = [...input.rooms].sort((left, right) => left.id.localeCompare(right.id));

  const rooms = sortedRooms.map((room) => {
    const { transmissionW } = computeRoomTransmission(room, transmissionContext);
    const { ventilationW } = computeRoomVentilation(room, externalTempC);

    return {
      roomId: room.id,
      transmissionW,
      ventilationW,
      totalW: transmissionW + ventilationW,
    };
  });

  const buildingTransmissionW = sumBuildingTransmission(rooms);
  const buildingVentilationW = sumBuildingVentilation(rooms);

  return {
    rooms,
    buildingTransmissionW,
    buildingVentilationW,
    buildingTotalW: buildingTransmissionW + buildingVentilationW,
  };
}
