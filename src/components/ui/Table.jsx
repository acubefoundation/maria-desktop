import React, { forwardRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const Table = forwardRef(function Table(
  {
    className,
    columns,
    data,
    onRowClick,
    rowClassName,
    emptyMessage = 'No records found.',
    loading = false,
    children,
    ...props
  },
  ref
) {
  // Backward compatibility: If columns and data are provided, render the full structured table
  if (columns && Array.isArray(columns)) {
    const tableData = Array.isArray(data) ? data : [];
    return (
      <div className="relative w-full overflow-auto rounded-xl border border-border bg-card shadow-sm dark:shadow-none">
        <table
          ref={ref}
          className={cn('data-table w-full caption-bottom text-sm', className)}
          {...props}
        >
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center'
                  )}
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : tableData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              tableData.map((row, i) => (
                <TableRow
                  key={row.id || i}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-muted/60',
                    rowClassName && rowClassName(row),
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center'
                      )}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
    );
  }

  // Pure shadcn Table primitive
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
});
Table.displayName = 'Table';

const TableHeader = forwardRef(function TableHeader({ className, ...props }, ref) {
  return (
    <thead ref={ref} className={cn('[&_tr]:border-b bg-muted/40', className)} {...props} />
  );
});
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
});
TableBody.displayName = 'TableBody';

const TableFooter = forwardRef(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  );
});
TableFooter.displayName = 'TableFooter';

const TableRow = forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border/60 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  );
});
TableRow.displayName = 'TableRow';

const TableHead = forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-10 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});
TableHead.displayName = 'TableHead';

const TableCell = forwardRef(function TableCell({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  );
});
TableCell.displayName = 'TableCell';

const TableCaption = forwardRef(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
TableCaption.displayName = 'TableCaption';

// Enhanced Pagination component supporting items-per-page selection
function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  totalItems,
  className,
}) {
  // If neither totalPages > 1 nor pageSize options are present, don't show
  if ((!totalPages || totalPages <= 1) && !onPageSizeChange && totalItems === undefined) {
    return null;
  }

  const safePage = Math.max(1, page || 1);
  const safeTotalPages = Math.max(1, totalPages || 1);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-border/40 bg-card/40 text-sm', className)}>
      <div className="flex items-center gap-4 flex-wrap">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Records per page:</span>
            <select
              value={pageSize || 10}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} items per page
                </option>
              ))}
            </select>
          </div>
        )}

        {totalItems !== undefined ? (
          <div className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">
              {totalItems === 0 ? 0 : (safePage - 1) * (pageSize || 10) + 1}
            </span>
            –
            <span className="font-semibold text-foreground">
              {Math.min(safePage * (pageSize || 10), totalItems)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> records
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{safePage}</span> of{' '}
            <span className="font-semibold text-foreground">{safeTotalPages}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => onPageChange && onPageChange(safePage - 1)}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Previous
        </button>
        <span className="text-xs font-medium px-2 py-1 bg-muted/60 rounded text-foreground">
          {safePage} / {safeTotalPages}
        </span>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange && onPageChange(safePage + 1)}
        >
          Next
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  Pagination,
};
export default Table;
