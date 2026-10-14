import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        // Robi-compliant Domain-Specific Status Badges (Low saturation, WCAG AAA contrast)
        clean: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20',
        warning: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20',
        cleaning: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20',
        reject: 'border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300 dark:bg-rose-500/20',
        dispatched: 'border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:bg-blue-500/20',
        unprocessed: 'border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300 dark:bg-slate-500/20',
        waste: 'border-transparent bg-amber-900/15 text-amber-800 dark:text-amber-200 dark:bg-amber-900/25',
        info: 'border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:bg-blue-500/20',
        success: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20',
        neutral: 'border-transparent bg-muted text-muted-foreground',
        accent: 'border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:bg-orange-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const statusMap = {
  // Entry statuses
  IN_STOCK_UNPROCESSED: { label: 'Unprocessed', variant: 'unprocessed' },
  IN_CLEANING: { label: 'In Cleaning', variant: 'warning' },
  PARTIALLY_PROCESSED: { label: 'Partial', variant: 'warning' },
  FULLY_PROCESSED: { label: 'Processed', variant: 'clean' },
  DISPATCHED: { label: 'Dispatched', variant: 'dispatched' },
  // Company statuses
  ACTIVE: { label: 'Active', variant: 'clean' },
  INACTIVE: { label: 'Inactive', variant: 'neutral' },
  // Purpose
  EXPORT: { label: 'Export', variant: 'dispatched' },
  INTERNAL_TRANSFER: { label: 'Transfer', variant: 'neutral' },
  RETURN_TO_SUPPLIER: { label: 'Return', variant: 'warning' },
  // User roles
  ADMIN: { label: 'Admin', variant: 'accent' },
  WAREHOUSE_MANAGER: { label: 'Manager', variant: 'info' },
  VIEWER: { label: 'Viewer', variant: 'neutral' },
  COMPANY_VIEWER: { label: 'Co. Viewer', variant: 'neutral' },
};

function Badge({
  className,
  variant = 'default',
  status,
  label,
  children,
  ...props
}) {
  let resolvedVariant = variant;
  let text = children ?? label;

  if (status) {
    const config = statusMap[status] || { label: status, variant: 'neutral' };
    resolvedVariant = config.variant || 'neutral';
    if (!text) {
      text = config.label;
    }
  }

  return (
    <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props}>
      {text}
    </div>
  );
}

export { Badge, badgeVariants };
export default Badge;
