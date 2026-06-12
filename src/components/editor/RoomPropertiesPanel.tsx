import { useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/lib/ui/form-classes";
import type { EditorRoomState } from "@/lib/services/project-editor";

interface RoomPropertiesPanelProps {
  room: EditorRoomState;
  onUpdate: (updates: Partial<EditorRoomState>) => void;
  onDelete: () => void;
  onClose: () => void;
}

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
    <aside className="border-border bg-card w-72 shrink-0 border-l p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-foreground text-sm font-medium">Room properties</h2>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs"
          onClick={onClose}
          aria-label="Close room properties"
        >
          Close
        </button>
      </div>

      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        Ventilation values are stored for the OZC calculation (F-03). Units follow the simplified model defined there.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="room_name" className={labelClass}>
            Name (optional)
          </label>
          <input
            id="room_name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={inputClass}
            placeholder="e.g. Living room"
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor="internal_temp_c" className={labelClass}>
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
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ventilation_supply" className={labelClass}>
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
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="ventilation_exhaust" className={labelClass}>
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
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="ventilation_natural" className={labelClass}>
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
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        {validationError && (
          <p className="text-destructive text-xs" role="alert">
            {validationError}
          </p>
        )}

        <Button type="submit" className="w-full">
          Save room
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full text-xs"
          onClick={onDelete}
        >
          Delete room
        </Button>
      </form>
    </aside>
  );
}
