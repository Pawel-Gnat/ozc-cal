import { validateOzcInput } from "@/lib/thermal/calc-validate";
import {
  OzcValidationError,
  type OzcCalcInput,
  type OzcCalcResult,
  type ValidatableOzcInput,
} from "@/lib/thermal/calc-types";
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

  const validInput = input as OzcCalcInput;
  const { scale, external_design_temp_c: externalTempC } = validInput;
  const horizontal = resolveHorizontalAssemblies(validInput.assemblies);
  const floorAssembly = horizontal.floor;
  const ceilingAssembly = horizontal.ceiling;
  if (!floorAssembly || !ceilingAssembly) {
    throw new OzcValidationError([
      ...(floorAssembly
        ? []
        : [
            {
              code: "missing_floor_assembly",
              message: "Catalog must include a floor or ground_floor assembly for horizontal floor losses.",
            },
          ]),
      ...(ceilingAssembly
        ? []
        : [
            {
              code: "missing_ceiling_assembly",
              message: "Catalog must include a ceiling or roof assembly for horizontal ceiling losses.",
            },
          ]),
    ]);
  }

  const transmissionContext = createTransmissionContext({
    externalTempC,
    storeyHeightM: validInput.storey_height_m,
    metersPerUnit: scale.meters_per_unit,
    nodes: validInput.nodes,
    segments: validInput.segments,
    rooms: validInput.rooms,
    assemblies: validInput.assemblies,
    horizontalAssemblies: {
      floor: floorAssembly,
      ceiling: ceilingAssembly,
    },
  });

  const sortedRooms = [...validInput.rooms].sort((left, right) => left.id.localeCompare(right.id));

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
