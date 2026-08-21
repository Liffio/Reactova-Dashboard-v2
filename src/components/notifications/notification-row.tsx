/**
 * One row, both surfaces (plan/NOTIFICATIONS, D10). The panel and the page
 * differ in spacing and which tools they expose, not in structure — two row
 * components would drift the moment either changed.
 */
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Check } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { categoryStyle, resolveNotificationAction } from "./notification-registry";
import type { NotificationItem } from "@/lib/api/notifications-api";

export type RowDensity = "compact" | "comfortable";

export type NotificationRowProps = {
  item: NotificationItem;
  density: RowDensity;
  onOpen?: (item: NotificationItem) => void;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  /** Selection is page-only; omitting `onToggleSelect` hides the checkbox. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Suppresses the inline action link when a surface handles navigation itself. */
  showAction?: boolean;
};

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  if (Date.now() - then < 60_000) return "Just now";
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
};

export function NotificationRow({
  item,
  density,
  onOpen,
  onMarkRead,
  onArchive,
  onUnarchive,
  selected = false,
  onToggleSelect,
  showAction = true,
}: NotificationRowProps) {
  const style = categoryStyle(item.category);
  const Icon = style.icon;
  const action = showAction ? resolveNotificationAction(item) : null;
  const unread = item.readAt === null;
  const compact = density === "compact";

  const open = () => onOpen?.(item);

  return (
    <li
      className={[
        "group relative flex gap-3 border-b border-border/50 transition-colors last:border-b-0",
        compact ? "px-4 py-2.5" : "px-4 py-3.5 sm:px-5",
        unread ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-accent/50",
        onOpen ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={open}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      {...(onOpen ? { role: "button", tabIndex: 0 } : {})}
    >
      {onToggleSelect && (
        <span
          className={[
            "flex items-start pt-1 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          ].join(" ")}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(item.id)}
            aria-label={`Select "${item.title}"`}
          />
        </span>
      )}

      <span
        className={[
          "grid shrink-0 place-items-center rounded-lg",
          compact ? "h-8 w-8" : "h-9 w-9",
          style.tile,
        ].join(" ")}
      >
        <Icon className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-foreground">
          {item.title}
          {item.rolledCount > 1 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 align-middle text-[11px] font-medium text-muted-foreground">
              ×{item.rolledCount}
            </span>
          )}
        </p>
        {item.body && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          {/* Hover swaps the timestamp for tools on the roomier page rows; the
              panel keeps the timestamp visible because its rows are tap targets. */}
          <span
            className={[
              "text-[11px] text-muted-foreground",
              compact ? "" : "sm:group-hover:hidden",
            ].join(" ")}
          >
            {relativeTime(item.createdAt)}
          </span>

          {!compact && (
            <span
              className="hidden items-center gap-1 sm:group-hover:flex"
              onClick={(event) => event.stopPropagation()}
            >
              {unread && onMarkRead && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => onMarkRead(item.id)}
                >
                  <Check className="h-3 w-3" /> Mark read
                </button>
              )}
              {item.archivedAt === null
                ? onArchive && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => onArchive(item.id)}
                    >
                      <Archive className="h-3 w-3" /> Archive
                    </button>
                  )
                : onUnarchive && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => onUnarchive(item.id)}
                    >
                      <ArchiveRestore className="h-3 w-3" /> Restore
                    </button>
                  )}
            </span>
          )}
        </div>

        {action && (
          <Link
            to={action.to}
            className="mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
            onClick={(event) => event.stopPropagation()}
          >
            {action.label}
          </Link>
        )}
      </div>

      {unread && (
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
      )}
    </li>
  );
}
