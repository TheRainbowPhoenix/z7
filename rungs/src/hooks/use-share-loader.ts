import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/store';
import { extractShareId, getShare, incrementForkCount } from '@/lib/aoi-share-service';
import { openAOIWithTabs } from '@/components/leftbar/aoi-actions';
import { getFirstTimeExampleAOI } from '@/lib/aoi-examples';
import type { AOIDefinition } from '@repo/plc-core';

export type ShareLoadState =
  | { status: 'idle' }
  | { status: 'loading'; shareId: string }
  | { status: 'confirm'; shareId: string; aoi: AOIDefinition }
  | { status: 'error'; message: string }
  | { status: 'loaded' };

export function useShareLoader() {
  const initialShareId = extractShareId(window.location.pathname);
  const shareIdRef = useRef<string | null>(initialShareId);
  const [state, setState] = useState<ShareLoadState>(() =>
    initialShareId ? { status: 'loading', shareId: initialShareId } : { status: 'idle' },
  );
  const addLog = useStore((s) => s.addLog);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    const shareId = shareIdRef.current;
    if (!shareId) return;

    const loadShare = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      const result = await getShare(shareId);

      if (!result.success) {
        window.history.replaceState(null, '', '/');
        shareIdRef.current = null;
        setState({ status: 'error', message: result.error });
        addLog({ type: 'error', message: `Failed to load shared AOI: ${result.error}` });

        const currentAoi = useStore.getState().aoi;
        if (!currentAoi) {
          const { loadAoi, openAoiTabs, openAoiRoutine } = useStore.getState();
          const fallbackAOI = getFirstTimeExampleAOI();
          const routines = Object.keys(fallbackAOI.routines).filter(
            (key): key is 'Logic' | 'Prescan' | 'EnableInFalse' =>
              fallbackAOI.routines[key as keyof typeof fallbackAOI.routines] !== undefined,
          );

          const draft: AOIDefinition = structuredClone(fallbackAOI);
          loadAoi(draft);
          openAoiTabs({ aoiName: fallbackAOI.name, routines });
          openAoiRoutine({ aoiName: fallbackAOI.name, routineName: 'Logic' });
          addLog({ type: 'info', message: `Loaded ${fallbackAOI.name} example as fallback` });
        }

        isLoadingRef.current = false;
        return;
      }

      const currentAoi = useStore.getState().aoi;
      if (currentAoi) {
        setState({ status: 'confirm', shareId, aoi: result.aoi });
        isLoadingRef.current = false;
        return;
      }

      try {
        openAOIWithTabs(result.aoi);
        await incrementForkCount(shareId);

        window.history.replaceState(null, '', '/');
        shareIdRef.current = null;
        setState({ status: 'loaded' });
        addLog({ type: 'info', message: `Loaded shared AOI "${result.aoi.name}"` });
      } finally {
        isLoadingRef.current = false;
      }
    };

    if (useStore.persist.hasHydrated()) {
      loadShare();
      return;
    }

    return useStore.persist.onFinishHydration(loadShare);
  }, [addLog]);

  async function confirmLoad() {
    if (state.status !== 'confirm') return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setState({ status: 'loading', shareId: state.shareId });

    try {
      openAOIWithTabs(state.aoi);
      await incrementForkCount(state.shareId);

      window.history.replaceState(null, '', '/');
      shareIdRef.current = null;
      setState({ status: 'loaded' });
      addLog({ type: 'info', message: `Loaded shared AOI "${state.aoi.name}"` });
    } finally {
      isLoadingRef.current = false;
    }
  }

  function cancelLoad() {
    window.history.replaceState(null, '', '/');
    shareIdRef.current = null;
    setState({ status: 'idle' });
  }

  return { state, confirmLoad, cancelLoad };
}
