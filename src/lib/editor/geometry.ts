import { OPENING_DEFAULT_HEIGHT_M } from "@/lib/thermal/wt2021-constants";
import { roomPolygonPoints } from "@/lib/editor/room-detection";
import type { AssemblyCategory } from "@/types";

export interface Point {
  x: number;
  y: number;
}

export interface GeometryNode {
  id: string;
  x: number;
  y: number;
}

export interface GeometrySegment {
  id: string;
  start_node_id: string;
  end_node_id: string;
  assembly_id: string;
}

export interface SnapResult {
  point: Point;
  nodeId?: string;
}

/** Tolerance for H/V alignment and duplicate-node merge in PDF pixel space. */
export const COORD_EPSILON = 2;

export function distancePx(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function snapToNodes(
  point: Point,
  nodes: GeometryNode[],
  thresholdPx: number,
  excludeNodeId?: string,
): SnapResult {
  let nearest: { node: GeometryNode; distance: number } | null = null;

  for (const node of nodes) {
    if (excludeNodeId && node.id === excludeNodeId) {
      continue;
    }

    const distance = distancePx(point, node);
    if (distance <= thresholdPx && (nearest === null || distance < nearest.distance)) {
      nearest = { node, distance };
    }
  }

  if (nearest) {
    return {
      point: { x: nearest.node.x, y: nearest.node.y },
      nodeId: nearest.node.id,
    };
  }

  return { point };
}

/** Snap the first click of a new segment to an existing node. */
export function snapStartPoint(cursor: Point, nodes: GeometryNode[], thresholdPx: number): SnapResult {
  return snapToNodes(cursor, nodes, thresholdPx);
}

export function constrainOrthogonal(start: Point, cursor: Point): Point {
  const dx = Math.abs(cursor.x - start.x);
  const dy = Math.abs(cursor.y - start.y);

  if (dx >= dy) {
    return { x: cursor.x, y: start.y };
  }

  return { x: start.x, y: cursor.y };
}

function orthogonallyReachableNodes(start: Point, nodes: GeometryNode[], excludeNodeId?: string): GeometryNode[] {
  return nodes.filter((node) => (!excludeNodeId || node.id !== excludeNodeId) && isOrthogonalSegment(start, node));
}

/** Snap segment endpoint to an existing node reachable via H/V from start. */
export function snapOrthogonalEndpoint(
  start: Point,
  cursor: Point,
  nodes: GeometryNode[],
  thresholdPx: number,
  excludeNodeId?: string,
): SnapResult {
  const constrained = constrainOrthogonal(start, cursor);
  const candidates = orthogonallyReachableNodes(start, nodes, excludeNodeId);

  let nearestToCursor: { node: GeometryNode; distance: number } | null = null;
  for (const node of candidates) {
    const distance = distancePx(node, cursor);
    if (distance <= thresholdPx && (nearestToCursor === null || distance < nearestToCursor.distance)) {
      nearestToCursor = { node, distance };
    }
  }

  if (nearestToCursor) {
    return {
      point: { x: nearestToCursor.node.x, y: nearestToCursor.node.y },
      nodeId: nearestToCursor.node.id,
    };
  }

  let nearestToConstrained: { node: GeometryNode; distance: number } | null = null;
  for (const node of candidates) {
    const distance = distancePx(node, constrained);
    if (distance <= thresholdPx && (nearestToConstrained === null || distance < nearestToConstrained.distance)) {
      nearestToConstrained = { node, distance };
    }
  }

  if (nearestToConstrained) {
    return {
      point: { x: nearestToConstrained.node.x, y: nearestToConstrained.node.y },
      nodeId: nearestToConstrained.node.id,
    };
  }

  return { point: constrained };
}

export function segmentLengthM(
  segment: GeometrySegment,
  nodes: GeometryNode[],
  scaleMetersPerUnit: number,
): number | null {
  const start = nodes.find((node) => node.id === segment.start_node_id);
  const end = nodes.find((node) => node.id === segment.end_node_id);

  if (!start || !end) {
    return null;
  }

  return distancePx(start, end) * scaleMetersPerUnit;
}

/** Shoelace formula on PDF-space vertices; scale² converts px² to m². */
export function polygonAreaM2(points: Point[], metersPerUnit: number): number {
  if (points.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  const areaPxSq = Math.abs(sum) / 2;
  return areaPxSq * metersPerUnit * metersPerUnit;
}

export interface RoomWithSegmentIds {
  segment_ids: string[];
}

/** Floor area from a closed room polygon derived from its segment chain. */
export function roomFloorAreaM2(
  room: RoomWithSegmentIds,
  segments: GeometrySegment[],
  nodes: GeometryNode[],
  metersPerUnit: number,
): number | null {
  const points = roomPolygonPoints(room.segment_ids, segments, nodes);
  if (!points) {
    return null;
  }

  return polygonAreaM2(points, metersPerUnit);
}

/** Wall or opening area from segment length × vertical extent (storey or opening default). */
export function segmentWallAreaM(
  segment: GeometrySegment,
  nodes: GeometryNode[],
  metersPerUnit: number,
  storeyHeightM: number,
  assemblyCategory: AssemblyCategory,
): number | null {
  const lengthM = segmentLengthM(segment, nodes, metersPerUnit);
  if (lengthM === null) {
    return null;
  }

  const heightM =
    assemblyCategory === "window" || assemblyCategory === "door" ? OPENING_DEFAULT_HEIGHT_M : storeyHeightM;

  return lengthM * heightM;
}

function endpointsMatch(startA: Point, endA: Point, startB: Point, endB: Point, tolerancePx: number): boolean {
  const sameDirection = distancePx(startA, startB) <= tolerancePx && distancePx(endA, endB) <= tolerancePx;
  const reversed = distancePx(startA, endB) <= tolerancePx && distancePx(endA, startB) <= tolerancePx;
  return sameDirection || reversed;
}

/** Find another segment sharing the same endpoints (either direction), excluding the given id. */
export function findColocatedSegment(
  segmentId: string,
  segments: GeometrySegment[],
  nodes: GeometryNode[],
  tolerancePx: number,
): string | null {
  const target = segments.find((segment) => segment.id === segmentId);
  if (!target) {
    return null;
  }

  const start = nodes.find((node) => node.id === target.start_node_id);
  const end = nodes.find((node) => node.id === target.end_node_id);
  if (!start || !end) {
    return null;
  }

  for (const candidate of segments) {
    if (candidate.id === segmentId) {
      continue;
    }

    const candidateStart = nodes.find((node) => node.id === candidate.start_node_id);
    const candidateEnd = nodes.find((node) => node.id === candidate.end_node_id);
    if (!candidateStart || !candidateEnd) {
      continue;
    }

    if (endpointsMatch(start, end, candidateStart, candidateEnd, tolerancePx)) {
      return candidate.id;
    }
  }

  return null;
}

export interface RoomSegmentOwner extends RoomWithSegmentIds {
  id: string;
}

/** Return the room id that owns a segment via its closed chain, or null. */
export function findRoomForSegment(segmentId: string, rooms: RoomSegmentOwner[]): string | null {
  for (const room of rooms) {
    if (room.segment_ids.includes(segmentId)) {
      return room.id;
    }
  }

  return null;
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return distancePx(point, start);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return distancePx(point, projection);
}

export function findNearestSegment(
  point: Point,
  segments: GeometrySegment[],
  nodes: GeometryNode[],
  threshold: number,
): string | null {
  let nearestId: string | null = null;
  let nearestDistance = threshold;

  for (const segment of segments) {
    const start = nodes.find((node) => node.id === segment.start_node_id);
    const end = nodes.find((node) => node.id === segment.end_node_id);

    if (!start || !end) {
      continue;
    }

    const distance = pointToSegmentDistance(point, start, end);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = segment.id;
    }
  }

  return nearestId;
}

export function removeOrphanNodes(nodes: GeometryNode[], segments: GeometrySegment[]): GeometryNode[] {
  const referenced = new Set<string>();

  for (const segment of segments) {
    referenced.add(segment.start_node_id);
    referenced.add(segment.end_node_id);
  }

  return nodes.filter((node) => referenced.has(node.id));
}

export function isOrthogonalSegment(start: Point, end: Point, epsilon = COORD_EPSILON): boolean {
  return Math.abs(start.x - end.x) <= epsilon || Math.abs(start.y - end.y) <= epsilon;
}

/** Align segment endpoint coordinates to a shared H or V line (anchor node keeps its axis value). */
export function alignNodesForOrthogonalSegment(
  nodes: GeometryNode[],
  segment: GeometrySegment,
  anchorNodeId: string,
): GeometryNode[] {
  const start = nodes.find((node) => node.id === segment.start_node_id);
  const end = nodes.find((node) => node.id === segment.end_node_id);
  const anchor = nodes.find((node) => node.id === anchorNodeId);

  if (!start || !end || !anchor) {
    return nodes;
  }

  const dx = Math.abs(start.x - end.x);
  const dy = Math.abs(start.y - end.y);

  if (dy <= COORD_EPSILON) {
    return nodes.map((node) => {
      if (node.id === start.id || node.id === end.id) {
        return { ...node, y: anchor.y };
      }
      return node;
    });
  }

  if (dx <= COORD_EPSILON) {
    return nodes.map((node) => {
      if (node.id === start.id || node.id === end.id) {
        return { ...node, x: anchor.x };
      }
      return node;
    });
  }

  return nodes;
}
