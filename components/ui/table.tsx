"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./primitives";

export type Column<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  width?: number | string;
  className?: string;
};

export type SortState = { id: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  rows,
  columns,
  rowId,
  loading = false,
  empty,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  mobile,
  initialSort = null,
  sort: controlledSort,
  onSortChange,
  footer,
  className,
  minWidth,
  dense = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowId: (row: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  mobile?: (row: T) => React.ReactNode;
  initialSort?: SortState;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  footer?: React.ReactNode;
  className?: string;
  minWidth?: number;
  dense?: boolean;
}) {
  const [internalSort, setInternalSort] = React.useState<SortState>(initialSort);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;

  const setSort = (next: SortState) => {
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
  };

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const multiplier = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * multiplier;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
    });
  }, [rows, sort, columns]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    if (sort?.id === column.id) {
      setSort(sort.dir === "asc" ? { id: column.id, dir: "desc" } : null);
    } else {
      setSort({ id: column.id, dir: "asc" });
    }
  };

  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedIds?.includes(rowId(row)));
  const someSelected = selectable && (selectedIds?.length ?? 0) > 0 && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rows.map(rowId));
  };

  const toggleRow = (row: T) => {
    if (!onSelectionChange) return;
    const id = rowId(row);
    const current = selectedIds ?? [];
    onSelectionChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  if (loading) {
    return (
      <div className={cn("stack-sm", className)} style={{ padding: 14 }} aria-busy="true" aria-label="Loading data">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="skeleton-row" style={{ opacity: 1 - index * 0.1 }} />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <>{empty ?? null}</>;
  }

  return (
    <div className={className}>
      <div className={cn("table-wrap", mobile && "table-desktop")}>
        <table
          className={cn("table", dense && "table--compact")}
          style={minWidth ? { minWidth } : undefined}
        >
          <thead>
            <tr>
              {selectable && (
                <th className="cell-check" scope="col">
                  <input
                    type="checkbox"
                    aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      column.align === "right" && "cell-num",
                      column.className
                    )}
                    style={{ width: column.width }}
                    data-sortable={column.sortable || undefined}
                    aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="th-sort"
                        data-active={active}
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp aria-hidden="true" />
                          ) : (
                            <ArrowDown aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const id = rowId(row);
              const selected = selectedIds?.includes(id);
              return (
                <tr
                  key={id}
                  data-selected={selected || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {selectable && (
                    <td className="cell-check" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected ?? false}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        column.align === "right" && "cell-num",
                        column.className
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mobile && <div className="record-list table-mobile">{sortedRows.map((row) => <React.Fragment key={rowId(row)}>{mobile(row)}</React.Fragment>)}</div>}
      {footer}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize,
  label = "results",
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  label?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const pages = React.useMemo(() => {
    if (safeTotalPages <= 7) return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
    const candidates = new Set([1, safeTotalPages, page - 1, page, page + 1]);
    return Array.from(candidates)
      .filter((value) => value >= 1 && value <= safeTotalPages)
      .sort((a, b) => a - b);
  }, [page, safeTotalPages]);

  const from = total === 0 ? 0 : (page - 1) * (pageSize ?? 10) + 1;
  const to = pageSize ? Math.min(total, page * pageSize) : total;

  return (
    <div className="pagination">
      <span className="hint num">
        {pageSize ? `${from}–${to} of ${total} ${label}` : `${total} ${label}`}
      </span>
      <div className="pagination__pages">
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        {pages.map((value, index) => {
          const previous = pages[index - 1];
          const gap = previous !== undefined && value - previous > 1;
          return (
            <React.Fragment key={value}>
              {gap && <span className="hint" aria-hidden="true">…</span>}
              <button
                type="button"
                className="page-btn"
                aria-current={value === page ? "page" : undefined}
                aria-label={`Page ${value}`}
                onClick={() => onPageChange(value)}
              >
                {value}
              </button>
            </React.Fragment>
          );
        })}
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safeTotalPages}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function TablePagination({ children }: { children: React.ReactNode }) {
  return <div className="table-pagination">{children}</div>;
}

export function TableFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card__foot", className)}>{children}</div>;
}
