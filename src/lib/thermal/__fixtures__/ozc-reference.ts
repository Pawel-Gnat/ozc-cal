import { expect } from "vitest";

import { computeAssemblyU } from "@/lib/thermal/wt2021-u";
import type { ValidatableOzcInput } from "@/lib/thermal/calc-types";
import type { PlanNode, PlanSegment } from "@/types";

/** ±1 W tolerance per manual-verification.md and ozc-manual-check.mts. */
export const TOLERANCE_W = 1;

export function assertHeatLossW(actual: number, expected: number, label?: string): void {
  const delta = Math.abs(actual - expected);
  expect(delta, label).toBeLessThanOrEqual(TOLERANCE_W);
}

export function layer(lambda: number, thicknessMm: number) {
  return { lambda_w_mk: lambda, thickness_mm: thicknessMm };
}

export const METERS_PER_UNIT = 0.01;
export const STOREY_HEIGHT_M = 2.6;
export const EXTERNAL_DESIGN_TEMP_C = -20;

export const wallLayers = layer(1, 4830);
export const floorLayers = layer(1, 6547);
export const ceilingLayers = layer(1, 6567);
export const partitionLayers = layer(1, 1740);

export const referenceAssemblies = [
  { id: "asm-wall", category: "external_wall" as const, layers: [wallLayers] },
  { id: "asm-floor", category: "floor" as const, layers: [floorLayers] },
  { id: "asm-ceiling", category: "ceiling" as const, layers: [ceilingLayers] },
  { id: "asm-partition", category: "internal_partition" as const, layers: [partitionLayers] },
];

export const referenceScale = {
  point_a_x: 0,
  point_a_y: 0,
  point_b_x: 100,
  point_b_y: 0,
  known_length_m: 1,
  meters_per_unit: METERS_PER_UNIT,
};

/** Hand-calc oracles from manual-verification.md Case 1 (target U, not engine output). */
export const CASE1_HAND_ORACLE = {
  transmissionW: 614.4,
  ventilationW: 1584,
  totalW: 2198,
} as const;

const case1Nodes: PlanNode[] = [
  { id: "n1", project_id: "p", x: 0, y: 0, created_at: "" },
  { id: "n2", project_id: "p", x: 400, y: 0, created_at: "" },
  { id: "n3", project_id: "p", x: 400, y: 500, created_at: "" },
  { id: "n4", project_id: "p", x: 0, y: 500, created_at: "" },
];

const case1Segments: PlanSegment[] = [
  { id: "s1", project_id: "p", start_node_id: "n1", end_node_id: "n2", assembly_id: "asm-wall", created_at: "" },
  { id: "s2", project_id: "p", start_node_id: "n2", end_node_id: "n3", assembly_id: "asm-wall", created_at: "" },
  { id: "s3", project_id: "p", start_node_id: "n3", end_node_id: "n4", assembly_id: "asm-wall", created_at: "" },
  { id: "s4", project_id: "p", start_node_id: "n4", end_node_id: "n1", assembly_id: "asm-wall", created_at: "" },
];

export const case1Input: ValidatableOzcInput = {
  external_design_temp_c: EXTERNAL_DESIGN_TEMP_C,
  storey_height_m: STOREY_HEIGHT_M,
  assemblies: referenceAssemblies,
  scale: referenceScale,
  nodes: case1Nodes,
  segments: case1Segments,
  rooms: [
    {
      id: "room1",
      name: "Box",
      internal_temp_c: 20,
      ventilation_supply: 120,
      ventilation_exhaust: null,
      ventilation_natural: null,
      segment_ids: ["s1", "s2", "s3", "s4"],
    },
  ],
};

const case2Nodes: PlanNode[] = [
  { id: "a1", project_id: "p", x: 0, y: 0, created_at: "" },
  { id: "a2", project_id: "p", x: 300, y: 0, created_at: "" },
  { id: "a3", project_id: "p", x: 300, y: 400, created_at: "" },
  { id: "a4", project_id: "p", x: 0, y: 400, created_at: "" },
  { id: "b2", project_id: "p", x: 500, y: 0, created_at: "" },
  { id: "b3", project_id: "p", x: 500, y: 400, created_at: "" },
];

