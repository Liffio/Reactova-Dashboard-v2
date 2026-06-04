import { useMemo, useState } from "react";
import { Plus, ExternalLink, Trash2, Link2, X, MousePointerClick, Trophy } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { PageAlert } from "@/components/page/PageAlert";
import { PageMetricCard } from "@/components/page/PageMetricCard";
import { PageSection } from "@/components/page/PageSection";
import { PageToolbar } from "@/components/page/PageToolbar";
import { useCan } from "@/hooks/useCan";
import { toast } from "@/components/ui/sonner";
import { useApp } from "@/state/AppContext";
import {
  type ShortLinkItem,
  useCreateShortLinkMutation,
  useDeleteShortLinkMutation,
  useShortLinksQuery
} from "@/hooks/useShortLinks";

const getShortLinkPreviewBase = () => {
  const shortBase = import.meta.env.VITE_SHORTLINK_PUBLIC_URL as string | undefined;
  if (shortBase?.trim()) {
    try {
      return new URL(shortBase.trim()).host;
    } catch {
      return shortBase.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    }
  }
  if (import.meta.env.PROD) {
    return "go.liffio.com";
  }
  const apiBase = import.meta.env.VITE_API_URL as string | undefined;
  if (apiBase) {
    try {
      return new URL(apiBase).host;
    } catch {
      return window.location.host;
    }
  }
  return window.location.host;
};

const columnHelper = createColumnHelper<LinkItem>();
type LinkItem = ShortLinkItem & { date: string };

