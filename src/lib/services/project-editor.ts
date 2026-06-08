import type { AppSupabaseClient } from "@/lib/database-client";
import { getProjectHasClimate } from "@/lib/services/project-climate";
import { getProjectHasFloorPlan } from "@/lib/services/project-floor-plan";
import type { EditorStateInput } from "@/lib/validation/editor";
import type { PlanNode, PlanRoomSegment, PlanSegment, Project } from "@/types";

export interface EditorScaleState {
  point_a_x: number;
  point_a_y: number;
  point_b_x: number;
  point_b_y: number;
  known_length_m: number;
  meters_per_unit: number;
}

export interface EditorRoomState {
  id: string;
  name: string | null;
  internal_temp_c: number;
  ventilation_supply: number | null;
  ventilation_exhaust: number | null;
  ventilation_natural: number | null;
  segment_ids: string[];
}

export interface EditorStatePayload {
  scale: EditorScaleState | null;
  nodes: PlanNode[];
  segments: PlanSegment[];
  rooms: EditorRoomState[];
}

export interface EditorStateMeta {
  updated_at: string;
}

function scaleFromProject(project: Project): EditorScaleState | null {
  const {
    plan_scale_point_a_x,
    plan_scale_point_a_y,
    plan_scale_point_b_x,
    plan_scale_point_b_y,
    plan_scale_known_length_m,
    plan_scale_meters_per_unit,
  } = project;

  if (
    plan_scale_point_a_x == null ||
    plan_scale_point_a_y == null ||
    plan_scale_point_b_x == null ||
    plan_scale_point_b_y == null ||
    plan_scale_known_length_m == null ||
    plan_scale_meters_per_unit == null
  ) {
    return null;
  }

  return {
    point_a_x: plan_scale_point_a_x,
    point_a_y: plan_scale_point_a_y,
    point_b_x: plan_scale_point_b_x,
    point_b_y: plan_scale_point_b_y,
    known_length_m: plan_scale_known_length_m,
    meters_per_unit: plan_scale_meters_per_unit,
  };
}

function projectScaleUpdate(input: EditorStateInput["scale"]): Record<string, number | null> {
  if (!input) {
    return {
      plan_scale_point_a_x: null,
      plan_scale_point_a_y: null,
      plan_scale_point_b_x: null,
      plan_scale_point_b_y: null,
      plan_scale_known_length_m: null,
      plan_scale_meters_per_unit: null,
    };
  }

  return {
    plan_scale_point_a_x: input.point_a_x,
    plan_scale_point_a_y: input.point_a_y,
    plan_scale_point_b_x: input.point_b_x,
    plan_scale_point_b_y: input.point_b_y,
    plan_scale_known_length_m: input.known_length_m,
    plan_scale_meters_per_unit: input.meters_per_unit,
  };
}

export function getProjectEditorReady(project: Project, assembliesCount: number): boolean {
  return getProjectHasClimate(project) && getProjectHasFloorPlan(project) && assembliesCount > 0;
}

export async function countProjectAssemblies(supabase: AppSupabaseClient, projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from("assemblies")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getEditorState(
  supabase: AppSupabaseClient,
  project: Project,
): Promise<{ data: EditorStatePayload; meta: EditorStateMeta }> {
  const projectId = project.id;

  const [nodesResult, segmentsResult, roomsResult] = await Promise.all([
    supabase
      .from("plan_nodes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .overrideTypes<PlanNode[], { merge: false }>(),
    supabase
      .from("plan_segments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .overrideTypes<PlanSegment[], { merge: false }>(),
    supabase.from("plan_rooms").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
  ]);

  if (nodesResult.error) {
    throw nodesResult.error;
  }
  if (segmentsResult.error) {
    throw segmentsResult.error;
  }
  if (roomsResult.error) {
    throw roomsResult.error;
  }

  const rooms = roomsResult.data;
  let roomSegments: PlanRoomSegment[] = [];

  if (rooms.length > 0) {
    const roomIds = rooms.map((room) => room.id);
    const { data, error } = await supabase
      .from("plan_room_segments")
      .select("*")
      .in("room_id", roomIds)
      .order("segment_order", { ascending: true })
      .overrideTypes<PlanRoomSegment[], { merge: false }>();

    if (error) {
      throw error;
    }

    roomSegments = data;
  }

  const segmentsByRoom = new Map<string, string[]>();
  for (const link of roomSegments) {
    const current = segmentsByRoom.get(link.room_id) ?? [];
    current.push(link.segment_id);
    segmentsByRoom.set(link.room_id, current);
  }

  return {
    data: {
      scale: scaleFromProject(project),
      nodes: nodesResult.data,
      segments: segmentsResult.data,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        internal_temp_c: room.internal_temp_c,
        ventilation_supply: room.ventilation_supply,
        ventilation_exhaust: room.ventilation_exhaust,
        ventilation_natural: room.ventilation_natural,
        segment_ids: segmentsByRoom.get(room.id) ?? [],
      })),
    },
    meta: {
      updated_at: project.updated_at,
    },
  };
}

