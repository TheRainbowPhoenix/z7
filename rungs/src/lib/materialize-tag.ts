import {
  type TagDefinition,
  type DataTypeValue,
  type ParameterValue,
  type ArrayParameterValue,
} from '@repo/plc-core';
import type { RuntimeTag } from '@/types/runtime-tags';
import type { FbdTimerValue, FbdCounterValue, TimerValue, CounterValue } from '@repo/plc-core';

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function deepMerge<T>(target: T, source: unknown): T {
  if (source === undefined) return target;
  if (typeof source !== 'object' || source === null) return source as T;
  if (typeof target !== 'object' || target === null) return source as T;

  const result = { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    result[key] = deepMerge(result[key], value);
  }
  return result as T;
}

function normalizeBool(value: unknown): number {
  if (typeof value === 'number') {
    return value !== 0 ? 1 : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    return value.trim() !== '' && value.trim() !== '0' ? 1 : 0;
  }
  return value ? 1 : 0;
}

export function materializeValue(tag: TagDefinition): ParameterValue | ArrayParameterValue {
  if (tag.name === 'EnableIn' || tag.name === 'EnableOut') {
    return normalizeBool(tag.defaultValue ?? 1);
  }

  const dimension = 'dimension' in tag && typeof tag.dimension === 'number' ? tag.dimension : undefined;
  const isArrayTag = dimension !== undefined;
  const baseDefault = getDefaultValue(tag.dataType);

  if (isArrayTag && dimension !== undefined) {
    const size = dimension;
    const result = Array(size)
      .fill(null)
      .map(() => cloneValue(baseDefault));

    if ('elements' in tag && tag.elements) {
      for (const [indexStr, element] of Object.entries(tag.elements)) {
        const index = parseInt(indexStr, 10);
        if (index >= 0 && index < size && element.defaultValue !== undefined) {
          result[index] = deepMerge(cloneValue(baseDefault), element.defaultValue);
        }
      }
    }

    return result as ArrayParameterValue;
  }

  if (tag.defaultValue !== undefined) {
    if (typeof tag.defaultValue === 'object' && tag.defaultValue !== null) {
      return deepMerge(baseDefault, tag.defaultValue);
    }
    if (typeof tag.defaultValue === 'number') {
      return tag.defaultValue;
    }
    return cloneValue(tag.defaultValue);
  }

  return baseDefault;
}

export function materializeTag(tag: TagDefinition): RuntimeTag {
  const { id, name, usage, description } = tag;
  const dimension = 'dimension' in tag ? tag.dimension : undefined;

  if (typeof dimension === 'number') {
    const size = dimension;
    switch (tag.dataType) {
      case 'BOOL': {
        const value: number[] = Array(size).fill(0);
        return { id, name, dataType: 'BOOL', usage, description, dimension, value };
      }
      case 'DINT': {
        const value: number[] = Array(size).fill(0);
        return { id, name, dataType: 'DINT', usage, description, dimension, value };
      }
      case 'REAL': {
        const value: number[] = Array(size).fill(0);
        return { id, name, dataType: 'REAL', usage, description, dimension, value };
      }
      case 'FBD_TIMER': {
        const base = getDefaultValue('FBD_TIMER');
        const value = Array(size).fill(null).map(() => cloneValue(base));
        return { id, name, dataType: 'FBD_TIMER', usage, description, dimension, value };
      }
      case 'FBD_COUNTER': {
        const base = getDefaultValue('FBD_COUNTER');
        const value = Array(size).fill(null).map(() => cloneValue(base));
        return { id, name, dataType: 'FBD_COUNTER', usage, description, dimension, value };
      }
      case 'TIMER': {
        const base = getDefaultValue('TIMER');
        const value = Array(size).fill(null).map(() => cloneValue(base));
        return { id, name, dataType: 'TIMER', usage, description, dimension, value };
      }
      case 'COUNTER': {
        const base = getDefaultValue('COUNTER');
        const value = Array(size).fill(null).map(() => cloneValue(base));
        return { id, name, dataType: 'COUNTER', usage, description, dimension, value };
      }
    }
  }

  switch (tag.dataType) {
    case 'BOOL': {
      const raw = tag.defaultValue ?? getDefaultValue('BOOL');
      const value = normalizeBool(raw);
      return { id, name, dataType: 'BOOL', usage, description, value };
    }
    case 'DINT': {
      const value = typeof tag.defaultValue === 'number' ? tag.defaultValue : getDefaultValue('DINT');
      return { id, name, dataType: 'DINT', usage, description, value };
    }
    case 'REAL': {
      const value = typeof tag.defaultValue === 'number' ? tag.defaultValue : getDefaultValue('REAL');
      return { id, name, dataType: 'REAL', usage, description, value };
    }
    case 'FBD_TIMER': {
      const base = getDefaultValue('FBD_TIMER');
      const value = typeof tag.defaultValue === 'object' && tag.defaultValue !== null
        ? deepMerge(base, tag.defaultValue)
        : base;
      return { id, name, dataType: 'FBD_TIMER', usage, description, value };
    }
    case 'FBD_COUNTER': {
      const base = getDefaultValue('FBD_COUNTER');
      const value = typeof tag.defaultValue === 'object' && tag.defaultValue !== null
        ? deepMerge(base, tag.defaultValue)
        : base;
      return { id, name, dataType: 'FBD_COUNTER', usage, description, value };
    }
    case 'TIMER': {
      const base = getDefaultValue('TIMER');
      const value = typeof tag.defaultValue === 'object' && tag.defaultValue !== null
        ? deepMerge(base, tag.defaultValue)
        : base;
      return { id, name, dataType: 'TIMER', usage, description, value };
    }
    case 'COUNTER': {
      const base = getDefaultValue('COUNTER');
      const value = typeof tag.defaultValue === 'object' && tag.defaultValue !== null
        ? deepMerge(base, tag.defaultValue)
        : base;
      return { id, name, dataType: 'COUNTER', usage, description, value };
    }
  }
}

