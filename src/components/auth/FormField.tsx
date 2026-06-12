import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { iconMutedClass, inputWithIconClass, labelClass } from "@/lib/ui/form-classes";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <span className={cn("absolute top-1/2 left-3 size-4 -translate-y-1/2", iconMutedClass)}>{icon}</span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={cn(inputWithIconClass, error && "border-destructive/60 focus-visible:ring-destructive")}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
