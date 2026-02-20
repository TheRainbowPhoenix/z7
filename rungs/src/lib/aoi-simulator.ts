import type {
  AOIDefinition,
  ParameterValue,
  ArrayParameterValue,
  ParameterMap,
} from '@repo/plc-core';
import { ExecutionService, ExecutionTimeoutError } from './execution-service';
import { materializeValue, cloneValue, normalizeBool } from './materialize-tag';
import type { TrendDataPoint } from './trend-data-manager';

export interface SimulationConfig {
  scanTime: number;
  maxScanTime: number;
  enablePerformanceMetrics: boolean;
}

export interface SimulationRuntimeDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  code: string;
  rung?: number;
  element?: number;
}

export interface SimulationState {
  scanCount: number;
  isRunning: boolean;
  startTime: number | null;
  lastScanDuration: number;
  averageScanDuration: number;
  maxScanDuration: number;
  parameters: ParameterMap;
  localTags: ParameterMap;
  errors: string[];
  warnings: string[];
  runtimeDiagnostics: SimulationRuntimeDiagnostic[];
}

export interface SimulationMetrics {
  actualScanTime: number;
  targetScanTime: number;
  scanCount: number;
  uptime: number;
  efficiency: number;
}

export type SimulationCallback = (state: SimulationState) => void;

export type RuntimeLogLevel = 'info' | 'warning' | 'error';

export interface RuntimeLogEvent {
  level: RuntimeLogLevel;
  message: string;
  code?: string;
  rung?: number;
  element?: number;
}

export class AOISimulator {
  private aoi: AOIDefinition | null = null;
  private config: SimulationConfig;
  private state: SimulationState;
  private intervalId: number | null = null;
  private callbacks: Set<SimulationCallback> = new Set();
  private runtimeLogSubscribers = new Set<(event: RuntimeLogEvent) => void>();
  private scanDurations: number[] = [];
  private trendHistory: TrendDataPoint[] = [];
  private trendWindowMs = 60_000;
  private trendMaxPoints = 600;
  private isExecutingScan = false;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = {
      scanTime: 100,
      maxScanTime: 1000,
      enablePerformanceMetrics: true,
      ...config,
    };

