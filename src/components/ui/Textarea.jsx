import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Textarea = forwardRef(function Textarea(
  { className, label, error, hint, required, rows = 3, ...props },
  ref
) {
  const hasWrapper = label || error || hint;

  const textareaElement = (
    <textarea
      rows={rows}
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive focus-visible:ring-destructive',
        !hasWrapper && className
      )}
      ref={ref}
      aria-invalid={!!error}
      {...props}
    />
  );

  if (!hasWrapper) return textareaElement;

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <label className="text-sm font-medium leading-none text-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-destructive font-semibold">*</span>}
        </label>
      )}
      {textareaElement}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
export default Textarea;
