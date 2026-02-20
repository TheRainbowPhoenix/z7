import { v4 as uuid } from 'uuid';
import type { Log, LogSlice, StoreSlice } from '../types';

export const createLogSlice: StoreSlice<LogSlice> = (set) => ({
  logs: [],

  addLog: (log) =>
    set((state) => {
      const newLog: Log = { id: `log-${uuid()}`, ...log };
      state.logs.push(newLog);

      if (log.type === 'error' || log.type === 'warning') {
        if (!state.editors.statusPanel.isOpen) {
          state.editors.statusPanel.isOpen = true;
          state.editors.statusPanel.activeTab = log.type === 'error' ? 'errors' : 'warnings';
          state.editors.statusPanel.unreadErrorCount = 0;
        } else if (log.type === 'error') {
          state.editors.statusPanel.unreadErrorCount += 1;
        }
      }
    }),

  logRoutineVerification: ({ fileName }) =>
    set((state) => {
      state.logs = [
        {
          id: `log-${uuid()}`,
          message: `Verifying ${fileName}...`,
          type: 'info',
        },
      ];
    }),

  clearLogs: () =>
    set((state) => {
      state.logs = [];
    }),
});
