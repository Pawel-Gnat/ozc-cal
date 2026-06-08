import { z } from "zod";

import { projectIdSchema } from "@/lib/validation/project";

const uuidSchema = z.uuid({ message: "Invalid ID" });

export const planNodeSchema = z.object({
  id: uuidSchema,
  x: z.number(),
  y: z.number(),
});

export const planSegmentSchema = z.object({
  id: uuidSchema,
  start_node_id: uuidSchema,
  end_node_id: uuidSchema,
  assembly_id: uuidSchema,
});

export const planScaleSchema = z.object({
  point_a_x: z.number(),
  point_a_y: z.number(),
  point_b_x: z.number(),
  point_b_y: z.number(),
  known_length_m: z.number().positive("Known length must be greater than 0"),
  meters_per_unit: z.number().positive("Scale must be greater than 0"),
});

export const planRoomSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().max(120, "Room name must be 120 characters or fewer").nullable().optional(),
  internal_temp_c: z
    .number()
    .min(5, "Internal temperature must be at least 5°C")
    .max(35, "Internal temperature must be at most 35°C"),
  ventilation_supply: z.number().nullable().optional(),
  ventilation_exhaust: z.number().nullable().optional(),
  ventilation_natural: z.number().nullable().optional(),
  segment_ids: z.array(uuidSchema).min(3, "A room must have at least 3 segments"),
});

export const editorStateSchema = z
  .object({
    scale: planScaleSchema.nullable(),
    nodes: z.array(planNodeSchema),
    segments: z.array(planSegmentSchema),
    rooms: z.array(planRoomSchema),
  })
  .superRefine((data, ctx) => {
    const nodeIds = new Set(data.nodes.map((node) => node.id));
    const segmentIds = new Set(data.segments.map((segment) => segment.id));

    for (const [index, segment] of data.segments.entries()) {
      if (!nodeIds.has(segment.start_node_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Segment references unknown start node",
          path: ["segments", index, "start_node_id"],
        });
      }
      if (!nodeIds.has(segment.end_node_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Segment references unknown end node",
          path: ["segments", index, "end_node_id"],
        });
      }
      if (segment.start_node_id === segment.end_node_id) {
        ctx.addIssue({
          code: "custom",
          message: "Segment start and end nodes must differ",
          path: ["segments", index],
        });
      }

      const start = data.nodes.find((node) => node.id === segment.start_node_id);
      const end = data.nodes.find((node) => node.id === segment.end_node_id);
      if (start && end && start.x !== end.x && start.y !== end.y) {
        ctx.addIssue({
          code: "custom",
          message: "Segment must be horizontal or vertical",
          path: ["segments", index],
        });
      }
    }

    const segmentIdsInRooms = new Set<string>();
    for (const [index, room] of data.rooms.entries()) {
      for (const [segmentIndex, segmentId] of room.segment_ids.entries()) {
        if (!segmentIds.has(segmentId)) {
          ctx.addIssue({
            code: "custom",
            message: "Room references unknown segment",
            path: ["rooms", index, "segment_ids", segmentIndex],
          });
        }
        if (segmentIdsInRooms.has(segmentId)) {
          ctx.addIssue({
            code: "custom",
            message: "Each segment can belong to at most one room",
            path: ["rooms", index, "segment_ids", segmentIndex],
          });
        }
        segmentIdsInRooms.add(segmentId);
      }
    }
  });

export type PlanNodeInput = z.infer<typeof planNodeSchema>;
export type PlanSegmentInput = z.infer<typeof planSegmentSchema>;
export type PlanScaleInput = z.infer<typeof planScaleSchema>;
export type PlanRoomInput = z.infer<typeof planRoomSchema>;
export type EditorStateInput = z.infer<typeof editorStateSchema>;

export { projectIdSchema };
