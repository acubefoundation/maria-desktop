import React, { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Map legacy variant and size names
const normalizeVariant = (v) => {
  if (!v) return 'default';
  const map = {
    primary: 'default',
    danger: 'destructive',
    dark: 'secondary',
    secondary: 'secondary',
    outline: 'outline',
    ghost: 'ghost',
    link: 'link',
    destructive: 'destructive',
  };
  return map[v] || 'default';
};

const normalizeSize = (s) => {
  if (!s) return 'default';
  const map = {
    sm: 'sm',
    md: 'default',
    lg: 'lg',
    icon: 'icon',
    default: 'default',
  };
  return map[s] || 'default';
};

const Button = forwardRef(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    as,
    loading = false,
    disabled = false,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const resolvedVariant = normalizeVariant(variant);
  const resolvedSize = normalizeSize(size);

  const Comp = asChild ? Slot : as || 'button';

  return (
    <Comp
      ref={ref}
      type={Comp === 'button' ? type : undefined}
      className={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