    this.state = this.createInitialState();
    this.recalculateTrendCapacity();
  }

  private buildStateFromAOI(aoi: AOIDefinition): SimulationState {
    const newState = { ...this.createInitialState() };

    (aoi.tags ?? []).forEach((tag) => {
      const value = materializeValue(tag);

      if (tag.usage === 'local') {
        newState.localTags[tag.name] = value;
      } else {
        newState.parameters[tag.name] = value;
      }
    });

    this.ensureEnableTagDefaults(newState.parameters);

    return newState;
  }

  private createInitialState(): SimulationState {
    return {
      scanCount: 0,
      isRunning: false,
      startTime: null,
      lastScanDuration: 0,
      averageScanDuration: 0,
      maxScanDuration: 0,
      parameters: {},
      localTags: {},
      errors: [],
      warnings: [],
      runtimeDiagnostics: [],
    };
  }

  loadAOI(aoi: AOIDefinition): void {
    try {
      this.stop();
      this.aoi = aoi;
      ExecutionService.invalidateCacheForAOI(aoi.name).catch((error) => {
        console.error(`Failed to invalidate execution cache for ${aoi.name}`, error);
      });

      this.state = this.buildStateFromAOI(aoi);
      this.trendHistory = [];
      this.scanDurations = [];
      this.notifyCallbacks();
    } catch (error) {
      this.handleError(
        `Failed to load AOI: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  start(): void {
    if (!this.aoi) {
      this.handleError('No AOI loaded');
      return;
    }

    if (this.state.isRunning) {
      this.handleWarning('Simulation is already running');
      return;
    }

    try {
      this.state = this.buildStateFromAOI(this.aoi);
      this.trendHistory = [];
      this.scanDurations = [];

      this.state = {
        ...this.state,
        isRunning: true,
        startTime: Date.now(),
        scanCount: 0,
        errors: [],
        warnings: [],
      };

      this.captureTrendPoint(Date.now(), this.state.parameters);

      this.intervalId = window.setInterval(async () => {
        try {
          await this.executeScan();
        } catch (error) {
          this.handleError(
            `Simulation scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          this.stop();
        }
      }, this.config.scanTime);

      this.notifyCallbacks();
    } catch (error) {
      this.handleError(
        `Failed to start simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  stop(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = {
      ...this.state,
      isRunning: false,
      startTime: null,
    };

    this.notifyCallbacks();
  }

  reset(): void {
    this.stop();

    if (this.aoi) {
      this.loadAOI(this.aoi);
    }
  }

  updateParameter(parameterName: string, value: ParameterValue): void {
    if (!this.aoi) return;

    try {
      const allTags = this.aoi.tags || [];
      const targetTag = allTags.find((p) => p.name === parameterName);
      const isMutable = targetTag && targetTag.usage === 'input';

      if (isMutable) {
        const nextParameters = {
          ...this.state.parameters,
          [parameterName]: cloneValue(value),
        } as ParameterMap;

        this.ensureEnableTagDefaults(nextParameters);

        this.state = {
          ...this.state,
          parameters: nextParameters,
        };
        this.notifyCallbacks();
      } else {
        this.handleWarning(`Cannot update parameter '${parameterName}': not an input parameter`);
      }
    } catch (error) {
      this.handleError(
        `Failed to update parameter '${parameterName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  updateLocalTag(tagName: string, value: ParameterValue | ArrayParameterValue): void {
    if (!this.aoi) return;

    try {
      const allTags = this.aoi.tags || [];
      const existsInAOI = allTags.some((t) => t.name === tagName && t.usage === 'local');
      const existsInState = Object.prototype.hasOwnProperty.call(this.state.localTags, tagName);

      if (existsInAOI || existsInState) {
        const newLocalTags = {
          ...this.state.localTags,
          [tagName]: cloneValue(value),
        } as ParameterMap;
        this.state = {
          ...this.state,
          localTags: newLocalTags,
        };
        this.notifyCallbacks();
      } else {
        this.handleWarning(`Cannot update local tag '${tagName}': tag not found or not local`);
      }
    } catch (error) {
      this.handleError(
        `Failed to update local tag '${tagName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  updateConfig(newConfig: Partial<SimulationConfig>): void {
    const wasRunning = this.state.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };
    this.recalculateTrendCapacity();

    if (wasRunning) {
      this.start();
    }
  }

  subscribe(callback: SimulationCallback): () => void {
    this.callbacks.add(callback);

    return () => {
      this.callbacks.delete(callback);
    };
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  getConfig(): SimulationConfig {
    return { ...this.config };
  }

  getMetrics(): SimulationMetrics | null {
    if (!this.state.startTime) {
      return null;
    }

    const uptime = Date.now() - this.state.startTime;
    const efficiency =
      this.config.scanTime > 0
        ? Math.min(100, (this.config.scanTime / Math.max(this.state.averageScanDuration, 1)) * 100)
        : 0;

    return {
      actualScanTime: this.state.averageScanDuration,
      targetScanTime: this.config.scanTime,
      scanCount: this.state.scanCount,
      uptime,
      efficiency,
    };
  }

  private async executeScan(): Promise<void> {
    const currentAOI = this.aoi;
    if (!currentAOI || this.isExecutingScan) {
      return;
    }

    this.isExecutingScan = true;
    const scanStartTime = Date.now();

    try {
      const logicRoutine = currentAOI.routines.Logic;
      if (!logicRoutine) {
        this.handleError('No Logic routine found in AOI');
        this.stop();
        return;
      }

      const executionParams = {
        ...this.state.parameters,
        ...this.state.localTags,
      };

      const result = await ExecutionService.executeRoutine(currentAOI, 'Logic', executionParams, {
        scanTime: this.config.scanTime,
      });

      if (!result.compilationResult.success) {
        this.handleError(`Compilation failed: ${result.compilationResult.error}`);
        return;
      }

      if (result.executionContext) {
        const runtimeLogs = result.executionContext.logs ?? [];

        for (const entry of runtimeLogs) {
          if (typeof entry === 'object' && entry.severity) {
            this.emitRuntimeLog({
              level: entry.severity,
              message: `Routine 'Logic' (Rung ${entry.rung}): ${entry.message}`,
              code: entry.code,
              rung: entry.rung,
              element: entry.element,
            });
            this.state = {
              ...this.state,
              errors: [...this.state.errors, entry.message],
              runtimeDiagnostics: [...this.state.runtimeDiagnostics, entry],
            };
            this.stop();
            this.notifyCallbacks();
            return;
          }
          if (typeof entry === 'string' && entry.trim().length > 0) {
            this.handleError(entry);
            this.stop();
            return;
          }
        }

        const newParameters = { ...this.state.parameters };
        const newLocalTags = { ...this.state.localTags };

        const outputs = (currentAOI.tags || []).filter((tag) => tag.usage === 'output');
        outputs.forEach((param) => {
          if (result.executionContext!.variables.has(param.name)) {
            newParameters[param.name] = cloneValue(
              result.executionContext!.variables.get(param.name) as ParameterValue,
            );
          }
        });

        (currentAOI.tags || [])
          .filter((tag) => tag.usage === 'local')
          .forEach((tag) => {
            if (result.executionContext!.variables.has(tag.name)) {
              newLocalTags[tag.name] = cloneValue(
                result.executionContext!.variables.get(tag.name) as
                  | ParameterValue
                  | ArrayParameterValue,
              );
            }
          });

        (currentAOI.tags || [])
          .filter((tag) => tag.usage === 'input')
          .forEach((tag) => {
            if (result.executionContext!.variables.has(tag.name)) {
              newParameters[tag.name] = cloneValue(
                result.executionContext!.variables.get(tag.name) as ParameterValue,
              );
            }
          });

        this.ensureEnableTagDefaults(newParameters);

        const scanEndTime = Date.now();
        const scanDuration = scanEndTime - scanStartTime;
        this.updateScanMetrics(scanDuration);

        this.state = {
          ...this.state,
          scanCount: this.state.scanCount + 1,
          parameters: newParameters,
          localTags: newLocalTags,
          lastScanDuration: scanDuration,
        };

        this.captureTrendPoint(scanEndTime, newParameters);

        if (scanDuration > this.config.maxScanTime) {
          this.handleWarning(
            `Scan time ${scanDuration}ms exceeded maximum ${this.config.maxScanTime}ms`,
          );
        }

        this.notifyCallbacks();
      }
    } catch (error) {
      this.handleError(
        `Scan execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof ExecutionTimeoutError) {
        this.stop();
      }
    } finally {
      this.isExecutingScan = false;
    }
  }

  private updateScanMetrics(scanDuration: number): void {
    if (!this.config.enablePerformanceMetrics) return;

    this.scanDurations.push(scanDuration);

    if (this.scanDurations.length > 100) {
      this.scanDurations.shift();
    }

    const average =
      this.scanDurations.reduce((sum, duration) => sum + duration, 0) / this.scanDurations.length;
    const max = Math.max(...this.scanDurations);

    this.state = {
      ...this.state,
      averageScanDuration: average,
      maxScanDuration: max,
    };
  }

  private ensureEnableTagDefaults(parameters: ParameterMap): void {
    if (Object.prototype.hasOwnProperty.call(parameters, 'EnableIn')) {
      parameters['EnableIn'] = normalizeBool(parameters['EnableIn']);
    }

    if (Object.prototype.hasOwnProperty.call(parameters, 'EnableOut')) {
      const enableIn = parameters['EnableIn'] ?? 1;
      parameters['EnableOut'] = normalizeBool(parameters['EnableOut'] ?? enableIn);
    }
  }

  private handleError(message: string): void {
    console.error(`AOI Simulator Error: ${message}`);
    this.state = {
      ...this.state,
      errors: [...this.state.errors, message],
    };
    this.emitRuntimeLog({ level: 'error', message });
    this.notifyCallbacks();
  }

  private handleWarning(message: string): void {
    console.warn(`AOI Simulator Warning: ${message}`);
    this.state = {
      ...this.state,
      warnings: [...this.state.warnings, message],
    };
    this.emitRuntimeLog({ level: 'warning', message });
    this.notifyCallbacks();
  }

  subscribeToRuntimeLogs(callback: (event: RuntimeLogEvent) => void): () => void {
    this.runtimeLogSubscribers.add(callback);
    return () => {
      this.runtimeLogSubscribers.delete(callback);
    };
  }

  private emitRuntimeLog(event: RuntimeLogEvent): void {
    this.runtimeLogSubscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Runtime log subscriber error:', error);
      }
    });
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(this.getState());
      } catch (error) {
        console.error('Simulation callback error:', error);
      }
    });
  }

  dispose(): void {
    this.stop();
    this.callbacks.clear();
    this.aoi = null;
  }

  private recalculateTrendCapacity(): void {
    const scan = Math.max(1, this.config.scanTime);
    this.trendMaxPoints = Math.max(1, Math.ceil(this.trendWindowMs / scan));
    if (this.trendHistory.length > this.trendMaxPoints) {
      this.trendHistory = this.trendHistory.slice(-this.trendMaxPoints);
    }
  }

  private captureTrendPoint(timestamp: number, parameters: ParameterMap): void {
    const point: TrendDataPoint = { timestamp };
    Object.entries(parameters).forEach(([key, value]) => {
      point[key] = typeof value === 'number' ? value : 0;
    });
    this.trendHistory.push(point);
    if (this.trendHistory.length > this.trendMaxPoints) {
      this.trendHistory.shift();
    }
  }

  getTrendData(): TrendDataPoint[] {
    return this.trendHistory.slice();
  }

  setTrendWindow(windowMs: number): void {
    this.trendWindowMs = Math.max(1_000, windowMs);
    this.recalculateTrendCapacity();
  }

  clearTrendData(): void {
    this.trendHistory = [];
  }
}
