import type { EditorRoomState, EditorScaleState } from "@/lib/services/project-editor";
import type { AssemblyCategory, AssemblyLayer, PlanNode, PlanSegment } from "@/types";

/** Assembly catalog entry with layer stack for U-value resolution. */
export interface OzcAssemblyInput {
  id: string;
  category: AssemblyCategory;
  layers: Pick<AssemblyLayer, "lambda_w_mk" | "thickness_mm">[];
}

/**
 * Raw project snapshot from `loadOzcCalcInput` — nullable climate/scale until validated.
 * `calculateOzc` accepts this shape, runs `validateOzcInput`, then narrows to `OzcCalcInput`.
 */
export interface ValidatableOzcInput {
  external_design_temp_c: number | null;
  storey_height_m: number;
  assemblies: OzcAssemblyInput[];
  scale: EditorScaleState | null;
  nodes: PlanNode[];
  segments: PlanSegment[];
  rooms: EditorRoomState[];
}

/**
 * Validated snapshot after `validateOzcInput` passes (non-null climate and scale).
 * Internal narrowing target inside `calculateOzc`; loaders return `ValidatableOzcInput`.
 */
export type OzcCalcInput = ValidatableOzcInput & {
  external_design_temp_c: number;
  scale: EditorScaleState;
};

export interface OzcRoomCalcResult {
  roomId: string;
  transmissionW: number;
  ventilationW: number;
  totalW: number;
}

export interface OzcCalcResult {
  rooms: OzcRoomCalcResult[];
  buildingTransmissionW: number;
  buildingVentilationW: number;
  buildingTotalW: number;
}

export type OzcCalcErrorCode =
  | "missing_scale"
  | "invalid_scale"
  | "missing_climate"
  | "no_rooms"
  | "missing_floor_assembly"
  | "missing_ceiling_assembly"
  | "unclosed_room"
  | "missing_segment_assembly"
  | "missing_assembly_layers"
  | "invalid_assembly_layers";

export interface OzcCalcError {
  code: OzcCalcErrorCode;
  message: string;
  roomId?: string;
  segmentId?: string;
}

export class OzcValidationError extends Error {
  readonly errors: OzcCalcError[];

  constructor(errors: OzcCalcError[]) {
    super(errors.map((error) => error.message).join("; "));
    this.name = "OzcValidationError";
    this.errors = errors;
  }
}
