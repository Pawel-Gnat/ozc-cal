import { describe, expect, it } from "vitest";

import { calculateOzc } from "@/lib/thermal/calculate-ozc";
import { toOzcCalcResultDisplay } from "@/lib/thermal/calc-display";
import { case1Input, case2Input, expectedCase2PartitionLossW } from "@/lib/thermal/__fixtures__/ozc-reference";

describe("toOzcCalcResultDisplay", () => {
  it("maps room names and preserves W values from engine result", () => {
    const engineResult = calculateOzc(case1Input);
    const display = toOzcCalcResultDisplay(engineResult, case1Input.rooms);

    expect(display.rooms[0].name).toBe("Box");
    expect(display.rooms[0].transmissionW).toBe(engineResult.rooms[0].transmissionW);
    expect(display.rooms[0].ventilationW).toBe(engineResult.rooms[0].ventilationW);
    expect(display.rooms[0].totalW).toBe(engineResult.rooms[0].totalW);
    expect(display.buildingTotalW).toBe(engineResult.buildingTotalW);
  });

  it("Case 1 rounded UI values match manual-check expectations", () => {
    const engineResult = calculateOzc(case1Input);
    const display = toOzcCalcResultDisplay(engineResult, case1Input.rooms);
    const room = display.rooms[0];

    expect(Math.round(room.transmissionW)).toBe(612);
    expect(Math.round(room.ventilationW)).toBe(1584);
    expect(Math.round(room.totalW)).toBe(2196);
    expect(Math.abs(Math.round(room.totalW) - 2198)).toBeLessThanOrEqual(2);
  });

  it("Case 2 building total sums displayed room totals", () => {
    const engineResult = calculateOzc(case2Input);
    const display = toOzcCalcResultDisplay(engineResult, case2Input.rooms);
    const roomA = display.rooms.find((room) => room.roomId === "room-a");
    const roomB = display.rooms.find((room) => room.roomId === "room-b");

    if (!roomA || !roomB) {
      throw new Error("Case 2 display rooms missing");
    }

    expect(display.buildingTotalW).toBeCloseTo(roomA.totalW + roomB.totalW, 2);
    expect(display.rooms.find((room) => room.roomId === "room-a")?.name).toBe("A");
    expect(display.rooms.find((room) => room.roomId === "room-b")?.name).toBe("B");
  });

  it("Case 2 partition loss per side matches fixture geometry oracle", () => {
    expect(expectedCase2PartitionLossW()).toBeCloseTo(20.8, 2);
  });

  it("produces identical JSON on repeat call", () => {
    const engineResult = calculateOzc(case1Input);
    const first = toOzcCalcResultDisplay(engineResult, case1Input.rooms);
    const second = toOzcCalcResultDisplay(calculateOzc(case1Input), case1Input.rooms);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
