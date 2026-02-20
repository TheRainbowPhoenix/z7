import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useStore } from '@/store/store';
import { useIsSimulationRunning } from '@/hooks/use-simulation';
import { trendDataManager, type TrendDataPoint } from '../../../lib/trend-data-manager';

type Props = {
  aoiName: string;
};

type Dimensions = {
  width: number;
  height: number;
};

type Lane = {
  signal: string;
  type: string;
  color: string;
  top: number;
  height: number;
  actualMin: number;
  actualMax: number;
  minY: number;
  maxY: number;
};

type ChartMeta = {
  width: number;
  height: number;
  plotWidth: number;
  plotHeight: number;
  minTimestamp: number;
  maxTimestamp: number;
  margin: { top: number; right: number; bottom: number; left: number };
  lanes: Lane[];
};

type ChartSnapshot = ChartMeta & {
  points: TrendDataPoint[];
  version: number;
};

// Bounded LRU cache to prevent memory leaks
const MAX_CACHE_SIZE = 50;

type CacheEntry<T> = {
  value: T;
  lastAccessed: number;
};

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Update access time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: string, value: T | null): void {
    if (value === null) {
      this.cache.delete(key);
      return;
    }

    // If cache is full, evict least recently used entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }
}

const previousMetaCache = new LRUCache<ChartSnapshot>(MAX_CACHE_SIZE);

const getCachedMeta = (aoiName: string): ChartSnapshot | null => {
  return previousMetaCache.get(aoiName);
};

const setCachedMeta = (aoiName: string, meta: ChartSnapshot | null): void => {
  previousMetaCache.set(aoiName, meta);
};

const emptyDataTimestampCache = new LRUCache<number>(MAX_CACHE_SIZE);

const getEmptyDataTimestamp = (aoiName: string): number | null => {
  return emptyDataTimestampCache.get(aoiName);
};

const ensureEmptyDataTimestamp = (aoiName: string): void => {
  if (!emptyDataTimestampCache.has(aoiName)) {
    emptyDataTimestampCache.set(aoiName, Date.now());
  }
};

const clearEmptyDataTimestamp = (aoiName: string): void => {
  emptyDataTimestampCache.delete(aoiName);
};

type HoverEntry = {
  signal: string;
  type: string;
  color: string;
  value: number;
  y: number;
};

type HoverState = {
  timestamp: number;
  x: number;
  entries: HoverEntry[];
  chartVersion: number;
};

const LINE_COLORS = ['#2563eb', '#16a34a', '#f97316', '#ec4899', '#0ea5e9', '#8b5cf6', '#22d3ee'];
const TREND_WINDOW_MS = 60_000;
const TICK_DIVISIONS = 5;

const MIN_LANE_PADDING_RATIO = 0.05;
const MIN_LANE_PADDING_PX = 4;
const MAX_LANE_PADDING_RATIO = 0.15;
const CONSTANT_LANE_PADDING_RATIO = 0.0005;

const axisNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const tooltipNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

const tooltipTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

const axisTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const formatTooltipTimestamp = (timestamp: number): string => {
  return tooltipTimeFormatter.format(timestamp);
};

const formatAxisTimestamp = (timestamp: number): string => {
  return axisTimeFormatter.format(timestamp);
};

const projectX = (value: number, meta: ChartMeta): number => {
  if (meta.maxTimestamp === meta.minTimestamp || meta.plotWidth <= 0) {
    return meta.margin.left + meta.plotWidth / 2;
  }

  return (
    meta.margin.left +
    ((value - meta.minTimestamp) / (meta.maxTimestamp - meta.minTimestamp)) * meta.plotWidth
  );
};

