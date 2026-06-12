import { useCallback, useState } from "react";
import { Calculator, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { panelClass } from "@/lib/ui/form-classes";
import type { ApiErrorBody, ApiErrorIssue, ApiSuccessBody } from "@/lib/api/json-response";
import type { OzcCalcResultDisplay } from "@/lib/thermal/calc-display";
import { cn } from "@/lib/utils";

interface OzcCalculationPanelProps {
  projectId: string;
}

type PanelStatus = "idle" | "loading" | "success" | "error";

function formatWatts(value: number): string {
  return String(Math.round(value));
}

function roomDisplayName(name: string | null, roomId: string): string {
  if (name?.trim()) {
    return name.trim();
  }
  return `Room ${roomId.slice(0, 8)}`;
}

export default function OzcCalculationPanel({ projectId }: OzcCalculationPanelProps) {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [result, setResult] = useState<OzcCalcResultDisplay | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<ApiErrorIssue[] | null>(null);

  const runCalculation = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setIssues(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/calc`, { method: "POST" });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setStatus("error");
        setResult(null);
        setErrorMessage(errorBody?.error.message ?? "Could not run calculation. Please try again.");
        setIssues(errorBody?.error.issues ?? null);
        return;
      }

      const successBody = (await response.json()) as ApiSuccessBody<OzcCalcResultDisplay>;
      setStatus("success");
      setResult(successBody.data);
    } catch {
      setStatus("error");
      setResult(null);
      setErrorMessage("Could not run calculation. Please try again.");
      setIssues(null);
    }
  }, [projectId]);

  const isLoading = status === "loading";

  return (
    <div className="space-y-6">
      <div>
        <Button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void runCalculation();
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              Calculating…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Calculator className="size-4" />
              Run calculation
            </span>
          )}
        </Button>
      </div>

      {status === "error" && errorMessage && (
        <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-4" role="alert">
          <p className="text-destructive flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="size-4 shrink-0" />
            {errorMessage}
          </p>
          {issues && issues.length > 0 && (
            <ul className="text-destructive mt-3 list-disc space-y-1 pl-5 text-sm">
              {issues.map((issue, index) => (
                <li key={`${issue.path.join(".")}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === "success" && result && (
        <div className="space-y-6">
          <div className={cn(panelClass, "overflow-x-auto p-0 shadow-sm")}>
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-border bg-muted text-muted-foreground border-b">
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Transmission (W)</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Ventilation (W)</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Total (W)</th>
                </tr>
              </thead>
              <tbody>
                {result.rooms.map((room) => (
                  <tr key={room.roomId} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">{roomDisplayName(room.name, room.roomId)}</td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatWatts(room.transmissionW)}</td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatWatts(room.ventilationW)}</td>
                    <td className="text-foreground px-4 py-3 font-medium tabular-nums">{formatWatts(room.totalW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={cn(panelClass, "shadow-sm")}>
            <h3 className="text-foreground text-sm font-medium">Building summary</h3>
            <p className="text-muted-foreground mt-1 text-xs">Sum of room heat losses</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Totals add each room&apos;s transmission and ventilation losses. Internal partitions with duplicate
              colocated segments count on both owning rooms — this is not net building envelope loss.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Transmission (W)</dt>
                <dd className="text-foreground mt-1 text-lg font-medium tabular-nums">
                  {formatWatts(result.buildingTransmissionW)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Ventilation (W)</dt>
                <dd className="text-foreground mt-1 text-lg font-medium tabular-nums">
                  {formatWatts(result.buildingVentilationW)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Total (W)</dt>
                <dd className="text-foreground mt-1 text-lg font-medium tabular-nums">
                  {formatWatts(result.buildingTotalW)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
