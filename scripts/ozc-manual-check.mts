/**
 * One-off manual verification runner for F-03. Not part of CI.
 * Usage: npx tsx scripts/ozc-manual-check.mts
 */
import { roomFloorAreaM2, segmentLengthM, segmentWallAreaM } from "../src/lib/editor/geometry.ts";
import { computeAssemblyPreview } from "../src/lib/thermal/assembly-preview.ts";
import { calculateOzc } from "../src/lib/thermal/calculate-ozc.ts";
import { toOzcCalcResultDisplay } from "../src/lib/thermal/calc-display.ts";
import type { ValidatableOzcInput } from "../src/lib/thermal/calc-types.ts";
import { computeAssemblyU } from "../src/lib/thermal/wt2021-u.ts";
import { computeRoomVentilation } from "../src/lib/thermal/wt2021-ventilation.ts";
import type { PlanNode, PlanSegment } from "../src/types.ts";

const METERS_PER_UNIT = 0.01;
const STOREY_HEIGHT_M = 2.6;
const TOLERANCE_W = 1;

function assertNear(label: string, actual: number, expected: number, tolerance = TOLERANCE_W): void {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tolerance;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} (expected ${expected}, Δ=${delta})`);
  if (!ok) {
    process.exitCode = 1;
  }
}

function layer(lambda: number, thicknessMm: number) {
  return { lambda_w_mk: lambda, thickness_mm: thicknessMm };
}

const wallLayers = layer(1, 4830);
const floorLayers = layer(1, 6547);
const ceilingLayers = layer(1, 6567);
const partitionLayers = layer(1, 1740);

const assemblies = [
  { id: "asm-wall", category: "external_wall" as const, layers: [wallLayers] },
  { id: "asm-floor", category: "floor" as const, layers: [floorLayers] },
  { id: "asm-ceiling", category: "ceiling" as const, layers: [ceilingLayers] },
  { id: "asm-partition", category: "internal_partition" as const, layers: [partitionLayers] },
];

console.log("--- Phase 2: geometry ---");
const nodes: PlanNode[] = [
  { id: "n1", project_id: "p", x: 0, y: 0, created_at: "" },
  { id: "n2", project_id: "p", x: 400, y: 0, created_at: "" },
  { id: "n3", project_id: "p", x: 400, y: 500, created_at: "" },
  { id: "n4", project_id: "p", x: 0, y: 500, created_at: "" },
];

const wallSegments: PlanSegment[] = [
  { id: "s1", project_id: "p", start_node_id: "n1", end_node_id: "n2", assembly_id: "asm-wall", created_at: "" },
  { id: "s2", project_id: "p", start_node_id: "n2", end_node_id: "n3", assembly_id: "asm-wall", created_at: "" },
  { id: "s3", project_id: "p", start_node_id: "n3", end_node_id: "n4", assembly_id: "asm-wall", created_at: "" },
  { id: "s4", project_id: "p", start_node_id: "n4", end_node_id: "n1", assembly_id: "asm-wall", created_at: "" },
];

const room = { segment_ids: ["s1", "s2", "s3", "s4"] };
const floorArea = roomFloorAreaM2(room, wallSegments, nodes, METERS_PER_UNIT);
assertNear("floor area 4×5 m", floorArea ?? 0, 20, 0.01);

const wallLen = segmentLengthM(wallSegments[0], nodes, METERS_PER_UNIT);
assertNear("wall segment length 4 m", wallLen ?? 0, 4, 0.01);

const wallArea = segmentWallAreaM(wallSegments[0], nodes, METERS_PER_UNIT, STOREY_HEIGHT_M, "external_wall");
assertNear("wall segment area 4×2.6 m²", wallArea ?? 0, 10.4, 0.01);

const windowSegment: PlanSegment = {
  id: "sw",
  project_id: "p",
  start_node_id: "n1",
  end_node_id: "n2",
  assembly_id: "asm-wall",
  created_at: "",
};
const windowArea = segmentWallAreaM(windowSegment, nodes, METERS_PER_UNIT, STOREY_HEIGHT_M, "window");
assertNear("window segment area length×1.2 m²", windowArea ?? 0, 4.8, 0.01);

console.log("--- Phase 3: U preview delegation ---");
const previewU = computeAssemblyPreview([wallLayers], "external_wall").uValue;
const engineU = computeAssemblyU([wallLayers], "external_wall").uValue;
assertNear("preview U matches engine U", previewU, engineU, 0.0001);

console.log("--- Phase 4: ventilation ---");
assertNear(
  "V=120 ΔT=40 ventilation W",
  computeRoomVentilation(
    { internal_temp_c: 20, ventilation_supply: 120, ventilation_exhaust: null, ventilation_natural: null },
    -20,
  ).ventilationW,
  1584,
);
assertNear(
  "null ventilation fields",
  computeRoomVentilation(
    { internal_temp_c: 20, ventilation_supply: null, ventilation_exhaust: null, ventilation_natural: null },
    -20,
  ).ventilationW,
  0,
  0,
);

console.log("--- Case 1: single-room box ---");
const case1Input: ValidatableOzcInput = {
  external_design_temp_c: -20,
  storey_height_m: STOREY_HEIGHT_M,
  assemblies,
  scale: {
    point_a_x: 0,
    point_a_y: 0,
    point_b_x: 100,
    point_b_y: 0,
    known_length_m: 1,
    meters_per_unit: METERS_PER_UNIT,
  },
  nodes,
  segments: wallSegments,
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

const wallU = computeAssemblyU([wallLayers], "external_wall").uValue;
const floorU = computeAssemblyU([floorLayers], "floor").uValue;
const ceilingU = computeAssemblyU([ceilingLayers], "ceiling").uValue;
const expectedTransmission = 18 * STOREY_HEIGHT_M * wallU * 40 + 20 * floorU * 40 + 20 * ceilingU * 40;

const case1 = calculateOzc(case1Input);
const room1 = case1.rooms[0];
assertNear("case1 transmission W", room1.transmissionW, expectedTransmission, 0.01);
assertNear("case1 ventilation W", room1.ventilationW, 1584);
assertNear("case1 total W", room1.totalW, expectedTransmission + 1584, 0.01);
console.log(`  U wall=${wallU.toFixed(4)} floor=${floorU.toFixed(4)} ceiling=${ceilingU.toFixed(4)}`);

const case1Repeat = calculateOzc(case1Input);
const deterministic = JSON.stringify(case1) === JSON.stringify(case1Repeat);
console.log(`${deterministic ? "PASS" : "FAIL"} deterministic repeat call`);
if (!deterministic) {
  process.exitCode = 1;
}

console.log("--- Case 2: two-room partition ---");
const nodes2: PlanNode[] = [
  { id: "a1", project_id: "p", x: 0, y: 0, created_at: "" },
  { id: "a2", project_id: "p", x: 300, y: 0, created_at: "" },
  { id: "a3", project_id: "p", x: 300, y: 400, created_at: "" },
  { id: "a4", project_id: "p", x: 0, y: 400, created_at: "" },
  { id: "b2", project_id: "p", x: 500, y: 0, created_at: "" },
  { id: "b3", project_id: "p", x: 500, y: 400, created_at: "" },
];

const segments2: PlanSegment[] = [
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

const case2Input: ValidatableOzcInput = {
  external_design_temp_c: -20,
  storey_height_m: STOREY_HEIGHT_M,
  assemblies,
  scale: {
    point_a_x: 0,
    point_a_y: 0,
    point_b_x: 100,
    point_b_y: 0,
    known_length_m: 1,
    meters_per_unit: METERS_PER_UNIT,
  },
  nodes: nodes2,
  segments: segments2,
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

const partitionU = computeAssemblyU([partitionLayers], "internal_partition").uValue;
const deltaTExternalA = 40;
const deltaTExternalB = 16 - -20;
const partitionLengthM = 4;
const partitionDeltaT = 4;
const partitionLossW = partitionLengthM * STOREY_HEIGHT_M * partitionU * partitionDeltaT;

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
const expectedRoomAW = roomAEnvelopeW + partitionLossW;
const expectedRoomBW = roomBEnvelopeW + partitionLossW;

const case2 = calculateOzc(case2Input);
const roomA = case2.rooms.find((r) => r.roomId === "room-a");
const roomB = case2.rooms.find((r) => r.roomId === "room-b");
if (!roomA || !roomB) {
  throw new Error("Case 2 fixture rooms missing from result");
}
assertNear("room A transmission (envelope + partition)", roomA.transmissionW, expectedRoomAW, 0.01);
assertNear("room B transmission (envelope + partition)", roomB.transmissionW, expectedRoomBW, 0.01);
assertNear("partition loss per side", partitionLossW, partitionLengthM * STOREY_HEIGHT_M * partitionU * 4, 0.01);
console.log(`  partition loss each side: ${partitionLossW.toFixed(2)} W (U=${partitionU.toFixed(4)})`);

console.log("--- S-04: display layer & UI rounding ---");
const display1 = toOzcCalcResultDisplay(case1, case1Input.rooms);
assertNear("display preserves transmission W", display1.rooms[0].transmissionW, case1.rooms[0].transmissionW, 0);
assertNear("display preserves total W", display1.rooms[0].totalW, case1.rooms[0].totalW, 0);
if (display1.rooms[0].name !== "Box") {
  console.log("FAIL display maps room name");
  process.exitCode = 1;
} else {
  console.log("PASS display maps room name");
}
assertNear("UI rounded Case 1 transmission W", Math.round(display1.rooms[0].transmissionW), 612, 0);
assertNear("UI rounded Case 1 ventilation W", Math.round(display1.rooms[0].ventilationW), 1584, 0);
assertNear("UI rounded Case 1 total W", Math.round(display1.rooms[0].totalW), 2196, 0);
assertNear("hand-check Case 1 total ≈2198 W (layer-derived U)", Math.round(display1.rooms[0].totalW), 2198, 2);

const display1Repeat = toOzcCalcResultDisplay(calculateOzc(case1Input), case1Input.rooms);
const displayDeterministic = JSON.stringify(display1) === JSON.stringify(display1Repeat);
console.log(`${displayDeterministic ? "PASS" : "FAIL"} display formatter deterministic`);
if (!displayDeterministic) {
  process.exitCode = 1;
}

const display2 = toOzcCalcResultDisplay(case2, case2Input.rooms);
const roomADisplay = display2.rooms.find((room) => room.roomId === "room-a");
const roomBDisplay = display2.rooms.find((room) => room.roomId === "room-b");
if (!roomADisplay || !roomBDisplay) {
  throw new Error("Case 2 display rooms missing");
}
assertNear("Case 2 partition loss per side (fixture geometry)", partitionLossW, 20.8, 0.01);
assertNear("building total sums room totals", display2.buildingTotalW, roomADisplay.totalW + roomBDisplay.totalW, 0.01);

console.log("--- Done ---");
