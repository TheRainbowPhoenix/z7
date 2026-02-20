import type { AOIDefinition } from '@repo/plc-core';
import { AoiNameSchema } from '@repo/plc-core';
import { useStore } from '@/store/store';
import { createEmptyAOI } from '@/lib/aoi-factory';
import { analytics } from '@/lib/posthog-analytics';

export function openAOIWithTabs(aoi: AOIDefinition, options?: { isNewAOI?: boolean }) {
  const { loadAoi, openAoiTabs } = useStore.getState();
  const draft = structuredClone(aoi);
  loadAoi(draft);

  const routines = Object.keys(aoi.routines).filter(
    (key): key is 'Logic' | 'Prescan' | 'EnableInFalse' =>
      aoi.routines[key as keyof typeof aoi.routines] !== undefined
  );

  openAoiTabs({
    aoiName: aoi.name,
    routines,
    isNewAOI: options?.isNewAOI,
  });
}

type CreateAOIResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

const UNTITLED_AOI_BASE_NAME = 'Untitled_AOI';

export function createNewAOIWithTabs(name?: string, language: 'st' | 'ld' = 'ld'): CreateAOIResult {
  const { addLog } = useStore.getState();
  const trimmed = name?.trim();
  if (name !== undefined && !trimmed) {
    return { success: false, message: 'Name is required.' };
  }

  const finalName = trimmed && trimmed.length > 0 ? trimmed : UNTITLED_AOI_BASE_NAME;
  const validation = AoiNameSchema.safeParse(finalName);
  if (!validation.success) {
    const message = validation.error.issues[0]?.message ?? 'Invalid AOI name.';
    return { success: false, message };
  }

  const newAOI = createEmptyAOI(validation.data, language);

  openAOIWithTabs(newAOI, { isNewAOI: true });
  analytics.trackAoiCreated(newAOI);

  addLog({
    type: 'info',
    message: `Created "${newAOI.name}".`,
  });

  return { success: true };
}
