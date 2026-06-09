import type { Point } from "@/lib/editor/geometry";
import type { GeometryNode, GeometrySegment } from "@/lib/editor/geometry";
import type { PlanNodeInput, PlanSegmentInput } from "@/lib/validation/editor";

const DEFAULT_MAX_LOOPS = 10;

interface AdjacencyEdge {
  nodeId: string;
  segmentId: string;
}

function buildAdjacency(segments: GeometrySegment[]): Map<string, AdjacencyEdge[]> {
  const adjacency = new Map<string, AdjacencyEdge[]>();

  const addEdge = (fromNodeId: string, toNodeId: string, segmentId: string) => {
    const edges = adjacency.get(fromNodeId) ?? [];
    edges.push({ nodeId: toNodeId, segmentId });
    adjacency.set(fromNodeId, edges);
  };

  for (const segment of segments) {
    addEdge(segment.start_node_id, segment.end_node_id, segment.id);
    addEdge(segment.end_node_id, segment.start_node_id, segment.id);
  }

  return adjacency;
}

function cycleKey(segmentIds: string[]): string {
  return [...segmentIds].sort().join("|");
}

function findCyclesFromSegment(
  firstSegment: GeometrySegment,
  segments: GeometrySegment[],
  adjacency: Map<string, AdjacencyEdge[]>,
  excludeSegmentIds: Set<string>,
  maxLoops: number,
  foundKeys: Set<string>,
  results: string[][],
): void {
  if (results.length >= maxLoops) {
    return;
  }

  const tryWalk = (startNodeId: string, firstStepNodeId: string) => {
    function walk(currentNodeId: string, pathSegmentIds: string[], usedSegmentIds: Set<string>): void {
      if (results.length >= maxLoops) {
        return;
      }

      if (pathSegmentIds.length >= 3 && currentNodeId === startNodeId) {
        const key = cycleKey(pathSegmentIds);
        if (!foundKeys.has(key)) {
          foundKeys.add(key);
          results.push([...pathSegmentIds]);
        }
        return;
      }

      if (pathSegmentIds.length >= segments.length) {
        return;
      }

      for (const edge of adjacency.get(currentNodeId) ?? []) {
        if (usedSegmentIds.has(edge.segmentId) || excludeSegmentIds.has(edge.segmentId)) {
          continue;
        }

        usedSegmentIds.add(edge.segmentId);
        pathSegmentIds.push(edge.segmentId);
        walk(edge.nodeId, pathSegmentIds, usedSegmentIds);
        pathSegmentIds.pop();
        usedSegmentIds.delete(edge.segmentId);
      }
    }

    walk(firstStepNodeId, [firstSegment.id], new Set([firstSegment.id]));
  };

  tryWalk(firstSegment.start_node_id, firstSegment.end_node_id);
  tryWalk(firstSegment.end_node_id, firstSegment.start_node_id);
}

/** Return minimal closed segment loops, capped for UI performance. */
export function findClosedLoops(
  segments: GeometrySegment[],
  _nodes: GeometryNode[],
  options?: { maxLoops?: number; excludeSegmentIds?: Set<string> },
): string[][] {
  const maxLoops = options?.maxLoops ?? DEFAULT_MAX_LOOPS;
  const excludeSegmentIds = options?.excludeSegmentIds ?? new Set<string>();
  const availableSegments = segments.filter((segment) => !excludeSegmentIds.has(segment.id));

  if (availableSegments.length < 3) {
    return [];
  }

  const adjacency = buildAdjacency(availableSegments);
  const foundKeys = new Set<string>();
  const results: string[][] = [];

  for (const segment of availableSegments) {
    if (results.length >= maxLoops) {
      break;
    }
    findCyclesFromSegment(segment, availableSegments, adjacency, excludeSegmentIds, maxLoops, foundKeys, results);
  }

  return results.sort((left, right) => left.length - right.length);
}

function segmentById(segments: PlanSegmentInput[], segmentId: string): PlanSegmentInput | undefined {
  return segments.find((segment) => segment.id === segmentId);
}

export function segmentsShareNode(left: PlanSegmentInput, right: PlanSegmentInput): boolean {
  return (
    left.start_node_id === right.start_node_id ||
    left.start_node_id === right.end_node_id ||
    left.end_node_id === right.start_node_id ||
    left.end_node_id === right.end_node_id
  );
}

/** Ordered segment ids must form a closed chain (each adjacent pair shares a node). */
export function isClosedChain(segmentIds: string[], segments: PlanSegmentInput[]): boolean {
  if (segmentIds.length < 3) {
    return false;
  }

  const ordered = segmentIds
    .map((segmentId) => segmentById(segments, segmentId))
    .filter((segment): segment is PlanSegmentInput => segment !== undefined);

  if (ordered.length !== segmentIds.length) {
    return false;
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    if (!segmentsShareNode(current, next)) {
      return false;
    }
  }

  return true;
}

function nextNodeId(segment: PlanSegmentInput, fromNodeId: string): string | null {
  if (segment.start_node_id === fromNodeId) {
    return segment.end_node_id;
  }
  if (segment.end_node_id === fromNodeId) {
    return segment.start_node_id;
  }
  return null;
}

/** Walk a closed chain and return corner points for polygon fill. */
export function roomPolygonPoints(
  segmentIds: string[],
  segments: PlanSegmentInput[],
  nodes: PlanNodeInput[],
): Point[] | null {
  if (!isClosedChain(segmentIds, segments)) {
    return null;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const firstSegment = segmentById(segments, segmentIds[0]);
  if (!firstSegment) {
    return null;
  }

  const points: Point[] = [];
  let currentNodeId = firstSegment.start_node_id;
  const startNode = nodeById.get(currentNodeId);
  if (!startNode) {
    return null;
  }
  points.push({ x: startNode.x, y: startNode.y });

  for (let index = 0; index < segmentIds.length; index += 1) {
    const segment = segmentById(segments, segmentIds[index]);
    if (!segment) {
      return null;
    }

    const nextId = nextNodeId(segment, currentNodeId);
    if (!nextId) {
      return null;
    }

    const nextNode = nodeById.get(nextId);
    if (!nextNode) {
      return null;
    }

    if (index < segmentIds.length - 1) {
      points.push({ x: nextNode.x, y: nextNode.y });
    }

    currentNodeId = nextId;
  }

  return points.length >= 3 ? points : null;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y + Number.EPSILON) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function findRoomAtPoint(
  point: Point,
  rooms: { id: string; segment_ids: string[] }[],
  segments: PlanSegmentInput[],
  nodes: PlanNodeInput[],
): string | null {
  for (const room of rooms) {
    const polygon = roomPolygonPoints(room.segment_ids, segments, nodes);
    if (polygon && pointInPolygon(point, polygon)) {
      return room.id;
    }
  }

  return null;
}

export function defaultRoomName(existingRoomCount: number): string {
  return `Room ${existingRoomCount + 1}`;
}
