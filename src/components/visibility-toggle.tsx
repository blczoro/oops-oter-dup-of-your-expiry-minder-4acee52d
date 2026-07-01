import { Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function VisibilityToggle({
  value,
  onChange,
  className,
}: {
  value: "personal" | "shared";
  onChange: (v: "personal" | "shared") => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs",
        className,
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "personal"}
        onClick={() => onChange("personal")}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors",
          value === "personal"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Lock className="h-3 w-3" /> Personal
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "shared"}
        onClick={() => onChange("shared")}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors",
          value === "shared"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Users className="h-3 w-3" /> Shared
      </button>
    </div>
  );
}
