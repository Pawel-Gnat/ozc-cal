import type { AssemblyCategory } from "@/types";

/** Resolve temperature difference [K] for a surface based on assembly category and room context. */
export function resolveDeltaT(
  category: AssemblyCategory,
  roomTemp: number,
  externalTemp: number,
  neighborTemp: number | null,
): number {
  switch (category) {
    case "internal_partition":
      return neighborTemp === null ? 0 : Math.abs(roomTemp - neighborTemp);
    case "external_wall":
    case "window":
    case "door":
    case "roof":
    case "ground_floor":
    case "floor":
    case "ceiling":
      return roomTemp - externalTemp;
  }
}
