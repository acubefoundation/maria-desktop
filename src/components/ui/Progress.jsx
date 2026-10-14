import React, { forwardRef } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const Progress = forwardRef(function Progress(
  { className, value = 0, segments, ...props },
  ref
) {
  // If multi-segment progress is provided (e.g. for batch yield split)
  if (segments && Array.isArray(segments) && segments.length > 0) {
    return (
      <div
        ref={ref}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-secondary flex',
          className
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn('h-full transition-all duration-300 ease-out', seg.className)}
            style={{
              width: `${Math.max(0, Math.min(100, seg.value || 0))}%`,
              backgroundColor: seg.color || undefined,
            }}
            title={seg.label ? `${seg.label}: ${seg.value}%` : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export default Progress;
