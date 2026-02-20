import React from 'react';
import { ChevronRight } from '@mui/icons-material';
import { StFileIcon } from '@/components/icons/st-file-icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/dual-sidebar';
import { AOIMenu } from './aoi-menu';
import { LadderFileIcon } from '@/components/icons/ladder-file-icon';
import type { AOIDefinition } from '@repo/plc-core';

type FolderItem = {
  title: string;
  id: string;
  aoi: AOIDefinition;
  isCurrent?: boolean;
  showUnsaved?: boolean;
};

type Props = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: FolderItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenAOI?: (aoi: AOIDefinition) => void;
};

export function AOIFolderSection({
  title,
  icon: Icon,
  items,
  isOpen,
  onOpenChange,
  onOpenAOI,
}: Props) {
  return (
    <Collapsible key={title} asChild open={isOpen} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={title}>
          <span>
            <Icon className="text-slate-700" />
            <span>{title}</span>
          </span>
        </SidebarMenuButton>
        {items.length > 0 && (
          <>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction className="data-[state=open]:rotate-90">
                <ChevronRight className="text-slate-700" />
                <span className="sr-only">Toggle</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {items.map((subItem) => (
                  <SidebarMenuSubItem key={subItem.id}>
                    <AOIMenu aoi={subItem.aoi} onOpen={() => onOpenAOI?.(subItem.aoi)}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={Boolean(subItem.isCurrent)}
                        onDoubleClick={() => {
                          onOpenAOI?.(subItem.aoi);
                        }}
                      >
                        <div className="flex w-full cursor-default items-center gap-2 select-none">
                          {subItem.aoi.routines.Logic.type === 'ld' ? (
                            <LadderFileIcon
                              className={cn(
                                'size-4 shrink-0 text-slate-700',
                                subItem.isCurrent && 'text-blue-600',
                              )}
                            />
                          ) : (
                            <StFileIcon
                              className={cn(
                                'size-4 shrink-0 text-slate-700',
                                subItem.isCurrent && 'text-blue-600',
                              )}
                            />
                          )}
                          <span className="flex flex-1 items-center gap-2">
                            <span
                              className={cn(
                                'truncate text-slate-900',
                                subItem.isCurrent && 'font-medium text-blue-600',
                              )}
                            >
                              {subItem.title}
                            </span>
                            {subItem.showUnsaved ? (
                              <>
                                <span className="sr-only">(unsaved changes)</span>
                                <span
                                  aria-hidden="true"
                                  className="ml-auto inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-600"
                                />
                              </>
                            ) : null}
                          </span>
                        </div>
                      </SidebarMenuSubButton>
                    </AOIMenu>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
}
