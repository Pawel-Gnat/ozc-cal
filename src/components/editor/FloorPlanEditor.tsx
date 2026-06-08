import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { EditorToolbar, type EditorMode, type SaveStatus } from "@/components/editor/EditorToolbar";
import { PlanOverlayCanvas } from "@/components/editor/PlanOverlayCanvas";
import { ScaleCalibrationPanel, type CalibrationPoint } from "@/components/editor/ScaleCalibrationPanel";
import { useEditorState } from "@/components/hooks/useEditorState";
import {
  distancePx,
  findNearestSegment,
  isOrthogonalSegment,
  removeOrphanNodes,
  snapOrthogonalEndpoint,
  snapStartPoint,
  type Point,
  type SnapResult,
} from "@/lib/editor/geometry";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import { renderPageToCanvas } from "@/lib/pdf/render-page-to-canvas";
import { pdfjs } from "@/lib/pdf/setup-pdfjs";
import type { EditorScaleState, EditorStatePayload } from "@/lib/services/project-editor";
import { cn } from "@/lib/utils";
import type { PlanNodeInput, PlanSegmentInput } from "@/lib/validation/editor";

interface FloorPlanEditorProps {
  projectId: string;
  projectName: string;
  assemblies: EditorAssemblySummary[];
  initialScale: EditorScaleState | null;
}

interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

interface EditorApiResponse {
  data: EditorStatePayload;
  meta?: { updated_at?: string };
}

