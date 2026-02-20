import { useSyncExternalStore } from 'react';
import { simulationManager } from '@/lib/simulation-manager';
import type { SimulationState, SimulationMetrics } from '@/lib/aoi-simulator';
import type { ParameterValue, ArrayParameterValue } from '@repo/plc-core';

export function useSimulationState(): SimulationState | null {
  return useSyncExternalStore(
    (callback) => simulationManager.subscribeToSimulation(callback),
    () => simulationManager.getState(),
    () => null,
  );
}

export function useIsSimulationRunning(): boolean {
  return useSyncExternalStore(
    (callback) => simulationManager.subscribe(() => callback()),
    () => simulationManager.isRunning(),
    () => false,
  );
}

export function useSimulationMetrics(): SimulationMetrics | null {
  return useSyncExternalStore(
    (callback) => simulationManager.subscribeToSimulation(callback),
    () => simulationManager.getMetrics(),
    () => null,
  );
}

const simulationActions = {
  start: () => simulationManager.start(),
  stop: () => simulationManager.stop(),
  updateParameter: (name: string, value: ParameterValue) =>
    simulationManager.updateParameter(name, value),
  updateLocalTag: (name: string, value: ParameterValue | ArrayParameterValue) =>
    simulationManager.updateLocalTag(name, value),
} as const;

export function useSimulationActions() {
  return simulationActions;
}