export function materializeTags(tags: TagDefinition[]): RuntimeTag[] {
  return tags.map(materializeTag);
}

export function extractExecutionParameters(tags: TagDefinition[]): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  for (const tag of tags) {
    parameters[tag.name] = materializeValue(tag);
  }
  return parameters;
}

const FBD_TIMER_DEFAULT = {
  EnableIn: 0,
  TimerEnable: 0,
  PRE: 0,
  Reset: 0,
  EnableOut: 0,
  ACC: 0,
  EN: 0,
  TT: 0,
  DN: 0,
  Status: 0,
  InstructFault: 0,
  PresetInv: 0,
} as const;

const FBD_COUNTER_DEFAULT = {
  EnableIn: 0,
  CUEnable: 0,
  CDEnable: 0,
  PRE: 0,
  Reset: 0,
  EnableOut: 0,
  ACC: 0,
  CU: 0,
  CD: 0,
  DN: 0,
  OV: 0,
  UN: 0,
} as const;

const TIMER_DEFAULT = {
  PRE: 0,
  ACC: 0,
  EN: 0,
  TT: 0,
  DN: 0,
} as const;

const COUNTER_DEFAULT = {
  PRE: 0,
  ACC: 0,
  CU: 0,
  CD: 0,
  DN: 0,
  OV: 0,
  UN: 0,
} as const;

export function getDefaultValue(dataType: 'BOOL'): 0;
export function getDefaultValue(dataType: 'DINT'): number;
export function getDefaultValue(dataType: 'REAL'): number;
export function getDefaultValue(dataType: 'TIMER'): TimerValue;
export function getDefaultValue(dataType: 'COUNTER'): CounterValue;
export function getDefaultValue(dataType: 'FBD_TIMER'): FbdTimerValue;
export function getDefaultValue(dataType: 'FBD_COUNTER'): FbdCounterValue;
export function getDefaultValue(dataType: DataTypeValue): ParameterValue;
export function getDefaultValue(dataType: DataTypeValue): ParameterValue {
  switch (dataType) {
    case 'BOOL':
    case 'DINT':
    case 'REAL':
      return 0;
    case 'TIMER':
      return { ...TIMER_DEFAULT };
    case 'COUNTER':
      return { ...COUNTER_DEFAULT };
    case 'FBD_TIMER':
      return { ...FBD_TIMER_DEFAULT };
    case 'FBD_COUNTER':
      return { ...FBD_COUNTER_DEFAULT };
    default:
      return 0;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const aVal = (a as Record<string, unknown>)[key];
    const bVal = (b as Record<string, unknown>)[key];
    return deepEqual(aVal, bVal);
  });
}

export function coerceArrayDefaultValue<T extends TagDefinition>(tag: T): T {
  const hasDimension = 'dimension' in tag && tag.dimension !== undefined;

  if (!hasDimension) return tag;

  if (!Array.isArray(tag.defaultValue)) return tag;

  const arrayValue = tag.defaultValue as unknown[];
  const baseDefault = getDefaultValue(tag.dataType);

  const elements: Record<string, { defaultValue?: unknown }> = {};
  let hasOverrides = false;

  arrayValue.forEach((value, index) => {
    if (!deepEqual(value, baseDefault)) {
      elements[String(index)] = { defaultValue: value };
      hasOverrides = true;
    }
  });

  return {
    ...tag,
    defaultValue: baseDefault,
    elements: hasOverrides ? elements : undefined,
  } as T;
}

export { cloneValue, deepMerge, normalizeBool };
