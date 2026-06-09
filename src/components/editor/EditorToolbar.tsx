import { Minus, MousePointer2, Pencil, Plus, RotateCcw, Square, Trash2 } from "lucide-react";

import { AssemblyPicker } from "@/components/editor/AssemblyPicker";
import { Button } from "@/components/ui/button";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import { cn } from "@/lib/utils";

export type EditorMode = "calibrate" | "draw" | "select" | "create-room";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorToolbarProps {
  projectName: string;
  projectId: string;
  mode: EditorMode;
  zoom: number;
  saveStatus: SaveStatus;
  assemblies: EditorAssemblySummary[];
  selectedAssemblyId: string | null;
  selectedSegmentId: string | null;
  onModeChange: (mode: EditorMode) => void;
  onAssemblyChange: (assemblyId: string) => void;
  onDeleteSegment: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  drawToolsDisabled?: boolean;
}

const MODE_LABELS: Record<EditorMode, string> = {
  calibrate: "Scale calibration",
  draw: "Draw segment",
  select: "Select",
  "create-room": "Create room",
};

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function EditorToolbar({
  projectName,
  projectId,
  mode,
  zoom,
  saveStatus,
  assemblies,
  selectedAssemblyId,
  selectedSegmentId,
  onModeChange,
  onAssemblyChange,
  onDeleteSegment,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  drawToolsDisabled = false,
}: EditorToolbarProps) {
  const saveLabel = SAVE_STATUS_LABELS[saveStatus];
  const toolsEnabled = !drawToolsDisabled && mode !== "calibrate";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <a
          href={`/projects/${projectId}`}
          className="shrink-0 text-sm text-purple-300 transition-colors hover:text-purple-100 hover:underline"
        >
          ← Back
        </a>
        <h1 className="truncate text-sm font-medium text-white">{projectName}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "calibrate" ? (
          <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-sm text-amber-100">
            {MODE_LABELS.calibrate}
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  mode === "draw"
                    ? "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                    : "text-blue-100/70 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => {
                  onModeChange("draw");
                }}
                disabled={!toolsEnabled}
                aria-pressed={mode === "draw"}
              >
                <Pencil className="h-3.5 w-3.5" />
                Segment
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  mode === "select"
                    ? "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                    : "text-blue-100/70 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => {
                  onModeChange("select");
                }}
                disabled={!toolsEnabled}
                aria-pressed={mode === "select"}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Select
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  mode === "create-room"
                    ? "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                    : "text-blue-100/70 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => {
                  onModeChange("create-room");
                }}
                disabled={!toolsEnabled}
                aria-pressed={mode === "create-room"}
              >
                <Square className="h-3.5 w-3.5" />
                Room
              </Button>
            </div>

            <AssemblyPicker
              assemblies={assemblies}
              value={selectedAssemblyId}
              onChange={onAssemblyChange}
              disabled={!toolsEnabled || mode !== "draw"}
            />

            {mode === "select" && selectedSegmentId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                onClick={onDeleteSegment}
                aria-label="Delete selected segment"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-100/80 hover:bg-white/10 hover:text-white"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs text-blue-100/60">{Math.round(zoom * 100)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-100/80 hover:bg-white/10 hover:text-white"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-100/80 hover:bg-white/10 hover:text-white"
          onClick={onZoomReset}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {saveLabel && (
        <span
          className={cn(
            "text-xs",
            saveStatus === "error" ? "text-red-300" : saveStatus === "saved" ? "text-emerald-300" : "text-blue-100/60",
          )}
          role="status"
        >
          {saveLabel}
        </span>
      )}
    </header>
  );
}
