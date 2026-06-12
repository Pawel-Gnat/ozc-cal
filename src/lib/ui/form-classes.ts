import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors";

export const inputWithIconClass = cn(inputClass, "pl-10");

export const selectClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors";

export const labelClass = "mb-1 block text-sm text-muted-foreground";

export const iconMutedClass = "text-muted-foreground";

export const panelClass = "rounded-lg border border-border bg-card p-6";

export const sectionHeadingClass = "text-lg font-medium text-foreground";

export const linkClass = "text-primary hover:underline";