export default function ShortLinks() {
  const { current } = useApp();
  const [open, setOpen] = useState(false);
  const canCreate = useCan("shortlink", "create");
  const canDelete = useCan("shortlink", "delete");
  const shortLinksQuery = useShortLinksQuery(current.id);
  const createShortLinkMutation = useCreateShortLinkMutation();
  const deleteShortLinkMutation = useDeleteShortLinkMutation(current.id);
  const items = useMemo<LinkItem[]>(
    () =>
      (shortLinksQuery.data ?? []).map((item) => ({
        ...item,
        date: new Date(item.createdAt).toLocaleDateString()
      })),
    [shortLinksQuery.data]
  );
  const topPerformingLink = useMemo(
    () => items.reduce<LinkItem | null>((best, item) => (best === null || item.clickCount > best.clickCount ? item : best), null),
    [items]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Link Name",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>
      }),
      columnHelper.accessor("slug", {
        header: "Short URL",
        cell: (info) => (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-primary">{info.row.original.shortUrl}</span>
            <CopyButton value={info.row.original.shortUrl} />
          </div>
        )
      }),
      columnHelper.accessor("destination", {
        header: "Destination",
        cell: (info) => (
          <span className="text-muted-foreground truncate max-w-[260px] inline-block">
            {info.getValue()}
          </span>
        )
      }),
      columnHelper.accessor("clickCount", {
        header: "Clicks",
        cell: (info) => <span className="font-mono">{info.getValue().toLocaleString()}</span>
      }),
      columnHelper.accessor("date", {
        header: "Created",
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="inline-flex gap-1">
            <a
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              href={row.original.shortUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => {
                deleteShortLinkMutation.mutate(row.original.id, {
                  onError: (error) => toast.error((error as Error).message),
                  onSuccess: () => toast.success("Short link deleted")
                });
              }}
              className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-40"
              disabled={!canDelete || deleteShortLinkMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })
    ],
    [canDelete, deleteShortLinkMutation]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <DashboardLayout title="Short Links" subtitle="Track every link you share.">
      <PageToolbar className="-mt-2 sm:justify-end">
        <Button variant="accent" className="w-full sm:w-auto" onClick={() => setOpen(true)} disabled={!canCreate}>
          <Plus className="h-4 w-4" /> Create Short Link
        </Button>
      </PageToolbar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <PageMetricCard icon={Link2} label="Total links" value={items.length} />
        <PageMetricCard
          icon={MousePointerClick}
          label="Total clicks"
          value={items.reduce((a, b) => a + b.clickCount, 0)}
        />
        <PageMetricCard
          icon={Trophy}
          label="Top link"
          value={topPerformingLink?.name ?? "—"}
          sub={topPerformingLink ? `${topPerformingLink.clickCount.toLocaleString()} clicks` : "No clicks yet"}
        />
      </div>

      {shortLinksQuery.error && <PageAlert>{(shortLinksQuery.error as Error).message}</PageAlert>}
      {shortLinksQuery.isLoading && (
        <div className="surface-card px-4 py-8 text-center text-sm text-muted-foreground">Loading short links...</div>
      )}

      {!shortLinksQuery.isLoading && items.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No short links yet"
          description="Every link in your DMs should be a tracked short link"
          ctaLabel={canCreate ? "Create Short Link" : "No permission to create"}
          onCta={() => {
            if (canCreate) setOpen(true);
          }}
        />
      ) : (
        <PageSection title="Your links" noPadding>
          <div className="mobile-data-list md:hidden">
            {items.map((row) => (
              <article key={row.id} className="mobile-data-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="font-mono text-xs text-primary truncate mt-0.5">{row.shortUrl}</p>
                  </div>
                  <div className="inline-flex gap-1 shrink-0">
                    <a
                      className="p-2 rounded-md glass-inset text-muted-foreground hover:text-foreground min-h-10 min-w-10 inline-flex items-center justify-center"
                      href={row.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => {
                        deleteShortLinkMutation.mutate(row.id, {
                          onError: (error) => toast.error((error as Error).message),
                          onSuccess: () => toast.success("Short link deleted")
                        });
                      }}
                      className="p-2 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-40 min-h-10 min-w-10 inline-flex items-center justify-center"
                      disabled={!canDelete || deleteShortLinkMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{row.destination}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{row.clickCount.toLocaleString()} clicks</span>
                  <span>{row.date}</span>
                </div>
                <CopyButton value={row.shortUrl} className="w-full justify-center" />
              </article>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="text-left text-xs text-muted-foreground border-b border-border">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-5 py-3 font-medium">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="stripe-row">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      )}

      {open && canCreate && (
        <CreateModal
          creating={createShortLinkMutation.isPending}
          onClose={() => setOpen(false)}
          onCreate={(payload) => {
            createShortLinkMutation.mutate(
              {
                workspaceId: current.id,
                name: payload.name,
                destination: payload.destination,
                slug: payload.slug
              },
              {
                onSuccess: () => {
                  toast.success("Short link created");
                  setOpen(false);
                },
                onError: (error) => toast.error((error as Error).message)
              }
            );
          }}
        />
      )}
    </DashboardLayout>
  );
}

function CreateModal({
  creating,
  onClose,
  onCreate
}: {
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; destination: string; slug?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedDestination = destination.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedName) {
      setError("Link name is required");
      return;
    }
    try {
      const parsedUrl = new URL(trimmedDestination);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        setError("Destination URL must start with http:// or https://");
        return;
      }
    } catch {
      setError("Destination URL is invalid");
      return;
    }
    if (trimmedSlug && !/^[a-z0-9-]{3,64}$/.test(trimmedSlug)) {
      setError("Slug can contain lowercase letters, numbers, and dashes only");
      return;
    }
    setError(null);
    onCreate({
      name: trimmedName,
      destination: trimmedDestination,
      slug: trimmedSlug || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md surface-card rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Create Short Link</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          <Label>Link Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-input border-border"
            placeholder="Spring Launch"
          />
        </div>
        <div className="space-y-2">
          <Label>Destination URL</Label>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="bg-input border-border"
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label>Custom slug (optional)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="bg-input border-border" placeholder="my-link" />
          <div className="text-xs font-mono text-muted-foreground">{getShortLinkPreviewBase()}/{slug || "auto"}</div>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <Button className="w-full" onClick={handleSubmit} disabled={creating}>
          {creating ? "Creating..." : "Create Link"}
        </Button>
      </div>
    </div>
  );
}
