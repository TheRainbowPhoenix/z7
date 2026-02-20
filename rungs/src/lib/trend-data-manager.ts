/**
 * Trend Data Manager
 *
 * Singleton that manages trend chart data independently of React component lifecycle.
 * This allows chart data to persist when switching tabs.
 *
 * Auto-collects data from the simulation manager when running.
 */

import { simulationManager } from './simulation-manager';

export interface TrendDataPoint {
  timestamp: number; // Unix timestamp for precise ordering
  [signal: string]: number;
}

type TrendDataCallback = (data: TrendDataPoint[]) => void;

class TrendDataManager {
  private callbacks = new Set<TrendDataCallback>();
  private simulationUnsubscribe: (() => void) | null = null;
  private managerUnsubscribe: (() => void) | null = null;

  // Proxy to simulator trend data
  getData(): TrendDataPoint[] {
    return simulationManager.getTrendData();
  }

  // Optional: allow UI to subscribe for batched updates
  subscribe(callback: TrendDataCallback): () => void {
    this.callbacks.add(callback);
    // Immediately notify with current data
    callback(this.getData());

    if (this.callbacks.size === 1) {
      this.startListening();
    }

    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.stopListening();
      }
    };
  }

  clear(): void {
    // Simulator has the source of truth; clearing via window set to zero then back
    simulationManager.setTrendWindow(0);
    simulationManager.setTrendWindow(60_000);
    this.notifyCallbacks();
  }

  setWindow(windowMs: number): void {
    simulationManager.setTrendWindow(windowMs);
    this.notifyCallbacks();
  }

  private notifyCallbacks(): void {
    const dataCopy = this.getData();
    this.callbacks.forEach((callback) => callback(dataCopy));
  }

  private startListening(): void {
    if (!this.managerUnsubscribe) {
      this.managerUnsubscribe = simulationManager.subscribe(() => {
        this.attachSimulation();
      });
    }

    this.attachSimulation();
  }

  private stopListening(): void {
    if (this.simulationUnsubscribe) {
      this.simulationUnsubscribe();
      this.simulationUnsubscribe = null;
    }

    if (this.managerUnsubscribe) {
      this.managerUnsubscribe();
      this.managerUnsubscribe = null;
    }
  }

  private attachSimulation(): void {
    if (this.simulationUnsubscribe) {
      this.simulationUnsubscribe();
      this.simulationUnsubscribe = null;
    }

    if (!simulationManager.hasAOI()) {
      return;
    }

    // Subscribe to the underlying AOI simulator if available so we capture every scan cycle.
    this.simulationUnsubscribe = simulationManager.subscribeToSimulation(() => {
      if (this.callbacks.size > 0) {
        this.notifyCallbacks();
      }
    });

    if (this.callbacks.size > 0) {
      this.notifyCallbacks();
    }
  }
}

export const trendDataManager = new TrendDataManager();
