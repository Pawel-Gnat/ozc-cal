import { getAssemblyCategoryLabel } from "@/lib/assemblies/category-labels";
import type { EditorAssemblySummary } from "@/lib/projects/resolve-project-editor";
import { selectClass } from "@/lib/ui/form-classes";
import { cn } from "@/lib/utils";
import { ASSEMBLY_CATEGORIES, type AssemblyCategory } from "@/types";

interface AssemblyPickerProps {
  assemblies: EditorAssemblySummary[];
  value: string | null;
  onChange: (assemblyId: string) => void;
  disabled?: boolean;
}

export function AssemblyPicker({ assemblies, value, onChange, disabled = false }: AssemblyPickerProps) {
  const assembliesByCategory = ASSEMBLY_CATEGORIES.reduce<Record<AssemblyCategory, EditorAssemblySummary[]>>(
    (acc, category) => {
      acc[category] = assemblies.filter((assembly) => assembly.category === category);
      return acc;
    },
    {} as Record<AssemblyCategory, EditorAssemblySummary[]>,
  );

  return (
    <label className={cn("text-muted-foreground flex items-center gap-2 text-sm", disabled && "opacity-50")}>
      <span className="hidden sm:inline">Assembly</span>
      <select
        className={cn(selectClass, "min-w-[12rem] py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50")}
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value) {
            onChange(event.target.value);
          }
        }}
        disabled={disabled}
        aria-label="Select assembly for new segment"
      >
        <option value="" disabled>
          Choose assembly…
        </option>
        {ASSEMBLY_CATEGORIES.map((category) => {
          const categoryAssemblies = assembliesByCategory[category];
          if (categoryAssemblies.length === 0) {
            return null;
          }

          return (
            <optgroup key={category} label={getAssemblyCategoryLabel(category)}>
              {categoryAssemblies.map((assembly) => (
                <option key={assembly.id} value={assembly.id}>
                  {assembly.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
}