async function assertAssemblyIdsBelongToProject(
  supabase: AppSupabaseClient,
  projectId: string,
  assemblyIds: string[],
): Promise<void> {
  if (assemblyIds.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(assemblyIds)];
  const { data, error } = await supabase
    .from("assemblies")
    .select("id")
    .eq("project_id", projectId)
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  if (data.length !== uniqueIds.length) {
    throw new Error("One or more assemblies do not belong to this project");
  }
}

export async function replaceEditorState(
  supabase: AppSupabaseClient,
  projectId: string,
  input: EditorStateInput,
): Promise<{ data: EditorStatePayload; meta: EditorStateMeta }> {
  await assertAssemblyIdsBelongToProject(
    supabase,
    projectId,
    input.segments.map((segment) => segment.assembly_id),
  );

  const { error: deleteRoomsError } = await supabase.from("plan_rooms").delete().eq("project_id", projectId);
  if (deleteRoomsError) {
    throw deleteRoomsError;
  }

  const { error: deleteSegmentsError } = await supabase.from("plan_segments").delete().eq("project_id", projectId);
  if (deleteSegmentsError) {
    throw deleteSegmentsError;
  }

  const { error: deleteNodesError } = await supabase.from("plan_nodes").delete().eq("project_id", projectId);
  if (deleteNodesError) {
    throw deleteNodesError;
  }

  const { data: updatedProject, error: scaleError } = await supabase
    .from("projects")
    .update(projectScaleUpdate(input.scale))
    .eq("id", projectId)
    .select()
    .single();

  if (scaleError) {
    throw scaleError;
  }

  if (input.nodes.length > 0) {
    const { error: nodesError } = await supabase.from("plan_nodes").insert(
      input.nodes.map((node) => ({
        id: node.id,
        project_id: projectId,
        x: node.x,
        y: node.y,
      })),
    );

    if (nodesError) {
      throw nodesError;
    }
  }

  if (input.segments.length > 0) {
    const { error: segmentsError } = await supabase.from("plan_segments").insert(
      input.segments.map((segment) => ({
        id: segment.id,
        project_id: projectId,
        start_node_id: segment.start_node_id,
        end_node_id: segment.end_node_id,
        assembly_id: segment.assembly_id,
      })),
    );

    if (segmentsError) {
      throw segmentsError;
    }
  }

  if (input.rooms.length > 0) {
    const { error: roomsError } = await supabase.from("plan_rooms").insert(
      input.rooms.map((room) => ({
        id: room.id,
        project_id: projectId,
        name: room.name ?? null,
        internal_temp_c: room.internal_temp_c,
        ventilation_supply: room.ventilation_supply ?? null,
        ventilation_exhaust: room.ventilation_exhaust ?? null,
        ventilation_natural: room.ventilation_natural ?? null,
      })),
    );

    if (roomsError) {
      throw roomsError;
    }

    const roomSegmentRows = input.rooms.flatMap((room) =>
      room.segment_ids.map((segmentId, index) => ({
        room_id: room.id,
        segment_id: segmentId,
        segment_order: index,
      })),
    );

    if (roomSegmentRows.length > 0) {
      const { error: roomSegmentsError } = await supabase.from("plan_room_segments").insert(roomSegmentRows);

      if (roomSegmentsError) {
        throw roomSegmentsError;
      }
    }
  }

  return getEditorState(supabase, updatedProject);
}
