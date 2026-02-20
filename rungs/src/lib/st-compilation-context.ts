import type { CompilationContext } from '@repo/plc-compiler';
import type { AOIDefinition } from '@repo/plc-core';
import { getMembersForDataType } from '@repo/plc-core';

export function cloneCompilationValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof globalThis.structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON-based clone below
    }
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getMembersForTag(dataType: string): Record<string, { dataType: string }> | undefined {
  const members = getMembersForDataType(dataType);
  if (members.length === 0) return undefined;
  return Object.fromEntries(members.map((m) => [m.key, { dataType: m.type }]));
}

export function buildCompilationContext(aoi?: AOIDefinition): CompilationContext {
  const tags = aoi?.tags ?? [];

  const context = {
    tags: tags.map((tag) => ({
      name: tag.name,
      dataType: typeof tag.dataType === 'string' ? tag.dataType : '',
      usage: tag.usage,
      dimension:
        'dimension' in tag && typeof tag.dimension === 'number' ? tag.dimension : undefined,
      defaultValue: cloneCompilationValue(tag.defaultValue),
      members: getMembersForTag(tag.dataType),
    })),
  };

  return context;
}