const projectY = (value: number, lane: Lane): number => {
  if (lane.maxY === lane.minY || lane.height <= 0) {
    return lane.top + lane.height / 2;
  }

  const ratio = (value - lane.minY) / (lane.maxY - lane.minY);
  return lane.top + (1 - ratio) * lane.height;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const renderChart = (
  canvas: HTMLCanvasElement,
  dimensions: Dimensions,
  chartState: ChartSnapshot | null,
): ChartSnapshot | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { width, height } = dimensions;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!chartState || width === 0 || height === 0) {
    return null;
  }

  const { lanes, margin, plotWidth, plotHeight, minTimestamp, points } = chartState;
  if (plotWidth === 0 || plotHeight === 0) {
    return null;
  }

  const tickOffsets = Array.from({ length: TICK_DIVISIONS + 1 }, (_value, index) => {
    return (TREND_WINDOW_MS / TICK_DIVISIONS) * index;
  });
  const tickTimes = tickOffsets.map((offset) => minTimestamp + offset);
  const tickXs = tickOffsets.map((offset) => margin.left + (offset / TREND_WINDOW_MS) * plotWidth);

  lanes.forEach((lane, laneIndex) => {
    ctx.fillStyle = laneIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(margin.left, lane.top, plotWidth, lane.height);

    ctx.strokeStyle = '#cbd5f5';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, lane.top, plotWidth, lane.height);

    const midTickValues = [0.33, 0.66]
      .map((fraction) => lane.minY + (lane.maxY - lane.minY) * fraction)
      .filter((value) => Number.isFinite(value));

    ctx.setLineDash([4, 4]);
    midTickValues.forEach((value) => {
      const y = projectY(value, lane);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotWidth, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.fillStyle = '#475569';
    ctx.font =
      '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const maxLabelY = clamp(
      projectY(lane.actualMax, lane),
      lane.top + 6,
      lane.top + lane.height - 6,
    );
    const minLabelY = clamp(
      projectY(lane.actualMin, lane),
      lane.top + 6,
      lane.top + lane.height - 6,
    );

    if (Math.abs(lane.actualMax - lane.actualMin) < 1e-6) {
      ctx.fillText(axisNumberFormatter.format(lane.actualMax), margin.left - 8, maxLabelY);
    } else {
      ctx.fillText(axisNumberFormatter.format(lane.actualMax), margin.left - 8, maxLabelY);
      ctx.fillText(axisNumberFormatter.format(lane.actualMin), margin.left - 8, minLabelY);
    }
  });

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  tickXs.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotHeight);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.font =
    '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  tickXs.forEach((x, index) => {
    const label = formatAxisTimestamp(tickTimes[index]);
    ctx.fillText(label, x, height - margin.bottom + 6);
  });

  lanes.forEach((lane) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, lane.top, plotWidth, lane.height);
    ctx.clip();

    ctx.strokeStyle = lane.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let drawing = false;

    points.forEach((point) => {
      const value = point[lane.signal];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        if (drawing) {
          ctx.stroke();
          drawing = false;
        }
        return;
      }

      const x = projectX(point.timestamp, chartState);
      const y = projectY(value, lane);

      if (!drawing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (drawing) {
      ctx.stroke();
    }

    ctx.restore();
  });

  return chartState;
};

