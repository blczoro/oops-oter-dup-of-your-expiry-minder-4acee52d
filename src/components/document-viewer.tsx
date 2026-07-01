import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: { id: string; file_name: string; file_type: string; storage_path: string } | null;
}

export function DocumentViewer({ open, onOpenChange, doc }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
    if (!doc || !open) {
      setUrl(null);
      return;
    }
    let alive = true;
    supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setUrl(null);
        else setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [doc, open]);

  const isImage = doc?.file_type.startsWith("image/");
  const isPdf = doc?.file_type === "application/pdf";

  const handleDownload = async () => {
    if (!url || !doc) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc?.file_name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!url}>
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </div>
        </div>

        <div className="mt-2 max-h-[70vh] overflow-auto rounded-md border bg-muted/30">
          {!url ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : isImage ? (
            <div className="flex items-center justify-center p-4">
              <img
                src={url}
                alt={doc?.file_name}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                className="max-w-full transition-transform"
              />
            </div>
          ) : isPdf ? (
            <iframe src={url} title={doc?.file_name} className="h-[70vh] w-full" />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Preview not available — download to view.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
