import { Minus, MousePointer2, Pencil, Plus, RotateCcw, Square, Trash2 } from "lucide-react";

import { AssemblyPicker } from "@/components/editor/AssemblyPicker";
import { Button } from "@/components/ui/button";
import { linkClass } from "@/lib/ui/form-classes";
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
    <header className="border-border bg-background/95 flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <a href={`/projects/${projectId}`} className={cn(linkClass, "shrink-0 text-sm")}>
          ← Back
        </a>
        <h1 className="text-foreground truncate text-sm font-medium">{projectName}</h1>
        {!drawToolsDisabled && (
          <a
            href={`/api/projects/${projectId}/floor-plan`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs transition-colors hover:underline"
          >
            Open PDF
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "calibrate" ? (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-sm text-amber-900">
            {MODE_LABELS.calibrate}
          </span>
        ) : (
          <>
            <div className="border-border bg-muted/50 flex items-center gap-1 rounded-md border p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  mode === "draw"
                    ? "bg-accent text-accent-foreground hover:bg-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                    ? "bg-accent text-accent-foreground hover:bg-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                    ? "bg-accent text-accent-foreground hover:bg-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 gap-1.5 px-2 text-xs"
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
          className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 w-8"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-muted-foreground w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 w-8"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 w-8"
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
            saveStatus === "error"
              ? "text-destructive"
              : saveStatus === "saved"
                ? "text-emerald-700"
                : "text-muted-foreground",
          )}
          role="status"
        >
          {saveLabel}
        </span>
      )}
    </header>
  );
}
