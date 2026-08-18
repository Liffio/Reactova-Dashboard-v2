import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_GROUPS } from "@/lib/registry-constants";
import {
  getRegistryTree,
  reorderParentChildren,
  reorderParents,
  type RegistryTreeNode,
} from "@/lib/api/registry-api";

const MODULE_MANAGE = "platform:module_manage";

export const Route = createFileRoute("/_app/module-registry/arrange")({
  head: () => ({ meta: [{ title: "Arrange Sidebar — Admin" }] }),
  component: ArrangeRoute,
});

function ArrangeRoute() {
  return (
    <PlatformPermissionRoute permission={MODULE_MANAGE}>
      <ArrangePage />
    </PlatformPermissionRoute>
  );
}

type Columns = Record<string, string[]>;

function ArrangePage() {
  const queryClient = useQueryClient();
  const treeQuery = useQuery({ queryKey: ["registry-tree"], queryFn: getRegistryTree });

  // Only sidebar-visible parents are arrangeable (hidden ones — dashboard/platform — aren't shown).
  const parents = useMemo(
    () => (treeQuery.data?.modules ?? []).filter((p) => p.showInSidebar),
    [treeQuery.data],
  );
  const parentsById = useMemo(() => {
    const m = new Map<string, RegistryTreeNode>();
    for (const p of parents) m.set(p.id, p);
    return m;
  }, [parents]);

  // Group order = the canonical NAV_GROUPS, plus any non-standard group present in the data.
  const groupOrder = useMemo(() => {
    const extra = [...new Set(parents.map((p) => p.navGroup))].filter(
      (g) => !NAV_GROUPS.includes(g as (typeof NAV_GROUPS)[number]),
    );
    return [...NAV_GROUPS, ...extra];
  }, [parents]);

  const [columns, setColumns] = useState<Columns>({});
  const columnsRef = useRef<Columns>({});
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Seed local columns from the server tree whenever it (re)loads.
  useEffect(() => {
    const next: Columns = {};
    for (const g of groupOrder) next[g] = [];
    for (const p of parents) (next[p.navGroup] ??= []).push(p.id);
    setColumns(next);
  }, [parents, groupOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveParents = useMutation({
    mutationFn: (cols: Columns) =>
      reorderParents(groupOrder.map((group) => ({ group, parentIds: cols[group] ?? [] }))),
    onSuccess: () => {
      toast.success("Sidebar order saved");
      void queryClient.invalidateQueries({ queryKey: ["navigation"] });
      void queryClient.invalidateQueries({ queryKey: ["registry-parents"] });
    },
    onError: (e) => {
      toast.error((e as Error).message);
      void treeQuery.refetch(); // revert local state to server truth
    },
  });

  const findContainer = (id: string): string | undefined => {
    if (id in columnsRef.current) return id; // dropped on the column itself
    return groupOrder.find((g) => (columnsRef.current[g] ?? []).includes(id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Cross-column moves happen live here for visual feedback; final order is persisted on drop.
  const onDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(activeId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const fromItems = prev[from] ?? [];
      const toItems = prev[to] ?? [];
      const overIndex = overId in prev ? toItems.length : toItems.indexOf(overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      return {
        ...prev,
        [from]: fromItems.filter((x) => x !== activeId),
        [to]: [...toItems.slice(0, insertAt), activeId, ...toItems.slice(insertAt)],
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const from = findContainer(activeId);
    const to = overId ? findContainer(overId) : undefined;
    let next = columnsRef.current;
    if (from && to && from === to && overId && !(overId in columnsRef.current)) {
      const items = columnsRef.current[from] ?? [];
      const oldIndex = items.indexOf(activeId);
      const newIndex = items.indexOf(overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        next = { ...columnsRef.current, [from]: arrayMove(items, oldIndex, newIndex) };
        setColumns(next);
      }
    }
    saveParents.mutate(next);
  };

  if (treeQuery.isLoading) {
    return (
      <div>
        <PageHeader eyebrow="Platform admin" title="Arrange Sidebar" description="Drag to reorder." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 md:p-10 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Arrange Sidebar"
        description="Drag modules to reorder them or move them between groups. Expand a module to reorder its capabilities. Changes save automatically and go live for everyone after the sidebar refreshes."
        actions={
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/module-registry">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to registry
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 md:p-10">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {groupOrder.map((group) => (
              <GroupColumn
                key={group}
                group={group}
                itemIds={columns[group] ?? []}
                parentsById={parentsById}
                saving={saveParents.isPending}
              />
            ))}
          </div>
          <DragOverlay>
            {activeId && parentsById.get(activeId) ? (
              <ParentCardShell node={parentsById.get(activeId)!} dragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function GroupColumn({
  group,
  itemIds,
  parentsById,
  saving,
}: {
  group: string;
  itemIds: string[];
  parentsById: Map<string, RegistryTreeNode>;
  saving: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-2xl border bg-card/50 p-3 transition-colors ${
        isOver ? "border-primary/60 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{group}</span>
        <Badge variant="secondary">{itemIds.length}</Badge>
      </div>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-col gap-2">
          {itemIds.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              Drop a module here
            </p>
          ) : (
            itemIds.map((id) => {
              const node = parentsById.get(id);
              return node ? <SortableParentCard key={id} node={node} disabled={saving} /> : null;
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableParentCard({ node, disabled }: { node: RegistryTreeNode; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <ParentCardShell node={node} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ParentCardShell({
  node,
  handleProps,
  dragging,
}: {
  node: RegistryTreeNode;
  handleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border bg-card p-2.5 shadow-soft ${dragging ? "shadow-glow" : ""}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...(handleProps ?? {})}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{node.name}</div>
          <div className="truncate text-xs text-muted-foreground">{node.route ?? node.key}</div>
        </div>
        {node.children.length > 0 && !dragging ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Reorder capabilities"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {open && !dragging ? <ChildReorder node={node} /> : null}
    </div>
  );
}

/** Isolated single-list reorder for one parent's capabilities. Auto-saves on drop. */
function ChildReorder({ node }: { node: RegistryTreeNode }) {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<string[]>(node.children.map((c) => c.id));
  const childById = useMemo(() => new Map(node.children.map((c) => [c.id, c])), [node.children]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const save = useMutation({
    mutationFn: (ids: string[]) => reorderParentChildren(node.id, ids),
    onSuccess: () => {
      toast.success("Capabilities reordered");
      void queryClient.invalidateQueries({ queryKey: ["registry-tree"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const oldIndex = order.indexOf(activeId);
    const newIndex = order.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    save.mutate(next);
  };

  return (
    <div className="mt-2 border-t pt-2">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {order.map((id) => {
              const child = childById.get(id);
              return child ? <SortableChild key={id} id={id} name={child.name} /> : null;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableChild({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder capability"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="truncate">{name}</span>
    </div>
  );
}
