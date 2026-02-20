import { AOISimulator, type RuntimeLogEvent } from './aoi-simulator';
import type { AOIDefinition, ParameterValue, ArrayParameterValue } from '@repo/plc-core';
import type { SimulationState, SimulationMetrics } from './aoi-simulator';
import type { TrendDataPoint } from './trend-data-manager';
import { analytics } from './posthog-analytics';
import { nanoid } from 'nanoid';

export interface SimulationManager {
  start(): void;
  stop(): void;

  loadAOI(aoi: AOIDefinition): void;
  unloadAOI(): void;

  isRunning(): boolean;
  hasAOI(): boolean;

  getMetrics(): SimulationMetrics | null;

  subscribe(callback: (state: SimulationManagerState) => void): () => void;
  subscribeToSimulation(callback: () => void): () => void;
  subscribeToLogs(callback: (event: RuntimeLogEvent) => void): () => void;

  updateParameter(parameterName: string, value: ParameterValue): void;
  updateLocalTag(tagName: string, value: ParameterValue | ArrayParameterValue): void;

  getState(): SimulationState | null;

  getTrendData(): TrendDataPoint[];
  setTrendWindow(windowMs: number): void;
}

export interface SimulationManagerState {
  aoiName: string | null;
  isRunning: boolean;
  state: SimulationState | null;
  metrics: SimulationMetrics | null;
}

class SimulationManagerImpl implements SimulationManager {
  private simulator: AOISimulator | null = null;
  private aoiName: string | null = null;
  private subscribers = new Set<(state: SimulationManagerState) => void>();
  private startTime: number | null = null;
  private logSubscribers = new Set<(event: RuntimeLogEvent) => void>();
  private simulatorLogUnsubscribe: (() => void) | null = null;
  private runId: string | null = null;
  private cycleCount: number = 0;
  private currentAoi: AOIDefinition | null = null;
  private inputChangeCount: number = 0;
  private uniqueInputsChanged = new Set<string>();

  private simulationSubscribers = new Set<() => void>();
  private simulatorSubscriptionUnsubscribe: (() => void) | null = null;

  private cachedState: SimulationState | null = null;
  private cachedMetrics: SimulationMetrics | null = null;

