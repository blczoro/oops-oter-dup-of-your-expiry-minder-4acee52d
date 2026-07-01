import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, Download, Trash2, Upload, FileText, Image as ImageIcon, RefreshCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { DocumentViewer } from "./document-viewer";

interface Props {
  itemId: string;
}

type Doc = {
  id: string;
  item_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentList({ itemId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const upload = async (file: File, replaceDoc?: Doc) => {
    if (!user) return;
    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${itemId}/${crypto.randomUUID()}.${ext}`;
      setProgress(40);
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type,
      });
      if (upErr) throw upErr;
      setProgress(75);

      if (replaceDoc) {
        await supabase.storage.from("documents").remove([replaceDoc.storage_path]);
        const { error } = await supabase
          .from("documents")
          .update({
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: path,
          })
          .eq("id", replaceDoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents").insert({
          item_id: itemId,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: path,
        });
        if (error) throw error;
      }
      setProgress(100);
      toast.success(replaceDoc ? "Document replaced" : "Document uploaded");
      qc.invalidateQueries({ queryKey: ["documents", itemId] });
      qc.invalidateQueries({ queryKey: ["document-counts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  };

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const doc = docs.find((d) => d.id === replacingId);
    if (doc) upload(file, doc);
    setReplacingId(null);
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["documents", itemId] });
    qc.invalidateQueries({ queryKey: ["document-counts"] });
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, PDF</p>
        </div>
        <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Upload className="mr-1 h-4 w-4" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
        <input ref={replaceInput} type="file" accept={ACCEPT} className="hidden" onChange={handleReplace} />
      </div>

      {progress > 0 && <Progress value={progress} className="mt-3" />}

      <div className="mt-4">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No documents yet — upload receipts, warranty cards, or photos.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={() => setViewing(doc)}
                onDownload={() => handleDownload(doc)}
                onReplace={() => {
                  setReplacingId(doc.id);
                  replaceInput.current?.click();
                }}
                onDelete={() => handleDelete(doc)}
              />
            ))}
          </ul>
        )}
      </div>

      <DocumentViewer open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} doc={viewing} />
    </div>
  );
}

function DocumentCard({
  doc,
  onView,
  onDownload,
  onReplace,
  onDelete,
}: {
  doc: Doc;
  onView: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const isImage = doc.file_type.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);

  // Lazy load thumbnail for images
  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10)
      .then(({ data }) => {
        if (alive && data) setThumb(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [isImage, doc.storage_path]);

  return (
    <li className="flex flex-col rounded-lg border bg-background p-3">
      <button
        type="button"
        onClick={onView}
        className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 hover:bg-muted"
      >
        {isImage && thumb ? (
          <img src={thumb} alt={doc.file_name} className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" />
        )}
      </button>
      <div className="mt-3 min-w-0">
        <div className="truncate text-sm font-medium" title={doc.file_name}>
          {doc.file_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {format(parseISO(doc.created_at), "MMM d, yyyy")} • {formatSize(doc.file_size)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye className="mr-1 h-3 w-3" /> View
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download className="mr-1 h-3 w-3" /> Download
        </Button>
        <Button size="sm" variant="outline" onClick={onReplace}>
          <RefreshCcw className="mr-1 h-3 w-3" /> Replace
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="mr-1 h-3 w-3 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
