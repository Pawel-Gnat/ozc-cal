import type { EditorRoomState, EditorScaleState } from "@/lib/services/project-editor";
import type { AssemblyCategory, AssemblyLayer, PlanNode, PlanSegment } from "@/types";

/** Assembly catalog entry with layer stack for U-value resolution. */
export interface OzcAssemblyInput {
  id: string;
  category: AssemblyCategory;
  layers: Pick<AssemblyLayer, "lambda_w_mk" | "thickness_mm">[];
}

/** Project snapshot for validation (nullable fields become OzcCalcError entries). */
export interface ValidatableOzcInput {
  external_design_temp_c: number | null;
  storey_height_m: number;
  assemblies: OzcAssemblyInput[];
  scale: EditorScaleState | null;
  nodes: PlanNode[];
  segments: PlanSegment[];
  rooms: EditorRoomState[];
}

/** Validated project snapshot consumed by the pure calculation engine. */
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
  | "missing_climate"
  | "no_rooms"
  | "missing_floor_assembly"
  | "missing_ceiling_assembly"
  | "unclosed_room"
  | "missing_segment_assembly"
  | "missing_assembly_layers";

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
