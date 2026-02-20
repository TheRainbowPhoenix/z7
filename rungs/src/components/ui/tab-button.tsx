import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'danger' | 'warning';

type Props = {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  badgeCount?: number;
  badgeVariant?: BadgeVariant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function TabButton({
  label,
  icon,
  active = false,
  badgeCount,
  badgeVariant = 'neutral',
  className,
  ...buttonProps
}: Props) {
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;

  return (
    <button
      type="button"
      {...buttonProps}
      className={cn(
        'inline-flex h-8 min-w-32 max-w-48 items-center justify-center gap-1 px-2 text-sm transition-colors',
        active ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200 ',
        className,
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {showBadge && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-xs',
            badgeVariant === 'danger'
              ? 'bg-red-500 text-white'
              : badgeVariant === 'warning'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-300 text-slate-700',
          )}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}
