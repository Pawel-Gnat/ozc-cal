import { useEffect, useRef } from "react";

import type { Point } from "@/lib/editor/geometry";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import type { PlanNodeInput, PlanSegmentInput } from "@/lib/validation/editor";
import type { AssemblyCategory } from "@/types";

interface PlanOverlayCanvasProps {
  dimensions: { width: number; height: number };
  nodes: PlanNodeInput[];
  segments: PlanSegmentInput[];
  assemblies: EditorAssemblySummary[];
  selectedSegmentId: string | null;
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

function getAssemblyColor(assemblies: EditorAssemblySummary[], assemblyId: string): string {
  const assembly = assemblies.find((item) => item.id === assemblyId);
  if (!assembly) {
    return DEFAULT_SEGMENT_COLOR;
  }
  return ASSEMBLY_COLORS[assembly.category];
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  dimensions: { width: number; height: number },
  nodes: PlanNodeInput[],
  segments: PlanSegmentInput[],
  assemblies: EditorAssemblySummary[],
  selectedSegmentId: string | null,
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

  for (const segment of segments) {
    const start = nodeById.get(segment.start_node_id);
    const end = nodeById.get(segment.end_node_id);
    if (!start || !end) {
      continue;
    }

    const isSelected = segment.id === selectedSegmentId;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = getAssemblyColor(assemblies, segment.assembly_id);
    context.lineWidth = isSelected ? 4 : 2;
    if (isSelected) {
      context.shadowColor = "rgba(255, 255, 255, 0.6)";
      context.shadowBlur = 6;
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
  selectedSegmentId,
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
      drawOverlay(canvas, dimensions, nodes, segments, assemblies, selectedSegmentId, drawPreview, snapIndicator);
      frameRef.current = null;
    });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [dimensions, nodes, segments, assemblies, selectedSegmentId, drawPreview, snapIndicator]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute top-0 left-0 block" />;
}
