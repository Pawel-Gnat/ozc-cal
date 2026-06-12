import { useCallback, useState } from "react";
import { Calculator, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiErrorBody, ApiErrorIssue, ApiSuccessBody } from "@/lib/api/json-response";
import type { OzcCalcResultDisplay } from "@/lib/thermal/calc-display";

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
      const body = (await response.json()) as ApiSuccessBody<OzcCalcResultDisplay> | ApiErrorBody;

      if (!response.ok) {
        const errorBody = body as ApiErrorBody;
        setStatus("error");
        setResult(null);
        setErrorMessage(errorBody.error.message);
        setIssues(errorBody.error.issues ?? null);
        return;
      }

      const successBody = body as ApiSuccessBody<OzcCalcResultDisplay>;
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
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 backdrop-blur-xl">
          <p className="flex items-center gap-2 text-sm font-medium text-red-200">
            <CircleAlert className="size-4 shrink-0" />
            {errorMessage}
          </p>
          {issues && issues.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-200/90">
              {issues.map((issue, index) => (
                <li key={`${issue.path.join(".")}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === "success" && result && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-blue-100/70">
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Transmission (W)</th>
                  <th className="px-4 py-3 font-medium">Ventilation (W)</th>
                  <th className="px-4 py-3 font-medium">Total (W)</th>
                </tr>
              </thead>
              <tbody>
                {result.rooms.map((room) => (
                  <tr key={room.roomId} className="border-b border-white/5 last:border-b-0">
                    <td className="px-4 py-3 text-white">{roomDisplayName(room.name, room.roomId)}</td>
                    <td className="px-4 py-3 text-emerald-200">{formatWatts(room.transmissionW)}</td>
                    <td className="px-4 py-3 text-emerald-200">{formatWatts(room.ventilationW)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-100">{formatWatts(room.totalW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white">Building summary</h3>
            <p className="mt-1 text-xs text-blue-100/60">Sum of room heat losses</p>
            <p className="mt-1 text-xs text-blue-100/50">
              Totals add each room&apos;s transmission and ventilation losses. Internal partitions with duplicate
              colocated segments count on both owning rooms — this is not net building envelope loss.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-blue-100/60">Transmission (W)</dt>
                <dd className="mt-1 text-lg font-medium text-emerald-200">
                  {formatWatts(result.buildingTransmissionW)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-blue-100/60">Ventilation (W)</dt>
                <dd className="mt-1 text-lg font-medium text-emerald-200">
                  {formatWatts(result.buildingVentilationW)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-blue-100/60">Total (W)</dt>
                <dd className="mt-1 text-lg font-medium text-emerald-100">{formatWatts(result.buildingTotalW)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
