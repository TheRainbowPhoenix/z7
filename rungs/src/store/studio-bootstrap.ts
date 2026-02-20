import { getFirstTimeExampleAOI } from '@/lib/aoi-examples';
import { extractShareId } from '@/lib/aoi-share-service';
import type { AOIDefinition } from '@repo/plc-core';
import { useStore } from './store';
import { analytics } from '@/lib/posthog-analytics';

let didRegister = false;

export function registerStudioBootstrap(): void {
  if (didRegister) return;
  didRegister = true;

  if (typeof window === 'undefined') return;

  const shareId = extractShareId(window.location.pathname);
  if (shareId) return;

  const bootstrap = () => {
    const {
      aoi,
      loadAoi,
      openAoiTabs,
      openAoiRoutine,
    } = useStore.getState();
    if (aoi) return;

    const exampleAOI = getFirstTimeExampleAOI();
    const routines = Object.keys(exampleAOI.routines).filter(
      (key): key is 'Logic' | 'Prescan' | 'EnableInFalse' =>
        exampleAOI.routines[key as keyof typeof exampleAOI.routines] !== undefined,
    );

    const draft: AOIDefinition = structuredClone(exampleAOI);
    loadAoi(draft);
    openAoiTabs({ aoiName: exampleAOI.name, routines });
    openAoiRoutine({ aoiName: exampleAOI.name, routineName: 'Logic' });
    analytics.trackDefaultExampleBootstrapped(exampleAOI.name);
  };

  if (useStore.persist.hasHydrated()) {
    bootstrap();
    return;
  }

  useStore.persist.onFinishHydration(bootstrap);
}
