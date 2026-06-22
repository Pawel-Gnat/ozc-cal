import { describe, expect, it } from "vitest";

import { editorStateSchema, MAX_EDITOR_NODES, type EditorStateInput } from "@/lib/validation/editor";

const nodeA = "11111111-1111-4111-8111-111111111101";
const nodeB = "11111111-1111-4111-8111-111111111102";
const nodeC = "11111111-1111-4111-8111-111111111103";
const nodeD = "11111111-1111-4111-8111-111111111104";
const assemblyId = "33333333-3333-4333-8333-333333333301";
const seg1 = "22222222-2222-4222-8222-222222222201";
const seg2 = "22222222-2222-4222-8222-222222222202";
const seg3 = "22222222-2222-4222-8222-222222222203";
const seg4 = "22222222-2222-4222-8222-222222222204";

function validEditorState(overrides: Partial<EditorStateInput> = {}): EditorStateInput {
  return {
    scale: null,
    nodes: [
      { id: nodeA, x: 0, y: 0 },
      { id: nodeB, x: 10, y: 0 },
      { id: nodeC, x: 10, y: 10 },
      { id: nodeD, x: 0, y: 10 },
    ],
    segments: [
      { id: seg1, start_node_id: nodeA, end_node_id: nodeB, assembly_id: assemblyId },
      { id: seg2, start_node_id: nodeB, end_node_id: nodeC, assembly_id: assemblyId },
      { id: seg3, start_node_id: nodeC, end_node_id: nodeD, assembly_id: assemblyId },
      { id: seg4, start_node_id: nodeD, end_node_id: nodeA, assembly_id: assemblyId },
    ],
    rooms: [],
    ...overrides,
  };
}

describe("editorStateSchema", () => {
  it("accepts a valid minimal payload", () => {
    const result = editorStateSchema.safeParse(validEditorState());
    expect(result.success).toBe(true);
  });

  it("rejects invalid node UUID with issues", () => {
    const result = editorStateSchema.safeParse(
      validEditorState({
        nodes: [{ id: "not-a-uuid", x: 0, y: 0 }],
        segments: [],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects duplicate node ids", () => {
    const result = editorStateSchema.safeParse(
      validEditorState({
        nodes: [
          { id: nodeA, x: 0, y: 0 },
          { id: nodeA, x: 1, y: 0 },
        ],
        segments: [],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Duplicate ID"))).toBe(true);
    }
  });

  it("rejects non-orthogonal segments", () => {
    const result = editorStateSchema.safeParse(
      validEditorState({
        nodes: [
          { id: nodeA, x: 0, y: 0 },
          { id: nodeB, x: 3, y: 4 },
        ],
        segments: [{ id: seg1, start_node_id: nodeA, end_node_id: nodeB, assembly_id: assemblyId }],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("horizontal or vertical"))).toBe(true);
    }
  });

  it("rejects open room chains", () => {
    const result = editorStateSchema.safeParse(
      validEditorState({
        nodes: [
          { id: nodeA, x: 0, y: 0 },
          { id: nodeB, x: 10, y: 0 },
          { id: nodeC, x: 20, y: 0 },
          { id: nodeD, x: 30, y: 0 },
        ],
        segments: [
          { id: seg1, start_node_id: nodeA, end_node_id: nodeB, assembly_id: assemblyId },
          { id: seg2, start_node_id: nodeB, end_node_id: nodeC, assembly_id: assemblyId },
          { id: seg3, start_node_id: nodeC, end_node_id: nodeD, assembly_id: assemblyId },
        ],
        rooms: [
          {
            id: "44444444-4444-4444-8444-444444444401",
            internal_temp_c: 20,
            segment_ids: [seg1, seg2, seg3],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("closed chain"))).toBe(true);
    }
  });

  it("rejects internal temperature outside 5–35°C", () => {
    const result = editorStateSchema.safeParse(
      validEditorState({
        rooms: [
          {
            id: "44444444-4444-4444-8444-444444444401",
            internal_temp_c: 40,
            segment_ids: [seg1, seg2, seg3],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("internal_temp_c"))).toBe(true);
    }
  });

  it(`rejects more than ${MAX_EDITOR_NODES} nodes`, () => {
    const nodes = Array.from({ length: MAX_EDITOR_NODES + 1 }, (_, index) => ({
      id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`,
      x: index,
      y: 0,
    }));

    const result = editorStateSchema.safeParse(validEditorState({ nodes, segments: [], rooms: [] }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes(String(MAX_EDITOR_NODES)))).toBe(true);
    }
  });
});
