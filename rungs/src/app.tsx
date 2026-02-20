import { useEffect, useRef } from 'react';
import { DualSidebarProvider, DualSidebarInset } from '@/components/ui/dual-sidebar';
import { MobileGate } from '@/components/mobile/mobile-gate';
import { useIsMobile } from '@/hooks/use-mobile';
import Editors from './components/editors/editors';
import StatusPanel from './components/status/status-panel';
import Library from './components/leftbar/library';
import Simulation from './components/rightbar/simulation';
import Standard from './components/toolbar/standard';
import { useStore } from './store/store';
import { exampleAOIs } from './lib/aoi-examples';
import { instructionExampleAOIs } from './lib/instruction-examples';
import { useSimulationLogs } from './hooks/use-simulation-logs';
import { simulationManager } from './lib/simulation-manager';
import { useShareLoader } from './hooks/use-share-loader';
import { SharedAoiReplaceDialog } from './components/share/shared-aoi-replace-dialog';
import type { AOIDefinition } from '@repo/plc-core';

function App() {
  const isMobile = useIsMobile();
  const statusPanel = useStore((state) => state.editors.statusPanel);
  const loadInstructionExamples = useStore((state) => state.loadInstructionExamples);
  const loadExampleAois = useStore((state) => state.loadExampleAois);
  const currentAOI = useStore((state) => state.aoi);
  const loadedAoiRef = useRef<AOIDefinition | null>(null);

  const { state: shareState, confirmLoad, cancelLoad } = useShareLoader();
  useSimulationLogs(!isMobile);

  useEffect(() => {
    if (isMobile) return;
    loadInstructionExamples(instructionExampleAOIs);
    loadExampleAois(exampleAOIs);
  }, [isMobile, loadExampleAois, loadInstructionExamples]);

  useEffect(() => {
    if (isMobile) return;
    if (currentAOI === loadedAoiRef.current) {
      return;
    }

    if (loadedAoiRef.current) {
      simulationManager.unloadAOI();
      loadedAoiRef.current = null;
    }

    if (currentAOI) {
      simulationManager.loadAOI(currentAOI);
      loadedAoiRef.current = currentAOI;
    }
  }, [currentAOI, isMobile]);

  useEffect(() => {
    if (!isMobile || !loadedAoiRef.current) return;
    simulationManager.unloadAOI();
    loadedAoiRef.current = null;
  }, [isMobile]);

  useEffect(
    () => () => {
      if (loadedAoiRef.current) {
        simulationManager.unloadAOI();
        loadedAoiRef.current = null;
      }
    },
    [],
  );

  const { isOpen: isStatusPanelOpen, height: statusPanelHeight } = statusPanel;

  const STATUS_BAR_HEIGHT = 40;
  const bottomPadding = isStatusPanelOpen ? statusPanelHeight : STATUS_BAR_HEIGHT;

  if (isMobile) {
    return <MobileGate />;
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="h-screen w-screen overflow-hidden [--header-height:calc(--spacing(10))]"
    >
      <DualSidebarProvider className="flex flex-col" defaultRightOpen>
        <Standard />
        <div className="flex flex-1 overflow-hidden">
          <Library />
          <DualSidebarInset
            className="flex min-w-0 flex-col overflow-hidden"
            style={{ paddingBottom: `${bottomPadding}px` }}
          >
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {shareState.status === 'loading' ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-sm text-muted-foreground">Loading shared AOI…</div>
                </div>
              ) : (
                <Editors />
              )}
            </div>
            <StatusPanel />
          </DualSidebarInset>
          <Simulation />
        </div>
      </DualSidebarProvider>

      <SharedAoiReplaceDialog
        open={shareState.status === 'confirm'}
        onOpenChange={(open) => !open && cancelLoad()}
        onCancel={cancelLoad}
        onConfirm={confirmLoad}
      />
    </div>
  );
}

export default App;
