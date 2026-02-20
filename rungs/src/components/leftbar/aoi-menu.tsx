import React from 'react';
import type { AOIDefinition } from '@repo/plc-core';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { FileDownloadOutlined, MenuBookOutlined } from '@mui/icons-material';
import { openAOIWithTabs } from './aoi-actions';
import { exportAOI } from '@/lib/aoi-file-export';

type Props = {
  children: React.ReactNode;
  aoi: AOIDefinition;
  onOpen?: () => void;
};

export function AOIMenu({ children, aoi, onOpen }: Props) {
  const handleExport = async () => {
    try {
      await exportAOI(aoi, 'rungs');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Export failed', error);
    }
  };

  const handleUseInProject = () => {
    openAOIWithTabs(aoi);
  };

  const handleOpen = onOpen ?? handleUseInProject;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleOpen}>
          <MenuBookOutlined className="mr-2 h-4 w-4 text-slate-700" />
          <span className="font-semibold">Open</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExport}>
          <FileDownloadOutlined className="mr-2 h-4 w-4 text-slate-700" />
          Save to...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
