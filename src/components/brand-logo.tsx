import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  /** Render as inline-flex (default) or block stacked */
  size?: "sm" | "md" | "lg";
  /** Hide the subtitle (use in very tight spaces). */
  hideSubtitle?: boolean;
}

const SIZES = {
  sm: { title: "text-sm", sub: "text-[9px]" },
  md: { title: "text-base", sub: "text-[10px]" },
  lg: { title: "text-2xl", sub: "text-xs" },
} as const;

export function BrandLogo({ className, size = "md", hideSubtitle }: BrandLogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex flex-col items-start leading-none", className)}>
      <span className={cn("font-semibold tracking-tight", s.title)}>One Home</span>
      {!hideSubtitle && (
        <span
          className={cn(
            "font-medium lowercase tracking-wide text-muted-foreground opacity-70",
            s.sub,
            "mt-[2px]",
          )}
        >
          dayta
        </span>
      )}
    </span>
  );
}
