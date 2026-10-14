import React from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  accentColor,
  variant,
  className,
}) {
  const trendPositive = trend > 0;
  const trendNeutral = trend === 0 || trend == null;
  const isHero = variant === 'hero';

  return (
    <div
      className={cn(
        'rounded-xl border border-border p-5 transition-all duration-200',
        isHero
          ? 'bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 text-foreground'
          : 'bg-card text-card-foreground shadow-sm dark:shadow-none hover:border-primary/40',
        className
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
          {title}
        </span>
        {icon && (
          <span
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 text-foreground"
            style={{ color: accentColor || undefined }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value ?? '—'}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      {trend != null && (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium mt-2',
            trendNeutral
              ? 'text-muted-foreground'
              : trendPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {!trendNeutral && (trendPositive ? '↑' : '↓')}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

export default StatCard;
