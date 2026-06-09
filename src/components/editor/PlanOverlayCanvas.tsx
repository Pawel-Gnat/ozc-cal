import { useEffect, useRef } from "react";

import type { Point } from "@/lib/editor/geometry";
import { roomPolygonPoints } from "@/lib/editor/room-detection";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import type { EditorRoomState } from "@/lib/services/project-editor";
import type { PlanNodeInput, PlanSegmentInput } from "@/lib/validation/editor";
import type { AssemblyCategory } from "@/types";

interface PlanOverlayCanvasProps {
  dimensions: { width: number; height: number };
  nodes: PlanNodeInput[];
  segments: PlanSegmentInput[];
  assemblies: EditorAssemblySummary[];
  rooms: EditorRoomState[];
  selectedSegmentId: string | null;
  selectedRoomId: string | null;
  highlightedLoopSegmentIds: string[];
  manualSelectionSegmentIds: string[];
  drawPreview: { start: Point; end: Point } | null;
  snapIndicator: Point | null;
}

const ASSEMBLY_COLORS: Record<AssemblyCategory, string> = {
  external_wall: "rgba(59, 130, 246, 0.95)",
  internal_partition: "rgba(168, 85, 247, 0.95)",
  floor: "rgba(234, 179, 8, 0.95)",
  ceiling: "rgba(148, 163, 184, 0.95)",
  roof: "rgba(239, 68, 68, 0.95)",
  ground_floor: "rgba(180, 83, 9, 0.95)",
  window: "rgba(34, 211, 238, 0.95)",
  door: "rgba(251, 146, 60, 0.95)",
};

const DEFAULT_SEGMENT_COLOR = "rgba(148, 163, 184, 0.9)";
const NODE_RADIUS = 6;
const SNAP_RADIUS = 10;
const ROOM_FILL_COLORS = [
  "rgba(34, 197, 94, 0.12)",
  "rgba(59, 130, 246, 0.12)",
  "rgba(168, 85, 247, 0.12)",
  "rgba(234, 179, 8, 0.12)",
];

function getAssemblyColor(assemblies: EditorAssemblySummary[], assemblyId: string): string {
  const assembly = assemblies.find((item) => item.id === assemblyId);
  if (!assembly) {
    return DEFAULT_SEGMENT_COLOR;
  }
  return ASSEMBLY_COLORS[assembly.category];
}

function polygonCentroid(points: Point[]): Point {
  const sum = points.reduce((accumulator, point) => ({ x: accumulator.x + point.x, y: accumulator.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  dimensions: { width: number; height: number },
  nodes: PlanNodeInput[],
  segments: PlanSegmentInput[],
  assemblies: EditorAssemblySummary[],
  rooms: EditorRoomState[],
  selectedSegmentId: string | null,
  selectedRoomId: string | null,
  highlightedLoopSegmentIds: string[],
  manualSelectionSegmentIds: string[],
  drawPreview: { start: Point; end: Point } | null,
  snapIndicator: Point | null,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(dimensions.width * dpr);
  canvas.height = Math.floor(dimensions.height * dpr);
  canvas.style.width = `${Math.floor(dimensions.width)}px`;
  canvas.style.height = `${Math.floor(dimensions.height)}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, dimensions.width, dimensions.height);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const highlightedLoopSet = new Set(highlightedLoopSegmentIds);
  const manualSelectionSet = new Set(manualSelectionSegmentIds);

  for (const [index, room] of rooms.entries()) {
    const polygon = roomPolygonPoints(room.segment_ids, segments, nodes);
    if (!polygon) {
      continue;
    }

    context.beginPath();
    context.moveTo(polygon[0].x, polygon[0].y);
    for (let pointIndex = 1; pointIndex < polygon.length; pointIndex += 1) {
      const point = polygon[pointIndex];
      context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.fillStyle =
      room.id === selectedRoomId ? "rgba(34, 197, 94, 0.22)" : ROOM_FILL_COLORS[index % ROOM_FILL_COLORS.length];
    context.fill();

    const centroid = polygonCentroid(polygon);
    const trimmedName = room.name?.trim();
    const label = trimmedName ?? `Room ${index + 1}`;
    const tempLabel = `${label} · ${room.internal_temp_c}°C`;
    context.font = "12px system-ui, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.textAlign = "center";
    context.fillText(tempLabel, centroid.x, centroid.y);
    context.textAlign = "start";
  }

  for (const segment of segments) {
    const start = nodeById.get(segment.start_node_id);
    const end = nodeById.get(segment.end_node_id);
    if (!start || !end) {
      continue;
    }

    const isSelected = segment.id === selectedSegmentId;
    const isLoopHighlight = highlightedLoopSet.has(segment.id);
    const isManualSelection = manualSelectionSet.has(segment.id);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = getAssemblyColor(assemblies, segment.assembly_id);
    context.lineWidth = isSelected || isLoopHighlight || isManualSelection ? 4 : 2;
    if (isSelected) {
      context.shadowColor = "rgba(255, 255, 255, 0.6)";
      context.shadowBlur = 6;
    } else if (isLoopHighlight) {
      context.shadowColor = "rgba(34, 197, 94, 0.8)";
      context.shadowBlur = 8;
    } else if (isManualSelection) {
      context.shadowColor = "rgba(250, 204, 21, 0.8)";
      context.shadowBlur = 8;
    } else {
      context.shadowBlur = 0;
    }
    context.stroke();
    context.shadowBlur = 0;
  }

  if (drawPreview) {
    context.beginPath();
    context.moveTo(drawPreview.start.x, drawPreview.start.y);
    context.lineTo(drawPreview.end.x, drawPreview.end.y);
    context.strokeStyle = "rgba(250, 204, 21, 0.9)";
    context.lineWidth = 2;
    context.setLineDash([6, 4]);
    context.stroke();
    context.setLineDash([]);
  }

  if (snapIndicator) {
    context.beginPath();
    context.arc(snapIndicator.x, snapIndicator.y, SNAP_RADIUS, 0, Math.PI * 2);
    context.strokeStyle = "rgba(34, 211, 238, 0.9)";
    context.lineWidth = 2;
    context.stroke();
  }

  for (const node of nodes) {
    context.beginPath();
    context.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.fill();
    context.strokeStyle = "rgba(15, 23, 42, 0.8)";
    context.lineWidth = 1;
    context.stroke();
  }
}

export function PlanOverlayCanvas({
  dimensions,
  nodes,
  segments,
  assemblies,
  rooms,
  selectedSegmentId,
  selectedRoomId,
  highlightedLoopSegmentIds,
  manualSelectionSegmentIds,
  drawPreview,
  snapIndicator,
}: PlanOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      drawOverlay(
        canvas,
        dimensions,
        nodes,
        segments,
        assemblies,
        rooms,
        selectedSegmentId,
        selectedRoomId,
        highlightedLoopSegmentIds,
        manualSelectionSegmentIds,
        drawPreview,
        snapIndicator,
      );
      frameRef.current = null;
    });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [
    dimensions,
    nodes,
    segments,
    assemblies,
    rooms,
    selectedSegmentId,
    selectedRoomId,
    highlightedLoopSegmentIds,
    manualSelectionSegmentIds,
    drawPreview,
    snapIndicator,
  ]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute top-0 left-0 block" />;
}
