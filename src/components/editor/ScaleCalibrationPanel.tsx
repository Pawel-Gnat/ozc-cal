import { useState } from "react";

import { Button } from "@/components/ui/button";
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

const inputClassName =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

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
    <aside className="w-72 shrink-0 border-l border-white/10 bg-slate-950/90 p-4 backdrop-blur-sm">
      <h2 className="text-sm font-medium text-white">Scale calibration</h2>
      <p className="mt-2 text-xs leading-relaxed text-blue-100/60">
        Click two points on a known dimension in the plan, then enter the real-world distance in metres. Drawing stays
        disabled until scale is saved.
      </p>

      <ol className="mt-4 space-y-2 text-xs text-blue-100/70">
        <li className={cn(pointA && "text-emerald-200")}>
          1. First point {pointA ? `(${pointA.x.toFixed(0)}, ${pointA.y.toFixed(0)})` : "— click on plan"}
        </li>
        <li className={cn(pointB && "text-emerald-200")}>
          2. Second point {pointB ? `(${pointB.x.toFixed(0)}, ${pointB.y.toFixed(0)})` : "— click on plan"}
        </li>
        <li>3. Enter known length and save</li>
      </ol>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div>
          <label htmlFor="known_length_m" className="mb-1 block text-xs text-blue-100/80">
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
            className={inputClassName}
            placeholder="e.g. 3.5"
          />
        </div>

        {displayError && (
          <p className="text-xs text-red-300" role="alert">
            {displayError}
          </p>
        )}

        <Button
          type="submit"
          disabled={!pointsReady || isSaving}
          className="w-full bg-purple-600 text-white hover:bg-purple-500"
        >
          {isSaving ? "Saving scale…" : "Save scale"}
        </Button>
      </form>
    </aside>
  );
}
