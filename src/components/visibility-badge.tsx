import { Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function VisibilityBadge({
  visibility,
  className,
}: {
  visibility: string | null | undefined;
  className?: string;
}) {
  const isShared = visibility === "shared";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px]",
        isShared
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {isShared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {isShared ? "Shared" : "Personal"}
    </Badge>
  );
}
