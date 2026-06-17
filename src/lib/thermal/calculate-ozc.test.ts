import { describe, expect, it } from "vitest";

import { calculateOzc } from "@/lib/thermal/calculate-ozc";
import {
  CASE1_HAND_ORACLE,
  assertHeatLossW,
  case1Input,
  case2Input,
  expectedCase1TransmissionW,
  expectedCase2RoomTransmissionW,
} from "@/lib/thermal/__fixtures__/ozc-reference";

describe("calculateOzc reference cases", () => {
  it("Case 1: single-room box matches layer-derived and hand-calc oracles", () => {
    const result = calculateOzc(case1Input);
    const room = result.rooms[0];

    expect(room.transmissionW).toBeCloseTo(expectedCase1TransmissionW(), 2);
    assertHeatLossW(room.ventilationW, CASE1_HAND_ORACLE.ventilationW, "Case 1 ventilation W");
    assertHeatLossW(room.totalW, expectedCase1TransmissionW() + CASE1_HAND_ORACLE.ventilationW, "Case 1 total W");
    // Layer-derived U yields ~2196 W vs hand-calc 2198 W (manual-verification.md); ±2 W matches manual-check.
    expect(Math.abs(room.totalW - CASE1_HAND_ORACLE.totalW)).toBeLessThanOrEqual(2);
  });

  it("Case 2: two-room partition with colocated segments", () => {
    const result = calculateOzc(case2Input);
    const expected = expectedCase2RoomTransmissionW();
    const roomA = result.rooms.find((room) => room.roomId === "room-a");
    const roomB = result.rooms.find((room) => room.roomId === "room-b");

    if (!roomA || !roomB) {
      throw new Error("Case 2 fixture rooms missing from result");
    }

    expect(roomA.transmissionW).toBeCloseTo(expected.roomA, 2);
    expect(roomB.transmissionW).toBeCloseTo(expected.roomB, 2);
    expect(roomA.ventilationW).toBe(0);
    expect(roomB.ventilationW).toBe(0);
  });

  it("Case 2: building total equals sum of room totals", () => {
    const result = calculateOzc(case2Input);
    const roomTotalSum = result.rooms.reduce((sum, room) => sum + room.totalW, 0);

    expect(result.buildingTotalW).toBeCloseTo(roomTotalSum, 2);
    expect(result.buildingTransmissionW).toBeCloseTo(
      result.rooms.reduce((sum, room) => sum + room.transmissionW, 0),
      2,
    );
  });

  it("produces identical JSON on repeat call", () => {
    const first = calculateOzc(case1Input);
    const second = calculateOzc(case1Input);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
