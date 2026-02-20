'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight } from '@mui/icons-material';

import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DUAL_SIDEBAR_COOKIE_NAME_LEFT = 'dual_sidebar_left_state';
const DUAL_SIDEBAR_COOKIE_NAME_RIGHT = 'dual_sidebar_right_state';
const DUAL_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const DUAL_SIDEBAR_LEFT_WIDTH = '16rem';
const DUAL_SIDEBAR_LEFT_WIDTH_MOBILE = '18rem';
const DUAL_SIDEBAR_LEFT_WIDTH_ICON = '3rem';
const DUAL_SIDEBAR_RIGHT_WIDTH = '24rem';
const DUAL_SIDEBAR_RIGHT_WIDTH_MOBILE = '20rem';
const DUAL_SIDEBAR_RIGHT_WIDTH_ICON = '3rem';
const DUAL_SIDEBAR_KEYBOARD_SHORTCUT_LEFT = 'b';
const DUAL_SIDEBAR_KEYBOARD_SHORTCUT_RIGHT = 'j';

// Utility function to read cookie value
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

type DualSidebarContextProps = {
  leftState: 'expanded' | 'collapsed';
  rightState: 'expanded' | 'collapsed';
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  leftOpenMobile: boolean;
  rightOpenMobile: boolean;
  setLeftOpenMobile: (open: boolean) => void;
  setRightOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
};

const DualSidebarContext = React.createContext<DualSidebarContextProps | null>(null);

function useDualSidebar() {
  const context = React.useContext(DualSidebarContext);
  if (!context) {
    throw new Error('useDualSidebar must be used within a DualSidebarProvider.');
  }

  return context;
}

