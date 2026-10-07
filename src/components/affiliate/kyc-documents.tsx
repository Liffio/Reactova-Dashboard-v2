import { useEffect, useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveBlob } from "@/lib/api/billing-api";
import { fetchKycDocument, kycDocumentFilename, type KycMyDocument } from "@/lib/api/affiliate-api";
import { fmtDate, KYC_SUBMISSION_STATUS } from "./affiliate-format";
import { StatusBadge } from "./affiliate-ui";
import { DocumentsArt } from "./illustrations";

const isPdf = (doc: KycMyDocument) => /\.pdf$/i.test(decodeURIComponent(doc.fileUrl));

/** The affiliate's uploaded verification documents, with preview and download. */
export function KycDocumentsCard({
  documents,
  canUpload,
  onUpload,
}: {
  documents: KycMyDocument[];
  canUpload: boolean;
  onUpload: () => void;
}) {
  const [preview, setPreview] = useState<KycMyDocument | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (doc: KycMyDocument) => {
    setDownloading(doc.fileUrl);
    try {
      const blob = await fetchKycDocument(doc.fileUrl);
      saveBlob(blob, kycDocumentFilename(doc, blob.type));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-xl border" aria-labelledby="kyc-docs-title">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3.5 py-2.5">
        <h4 id="kyc-docs-title" className="text-[13.5px] font-semibold">
          Your documents
        </h4>
        {canUpload && documents.length > 0 && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5" />
            Upload new
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-7 pt-5 text-center">
          <DocumentsArt className="mb-2 h-[88px] w-auto" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="mb-3.5 mt-1 max-w-[42ch] text-[13px] text-muted-foreground">
            Verify early and your first payout won't wait on a review. Files are stored privately.
          </p>
          {canUpload && (
            <Button size="sm" onClick={onUpload} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Add verification documents
            </Button>
          )}
        </div>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li
              key={doc.fileUrl}
              className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3 last:border-b-0"
            >
              <FileBadge pdf={isPdf(doc)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{doc.label}</div>
                <div className="text-xs text-muted-foreground">
                  Uploaded {fmtDate(doc.uploadedAt)}
                </div>
              </div>
              <span className="hidden sm:block">
                <StatusBadge status={doc.status} map={KYC_SUBMISSION_STATUS} />
              </span>
              <div className="flex flex-none gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  aria-label={`View ${doc.label}`}
                  onClick={() => setPreview(doc)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Download ${doc.label}`}
                  disabled={downloading === doc.fileUrl}
                  onClick={() => void download(doc)}
                >
                  {downloading === doc.fileUrl ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <KycDocumentPreviewDialog
        doc={preview}
        onOpenChange={(o) => !o && setPreview(null)}
        onDownload={(d) => void download(d)}
      />
    </section>
  );
}

function FileBadge({ pdf }: { pdf: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${
        pdf ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground/70"
      }`}
      aria-hidden
    >
      {pdf ? (
        <FileText className="h-[18px] w-[18px]" />
      ) : (
        <ImageIcon className="h-[18px] w-[18px]" />
      )}
    </span>
  );
}

/** Fetches the document with the bearer token and shows it inline: images as <img>, PDFs embedded. */
function KycDocumentPreviewDialog({
  doc,
  onOpenChange,
  onDownload,
}: {
  doc: KycMyDocument | null;
  onOpenChange: (open: boolean) => void;
  onDownload: (doc: KycMyDocument) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(null);
    fetchKycDocument(doc.fileUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setType(blob.type);
        setUrl(objectUrl);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{doc?.label}</DialogTitle>
          <DialogDescription>
            {doc
              ? `Uploaded ${fmtDate(doc.uploadedAt)}. Only you and Liffio's verification team can see it.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-xl border bg-muted/40">
          {error ? (
            <p className="px-6 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : !url ? (
            <Loader2
              className="h-6 w-6 animate-spin text-muted-foreground"
              aria-label="Loading document"
            />
          ) : type === "application/pdf" ? (
            <iframe
              title={doc?.label ?? "Document"}
              src={url}
              className="h-[60vh] w-full bg-card"
            />
          ) : (
            <img
              src={url}
              alt={doc?.label ?? "Document"}
              className="max-h-[60vh] w-auto object-contain"
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {doc && (
            <Button className="gap-1.5" onClick={() => onDownload(doc)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
