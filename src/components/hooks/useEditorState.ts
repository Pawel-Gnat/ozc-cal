import { useCallback, useEffect, useRef, useState } from "react";

import type { SaveStatus } from "@/components/editor/EditorToolbar";
import { alignNodesForOrthogonalSegment } from "@/lib/editor/geometry";
import type { EditorRoomState, EditorScaleState, EditorStatePayload } from "@/lib/services/project-editor";
import type { EditorStateInput, PlanNodeInput, PlanSegmentInput } from "@/lib/validation/editor";

const SAVE_DEBOUNCE_MS = 800;

interface EditorApiResponse {
  data: EditorStatePayload;
  meta?: { updated_at?: string };
}

interface EditorApiError {
  error: { message: string; code: string; issues?: { path: string[]; message: string }[] };
}

interface UseEditorStateOptions {
  projectId: string;
  initialData: EditorStatePayload;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

function toNodeInput(node: { id: string; x: number; y: number }): PlanNodeInput {
  return { id: node.id, x: node.x, y: node.y };
}

function toSegmentInput(segment: {
  id: string;
  start_node_id: string;
  end_node_id: string;
  assembly_id: string;
}): PlanSegmentInput {
  return {
    id: segment.id,
    start_node_id: segment.start_node_id,
    end_node_id: segment.end_node_id,
    assembly_id: segment.assembly_id,
  };
}

function buildPayloadFromState(
  nodes: PlanNodeInput[],
  segments: PlanSegmentInput[],
  rooms: EditorRoomState[],
  scale: EditorScaleState | null,
): EditorStateInput {
  return {
    scale: scale
      ? {
          point_a_x: scale.point_a_x,
          point_a_y: scale.point_a_y,
          point_b_x: scale.point_b_x,
          point_b_y: scale.point_b_y,
          known_length_m: scale.known_length_m,
          meters_per_unit: scale.meters_per_unit,
        }
      : null,
    nodes,
    segments,
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      internal_temp_c: room.internal_temp_c,
      ventilation_supply: room.ventilation_supply,
      ventilation_exhaust: room.ventilation_exhaust,
      ventilation_natural: room.ventilation_natural,
      segment_ids: room.segment_ids,
    })),
  };
}

