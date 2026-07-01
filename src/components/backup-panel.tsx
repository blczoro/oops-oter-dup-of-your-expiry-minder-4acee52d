import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createBackup, downloadBackupJson, latestBackup, restoreBackup, type BackupPayload } from "@/lib/backup";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Database, Download, Upload, Loader2 } from "lucide-react";

export function BackupPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "create" | "download" | "restore">(null);

  const { data: latest } = useQuery({
    queryKey: ["latest-backup", user?.id],
    queryFn: () => latestBackup(user!.id),
    enabled: !!user,
  });

  const handleCreate = async () => {
    if (!user) return;
    setBusy("create");
    try {
      const { payload } = await createBackup(user.id);
      downloadBackupJson(payload);
      toast.success("Backup created");
      qc.invalidateQueries({ queryKey: ["latest-backup"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!latest) return toast.error("No backup yet");
    setBusy("download");
    try {
      downloadBackupJson(latest.payload as unknown as BackupPayload);
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!confirm("Restoring will REPLACE all your current applications, reminders, and documents metadata with the backup. Continue?")) return;
    setBusy("restore");
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      await restoreBackup(user.id, payload);
      toast.success("Backup restored");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 text-primary" />
        <div className="flex-1">
          <h2 className="text-sm font-medium">Backup &amp; restore</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Save a snapshot of your data. Note: document files themselves are not included — only their metadata.
          </p>

          <div className="mt-4 rounded-md border bg-background p-3 text-xs">
            <div className="text-muted-foreground">Last backup</div>
            <div className="mt-1 font-medium">
              {latest
                ? `${formatDistanceToNow(parseISO(latest.created_at), { addSuffix: true })} • ${(latest.size / 1024).toFixed(1)} KB`
                : "No backups yet"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy !== null}>
              {busy === "create" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Create Backup
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={busy !== null || !latest}>
              <Download className="mr-1 h-3 w-3" /> Download Latest
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              <Upload className="mr-1 h-3 w-3" /> Restore Backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleRestoreFile} />
          </div>
        </div>
      </div>
    </section>
  );
}
