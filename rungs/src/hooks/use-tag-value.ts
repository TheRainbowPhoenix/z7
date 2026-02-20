import { useCallback } from 'react';
import type { DataTypeValue, ParameterValue, ArrayParameterValue } from '@repo/plc-core';
import { parseParameterValue } from '@/components/editors/tags/tag-field-utils';

/**
 * Hook for parsing and validating tag values
 */
export function useValueParser() {
  const parseValue = useCallback((value: string, dataType: DataTypeValue): ParameterValue | null => {
    return parseParameterValue(value, dataType);
  }, []);

  const validateValue = useCallback((value: unknown, dataType: DataTypeValue): boolean => {
    if (value === null || value === undefined) return true;
    
    const normalizedType = dataType.toUpperCase();
    switch (normalizedType) {
      case 'BOOL':
        return value === 0 || value === 1;
      case 'DINT':
      case 'INT':
      case 'SINT':
        return typeof value === 'number' && Number.isInteger(value);
      case 'REAL':
        return typeof value === 'number' && !Number.isNaN(value);
      default:
        return true;
    }
  }, []);

  return { parseValue, validateValue };
}

/**
 * Hook for field validation and updates
 */
export function useFieldValidation() {
  const { parseValue, validateValue } = useValueParser();

  const updateField = useCallback((
    newValueString: string,
    dataType: DataTypeValue,
    onUpdate: (value: ParameterValue | ArrayParameterValue) => void
  ): boolean => {
    const parsed = parseValue(newValueString, dataType);
    if (parsed !== null && validateValue(parsed, dataType)) {
      onUpdate(parsed);
      return true;
    }
    return false;
  }, [parseValue, validateValue]);

  const updateStructuredField = useCallback((
    currentObject: Record<string, unknown>,
    fieldName: string,
    newValueString: string,
    fieldType: DataTypeValue,
    onUpdate: (value: Record<string, unknown>) => void
  ): boolean => {
    const parsed = parseValue(newValueString, fieldType);
    if (parsed !== null && validateValue(parsed, fieldType)) {
      const updated = { ...currentObject, [fieldName]: parsed };
      onUpdate(updated);
      return true;
    }
    return false;
  }, [parseValue, validateValue]);

  return { updateField, updateStructuredField, validateValue };
}
