import React from 'react';
import {
  DualSidebar,
  SidebarContent,
  SidebarFooter,
  DualSidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/dual-sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ChevronRight, FolderOpenOutlined } from '@mui/icons-material';
import { StFileIcon } from '@/components/icons/st-file-icon';
import { DriveFileRenameOutline } from '@mui/icons-material';
import { LadderFileIcon } from '@/components/icons/ladder-file-icon';
import { useStore } from '@/store/store';
import LibraryNavMain from './aoi-definitions';
import { RenameAoiDialog } from './aoi-dialogs';
import packageJson from '../../../package.json';

export default function Library() {
  const studioVersion = packageJson.version;
  const currentAOI = useStore((state) => state.aoi);
  const isAoiModified = useStore((state) => state.isAoiModified);
  const collapsibleSections = useStore((state) => state.editors.ui.collapsibleSections);
  const toggleCollapsibleSection = useStore((state) => state.toggleCollapsibleSection);
  const renameAoi = useStore((state) => state.renameAoi);

  const isDraftOpen = collapsibleSections['draft-aoi'] ?? true;
  const draftLabel = currentAOI?.name ?? 'No AOI selected';
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);

  function handleDraftToggle(isOpen: boolean) {
    toggleCollapsibleSection({ sectionId: 'draft-aoi', isOpen });
  }

  function handleRename(name: string) {
    renameAoi(name);
    setIsRenameDialogOpen(false);
  }

  return (
    <DualSidebar side="left" collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm">Library</SidebarGroupLabel>
          <SidebarMenu>
            <Collapsible asChild open={isDraftOpen} onOpenChange={handleDraftToggle}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Draft">
                  <span>
                    <FolderOpenOutlined className="text-slate-700" />
                    <span>Draft</span>
                  </span>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="data-[state=open]:rotate-90">
                    <ChevronRight className="text-slate-700" />
                    <span className="sr-only">Toggle</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <SidebarMenuSubButton asChild aria-disabled={!currentAOI}>
                            <div className="flex w-full cursor-default items-center gap-2 select-none">
                              {currentAOI?.routines.Logic.type === 'ld' ? (
                                <LadderFileIcon className="size-6 shrink-0 text-slate-700" />
                              ) : (
                                <StFileIcon className="size-6 shrink-0 text-slate-700" />
                              )}
                              <span className="flex flex-1 items-center gap-2">
                                <span
                                  className={`truncate text-slate-900 ${
                                    currentAOI ? 'font-medium' : ''
                                  }`}
                                >
                                  {draftLabel}
                                </span>
                                {isAoiModified && currentAOI ? (
                                  <span
                                    aria-hidden="true"
                                    className="ml-auto inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-600"
                                  />
                                ) : null}
                              </span>
                            </div>
                          </SidebarMenuSubButton>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            onSelect={() => {
                              if (!currentAOI) return;
                              setIsRenameDialogOpen(true);
                            }}
                            disabled={!currentAOI}
                          >
                            <DriveFileRenameOutline className="mr-2 h-4 w-4 text-slate-700" />
                            Rename draft
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <LibraryNavMain
              instructionExamplesTitle="Instruction Examples"
              exampleAoisTitle="Example AOIs"
            />
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2">
          <nav className="text-muted-foreground flex flex-col gap-1 text-sm">
            <a
              href="https://rungs.dev/docs/intro"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1 transition-colors"
            >
              Documentation
            </a>
            <a
              href="https://github.com/rungs-dev/community/issues"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1 transition-colors"
            >
              Report an Issue
            </a>
            <a
              href="https://github.com/rungs-dev/community/discussions"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1 transition-colors"
            >
              Community Discussions
            </a>
            <a
              href="https://github.com/rungs-dev/community/blob/main/changelogs/apps/studio.md"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1 transition-colors"
            >
              Studio v{studioVersion}
            </a>
          </nav>
        </div>
      </SidebarFooter>
      <DualSidebarRail side="left" />
      <RenameAoiDialog
        key={currentAOI?.name ?? 'rename-aoi'}
        open={isRenameDialogOpen}
        initialName={currentAOI?.name ?? ''}
        onConfirm={handleRename}
        onCancel={() => setIsRenameDialogOpen(false)}
      />
    </DualSidebar>
  );
}
