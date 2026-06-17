import { describe, expect, it } from "vitest";

import { VENTILATION_HEAT_FACTOR } from "@/lib/thermal/wt2021-constants";

describe("vitest smoke", () => {
  it("resolves @/ path aliases and thermal constants", () => {
    expect(VENTILATION_HEAT_FACTOR).toBe(0.33);
  });
});
