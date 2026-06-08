import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { EditorToolbar, type EditorMode, type SaveStatus } from "@/components/editor/EditorToolbar";
import { ScaleCalibrationPanel, type CalibrationPoint } from "@/components/editor/ScaleCalibrationPanel";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import { renderPageToCanvas } from "@/lib/pdf/render-page-to-canvas";
import { pdfjs } from "@/lib/pdf/setup-pdfjs";
import type { EditorScaleState, EditorStatePayload } from "@/lib/services/project-editor";
import { cn } from "@/lib/utils";

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

interface EditorApiError {
  error: { message: string; code: string };
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

function distancePx(a: CalibrationPoint, b: CalibrationPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function screenToPdfCoords(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  transform: ViewTransform,
): CalibrationPoint {
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

export default function FloorPlanEditor({
  projectId,
  projectName,
  assemblies: _assemblies,
  initialScale,
}: FloorPlanEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [loadState, setLoadState] = useState<"loading" | "rendering" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState<EditorScaleState | null>(initialScale);
  const [mode, setMode] = useState<EditorMode>(initialScale ? "draw" : "calibrate");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [calibrationError, setCalibrationError] = useState<string | undefined>();
  const [calibrationPointA, setCalibrationPointA] = useState<CalibrationPoint | null>(null);
  const [calibrationPointB, setCalibrationPointB] = useState<CalibrationPoint | null>(null);
  const [transform, setTransform] = useState<ViewTransform>({ panX: 0, panY: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pendingPdfDataRef = useRef<{ pdfBuffer: ArrayBuffer; editorBody: EditorApiResponse } | null>(null);

  const isCalibrating = mode === "calibrate" && loadState === "ready";

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

      setSaveStatus("saving");
      setCalibrationError(undefined);

      try {
        const response = await fetch(`/api/projects/${projectId}/editor`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scale: scalePayload,
            nodes: [],
            segments: [],
            rooms: [],
          }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as EditorApiError | null;
          const message = errorBody ? errorBody.error.message : "Could not save scale";
          throw new Error(message);
        }

        const body = (await response.json()) as EditorApiResponse;
        setScale(body.data.scale);
        setMode("draw");
        setSaveStatus("saved");
        setCalibrationPointA(null);
        setCalibrationPointB(null);
      } catch (error) {
        setSaveStatus("error");
        setCalibrationError(error instanceof Error ? error.message : "Could not save scale");
      }
    },
    [projectId],
  );

  useEffect(() => {
    let cancelled = false;
    pendingPdfDataRef.current = null;

    async function fetchEditorData() {
      try {
        const [pdfResponse, editorResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}/floor-plan/data`),
          fetch(`/api/projects/${projectId}/editor`),
        ]);

        if (!pdfResponse.ok) {
          throw new Error("Could not load floor plan PDF");
        }
        if (!editorResponse.ok) {
          throw new Error("Could not load editor state");
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        const editorBody = (await editorResponse.json()) as EditorApiResponse;

        if (cancelled) {
          return;
        }

        pendingPdfDataRef.current = { pdfBuffer, editorBody };
        setScale(editorBody.data.scale);
        setMode(editorBody.data.scale ? "draw" : "calibrate");
        setLoadState("rendering");
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
    if (!pageDimensions || !overlayCanvasRef.current) {
      return;
    }
    drawCalibrationOverlay(
      overlayCanvasRef.current,
      pageDimensions,
      isCalibrating ? calibrationPointA : null,
      isCalibrating ? calibrationPointB : null,
    );
  }, [pageDimensions, calibrationPointA, calibrationPointB, isCalibrating]);

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

      if (event.button === 0 || event.button === 1) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
        panStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          panX: transform.panX,
          panY: transform.panY,
        };
      }
    },
    [isCalibrating, calibrationPointA, calibrationPointB, transform],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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
    [isPanning],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const isInteractive = loadState === "ready";

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <EditorToolbar
        projectName={projectName}
        projectId={projectId}
        mode={loadState === "ready" ? mode : "calibrate"}
        zoom={transform.zoom}
        saveStatus={saveStatus}
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
            isCalibrating ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
          onWheel={isInteractive ? handleWheel : undefined}
          onPointerDown={isInteractive ? handlePointerDown : undefined}
          onPointerMove={isInteractive ? handlePointerMove : undefined}
          onPointerUp={isInteractive ? handlePointerUp : undefined}
          onPointerCancel={isInteractive ? handlePointerUp : undefined}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            }}
          >
            <canvas ref={backgroundCanvasRef} className="block" />
            <canvas ref={overlayCanvasRef} className="pointer-events-none absolute top-0 left-0 block" />
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
