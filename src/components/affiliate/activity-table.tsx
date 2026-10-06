import type { ReactNode } from "react";
import { TD, TH } from "./affiliate-format";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** On phones a row stacks: `title` and `badge` on top, `detail` columns underneath. */
  mobile: "title" | "badge" | "detail";
  align?: "right";
};

/** A table on desktop, stacked rows on phones (spec §8: no sideways scroll at 390px). */
export function ActivityTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) {
  const title = columns.find((c) => c.mobile === "title");
  const badge = columns.find((c) => c.mobile === "badge");
  const details = columns.filter((c) => c.mobile === "detail");

  return (
    <>
      <table className="hidden w-full border-collapse text-sm sm:table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={`${TH} ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-muted/40">
              {columns.map((c) => (
                <td key={c.header} className={`${TD} ${c.align === "right" ? "text-right" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="border-t border-border/60 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="space-y-2 border-b border-border/60 px-4 py-3.5 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{title?.cell(row)}</div>
              {badge?.cell(row)}
            </div>
            {details.map((c) => (
              <div key={c.header} className="text-[13px]">
                {c.cell(row)}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
