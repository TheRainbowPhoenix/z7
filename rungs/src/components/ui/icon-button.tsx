import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

type IconButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    active?: boolean;
  };

export function IconButton({
  className,
  active,
  variant = 'ghost',
  size = 'icon',
  asChild = false,
  ...props
}: IconButtonProps) {
  return (
    <Button
      asChild={asChild}
      variant={variant}
      size={size}
      data-active={active ? 'true' : undefined}
      className={cn(
        // Unified toolbar icon-only button styling
        'size-9 rounded-md transition-colors text-gray-700 dark:text-gray-200',
        'hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-900 dark:active:bg-gray-800',
        'data-[active=true]:bg-gray-200 dark:data-[active=true]:bg-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export default IconButton;