interface DrawDraft {
  startNodeId: string;
  startPoint: Point;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const SNAP_THRESHOLD_SCREEN_PX = 32;
const SNAP_CLICK_MULTIPLIER = 2;
const SEGMENT_HIT_THRESHOLD_PX = 8;

function snapThresholdPdf(zoom: number, multiplier = 1): number {
  return (SNAP_THRESHOLD_SCREEN_PX * multiplier) / zoom;
}

function screenToPdfCoords(clientX: number, clientY: number, containerRect: DOMRect, transform: ViewTransform): Point {
  return {
    x: (clientX - containerRect.left - transform.panX) / transform.zoom,
    y: (clientY - containerRect.top - transform.panY) / transform.zoom,
  };
}

function drawCalibrationOverlay(
  canvas: HTMLCanvasElement,
  dimensions: { width: number; height: number },
  pointA: CalibrationPoint | null,
  pointB: CalibrationPoint | null,
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

  if (!pointA && !pointB) {
    return;
  }

  context.lineWidth = 2;
  context.strokeStyle = "rgba(168, 85, 247, 0.9)";
  context.fillStyle = "rgba(168, 85, 247, 0.9)";

  const drawPoint = (point: CalibrationPoint, label: string) => {
    context.beginPath();
    context.arc(point.x, point.y, 6, 0, Math.PI * 2);
    context.fill();
    context.font = "12px system-ui, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fillText(label, point.x + 10, point.y - 10);
    context.fillStyle = "rgba(168, 85, 247, 0.9)";
  };

  if (pointA) {
    drawPoint(pointA, "A");
  }
  if (pointB) {
    drawPoint(pointB, "B");
  }
  if (pointA && pointB) {
    context.beginPath();
    context.moveTo(pointA.x, pointA.y);
    context.lineTo(pointB.x, pointB.y);
    context.stroke();
  }
}

interface ResolvedNode {
  nodeId: string;
  point: Point;
  newNode?: PlanNodeInput;
}

function resolveNodeAtPoint(point: Point, nodes: PlanNodeInput[], thresholdPx: number): ResolvedNode {
  const snap = snapStartPoint(point, nodes, thresholdPx);
  if (snap.nodeId) {
    return { nodeId: snap.nodeId, point: snap.point };
  }

  const newNode: PlanNodeInput = {
    id: crypto.randomUUID(),
    x: snap.point.x,
    y: snap.point.y,
  };
  return { nodeId: newNode.id, point: snap.point, newNode };
}

interface FloorPlanEditorLoadedProps extends FloorPlanEditorProps {
  initialEditorData: EditorStatePayload;
}

function FloorPlanEditorLoaded({ projectId, projectName, assemblies, initialEditorData }: FloorPlanEditorLoadedProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [loadState, setLoadState] = useState<"loading" | "rendering" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<EditorMode>(initialEditorData.scale ? "draw" : "calibrate");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [calibrationError, setCalibrationError] = useState<string | undefined>();
  const [calibrationPointA, setCalibrationPointA] = useState<CalibrationPoint | null>(null);
  const [calibrationPointB, setCalibrationPointB] = useState<CalibrationPoint | null>(null);
  const [transform, setTransform] = useState<ViewTransform>({ panX: 0, panY: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Point | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<Point | null>(null);

  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pendingPdfDataRef = useRef<{ pdfBuffer: ArrayBuffer } | null>(null);

  const editorState = useEditorState({
    projectId,
    initialData: initialEditorData,
    onSaveStatusChange: setSaveStatus,
  });

  const scale = editorState.scale;
  const isCalibrating = mode === "calibrate" && loadState === "ready";
  const canDraw = Boolean(scale) && mode === "draw" && Boolean(selectedAssemblyId);

  const applyZoom = useCallback((nextZoom: number, focal?: { x: number; y: number }) => {
    setTransform((current) => {
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      if (!focal || !viewportRef.current) {
        return { ...current, zoom: clampedZoom };
      }

      const rect = viewportRef.current.getBoundingClientRect();
      const focalX = focal.x - rect.left;
      const focalY = focal.y - rect.top;
      const scaleFactor = clampedZoom / current.zoom;
      const panX = focalX - (focalX - current.panX) * scaleFactor;
      const panY = focalY - (focalY - current.panY) * scaleFactor;

      return { panX, panY, zoom: clampedZoom };
    });
  }, []);

  const saveScale = useCallback(
    async (pointA: CalibrationPoint, pointB: CalibrationPoint, knownLengthM: number) => {
      const pixelDistance = distancePx(pointA, pointB);
      if (pixelDistance <= 0) {
        setCalibrationError("Calibration points must be different");
        return;
      }

      const scalePayload: EditorScaleState = {
        point_a_x: pointA.x,
        point_a_y: pointA.y,
        point_b_x: pointB.x,
        point_b_y: pointB.y,
        known_length_m: knownLengthM,
        meters_per_unit: knownLengthM / pixelDistance,
      };

      setCalibrationError(undefined);
      const saved = await editorState.saveScaleImmediately(scalePayload);
      if (saved) {
        setMode("draw");
        setCalibrationPointA(null);
        setCalibrationPointB(null);
      } else {
        setCalibrationError(editorState.saveError ?? "Could not save scale");
      }
    },
    [editorState],
  );

  const handleDeleteSelectedSegment = useCallback(() => {
    if (!selectedSegmentId) {
      return;
    }

    const nextSegments = editorState.segments.filter((segment) => segment.id !== selectedSegmentId);
    const nextNodes = removeOrphanNodes(editorState.nodes, nextSegments);
    editorState.deleteSegment(selectedSegmentId, nextNodes);
    setSelectedSegmentId(null);
  }, [editorState, selectedSegmentId]);

  useEffect(() => {
    let cancelled = false;
    pendingPdfDataRef.current = null;

    async function fetchPdf() {
      try {
        const pdfResponse = await fetch(`/api/projects/${projectId}/floor-plan/data`);
        if (!pdfResponse.ok) {
          throw new Error("Could not load floor plan PDF");
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        if (cancelled) {
          return;
        }

        pendingPdfDataRef.current = { pdfBuffer };
        setLoadState("rendering");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(error instanceof Error ? error.message : "Could not load editor");
        }
      }
    }

    void fetchPdf();

    return () => {
      cancelled = true;
      pendingPdfDataRef.current = null;
      void pdfDocumentRef.current?.destroy();
      pdfDocumentRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    if (loadState !== "rendering") {
      return;
    }

    const pendingData = pendingPdfDataRef.current;
    const backgroundCanvas = backgroundCanvasRef.current;
    if (!pendingData || !backgroundCanvas) {
      return;
    }

    const pdfBuffer = pendingData.pdfBuffer;
    const canvas = backgroundCanvas;
    let cancelled = false;

    async function renderPdfToCanvas() {
      try {
        const pdfDocument = await pdfjs.getDocument({ data: pdfBuffer }).promise;
        if (cancelled) {
          void pdfDocument.destroy();
          return;
        }

        pdfDocumentRef.current = pdfDocument;
        const dimensions = await renderPageToCanvas(pdfDocument, canvas, 1);

        setPageDimensions(dimensions);
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(error instanceof Error ? error.message : "Could not load editor");
        }
      }
    }

    void renderPdfToCanvas();

    return () => {
      cancelled = true;
    };
  }, [loadState]);

  useEffect(() => {
    if (!pageDimensions || !overlayCanvasRef.current || !isCalibrating) {
      return;
    }
    drawCalibrationOverlay(overlayCanvasRef.current, pageDimensions, calibrationPointA, calibrationPointB);
  }, [pageDimensions, calibrationPointA, calibrationPointB, isCalibrating]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (mode !== "select" || !selectedSegmentId) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteSelectedSegment();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDeleteSelectedSegment, mode, selectedSegmentId]);

  const updateStartSnapPreview = useCallback(
    (clientX: number, clientY: number) => {
      if (!viewportRef.current) {
        return;
      }

      const pdfPoint = screenToPdfCoords(clientX, clientY, viewportRef.current.getBoundingClientRect(), transform);
      const snap = snapStartPoint(pdfPoint, editorState.nodes, snapThresholdPdf(transform.zoom, SNAP_CLICK_MULTIPLIER));
      setSnapIndicator(snap.nodeId ? snap.point : null);
    },
    [editorState.nodes, transform],
  );

  const updateDrawPreview = useCallback(
    (clientX: number, clientY: number) => {
      if (!drawDraft || !viewportRef.current) {
        return;
      }

      const pdfPoint = screenToPdfCoords(clientX, clientY, viewportRef.current.getBoundingClientRect(), transform);
      const snap = snapOrthogonalEndpoint(
        drawDraft.startPoint,
        pdfPoint,
        editorState.nodes,
        snapThresholdPdf(transform.zoom),
        drawDraft.startNodeId,
      );
      setPreviewEnd(snap.point);
      setSnapIndicator(snap.nodeId ? snap.point : null);
    },
    [drawDraft, editorState.nodes, transform],
  );

  const commitSegment = useCallback(
    (endSnap: SnapResult) => {
      if (!drawDraft || !selectedAssemblyId) {
        return;
      }

      let endPoint = endSnap.point;
      let endNodeId = endSnap.nodeId;

      if (!endNodeId) {
        const merged = resolveNodeAtPoint(
          endPoint,
          editorState.nodes,
          snapThresholdPdf(transform.zoom, SNAP_CLICK_MULTIPLIER),
        );
        if (
          !merged.newNode &&
          merged.nodeId !== drawDraft.startNodeId &&
          isOrthogonalSegment(drawDraft.startPoint, merged.point)
        ) {
          endNodeId = merged.nodeId;
          endPoint = merged.point;
        }
      }

      if (!isOrthogonalSegment(drawDraft.startPoint, endPoint)) {
        return;
      }

      if (distancePx(drawDraft.startPoint, endPoint) <= 0) {
        setDrawDraft(null);
        setPreviewEnd(null);
        setSnapIndicator(null);
        return;
      }

      if (endNodeId && endNodeId === drawDraft.startNodeId) {
        setDrawDraft(null);
        setPreviewEnd(null);
        setSnapIndicator(null);
        return;
      }

      const newNodes: PlanNodeInput[] = [];
      if (!endNodeId) {
        endNodeId = crypto.randomUUID();
        newNodes.push({ id: endNodeId, x: endPoint.x, y: endPoint.y });
      }

      const segment: PlanSegmentInput = {
        id: crypto.randomUUID(),
        start_node_id: drawDraft.startNodeId,
        end_node_id: endNodeId,
        assembly_id: selectedAssemblyId,
      };

      const anchorNodeId = newNodes.length > 0 ? drawDraft.startNodeId : endNodeId;
      editorState.addNodesAndSegment(newNodes, segment, anchorNodeId);
      setDrawDraft(null);
      setPreviewEnd(null);
      setSnapIndicator(null);
    },
    [drawDraft, editorState, selectedAssemblyId, transform.zoom],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      applyZoom(transform.zoom + direction * ZOOM_STEP, { x: event.clientX, y: event.clientY });
    },
    [applyZoom, transform.zoom],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!viewportRef.current) {
        return;
      }

      if (isCalibrating && event.button === 0) {
        const pdfPoint = screenToPdfCoords(
          event.clientX,
          event.clientY,
          viewportRef.current.getBoundingClientRect(),
          transform,
        );

        if (!calibrationPointA) {
          setCalibrationPointA(pdfPoint);
          return;
        }
        if (!calibrationPointB) {
          setCalibrationPointB(pdfPoint);
          return;
        }
        setCalibrationPointA(pdfPoint);
        setCalibrationPointB(null);
        return;
      }

      if (event.button === 1) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
        panStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          panX: transform.panX,
          panY: transform.panY,
        };
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const pdfPoint = screenToPdfCoords(
        event.clientX,
        event.clientY,
        viewportRef.current.getBoundingClientRect(),
        transform,
      );

