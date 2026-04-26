import { useMemo, useState } from "react";
import { Plus, ExternalLink, Trash2, Link2, X } from "lucide-react";
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
import { useCan } from "@/hooks/useCan";

const seed = [
  { id: 1, name: "Spring Launch", slug: "spring", url: "https://reactova.com/launch?utm=ig", clicks: 1284, date: "Apr 18, 2026" },
  { id: 2, name: "Free Guide PDF", slug: "guide", url: "https://reactova.com/free-guide", clicks: 942, date: "Apr 10, 2026" },
  { id: 3, name: "Webinar Signup", slug: "webinar", url: "https://reactova.com/webinar/may", clicks: 401, date: "Apr 5, 2026" },
];
type LinkItem = (typeof seed)[number];
const columnHelper = createColumnHelper<LinkItem>();

export default function ShortLinks() {
  const [items, setItems] = useState(seed);
  const [open, setOpen] = useState(false);
  const canCreate = useCan("shortlink", "create");
  const canDelete = useCan("shortlink", "delete");
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
            <span className="font-mono text-xs text-primary">go.reactova.com/{info.getValue()}</span>
            <CopyButton value={`go.reactova.com/${info.getValue()}`} />
          </div>
        )
      }),
      columnHelper.accessor("url", {
        header: "Destination",
        cell: (info) => (
          <span className="text-muted-foreground truncate max-w-[260px] inline-block">
            {info.getValue()}
          </span>
        )
      }),
      columnHelper.accessor("clicks", {
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
            <a className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => setItems((prev) => prev.filter((item) => item.id !== row.original.id))}
              className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-40"
              disabled={!canDelete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })
    ],
    [canDelete]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <DashboardLayout title="Short Links" subtitle="Track every link you share.">
      <div className="flex justify-end -mt-2">
        <Button variant="accent" onClick={() => setOpen(true)} disabled={!canCreate}>
          <Plus className="h-4 w-4" /> Create Short Link
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total Links Created" value={items.length.toString()} />
        <Stat label="Total Clicks" value={items.reduce((a, b) => a + b.clicks, 0).toLocaleString()} />
        <Stat label="Top Performing Link" value="Spring Launch" sub="1,284 clicks" />
      </div>

      {items.length === 0 ? (
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
        <section className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
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
        </section>
      )}

      {open && canCreate && <CreateModal onClose={() => setOpen(false)} />}
    </DashboardLayout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Create Short Link</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2"><Label>Link Name</Label><Input className="bg-input border-border" placeholder="Spring Launch" /></div>
        <div className="space-y-2"><Label>Destination URL</Label><Input className="bg-input border-border" placeholder="https://..." /></div>
        <div className="space-y-2">
          <Label>Custom slug (optional)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="bg-input border-border" placeholder="my-link" />
          <div className="text-xs font-mono text-muted-foreground">go.reactova.com/{slug || "auto"}</div>
        </div>
        <Button className="w-full" onClick={onClose}>Create Link</Button>
      </div>
    </div>
  );
}
