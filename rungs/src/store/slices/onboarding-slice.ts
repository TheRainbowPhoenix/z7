import { createInitialOnboardingState } from '../initial-state';
import type { OnboardingSlice, StoreSlice } from '../types';

export const createOnboardingSlice: StoreSlice<OnboardingSlice> = (set) => ({
  onboarding: createInitialOnboardingState(),

  dismissStartButtonHighlight: () =>
    set((state) => {
      state.onboarding.hasSeenStartButtonHighlight = true;
    }),

  markTrendOpenedOnFirstStart: () =>
    set((state) => {
      state.onboarding.hasOpenedTrendOnFirstStart = true;
    }),

  resetOnboarding: () =>
    set((state) => {
      state.onboarding = createInitialOnboardingState();
    }),
});
