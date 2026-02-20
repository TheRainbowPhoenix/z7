import { useState } from 'react';
import { useStore } from '@/store/store';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileDownloadOutlined, CodeOutlined } from '@mui/icons-material';
import { exportAOI, isDevMode } from '@/lib/aoi-file-export';
import type { ExportFormat } from '@/lib/aoi-file-export';

export default function ExportAOIButton() {
  const currentAOI = useStore((s) => s.aoi);
  const markAoiAsSaved = useStore((s) => s.markAoiAsSaved);
  const addLog = useStore((s) => s.addLog);
  const openStatusPanelWithTab = useStore((s) => s.openStatusPanelWithTab);
  const [isSaving, setIsSaving] = useState(false);

  const performExport = async (format: ExportFormat) => {
    if (!currentAOI) return;
    setIsSaving(true);
    try {
      await exportAOI(currentAOI, format);
      markAoiAsSaved();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      addLog({
        message: 'Failed to export AOI',
        type: 'error',
      });
      openStatusPanelWithTab('errors');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton disabled={!currentAOI || isSaving} onClick={() => performExport('rungs')}>
            <FileDownloadOutlined className="size-6" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>
          <p>Save to... (.rungs)</p>
        </TooltipContent>
      </Tooltip>

      {isDevMode() && (
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton disabled={!currentAOI || isSaving} onClick={() => performExport('dsl')}>
              <CodeOutlined className="size-6" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save to... (.dsl)</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