const case2Segments: PlanSegment[] = [
  { id: "a-s1", project_id: "p", start_node_id: "a1", end_node_id: "a2", assembly_id: "asm-wall", created_at: "" },
  { id: "a-s3", project_id: "p", start_node_id: "a3", end_node_id: "a4", assembly_id: "asm-wall", created_at: "" },
  { id: "a-s4", project_id: "p", start_node_id: "a4", end_node_id: "a1", assembly_id: "asm-wall", created_at: "" },
  {
    id: "part-a",
    project_id: "p",
    start_node_id: "a2",
    end_node_id: "a3",
    assembly_id: "asm-partition",
    created_at: "",
  },
  { id: "b-s1", project_id: "p", start_node_id: "a2", end_node_id: "b2", assembly_id: "asm-wall", created_at: "" },
  { id: "b-s2", project_id: "p", start_node_id: "b2", end_node_id: "b3", assembly_id: "asm-wall", created_at: "" },
  { id: "b-s3", project_id: "p", start_node_id: "b3", end_node_id: "a3", assembly_id: "asm-wall", created_at: "" },
  {
    id: "part-b",
    project_id: "p",
    start_node_id: "a2",
    end_node_id: "a3",
    assembly_id: "asm-partition",
    created_at: "",
  },
];

export const case2Input: ValidatableOzcInput = {
  external_design_temp_c: EXTERNAL_DESIGN_TEMP_C,
  storey_height_m: STOREY_HEIGHT_M,
  assemblies: referenceAssemblies,
  scale: referenceScale,
  nodes: case2Nodes,
  segments: case2Segments,
  rooms: [
    {
      id: "room-a",
      name: "A",
      internal_temp_c: 20,
      ventilation_supply: null,
      ventilation_exhaust: null,
      ventilation_natural: null,
      segment_ids: ["a-s1", "part-a", "a-s3", "a-s4"],
    },
    {
      id: "room-b",
      name: "B",
      internal_temp_c: 16,
      ventilation_supply: null,
      ventilation_exhaust: null,
      ventilation_natural: null,
      segment_ids: ["b-s1", "b-s2", "b-s3", "part-b"],
    },
  ],
};

function assemblyUValues() {
  return {
    wallU: computeAssemblyU([wallLayers], "external_wall").uValue,
    floorU: computeAssemblyU([floorLayers], "floor").uValue,
    ceilingU: computeAssemblyU([ceilingLayers], "ceiling").uValue,
    partitionU: computeAssemblyU([partitionLayers], "internal_partition").uValue,
  };
}

/** Layer-derived transmission oracle for Case 1 (18 m perimeter × 2.6 m walls + 20 m² floor/ceiling, ΔT=40 K). */
export function expectedCase1TransmissionW(): number {
  const { wallU, floorU, ceilingU } = assemblyUValues();
  return 18 * STOREY_HEIGHT_M * wallU * 40 + 20 * floorU * 40 + 20 * ceilingU * 40;
}

/** Partition loss per side for Case 2 (4 m × 2.6 m, ΔT=4 K). */
export function expectedCase2PartitionLossW(): number {
  const { partitionU } = assemblyUValues();
  const partitionLengthM = 4;
  const partitionDeltaT = 4;
  return partitionLengthM * STOREY_HEIGHT_M * partitionU * partitionDeltaT;
}

/** Layer-derived per-room transmission oracles for Case 2. */
export function expectedCase2RoomTransmissionW(): { roomA: number; roomB: number } {
  const { wallU, floorU, ceilingU } = assemblyUValues();
  const partitionLossW = expectedCase2PartitionLossW();
  const deltaTExternalA = 40;
  const deltaTExternalB = 16 - EXTERNAL_DESIGN_TEMP_C;
  const roomAFloorM2 = 12;
  const roomBFloorM2 = 8;
  const roomAEnvelopeW =
    (3 + 4 + 3) * STOREY_HEIGHT_M * wallU * deltaTExternalA +
    roomAFloorM2 * floorU * deltaTExternalA +
    roomAFloorM2 * ceilingU * deltaTExternalA;
  const roomBEnvelopeW =
    (2 + 4 + 2) * STOREY_HEIGHT_M * wallU * deltaTExternalB +
    roomBFloorM2 * floorU * deltaTExternalB +
    roomBFloorM2 * ceilingU * deltaTExternalB;
  return {
    roomA: roomAEnvelopeW + partitionLossW,
    roomB: roomBEnvelopeW + partitionLossW,
  };
}
