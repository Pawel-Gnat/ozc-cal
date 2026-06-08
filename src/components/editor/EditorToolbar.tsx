import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EditorMode = "calibrate" | "draw" | "select";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorToolbarProps {
  projectName: string;
  projectId: string;
  mode: EditorMode;
  zoom: number;
  saveStatus: SaveStatus;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  drawToolsDisabled?: boolean;
}

const MODE_LABELS: Record<EditorMode, string> = {
  calibrate: "Scale calibration",
  draw: "Draw",
  select: "Select",
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
  onZoomIn,
  onZoomOut,
  onZoomReset,
  drawToolsDisabled = false,
}: EditorToolbarProps) {
  const saveLabel = SAVE_STATUS_LABELS[saveStatus];

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-slate-950/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <a
          href={`/projects/${projectId}`}
          className="shrink-0 text-sm text-purple-300 transition-colors hover:text-purple-100 hover:underline"
        >
          ← Back
        </a>
        <h1 className="truncate text-sm font-medium text-white">{projectName}</h1>
      </div>

      <div className="flex items-center gap-2 text-sm text-blue-100/70">
        <span
          className={cn(
            "rounded-md border px-2 py-1",
            mode === "calibrate"
              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
              : "border-white/10 bg-white/5 text-blue-100/80",
          )}
        >
          {MODE_LABELS[mode]}
        </span>
        {drawToolsDisabled && mode !== "calibrate" && (
          <span className="hidden text-xs text-blue-100/50 sm:inline">Drawing tools coming next</span>
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
