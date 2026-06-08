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
