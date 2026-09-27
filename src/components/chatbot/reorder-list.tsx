import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock, Pin } from "lucide-react";
import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { cn } from "@/lib/utils";
import { stepSummary } from "./model";

/**
 * Reorder mode (spec §10.2): one-line rows, drag by the grip only, step 1 pinned with a "First"
 * badge (a label, not a button), "Make first" on the others, arrows for keyboard and one-handed use.
 */
export function ReorderList({
  steps,
  onChange,
}: {
  steps: ChatbotStep[];
  onChange: (steps: ChatbotStep[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (from: number, to: number) => {
    // The first step stays first: nothing may be dropped above it or drag it away.
    if (from === 0 || to === 0) return;
    onChange(arrayMove(steps, from, to));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(
      steps.findIndex((s) => s.id === e.active.id),
      steps.findIndex((s) => s.id === e.over!.id),
    );
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {steps.map((s, i) => (
          <Row
            key={s.id}
            step={s}
            index={i}
            total={steps.length}
            onUp={() => move(i, i - 1)}
            onDown={() => move(i, i + 1)}
            onFirst={() => onChange([s, ...steps.filter((x) => x.id !== s.id)])}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function Row({
  step,
  index,
  total,
  onUp,
  onDown,
  onFirst,
}: {
  step: ChatbotStep;
  index: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
  onFirst: () => void;
}) {
  const first = index === 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: first });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative mb-2 rounded-xl border border-border bg-card shadow-card",
        isDragging && "z-10 border-primary opacity-95 shadow-glow",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-2 -left-11 z-[1] grid h-[31px] w-[31px] place-items-center rounded-[11px] border border-border bg-card text-xs font-semibold text-muted-foreground shadow-card max-md:-left-[38px] max-md:h-7 max-md:w-7",
          step.type === "CONDITION" && "border-transparent bg-cond text-cond-foreground",
          first && "border-transparent bg-brand-gradient text-white",
        )}
      >
        {index + 1}
      </span>
      <div className="flex min-h-12 items-center gap-2 py-1.5 pr-1.5 pl-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          disabled={first}
          aria-label={first ? "Fixed in place" : "Drag to reorder"}
          title={first ? "The first step stays at the top" : "Hold and drag to reorder"}
          className={cn(
            "flex touch-none rounded-lg p-2 text-muted-foreground select-none",
            first ? "cursor-default" : "cursor-grab hover:bg-muted hover:text-foreground",
          )}
          {...(first ? {} : { ...attributes, ...listeners })}
        >
          {first ? <Lock className="h-3.5 w-3.5" /> : <GripVertical className="h-4 w-4" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-display text-[15px] font-semibold">{step.name}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground max-sm:hidden">
            {stepSummary(step)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {first ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-[9px] bg-brand-gradient px-2 py-1 text-[11px] font-semibold text-white"
              title="This is where the chat starts"
            >
              <Pin className="h-3.5 w-3.5 fill-current" />
              <b className="max-sm:hidden">First</b>
            </span>
          ) : (
            <button
              type="button"
              onClick={onFirst}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:bg-primary-wash hover:text-primary"
              aria-label="Make this the first step"
            >
              <Pin className="h-3.5 w-3.5" />
              <b className="max-sm:hidden">Make first</b>
            </button>
          )}
          <button
            type="button"
            disabled={index <= 1}
            onClick={onUp}
            aria-label="Move up"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={first || index === total - 1}
            onClick={onDown}
            aria-label="Move down"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
