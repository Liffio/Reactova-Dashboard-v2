import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createShortLink, deleteShortLink, listShortLinks, type ShortLinkItem } from "@/lib/api/shortlinks-api";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";

export const Route = createFileRoute("/_app/short-links")({
  head: () => ({ meta: [{ title: "Short Links — Liffio" }] }),
  component: ShortLinksRoute,
});

function ShortLinksRoute() {
  return (
    <ProtectedRoute module="shortlink">
      <ShortLinksPage />
    </ProtectedRoute>
  );
}

function ShortLinksPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ShortLinkItem | null>(null);

  const linksQuery = useQuery({
    queryKey: ["short-links", workspaceId],
    queryFn: () => listShortLinks(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; destination: string; slug?: string }) =>
      createShortLink(workspaceId, body),
    onSuccess: () => {
      toast.success("Short link created");
      void queryClient.invalidateQueries({ queryKey: ["short-links", workspaceId] });
      setCreateOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShortLink(workspaceId, id),
    onSuccess: () => {
      toast.success("Link deleted");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["short-links", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const links = linksQuery.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Distribute"
        title="Short Links"
        description="Create tracked short links and monitor click performance."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New link
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        {linksQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(linksQuery.error as Error).message}
          </div>
        )}

        {linksQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
            <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No short links yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first short link to start tracking clicks.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New link
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Short URL</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Destination</th>
                    <th className="px-4 py-3 text-right font-medium">Clicks</th>
                    <th className="px-6 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3.5 font-medium">{link.name}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary">{link.shortUrl}</span>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy"
                            onClick={() => {
                              void navigator.clipboard.writeText(link.shortUrl);
                              toast.success("Copied!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={link.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Open"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="max-w-xs truncate block text-xs text-muted-foreground">
                          {link.destination}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium">
                        {formatNum(link.clickCount)}
                      </td>
                      <td className="px-6 py-3.5">
                        <button
                          className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeleting(link)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CreateLinkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The short link will stop redirecting immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateLinkDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (data: { name: string; destination: string; slug?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [slug, setSlug] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !destination.trim()) return;
    onSubmit({ name: name.trim(), destination: destination.trim(), slug: slug.trim() || undefined });
    setName("");
    setDestination("");
    setSlug("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New short link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-name">Name</Label>
            <Input
              id="link-name"
              placeholder="My product link"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-dest">Destination URL</Label>
            <Input
              id="link-dest"
              type="url"
              placeholder="https://example.com/product"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-slug">
              Custom slug{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="link-slug"
              placeholder="my-product"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