function TrendChart({ aoiName }: Props) {
  const [data, setData] = useState<TrendDataPoint[]>(() => trendDataManager.getData());
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingMeasureRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = trendDataManager.subscribe((next) => {
      if (next.length === 0) {
        ensureEmptyDataTimestamp(aoiName);
      } else {
        clearEmptyDataTimestamp(aoiName);
      }
      setData(next);
    });
    return () => unsubscribe();
  }, [aoiName]);

  const aoiDefinition = useStore((state) => state.aoi);
  const isSimulationRunning = useIsSimulationRunning();

  const { signals: monitoredSignals, usageBySignal } = useMemo(() => {
    const inputs: string[] = [];
    const outputs: string[] = [];
    const others: string[] = [];
    const usage = new Map<string, string>();

    if (aoiDefinition) {
      (aoiDefinition.tags ?? []).forEach((tag) => {
        if (tag.usage === 'local') {
          return;
        }

        usage.set(tag.name, tag.usage);

        // Group signals so inputs render first (legend left/top lanes) and outputs last.
        if (tag.usage === 'input') {
          inputs.push(tag.name);
        } else if (tag.usage === 'output') {
          outputs.push(tag.name);
        } else {
          others.push(tag.name);
        }
      });
    }

    return { signals: [...inputs, ...others, ...outputs], usageBySignal: usage };
  }, [aoiDefinition]);

  const hasSignals = monitoredSignals.length > 0;
  const hasTrendData = data.length > 0;

  useLayoutEffect(() => {
    if (!hasSignals) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setDimensions((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });

      if ((width === 0 || height === 0) && typeof requestAnimationFrame !== 'undefined') {
        pendingMeasureRef.current = requestAnimationFrame(() => {
          pendingMeasureRef.current = null;
          measure();
        });
      }
    };

    const triggerMeasure = () => {
      if (pendingMeasureRef.current != null) {
        cancelAnimationFrame(pendingMeasureRef.current);
        pendingMeasureRef.current = null;
      }
      measure();
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(triggerMeasure);
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', triggerMeasure);
    return () => {
      window.removeEventListener('resize', triggerMeasure);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (pendingMeasureRef.current != null) {
        cancelAnimationFrame(pendingMeasureRef.current);
        pendingMeasureRef.current = null;
      }
    };
  }, [hasSignals]);

  // Re-measure dimensions when data becomes available
  useEffect(() => {
    if (hasTrendData && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    }
  }, [hasTrendData]);

  useEffect(() => {
    if (!isSimulationRunning) {
      return;
    }

    const measureOnNextFrame = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width > 0 && height > 0) {
        setDimensions((prev) => {
          if (prev.width === width && prev.height === height) {
            return prev;
          }
          return { width, height };
        });
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      const frame = requestAnimationFrame(measureOnNextFrame);
      return () => cancelAnimationFrame(frame);
    }

    measureOnNextFrame();
    return;
  }, [isSimulationRunning]);

  const chartState = useMemo<ChartSnapshot | null>(() => {
    const { width, height } = dimensions;
    if (width === 0 || height === 0 || monitoredSignals.length === 0) {
      return null;
    }

    const previousMeta = getCachedMeta(aoiName);

    const margin = { top: 2, right: 32, bottom: 24, left: 56 };
    const plotWidth = Math.max(width - margin.left - margin.right, 0);
    const plotHeight = Math.max(height - margin.top - margin.bottom, 0);

    if (plotWidth === 0 || plotHeight === 0) {
      return null;
    }

    const latestPointTimestamp =
      data.length > 0 ? (data[data.length - 1]?.timestamp ?? null) : null;
    const fallbackTimestamp =
      latestPointTimestamp ?? previousMeta?.maxTimestamp ?? getEmptyDataTimestamp(aoiName);

    if (fallbackTimestamp == null) {
      return null;
    }

    const maxTimestamp = fallbackTimestamp;
    const minTimestamp = maxTimestamp - TREND_WINDOW_MS;

    const visiblePoints: TrendDataPoint[] = [];
    const laneStats = new Map<string, { min: number; max: number }>();
    const previousLaneBySignal =
      previousMeta != null ? new Map(previousMeta.lanes.map((lane) => [lane.signal, lane])) : null;

    data.forEach((point) => {
      if (point.timestamp < minTimestamp) {
        return;
      }

      visiblePoints.push(point);

      monitoredSignals.forEach((signal) => {
        const rawValue = point[signal];
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
          return;
        }

        const stats = laneStats.get(signal);
        if (stats) {
          if (rawValue < stats.min) stats.min = rawValue;
          if (rawValue > stats.max) stats.max = rawValue;
        } else {
          laneStats.set(signal, { min: rawValue, max: rawValue });
        }
      });
    });

    const laneHeight = plotHeight / monitoredSignals.length;
    const lanes: Lane[] = monitoredSignals.map((signal, index) => {
      const stats = laneStats.get(signal);
      const previousLane = previousLaneBySignal?.get(signal);
      const actualMin = stats ? stats.min : previousLane ? previousLane.actualMin : 0;
      const actualMax = stats ? stats.max : previousLane ? previousLane.actualMax : 0;
      const span = actualMax - actualMin;

      let padding: number;
      if (span <= 0) {
        const baseline = Math.max(Math.abs(actualMax), Math.abs(actualMin), 1);
        padding = baseline * CONSTANT_LANE_PADDING_RATIO;
      } else {
        const valuePerPixel = laneHeight === 0 ? 0 : span / laneHeight;
        const pixelPadding = valuePerPixel * MIN_LANE_PADDING_PX;
        const ratioPadding = span * MIN_LANE_PADDING_RATIO;
        const maxPadding = span * MAX_LANE_PADDING_RATIO;
        padding = Math.min(Math.max(pixelPadding, ratioPadding), maxPadding);
      }

      padding = Number.isFinite(padding) && padding > 0 ? padding : 1;

      const top = margin.top + index * laneHeight;
      const minY = actualMin - padding;
      const maxY = actualMax + padding;

      return {
        signal,
        type: usageBySignal.get(signal) ?? '',
        color: LINE_COLORS[index % LINE_COLORS.length],
        top,
        height: laneHeight,
        actualMin,
        actualMax,
        minY,
        maxY: minY === maxY ? minY + 1 : maxY,
      };
    });

    // Only increment version when chart structure changes, not on every data update
    const structureChanged =
      !previousMeta ||
      previousMeta.width !== width ||
      previousMeta.height !== height ||
      previousMeta.lanes.length !== lanes.length ||
      previousMeta.lanes.some((prevLane, idx) => lanes[idx]?.signal !== prevLane.signal);

    const version = structureChanged
      ? (previousMeta?.version ?? 0) + 1
      : (previousMeta?.version ?? 1);

    return {
      width,
      height,
      plotWidth,
      plotHeight,
      minTimestamp,
      maxTimestamp,
      margin,
      lanes,
      points: visiblePoints,
      version,
    };
  }, [aoiName, data, dimensions, monitoredSignals, usageBySignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const meta = renderChart(canvas, dimensions, chartState);
    setCachedMeta(aoiName, meta);
  }, [aoiName, chartState, dimensions]);

  useEffect(() => {
    return () => {
      setCachedMeta(aoiName, null);
      clearEmptyDataTimestamp(aoiName);
    };
  }, [aoiName]);

  // Keep hover active if chart structure hasn't changed
  const activeHover =
    hover && chartState && hover.chartVersion === chartState.version ? hover : null;

  if (!aoiDefinition) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-4">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">AOI not found</p>
          <p className="text-sm">Cannot load trend data for AOI: {aoiName}</p>
          <p className="mt-2 text-xs text-gray-400">Verify the AOI exists in the project.</p>
        </div>
      </div>
    );
  }

  if (!hasSignals) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-4">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No parameters to monitor</p>
          <p className="text-sm">
            Add Input or Output parameters to the <strong>{aoiDefinition.name}</strong> AOI.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Inputs: {(aoiDefinition.tags ?? []).filter((tag) => tag.usage === 'input').length} ·
            Outputs: {(aoiDefinition.tags ?? []).filter((tag) => tag.usage === 'output').length}
          </p>
        </div>
      </div>
    );
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const meta = chartState;
    if (!meta || meta.points.length === 0) {
      setHover(null);
      return;
    }

    const { offsetX, offsetY } = event.nativeEvent;

    const insideX = offsetX >= meta.margin.left && offsetX <= meta.margin.left + meta.plotWidth;
    const insideY = offsetY >= meta.margin.top && offsetY <= meta.margin.top + meta.plotHeight;

    if (!insideX || !insideY) {
      setHover(null);
      return;
    }

    const ratio =
      meta.maxTimestamp === meta.minTimestamp || meta.plotWidth === 0
        ? 0
        : (offsetX - meta.margin.left) / meta.plotWidth;
    const targetTimestamp = meta.minTimestamp + ratio * (meta.maxTimestamp - meta.minTimestamp);

    let closestPoint = meta.points[0];
    let smallestDelta = Math.abs(closestPoint.timestamp - targetTimestamp);

    for (let index = 1; index < meta.points.length; index += 1) {
      const point = meta.points[index];
      const delta = Math.abs(point.timestamp - targetTimestamp);
      if (delta < smallestDelta) {
        smallestDelta = delta;
        closestPoint = point;
      }
    }

    if (!closestPoint) {
      setHover(null);
      return;
    }

    const x = projectX(closestPoint.timestamp, meta);

    const entries: HoverEntry[] = meta.lanes
      .map((lane) => {
        const value = closestPoint[lane.signal];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return null;
        }
        return {
          signal: lane.signal,
          type: lane.type,
          color: lane.color,
          value,
          y: projectY(value, lane),
        };
      })
      .filter((entry): entry is HoverEntry => entry !== null);

    if (entries.length === 0) {
      setHover(null);
      return;
    }

    setHover({
      timestamp: closestPoint.timestamp,
      x,
      entries,
      chartVersion: meta.version,
    });
  };

  const handlePointerLeave = () => {
    setHover(null);
  };

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
      <div className="flex shrink-0 flex-wrap justify-center gap-3 text-xs text-slate-600">
        {monitoredSignals.map((signal, index) => (
          <div key={signal} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
            />
            <span className="font-medium">{signal}</span>
            <span className="text-slate-400">
              {usageBySignal.get(signal) ? `(${usageBySignal.get(signal)})` : ''}
            </span>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
        {!hasTrendData && !isSimulationRunning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="rounded-md bg-white/80 px-4 py-3 text-center shadow backdrop-blur">
              <p className="text-sm font-medium text-slate-600">No trend data captured yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Start the simulation to record live parameter trends for
                <span className="font-semibold text-slate-500"> {aoiDefinition.name}</span>.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Monitoring: {monitoredSignals.join(', ')}
              </p>
            </div>
          </div>
        )}
        {activeHover &&
          chartState &&
          (() => {
            const markerX = projectX(activeHover.timestamp, chartState);

            return (
              <>
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: `${markerX}px`,
                    top: `${chartState.margin.top}px`,
                    bottom: `${chartState.margin.bottom}px`,
                  }}
                >
                  <div className="h-full w-px bg-slate-300" />
                </div>
                {activeHover.entries.map((entry) => {
                  const lane = chartState.lanes.find((l) => l.signal === entry.signal);
                  const markerY = lane ? projectY(entry.value, lane) : entry.y;

                  return (
                    <div
                      key={entry.signal}
                      className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
                      style={{
                        left: `${markerX}px`,
                        top: `${markerY}px`,
                        backgroundColor: entry.color,
                      }}
                    />
                  );
                })}
                <div
                  className="pointer-events-none absolute z-10 max-w-[240px] min-w-[180px] rounded bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
                  style={{
                    left: `${Math.min(
                      Math.max(activeHover.x + 12, chartState.margin.left),
                      Math.max(chartState.margin.left, chartState.width - 220),
                    )}px`,
                    top: `${Math.max(
                      chartState.margin.top + 8,
                      (activeHover.entries[0]?.y ?? chartState.margin.top + 8) - 40,
                    )}px`,
                  }}
                >
                  <div className="mb-2 font-semibold">
                    {formatTooltipTimestamp(activeHover.timestamp)}
                  </div>
                  {activeHover.entries.map((entry) => (
                    <div key={entry.signal} className="flex items-center gap-2 py-0.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="truncate">{entry.signal}</span>
                      {entry.type ? <span className="text-slate-300">({entry.type})</span> : null}
                      <span className="ml-auto font-medium">
                        {tooltipNumberFormatter.format(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
      </div>
    </div>
  );
}

export default TrendChart;
