import {
  DATA_TYPES,
  DintValueSchema,
  RealValueSchema,
  type DataTypeValue,
  type ParameterValue,
} from '@repo/plc-core';

export function formatValue(value: number | string | undefined | null, dataType: string): string {
  if (value === undefined || value === null) return '';
  if (dataType === 'BOOL') {
    const numVal = typeof value === 'string' ? Number(value) : value;
    return numVal ? '1' : '0';
  }
  return String(value);
}

export const parseParameterValue = (
  value: string,
  dataType: DataTypeValue,
): ParameterValue | null => {
  const normalized = dataType.toUpperCase();
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const parseWithSchema = <T>(schema: {
    safeParse: (input: unknown) => { success: true; data: T } | { success: false };
  }): T | null => {
    const result = schema.safeParse(trimmed);
    if (!result.success) return null;
    return result.data;
  };

  switch (normalized) {
    case DATA_TYPES.BOOL: {
      if (trimmed === '0') return 0;
      if (trimmed === '1') return 1;
      return null;
    }
    case DATA_TYPES.DINT: {
      return parseWithSchema(DintValueSchema);
    }
    case DATA_TYPES.REAL: {
      return parseWithSchema(RealValueSchema);
    }
    default:
      return null;
  }
};
