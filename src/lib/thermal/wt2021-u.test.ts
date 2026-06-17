import { describe, expect, it } from "vitest";

import { computeAssemblyPreview } from "@/lib/thermal/assembly-preview";
import { computeAssemblyU } from "@/lib/thermal/wt2021-u";
import { wallLayers } from "@/lib/thermal/__fixtures__/ozc-reference";

describe("computeAssemblyU vs computeAssemblyPreview", () => {
  it("external_wall preview U matches engine U", () => {
    const previewU = computeAssemblyPreview([wallLayers], "external_wall").uValue;
    const engineU = computeAssemblyU([wallLayers], "external_wall").uValue;

    expect(previewU).toBeCloseTo(engineU, 4);
  });
});
