import { describe, expect, it } from "vitest";

import { computeRoomVentilation } from "@/lib/thermal/wt2021-ventilation";
import { EXTERNAL_DESIGN_TEMP_C } from "@/lib/thermal/__fixtures__/ozc-reference";

describe("computeRoomVentilation", () => {
  it("V=120 m³/h and ΔT=40 K yields 1584 W", () => {
    const result = computeRoomVentilation(
      {
        internal_temp_c: 20,
        ventilation_supply: 120,
        ventilation_exhaust: null,
        ventilation_natural: null,
      },
      EXTERNAL_DESIGN_TEMP_C,
    );

    expect(result.ventilationW).toBe(1584);
    expect(result.volumeM3h).toBe(120);
  });

  it("treats all null ventilation fields as 0 W", () => {
    const result = computeRoomVentilation(
      {
        internal_temp_c: 20,
        ventilation_supply: null,
        ventilation_exhaust: null,
        ventilation_natural: null,
      },
      EXTERNAL_DESIGN_TEMP_C,
    );

    expect(result.ventilationW).toBe(0);
    expect(result.volumeM3h).toBe(0);
  });

  it("sums supply, exhaust, and natural flow rates", () => {
    const result = computeRoomVentilation(
      {
        internal_temp_c: 20,
        ventilation_supply: 40,
        ventilation_exhaust: 50,
        ventilation_natural: 30,
      },
      EXTERNAL_DESIGN_TEMP_C,
    );

    expect(result.volumeM3h).toBe(120);
    expect(result.ventilationW).toBe(1584);
  });
});
