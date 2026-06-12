import { useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/lib/ui/form-classes";
import { cn } from "@/lib/utils";

export interface CalibrationPoint {
  x: number;
  y: number;
}

interface ScaleCalibrationPanelProps {
  pointA: CalibrationPoint | null;
  pointB: CalibrationPoint | null;
  onSubmit: (knownLengthM: number) => void;
  isSaving: boolean;
  errorMessage?: string;
}

export function ScaleCalibrationPanel({
  pointA,
  pointB,
  onSubmit,
  isSaving,
  errorMessage,
}: ScaleCalibrationPanelProps) {
  const [knownLength, setKnownLength] = useState("");
  const [validationError, setValidationError] = useState<string | undefined>();

  const pointsReady = pointA !== null && pointB !== null;
  const displayError = validationError ?? errorMessage;

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(knownLength);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValidationError("Enter a known length greater than 0 metres");
      return;
    }
    setValidationError(undefined);
    onSubmit(parsed);
  }

  return (
    <aside className="border-border bg-card w-72 shrink-0 border-l p-4">
      <h2 className="text-foreground text-sm font-medium">Scale calibration</h2>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        Click two points on a known dimension in the plan, then enter the real-world distance in metres. Drawing stays
        disabled until scale is saved.
      </p>

      <ol className="text-muted-foreground mt-4 space-y-2 text-xs">
        <li className={cn(pointA && "text-emerald-700")}>
          1. First point {pointA ? `(${pointA.x.toFixed(0)}, ${pointA.y.toFixed(0)})` : "— click on plan"}
        </li>
        <li className={cn(pointB && "text-emerald-700")}>
          2. Second point {pointB ? `(${pointB.x.toFixed(0)}, ${pointB.y.toFixed(0)})` : "— click on plan"}
        </li>
        <li>3. Enter known length and save</li>
      </ol>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div>
          <label htmlFor="known_length_m" className={labelClass}>
            Known length (m)
          </label>
          <input
            id="known_length_m"
            type="number"
            min="0.001"
            step="any"
            value={knownLength}
            onChange={(event) => {
              setKnownLength(event.target.value);
            }}
            disabled={!pointsReady || isSaving}
            className={inputClass}
            placeholder="e.g. 3.5"
          />
        </div>

        {displayError && (
          <p className="text-destructive text-xs" role="alert">
            {displayError}
          </p>
        )}

        <Button type="submit" disabled={!pointsReady || isSaving} className="w-full">
          {isSaving ? "Saving scale…" : "Save scale"}
        </Button>
      </form>
    </aside>
  );
}
