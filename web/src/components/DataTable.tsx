import { ArrowUpDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
  className?: string;
};

/** Sortable table with sticky header; degrades to stacked cards below 640 px (File 02 rubric 10). */
export function DataTable<T>({ columns, rows, getRowKey }: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = (() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * sort.dir;
    });
  })();

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    );

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      {/* desktop table */}
      <table className="hidden w-full text-secondary sm:table">
        <thead className="sticky top-0 bg-surface-2 text-left text-caption font-medium text-text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("px-4 py-2.5", column.className)}>
                {column.sortValue ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-text"
                    onClick={() => toggleSort(column.key)}
                    aria-label={`Sort by ${column.header}`}
                  >
                    {column.header}
                    <ArrowUpDown size={12} aria-hidden className={sort?.key === column.key ? "text-primary" : ""} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={getRowKey(row)} className="border-t border-border hover:bg-surface-2/60">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-2.5", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* mobile cards */}
      <ul className="divide-y divide-border sm:hidden">
        {sorted.map((row) => (
          <li key={getRowKey(row)} className="space-y-1.5 p-4">
            {columns.map((column) => (
              <div key={column.key} className="flex items-baseline justify-between gap-3">
                <span className="text-caption text-text-subtle">{column.header}</span>
                <span className="text-right text-secondary">{column.render(row)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {sorted.length === 0 ? <p className="p-4 text-center text-secondary text-text-muted">Nothing here yet.</p> : null}
    </div>
  );
}