function DualSidebarProvider({
  defaultLeftOpen = true,
  defaultRightOpen = false,
  leftOpen: leftOpenProp,
  rightOpen: rightOpenProp,
  onLeftOpenChange: setLeftOpenProp,
  onRightOpenChange: setRightOpenProp,
  offsetTop = 'var(--header-height, 0px)',
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultLeftOpen?: boolean;
  defaultRightOpen?: boolean;
  leftOpen?: boolean;
  rightOpen?: boolean;
  onLeftOpenChange?: (open: boolean) => void;
  onRightOpenChange?: (open: boolean) => void;
  offsetTop?: string;
}) {
  const isMobile = useIsMobile();
  const [leftOpenMobile, setLeftOpenMobile] = React.useState(false);
  const [rightOpenMobile, setRightOpenMobile] = React.useState(false);

  // Read saved sidebar states from cookies
  // Read saved sidebar states from cookies
  const getInitialLeftOpen = () => {
    const savedState = getCookieValue(DUAL_SIDEBAR_COOKIE_NAME_LEFT);
    return savedState !== null ? savedState === 'true' : defaultLeftOpen;
  };

  const getInitialRightOpen = () => {
    const savedState = getCookieValue(DUAL_SIDEBAR_COOKIE_NAME_RIGHT);
    return savedState !== null ? savedState === 'true' : defaultRightOpen;
  };

  // Internal state for left sidebar
  const [_leftOpen, _setLeftOpen] = React.useState(getInitialLeftOpen);
  const leftOpen = leftOpenProp ?? _leftOpen;
  const setLeftOpen = (value: boolean | ((value: boolean) => boolean)) => {
    const openState = typeof value === 'function' ? value(leftOpen) : value;
    if (setLeftOpenProp) {
      setLeftOpenProp(openState);
    } else {
      _setLeftOpen(openState);
    }
  };

  // Save left sidebar state to cookie
  React.useEffect(() => {
    document.cookie = `${DUAL_SIDEBAR_COOKIE_NAME_LEFT}=${leftOpen}; path=/; max-age=${DUAL_SIDEBAR_COOKIE_MAX_AGE}`;
  }, [leftOpen]);

  // Internal state for right sidebar
  const [_rightOpen, _setRightOpen] = React.useState(getInitialRightOpen);
  const rightOpen = rightOpenProp ?? _rightOpen;
  const setRightOpen = (value: boolean | ((value: boolean) => boolean)) => {
    const openState = typeof value === 'function' ? value(rightOpen) : value;
    if (setRightOpenProp) {
      setRightOpenProp(openState);
    } else {
      _setRightOpen(openState);
    }
  };

  // Save right sidebar state to cookie
  React.useEffect(() => {
    document.cookie = `${DUAL_SIDEBAR_COOKIE_NAME_RIGHT}=${rightOpen}; path=/; max-age=${DUAL_SIDEBAR_COOKIE_MAX_AGE}`;
  }, [rightOpen]);

  // Toggle functions
  const toggleLeftSidebar = () => {
    return isMobile ? setLeftOpenMobile((open) => !open) : setLeftOpen((open) => !open);
  };

  const toggleRightSidebar = () => {
    return isMobile ? setRightOpenMobile((open) => !open) : setRightOpen((open) => !open);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (event.key === DUAL_SIDEBAR_KEYBOARD_SHORTCUT_LEFT) {
        event.preventDefault();
        if (isMobile) {
          setLeftOpenMobile((open) => !open);
        } else if (setLeftOpenProp) {
          setLeftOpenProp(!leftOpen);
        } else {
          _setLeftOpen((open) => !open);
        }
      } else if (event.key === DUAL_SIDEBAR_KEYBOARD_SHORTCUT_RIGHT) {
        event.preventDefault();
        if (isMobile) {
          setRightOpenMobile((open) => !open);
        } else if (setRightOpenProp) {
          setRightOpenProp(!rightOpen);
        } else {
          _setRightOpen((open) => !open);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isMobile,
    leftOpen,
    rightOpen,
    setLeftOpenMobile,
    setRightOpenMobile,
    setLeftOpenProp,
    setRightOpenProp,
    _setLeftOpen,
    _setRightOpen,
  ]);

  const leftState = leftOpen ? 'expanded' : 'collapsed';
  const rightState = rightOpen ? 'expanded' : 'collapsed';

  const contextValue: DualSidebarContextProps = {
    leftState,
    rightState,
    leftOpen,
    rightOpen,
    setLeftOpen,
    setRightOpen,
    isMobile,
    leftOpenMobile,
    rightOpenMobile,
    setLeftOpenMobile,
    setRightOpenMobile,
    toggleLeftSidebar,
    toggleRightSidebar,
  };

  return (
    <DualSidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="dual-sidebar-wrapper"
          style={
            {
              '--dual-sidebar-left-width': DUAL_SIDEBAR_LEFT_WIDTH,
              '--dual-sidebar-left-width-icon': DUAL_SIDEBAR_LEFT_WIDTH_ICON,
              '--dual-sidebar-right-width': DUAL_SIDEBAR_RIGHT_WIDTH,
              '--dual-sidebar-right-width-icon': DUAL_SIDEBAR_RIGHT_WIDTH_ICON,
              '--dual-sidebar-offset-top': offsetTop,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            'group/dual-sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-full w-full',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </DualSidebarContext.Provider>
  );
}

function DualSidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const {
    isMobile,
    leftState,
    rightState,
    leftOpenMobile,
    rightOpenMobile,
    setLeftOpenMobile,
    setRightOpenMobile,
  } = useDualSidebar();

  const state = side === 'left' ? leftState : rightState;
  const openMobile = side === 'left' ? leftOpenMobile : rightOpenMobile;
  const setOpenMobile = side === 'left' ? setLeftOpenMobile : setRightOpenMobile;

  if (collapsible === 'none') {
    return (
      <div
        data-slot="dual-sidebar"
        className={cn(
          'bg-sidebar text-sidebar-foreground flex h-full flex-col',
          side === 'left' ? 'w-(--dual-sidebar-left-width)' : 'w-(--dual-sidebar-right-width)',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="dual-sidebar"
          data-mobile="true"
          className={cn(
            'bg-sidebar text-sidebar-foreground p-0 [&>button]:hidden',
            side === 'left' ? 'w-(--dual-sidebar-left-width)' : 'w-(--dual-sidebar-right-width)',
          )}
          style={
            {
              '--dual-sidebar-left-width': DUAL_SIDEBAR_LEFT_WIDTH_MOBILE,
              '--dual-sidebar-right-width': DUAL_SIDEBAR_RIGHT_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{side === 'left' ? 'Left' : 'Right'} Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile {side} sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="dual-sidebar"
    >
      {/* Sidebar gap for spacing */}
      <div
        data-slot="dual-sidebar-gap"
        className={cn(
          'relative bg-transparent transition-[width] duration-200 ease-linear',
          side === 'left' ? 'w-(--dual-sidebar-left-width)' : 'w-(--dual-sidebar-right-width)',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? side === 'left'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--dual-sidebar-left-width-icon)+(--spacing(4)))]'
              : 'group-data-[collapsible=icon]:w-[calc(var(--dual-sidebar-right-width-icon)+(--spacing(4)))]'
            : side === 'left'
              ? 'group-data-[collapsible=icon]:w-(--dual-sidebar-left-width-icon)'
              : 'group-data-[collapsible=icon]:w-(--dual-sidebar-right-width-icon)',
        )}
      />
      <div
        data-slot="dual-sidebar-container"
        className={cn(
          'fixed top-(--dual-sidebar-offset-top) z-10 hidden h-[calc(100svh-var(--dual-sidebar-offset-top))] transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left' ? 'w-(--dual-sidebar-left-width)' : 'w-(--dual-sidebar-right-width)',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--dual-sidebar-left-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--dual-sidebar-right-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? side === 'left'
              ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--dual-sidebar-left-width-icon)+(--spacing(4))+2px)]'
              : 'p-2 group-data-[collapsible=icon]:w-[calc(var(--dual-sidebar-right-width-icon)+(--spacing(4))+2px)]'
            : side === 'left'
              ? 'group-data-[collapsible=icon]:w-(--dual-sidebar-left-width-icon) group-data-[side=left]:border-r'
              : 'group-data-[collapsible=icon]:w-(--dual-sidebar-right-width-icon) group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="dual-sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border relative flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function DualSidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="dual-sidebar-inset"
      className={cn('bg-background relative flex min-w-0 flex-1 flex-col', className)}
      {...props}
    />
  );
}

function DualSidebarTrigger({
  side = 'left',
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  side?: 'left' | 'right';
}) {
  const { toggleLeftSidebar, toggleRightSidebar } = useDualSidebar();
  const toggle = side === 'left' ? toggleLeftSidebar : toggleRightSidebar;
  const Icon = side === 'left' ? KeyboardDoubleArrowLeft : KeyboardDoubleArrowRight;

  return (
    <Button
      data-sidebar="trigger"
      data-slot="dual-sidebar-trigger"
      data-side={side}
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggle();
      }}
      {...props}
    >
      <Icon />
      <span className="sr-only">Toggle {side === 'left' ? 'Left' : 'Right'} Sidebar</span>
    </Button>
  );
}

function DualSidebarRail({
  side = 'left',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  side?: 'left' | 'right';
}) {
  const { toggleLeftSidebar, toggleRightSidebar } = useDualSidebar();
  const toggle = side === 'left' ? toggleLeftSidebar : toggleRightSidebar;

  return (
    <button
      data-sidebar="rail"
      data-slot="dual-sidebar-rail"
      data-side={side}
      aria-label={`Toggle ${side === 'left' ? 'Left' : 'Right'} Sidebar`}
      tabIndex={-1}
      onClick={toggle}
      title={`Toggle ${side === 'left' ? 'Left' : 'Right'} Sidebar`}
      className={cn(
        'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  );
}

// Re-export sidebar components that work with dual sidebar
export {
  DualSidebar,
  DualSidebarProvider,
  DualSidebarInset,
  DualSidebarTrigger,
  DualSidebarRail,
  useDualSidebar,
};

// Create a compatible SidebarMenuButton that works with dual sidebar context
function DualSidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}) {
  const Comp = asChild ? Slot : 'button';
  const { isMobile, leftState } = useDualSidebar();

  // Use left state by default, but this could be enhanced to detect which sidebar we're in
  const state = leftState;

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'peer/menu-button ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        variant === 'outline' &&
          'bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
        size === 'sm' && 'h-7 text-xs',
        size === 'lg' && 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
        className,
      )}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
}

// Re-export individual sidebar components for use within DualSidebar
export {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from './sidebar';

// Export the dual sidebar compatible component
export { DualSidebarMenuButton as SidebarMenuButton };
