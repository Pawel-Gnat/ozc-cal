import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { EditorRoomState } from "@/lib/services/project-editor";

interface RoomPropertiesPanelProps {
  room: EditorRoomState;
  onUpdate: (updates: Partial<EditorRoomState>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const inputClassName =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RoomPropertiesPanel({ room, onUpdate, onDelete, onClose }: RoomPropertiesPanelProps) {
  const [name, setName] = useState(room.name ?? "");
  const [internalTemp, setInternalTemp] = useState(String(room.internal_temp_c));
  const [supply, setSupply] = useState(room.ventilation_supply == null ? "" : String(room.ventilation_supply));
  const [exhaust, setExhaust] = useState(room.ventilation_exhaust == null ? "" : String(room.ventilation_exhaust));
  const [natural, setNatural] = useState(room.ventilation_natural == null ? "" : String(room.ventilation_natural));
  const [validationError, setValidationError] = useState<string | undefined>();

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedTemp = Number(internalTemp);
    if (!Number.isFinite(parsedTemp) || parsedTemp < 5 || parsedTemp > 35) {
      setValidationError("Internal temperature must be between 5°C and 35°C");
      return;
    }

    setValidationError(undefined);
    onUpdate({
      name: name.trim() === "" ? null : name.trim(),
      internal_temp_c: parsedTemp,
      ventilation_supply: parseOptionalNumber(supply),
      ventilation_exhaust: parseOptionalNumber(exhaust),
      ventilation_natural: parseOptionalNumber(natural),
    });
  }

  return (
    <aside className="w-72 shrink-0 border-l border-white/10 bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-white">Room properties</h2>
        <button
          type="button"
          className="text-xs text-blue-100/60 hover:text-white"
          onClick={onClose}
          aria-label="Close room properties"
        >
          Close
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-blue-100/60">
        Ventilation values are stored for the OZC calculation (F-03). Units follow the simplified model defined there.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="room_name" className="mb-1 block text-xs text-blue-100/80">
            Name (optional)
          </label>
          <input
            id="room_name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={inputClassName}
            placeholder="e.g. Living room"
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor="internal_temp_c" className="mb-1 block text-xs text-blue-100/80">
            Internal temperature (°C)
          </label>
          <input
            id="internal_temp_c"
            type="number"
            min="5"
            max="35"
            step="0.1"
            required
            value={internalTemp}
            onChange={(event) => {
              setInternalTemp(event.target.value);
            }}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="ventilation_supply" className="mb-1 block text-xs text-blue-100/80">
            Supply
          </label>
          <input
            id="ventilation_supply"
            type="number"
            step="any"
            value={supply}
            onChange={(event) => {
              setSupply(event.target.value);
            }}
            className={inputClassName}
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="ventilation_exhaust" className="mb-1 block text-xs text-blue-100/80">
            Exhaust
          </label>
          <input
            id="ventilation_exhaust"
            type="number"
            step="any"
            value={exhaust}
            onChange={(event) => {
              setExhaust(event.target.value);
            }}
            className={inputClassName}
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="ventilation_natural" className="mb-1 block text-xs text-blue-100/80">
            Natural
          </label>
          <input
            id="ventilation_natural"
            type="number"
            step="any"
            value={natural}
            onChange={(event) => {
              setNatural(event.target.value);
            }}
            className={inputClassName}
            placeholder="Optional"
          />
        </div>

        {validationError && (
          <p className="text-xs text-red-300" role="alert">
            {validationError}
          </p>
        )}

        <Button type="submit" className="w-full bg-purple-600 text-white hover:bg-purple-500">
          Save room
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
          onClick={onDelete}
        >
          Delete room
        </Button>
      </form>
    </aside>
  );
}
