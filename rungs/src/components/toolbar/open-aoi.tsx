import { useCallback, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FolderOpenOutlined } from '@mui/icons-material';
import { openAOIFromFile } from '@/lib/aoi-file-import';
import { useStore } from '@/store/store';
import { analytics } from '@/lib/posthog-analytics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OpenAOI() {
  const isModified = useStore((s) => s.isAoiModified);
  const loadAoi = useStore((s) => s.loadAoi);
  const openAoiTabs = useStore((s) => s.openAoiTabs);
  const selectTab = useStore((s) => s.selectTab);
  const addLog = useStore((s) => s.addLog);
  const openStatusPanelWithTab = useStore((s) => s.openStatusPanelWithTab);
  const isOpeningRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const performOpen = useCallback(async () => {
    if (isOpeningRef.current) return;
    isOpeningRef.current = true;
    try {
      const aoi = await openAOIFromFile();

      // Local library disabled - import directly to workspace only
      loadAoi(structuredClone(aoi));
      analytics.trackAoiImported(aoi);

      // Open tabs for the new AOI
      const routines = Object.keys(aoi.routines).filter(
        (key): key is 'Logic' | 'Prescan' | 'EnableInFalse' =>
          aoi.routines[key as keyof typeof aoi.routines] !== undefined
      );

      openAoiTabs({
        aoiName: aoi.name,
        routines,
      });
      selectTab(0); // Select Tags tab
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const name =
        err && typeof err === 'object' && 'name' in err
          ? (err as { name?: string }).name
          : undefined;
      // Treat user cancellations as no-ops
      if (name === 'AbortError' || /cancelled/i.test(message)) return;
      addLog({
        message: `Failed to open AOI file${message ? `: ${message}` : ''}`,
        type: 'error',
      });
      openStatusPanelWithTab('errors');
    } finally {
      isOpeningRef.current = false;
    }
  }, [loadAoi, openAoiTabs, selectTab, addLog, openStatusPanelWithTab]);

  const beginOpen = useCallback(() => {
    if (isModified) {
      setConfirmOpen(true);
      return;
    }
    void performOpen();
  }, [isModified, performOpen]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <IconButton onClick={beginOpen}>
              <FolderOpenOutlined className="size-6" />
            </IconButton>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open AOI (.rungs)</p>
        </TooltipContent>
      </Tooltip>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the current draft. Opening a file will discard those
              changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void performOpen();
              }}
            >
              Discard and Open
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
