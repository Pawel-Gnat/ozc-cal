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
    <aside className="border-border bg-card w-72 shrink-0 border-l p-4">
      <h2 className="text-foreground text-sm font-medium">Rooms</h2>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        Closed wall loops can become rooms. Shared internal walls between two rooms require two colocated segments in
        this MVP — assign each segment to one room only.
      </p>

      {detectedLoops.length > 0 && !manualMode && (
        <div className="mt-4 space-y-2">
          <p className="text-foreground text-xs font-medium">Detected loops</p>
          {detectedLoops.map((segmentIds, index) => (
            <div
              key={segmentIds.join("-")}
              className="border-border bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-2 py-2"
            >
              <span className="text-muted-foreground text-xs">
                Loop {index + 1} · {segmentIds.length} segments
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
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
              ? "bg-accent text-accent-foreground hover:bg-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={onToggleManualMode}
        >
          {manualMode ? "Exit manual selection" : "Select segments manually"}
        </Button>

        {manualMode && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Click segments on the plan to build a closed chain ({manualSegmentIds.length} selected).
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 flex-1 text-xs"
                disabled={!manualSelectionValid || isCreating}
                onClick={onCreateFromManualSelection}
              >
                Create room
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted h-7 px-2 text-xs"
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
        <p className="text-destructive mt-3 text-xs" role="alert">
          {errorMessage}
        </p>
      )}
    </aside>
  );
}