      if (canDraw) {
        event.currentTarget.setPointerCapture(event.pointerId);

        if (!drawDraft) {
          const startNode = resolveNodeAtPoint(
            pdfPoint,
            editorState.nodes,
            snapThresholdPdf(transform.zoom, SNAP_CLICK_MULTIPLIER),
          );
          if (!startNode.newNode) {
            setDrawDraft({ startNodeId: startNode.nodeId, startPoint: startNode.point });
            setPreviewEnd(startNode.point);
            setSelectedSegmentId(null);
            return;
          }

          editorState.addNode(startNode.newNode);
          setDrawDraft({ startNodeId: startNode.nodeId, startPoint: startNode.point });
          setPreviewEnd(startNode.point);
          setSelectedSegmentId(null);
          return;
        }

        const endSnap = snapOrthogonalEndpoint(
          drawDraft.startPoint,
          pdfPoint,
          editorState.nodes,
          snapThresholdPdf(transform.zoom, SNAP_CLICK_MULTIPLIER),
          drawDraft.startNodeId,
        );
        commitSegment(endSnap);
        return;
      }

      if (mode === "select" && scale) {
        const nearestSegmentId = findNearestSegment(
          pdfPoint,
          editorState.segments,
          editorState.nodes,
          SEGMENT_HIT_THRESHOLD_PX / transform.zoom,
        );
        setSelectedSegmentId(nearestSegmentId);
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: transform.panX,
        panY: transform.panY,
      };
    },
    [
      isCalibrating,
      calibrationPointA,
      calibrationPointB,
      transform,
      canDraw,
      drawDraft,
      editorState,
      commitSegment,
      mode,
      scale,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (drawDraft) {
        updateDrawPreview(event.clientX, event.clientY);
      } else if (canDraw) {
        updateStartSnapPreview(event.clientX, event.clientY);
      }

      const panStart = panStartRef.current;
      if (!isPanning || !panStart) {
        return;
      }

      const deltaX = event.clientX - panStart.x;
      const deltaY = event.clientY - panStart.y;
      setTransform((current) => ({
        ...current,
        panX: panStart.panX + deltaX,
        panY: panStart.panY + deltaY,
      }));
    },
    [canDraw, drawDraft, isPanning, updateDrawPreview, updateStartSnapPreview],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const isInteractive = loadState === "ready";
  const drawPreview = drawDraft && previewEnd ? { start: drawDraft.startPoint, end: previewEnd } : null;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <EditorToolbar
        projectName={projectName}
        projectId={projectId}
        mode={loadState === "ready" ? mode : "calibrate"}
        zoom={transform.zoom}
        saveStatus={saveStatus}
        assemblies={assemblies}
        selectedAssemblyId={selectedAssemblyId}
        selectedSegmentId={selectedSegmentId}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setDrawDraft(null);
          setPreviewEnd(null);
          setSnapIndicator(null);
          if (nextMode !== "select") {
            setSelectedSegmentId(null);
          }
        }}
        onAssemblyChange={setSelectedAssemblyId}
        onDeleteSegment={handleDeleteSelectedSegment}
        drawToolsDisabled={!scale}
        onZoomIn={() => {
          applyZoom(transform.zoom + ZOOM_STEP);
        }}
        onZoomOut={() => {
          applyZoom(transform.zoom - ZOOM_STEP);
        }}
        onZoomReset={() => {
          setTransform({ panX: 0, panY: 0, zoom: 1 });
        }}
      />

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={viewportRef}
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden bg-slate-900",
            !isInteractive && "pointer-events-none",
            isCalibrating || canDraw ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
          onWheel={isInteractive ? handleWheel : undefined}
          onPointerDown={isInteractive ? handlePointerDown : undefined}
          onPointerMove={isInteractive ? handlePointerMove : undefined}
          onPointerUp={isInteractive ? handlePointerUp : undefined}
          onPointerCancel={isInteractive ? handlePointerUp : undefined}
          onPointerLeave={
            isInteractive
              ? () => {
                  if (!drawDraft) {
                    setSnapIndicator(null);
                  }
                }
              : undefined
          }
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            }}
          >
            <canvas ref={backgroundCanvasRef} className="block" />
            {isCalibrating ? (
              <canvas ref={overlayCanvasRef} className="pointer-events-none absolute top-0 left-0 block" />
            ) : (
              pageDimensions && (
                <PlanOverlayCanvas
                  dimensions={pageDimensions}
                  nodes={editorState.nodes}
                  segments={editorState.segments}
                  assemblies={assemblies}
                  selectedSegmentId={selectedSegmentId}
                  drawPreview={drawPreview}
                  snapIndicator={snapIndicator}
                />
              )
            )}
          </div>
        </div>

        {isCalibrating && (
          <ScaleCalibrationPanel
            pointA={calibrationPointA}
            pointB={calibrationPointB}
            onSubmit={(knownLengthM) => {
              if (calibrationPointA && calibrationPointB) {
                void saveScale(calibrationPointA, calibrationPointB, knownLengthM);
              }
            }}
            isSaving={saveStatus === "saving"}
            errorMessage={calibrationError}
          />
        )}

        {loadState !== "ready" && loadState !== "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 text-sm text-blue-100/70">
            Loading floor plan…
          </div>
        )}

        {loadState === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center">
            <p className="text-sm text-red-300" role="alert">
              {loadError ?? "Could not load editor"}
            </p>
            <a
              href={`/projects/${projectId}`}
              className="text-sm text-purple-300 hover:text-purple-100 hover:underline"
            >
              ← Back to project
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FloorPlanEditor({
  projectId,
  projectName,
  assemblies,
  initialScale: _initialScale,
}: FloorPlanEditorProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialEditorData, setInitialEditorData] = useState<EditorStatePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEditorData() {
      try {
        const editorResponse = await fetch(`/api/projects/${projectId}/editor`);
        if (!editorResponse.ok) {
          throw new Error("Could not load editor state");
        }

        const editorBody = (await editorResponse.json()) as EditorApiResponse;
        if (cancelled) {
          return;
        }

        setInitialEditorData(editorBody.data);
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(error instanceof Error ? error.message : "Could not load editor");
        }
      }
    }

    void fetchEditorData();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loadState === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white">
        <p className="text-sm text-red-300" role="alert">
          {loadError ?? "Could not load editor"}
        </p>
        <a href={`/projects/${projectId}`} className="text-sm text-purple-300 hover:text-purple-100 hover:underline">
          ← Back to project
        </a>
      </div>
    );
  }

  if (loadState !== "ready" || !initialEditorData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-sm text-blue-100/70">
        Loading editor…
      </div>
    );
  }

  return (
    <FloorPlanEditorLoaded
      projectId={projectId}
      projectName={projectName}
      assemblies={assemblies}
      initialScale={initialEditorData.scale}
      initialEditorData={initialEditorData}
    />
  );
}