export function useEditorState({ projectId, initialData, onSaveStatusChange }: UseEditorStateOptions) {
  const [nodes, setNodes] = useState<PlanNodeInput[]>(initialData.nodes.map(toNodeInput));
  const [segments, setSegments] = useState<PlanSegmentInput[]>(initialData.segments.map(toSegmentInput));
  const [rooms, setRooms] = useState<EditorRoomState[]>(initialData.rooms);
  const [scale, setScale] = useState<EditorScaleState | null>(initialData.scale);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const stateRef = useRef({ nodes, segments, rooms, scale });
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);

  useEffect(() => {
    stateRef.current = { nodes, segments, rooms, scale };
  }, [nodes, segments, rooms, scale]);

  useEffect(() => {
    onSaveStatusChangeRef.current = onSaveStatusChange;
  }, [onSaveStatusChange]);

  const runSave = useRef(async () => {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    onSaveStatusChangeRef.current?.("saving");
    setSaveError(null);

    try {
      const payload = buildPayloadFromState(
        stateRef.current.nodes,
        stateRef.current.segments,
        stateRef.current.rooms,
        stateRef.current.scale,
      );

      const response = await fetch(`/api/projects/${projectId}/editor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as EditorApiError | null;
        const message = errorBody?.error.message ?? "Could not save editor state";
        throw new Error(message);
      }

      const body = (await response.json()) as EditorApiResponse;
      setScale(body.data.scale);
      setNodes(body.data.nodes.map(toNodeInput));
      setSegments(body.data.segments.map(toSegmentInput));
      setRooms(body.data.rooms);
      onSaveStatusChangeRef.current?.("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save editor state";
      setSaveError(message);
      onSaveStatusChangeRef.current?.("error");
    } finally {
      isSavingRef.current = false;
    }
  });

  const saveNow = useCallback(async () => {
    await runSave.current();
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      void runSave.current();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const updateScale = useCallback((nextScale: EditorScaleState) => {
    setScale(nextScale);
  }, []);

  const addNode = useCallback((node: PlanNodeInput) => {
    setNodes((current) => {
      const next = [...current, node];
      stateRef.current = { ...stateRef.current, nodes: next };
      return next;
    });
  }, []);

  const addNodesAndSegment = useCallback(
    (newNodes: PlanNodeInput[], segment: PlanSegmentInput, anchorNodeId: string) => {
      const mergedNodes = (() => {
        const current = stateRef.current.nodes;
        const existingIds = new Set(current.map((node) => node.id));
        const toAdd = newNodes.filter((node) => !existingIds.has(node.id));
        return toAdd.length > 0 ? [...current, ...toAdd] : current;
      })();
      const nextNodes = alignNodesForOrthogonalSegment(mergedNodes, segment, anchorNodeId);
      const nextSegments = [...stateRef.current.segments, segment];
      stateRef.current = { ...stateRef.current, nodes: nextNodes, segments: nextSegments };
      setNodes(nextNodes);
      setSegments(nextSegments);
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceNodes = useCallback((nextNodes: PlanNodeInput[]) => {
    stateRef.current = { ...stateRef.current, nodes: nextNodes };
    setNodes(nextNodes);
  }, []);

  const deleteSegment = useCallback(
    (segmentId: string, nextNodes: PlanNodeInput[]) => {
      const nextSegments = stateRef.current.segments.filter((segment) => segment.id !== segmentId);
      const nextRooms = stateRef.current.rooms
        .map((room) => ({
          ...room,
          segment_ids: room.segment_ids.filter((id) => id !== segmentId),
        }))
        .filter((room) => room.segment_ids.length >= 3);
      stateRef.current = { ...stateRef.current, nodes: nextNodes, segments: nextSegments, rooms: nextRooms };
      setNodes(nextNodes);
      setSegments(nextSegments);
      setRooms(nextRooms);
      scheduleSave();
    },
    [scheduleSave],
  );

  const addRoom = useCallback(
    (room: EditorRoomState) => {
      const nextRooms = [...stateRef.current.rooms, room];
      stateRef.current = { ...stateRef.current, rooms: nextRooms };
      setRooms(nextRooms);
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateRoom = useCallback(
    (roomId: string, updates: Partial<EditorRoomState>) => {
      const nextRooms = stateRef.current.rooms.map((room) => (room.id === roomId ? { ...room, ...updates } : room));
      stateRef.current = { ...stateRef.current, rooms: nextRooms };
      setRooms(nextRooms);
      scheduleSave();
    },
    [scheduleSave],
  );

  const deleteRoom = useCallback(
    (roomId: string) => {
      const nextRooms = stateRef.current.rooms.filter((room) => room.id !== roomId);
      stateRef.current = { ...stateRef.current, rooms: nextRooms };
      setRooms(nextRooms);
      scheduleSave();
    },
    [scheduleSave],
  );

  const saveScaleImmediately = useCallback(
    async (scalePayload: EditorScaleState) => {
      setScale(scalePayload);
      onSaveStatusChangeRef.current?.("saving");
      setSaveError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/editor`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scale: {
              point_a_x: scalePayload.point_a_x,
              point_a_y: scalePayload.point_a_y,
              point_b_x: scalePayload.point_b_x,
              point_b_y: scalePayload.point_b_y,
              known_length_m: scalePayload.known_length_m,
              meters_per_unit: scalePayload.meters_per_unit,
            },
            nodes: [],
            segments: [],
            rooms: [],
          }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as EditorApiError | null;
          const message = errorBody?.error.message ?? "Could not save scale";
          throw new Error(message);
        }

        const body = (await response.json()) as EditorApiResponse;
        setScale(body.data.scale);
        setNodes([]);
        setSegments([]);
        setRooms([]);
        onSaveStatusChangeRef.current?.("saved");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save scale";
        setSaveError(message);
        onSaveStatusChangeRef.current?.("error");
        return false;
      }
    },
    [projectId],
  );

  return {
    nodes,
    segments,
    rooms,
    scale,
    saveError,
    setScale: updateScale,
    addNode,
    addNodesAndSegment,
    replaceNodes,
    deleteSegment,
    addRoom,
    updateRoom,
    deleteRoom,
    scheduleSave,
    saveNow,
    saveScaleImmediately,
  };
}
