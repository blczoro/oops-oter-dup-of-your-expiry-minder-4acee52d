import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchUserData } from "@/lib/backup";
import { exportJson, exportCsv, exportXlsx, type ExportData } from "@/lib/export";
import { toast } from "sonner";

interface Props {
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function ExportMenu({ variant = "outline", size = "sm" }: Props) {
  const { user } = useAuth();

  const run = async (format: "json" | "csv" | "xlsx") => {
    if (!user) return;
    try {
      const data = await fetchUserData(user.id);
      const payload: ExportData = { ...data, exportedAt: new Date().toISOString() };
      if (format === "json") exportJson(payload);
      else if (format === "csv") exportCsv(payload);
      else exportXlsx(payload);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("json")}>Export as JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("csv")}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")}>Export as Excel (.xlsx)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