  start(): void {
    if (!this.simulator) {
      console.warn('No AOI loaded to start simulation');
      return;
    }

    try {
      if (!this.simulator.getState().isRunning) {
        this.startTime = Date.now();
        this.runId = nanoid();
        this.cycleCount = 0;
        this.inputChangeCount = 0;
        this.uniqueInputsChanged.clear();
        this.simulator.start();
        analytics.trackSimulationStarted(this.currentAoi, this.runId);
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }

    this.updateCachedState();
    this.notifySimulationSubscribers();
    this.notifySubscribers();
  }

  stop(): void {
    if (!this.simulator) return;

    try {
      if (this.simulator.getState().isRunning) {
        const durationMs = this.startTime ? Date.now() - this.startTime : 0;
        const metrics = this.simulator.getMetrics();
        this.cycleCount = metrics?.scanCount ?? 0;
        this.simulator.stop();

        if (this.runId) {
          analytics.trackSimulationCompleted({
            aoi: this.currentAoi,
            runId: this.runId,
            durationMs,
            durationCycles: this.cycleCount,
            inputChangeCount: this.inputChangeCount,
            uniqueInputsChanged: this.uniqueInputsChanged.size,
            language: this.currentAoi?.routines.Logic.type ?? 'st',
          });
        }
      }
    } catch (error) {
      console.error('Failed to stop simulation:', error);
    }

    this.startTime = null;
    this.runId = null;
    this.updateCachedState();
    this.notifySimulationSubscribers();
    this.notifySubscribers();
  }

  loadAOI(aoi: AOIDefinition): void {
    this.unloadAOI();

    this.aoiName = aoi.name;
    this.currentAoi = aoi;
    this.simulator = new AOISimulator();
    this.simulatorLogUnsubscribe = this.simulator.subscribeToRuntimeLogs((event) => {
      this.notifyLogSubscribers(event);
    });

    try {
      this.simulator.loadAOI(aoi);

      // Subscribe to simulator updates and forward to simulation subscribers
      this.setupSimulatorSubscription();

      this.updateCachedState();
      this.notifySimulationSubscribers();
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to load AOI:', error);
      this.simulator = null;
      this.aoiName = null;
      if (this.simulatorLogUnsubscribe) {
        this.simulatorLogUnsubscribe();
        this.simulatorLogUnsubscribe = null;
      }
    }
  }

  unloadAOI(): void {
    if (this.simulator) {
      try {
        this.simulator.stop();
      } catch (error) {
        console.error('Failed to stop simulator during unload:', error);
      }
    }

    if (this.simulatorLogUnsubscribe) {
      this.simulatorLogUnsubscribe();
      this.simulatorLogUnsubscribe = null;
    }

    if (this.simulatorSubscriptionUnsubscribe) {
      this.simulatorSubscriptionUnsubscribe();
      this.simulatorSubscriptionUnsubscribe = null;
    }

    this.simulator = null;
    this.aoiName = null;
    this.currentAoi = null;
    this.startTime = null;
    this.runId = null;
    this.cycleCount = 0;
    this.cachedState = null;
    this.cachedMetrics = null;
    this.notifySimulationSubscribers();
    this.notifySubscribers();
  }

  isRunning(): boolean {
    return this.cachedState?.isRunning ?? false;
  }

  hasAOI(): boolean {
    return this.simulator !== null;
  }

  getMetrics(): SimulationMetrics | null {
    return this.cachedMetrics;
  }

  subscribe(callback: (state: SimulationManagerState) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  subscribeToSimulation(callback: () => void): () => void {
    this.simulationSubscribers.add(callback);
    return () => {
      this.simulationSubscribers.delete(callback);
    };
  }

  subscribeToLogs(callback: (event: RuntimeLogEvent) => void): () => void {
    this.logSubscribers.add(callback);
    return () => {
      this.logSubscribers.delete(callback);
    };
  }

  updateParameter(parameterName: string, value: ParameterValue): void {
    if (!this.simulator) {
      console.warn('No simulator available for parameter update');
      return;
    }

    try {
      this.simulator.updateParameter(parameterName, value);
      this.inputChangeCount++;
      this.uniqueInputsChanged.add(parameterName);
    } catch (error) {
      console.error(`Failed to update parameter ${parameterName}:`, error);
    }
  }

  updateLocalTag(tagName: string, value: ParameterValue | ArrayParameterValue): void {
    if (!this.simulator) {
      console.warn('No simulator available for local tag update');
      return;
    }

    try {
      this.simulator.updateLocalTag(tagName, value);
      this.inputChangeCount++;
      this.uniqueInputsChanged.add(tagName);
    } catch (error) {
      console.error(`Failed to update local tag ${tagName}:`, error);
    }
  }

  getState(): SimulationState | null {
    return this.cachedState;
  }

  getTrendData(): TrendDataPoint[] {
    if (!this.simulator) return [];
    return this.simulator.getTrendData();
  }

  setTrendWindow(windowMs: number): void {
    if (!this.simulator) return;
    this.simulator.setTrendWindow(windowMs);
  }

  private setupSimulatorSubscription(): void {
    if (!this.simulator) return;

    this.simulatorSubscriptionUnsubscribe = this.simulator.subscribe((state) => {
      this.cachedState = state;
      this.updateCachedMetrics();

      this.notifySimulationSubscribers();
    });
  }

  private updateCachedState(): void {
    if (this.simulator) {
      this.cachedState = this.simulator.getState();
    } else {
      this.cachedState = null;
    }
    this.updateCachedMetrics();
  }

  private updateCachedMetrics(): void {
    if (!this.simulator || !this.cachedState?.isRunning) {
      this.cachedMetrics = null;
      return;
    }

    const simulatorMetrics = this.simulator.getMetrics();
    if (!simulatorMetrics) {
      this.cachedMetrics = null;
      return;
    }

    this.cachedMetrics = {
      ...simulatorMetrics,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  private notifySimulationSubscribers(): void {
    this.simulationSubscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Simulation subscriber error:', error);
      }
    });
  }

  private notifyLogSubscribers(event: RuntimeLogEvent): void {
    this.logSubscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Simulation log subscriber error:', error);
      }
    });
  }

  private notifySubscribers(): void {
    const state: SimulationManagerState = {
      aoiName: this.aoiName,
      isRunning: this.isRunning(),
      state: this.cachedState,
      metrics: this.cachedMetrics,
    };

    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error('Subscriber callback error:', error);
      }
    });
  }
}

export const simulationManager: SimulationManager = new SimulationManagerImpl();
