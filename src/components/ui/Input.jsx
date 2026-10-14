import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef(function Input(
  {
    className,
    type = 'text',
    label,
    error,
    hint,
    required,
    leftIcon,
    rightIcon,
    ...props
  },
  ref
) {
  const hasWrapper = label || error || hint || leftIcon || rightIcon;

  const inputElement = (
    <input
      type={type}
      className={cn(
        'flex h-10 sm:h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base sm:text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        leftIcon && 'pl-9',
        rightIcon && 'pr-9',
        error && 'border-destructive focus-visible:ring-destructive',
        !hasWrapper && className
      )}
      ref={ref}
      aria-invalid={!!error}
      {...props}
    />
  );

  if (!hasWrapper) {
    return inputElement;
  }

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <label className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
          {label}
          {required && <span className="text-destructive font-semibold">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center justify-center pointer-events-none">
            {leftIcon}
          </span>
        )}
        {inputElement}
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center justify-center pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
});
Input.displayName = 'Input';

// Backward compatibility: Textarea and Select re-exported for legacy consumers
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

const Select = forwardRef(function Select(
  { className, label, error, hint, required, children, placeholder, ...props },
  ref
) {
  const hasWrapper = label || error || hint;

  const selectElement = (
    <div className="relative">
      <select
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive',
          !hasWrapper && className
        )}
        ref={ref}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        ▼
      </span>
    </div>
  );

  if (!hasWrapper) return selectElement;

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <label className="text-sm font-medium leading-none text-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-destructive font-semibold">*</span>}
        </label>
      )}
      {selectElement}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
});
Select.displayName = 'Select';

export { Input, Textarea, Select };
export default Input;
