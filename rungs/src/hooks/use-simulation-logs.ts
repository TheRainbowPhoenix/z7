import { useEffect } from 'react';
import { useStore } from '@/store/store';
import { simulationManager } from '@/lib/simulation-manager';

export function useSimulationLogs(enabled = true) {
  const addLog = useStore((state) => state.addLog);

  useEffect(() => {
    if (!enabled) return undefined;
    return simulationManager.subscribeToLogs(({ level, message, code }) => {
      if (message) {
        addLog({ type: level, message, code });
      }
    });
  }, [addLog, enabled]);
}
