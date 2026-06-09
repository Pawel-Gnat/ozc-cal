import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RoomCreationPromptProps {
  detectedLoops: string[][];
  manualSegmentIds: string[];
  manualMode: boolean;
  isCreating: boolean;
  errorMessage?: string;
  onToggleManualMode: () => void;
  onCreateFromLoop: (segmentIds: string[]) => void;
  onCreateFromManualSelection: () => void;
  onClearManualSelection: () => void;
}

export function RoomCreationPrompt({
  detectedLoops,
  manualSegmentIds,
  manualMode,
  isCreating,
  errorMessage,
  onToggleManualMode,
  onCreateFromLoop,
  onCreateFromManualSelection,
  onClearManualSelection,
}: RoomCreationPromptProps) {
  const manualSelectionValid = manualSegmentIds.length >= 3;

  return (
    <aside className="w-72 shrink-0 border-l border-white/10 bg-slate-950/90 p-4 backdrop-blur-sm">
      <h2 className="text-sm font-medium text-white">Rooms</h2>
      <p className="mt-2 text-xs leading-relaxed text-blue-100/60">
        Closed wall loops can become rooms. Shared internal walls between two rooms require two colocated segments in
        this MVP — assign each segment to one room only.
      </p>

      {detectedLoops.length > 0 && !manualMode && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-blue-100/80">Detected loops</p>
          {detectedLoops.map((segmentIds, index) => (
            <div
              key={segmentIds.join("-")}
              className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-2"
            >
              <span className="text-xs text-blue-100/70">
                Loop {index + 1} · {segmentIds.length} segments
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 bg-purple-600 px-2 text-xs text-white hover:bg-purple-500"
                disabled={isCreating}
                onClick={() => {
                  onCreateFromLoop(segmentIds);
                }}
              >
                Create room
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-full justify-start px-2 text-xs",
            manualMode
              ? "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
              : "text-blue-100/70 hover:bg-white/10 hover:text-white",
          )}
          onClick={onToggleManualMode}
        >
          {manualMode ? "Exit manual selection" : "Select segments manually"}
        </Button>

        {manualMode && (
          <div className="space-y-2">
            <p className="text-xs text-blue-100/70">
              Click segments on the plan to build a closed chain ({manualSegmentIds.length} selected).
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 flex-1 bg-purple-600 text-xs text-white hover:bg-purple-500"
                disabled={!manualSelectionValid || isCreating}
                onClick={onCreateFromManualSelection}
              >
                Create room
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-100/70 hover:bg-white/10"
                disabled={manualSegmentIds.length === 0 || isCreating}
                onClick={onClearManualSelection}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 text-xs text-red-300" role="alert">
          {errorMessage}
        </p>
      )}
    </aside>
  );
}
