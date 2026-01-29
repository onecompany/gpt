import React, { forwardRef } from "react";
import { cn } from "@/utils/utils";

export const Table = forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto w-full">
    <table
      ref={ref}
      className={cn("min-w-full divide-y divide-zinc-750", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-zinc-750", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("", className)} {...props} />
));
TableRow.displayName = "TableRow";

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  compact?: boolean;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, compact, ...props }, ref) => {
    const paddingClass = compact ? "px-0" : "px-5";
    return (
      <th
        ref={ref}
        className={cn(
          "py-2 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider align-middle",
          paddingClass,
          className,
        )}
        {...props}
      />
    );
  },
);
TableHead.displayName = "TableHead";

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  compact?: boolean;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, compact, ...props }, ref) => {
    const paddingClass = compact ? "px-0" : "px-5";
    return (
      <td
        ref={ref}
        className={cn(
          "py-2.5 text-sm text-zinc-200 align-middle",
          paddingClass,
          className,
        )}
        {...props}
      />
    );
  },
);
TableCell.displayName = "TableCell";
