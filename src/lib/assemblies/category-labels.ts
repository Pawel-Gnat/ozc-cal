import type { AssemblyCategory } from "@/types";

const CATEGORY_LABELS: Record<AssemblyCategory, string> = {
  external_wall: "External wall",
  internal_partition: "Internal partition",
  floor: "Floor",
  ceiling: "Ceiling",
  roof: "Roof",
  ground_floor: "Ground floor",
  window: "Window",
  door: "Door",
};

export function getAssemblyCategoryLabel(category: AssemblyCategory): string {
  return CATEGORY_LABELS[category];
}
