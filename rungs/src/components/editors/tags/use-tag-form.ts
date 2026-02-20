import { useState, useEffect, useRef, startTransition } from 'react';
import {
  TagDefinitionSchema,
  TagNameSchema,
  type TagDefinition,
  type TagUsage,
  type DataTypeValue,
  getAvailableDataTypes,
} from '@repo/plc-core';
import { getDefaultValue } from '@/lib/materialize-tag';
import { parseParameterValue } from './tag-field-utils';

export type { TagUsage, TagFormValues };

type TagFormValues = {
  id?: string;
  name: string;
  usage: TagUsage;
  dataType: DataTypeValue;
  defaultValue?: number | Record<string, unknown> | null;
  dimension?: number;
  elements?: Record<string, { description?: string; defaultValue?: unknown }>;
  description?: string;
};

type ArrayFormValues = TagFormValues & {
  dimension: number;
  elements: Record<string, { description?: string; defaultValue?: unknown }>;
};

const createDefaultFormValues = (): TagFormValues => ({
  id: undefined,
  name: '',
  usage: 'local',
  dataType: 'DINT',
  defaultValue: undefined,
  description: undefined,
  dimension: undefined,
  elements: undefined,
});

export const isStructuredType = (dataType: DataTypeValue) =>
  dataType === 'TIMER' ||
  dataType === 'COUNTER' ||
  dataType === 'FBD_TIMER' ||
  dataType === 'FBD_COUNTER';

const toFormDefaultValue = (value: unknown): TagFormValues['defaultValue'] => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return undefined;
};

const normalizeDefaultValueInput = (
  input: number | null | undefined,
  dataType: DataTypeValue,
): TagFormValues['defaultValue'] => {
  if (input === null || input === undefined) return undefined;
  const parsed = parseParameterValue(String(input), dataType);
  return typeof parsed === 'number' ? parsed : undefined;
};

const isArrayFormValues = (values: TagFormValues): values is ArrayFormValues =>
  values.dimension !== undefined;

const stripArrayValues = (values: TagFormValues): TagFormValues => {
  if (!isArrayFormValues(values)) return values;
  return {
    id: values.id,
    name: values.name,
    usage: values.usage,
    dataType: values.dataType,
    description: values.description,
    defaultValue: toFormDefaultValue(getDefaultValue(values.dataType)),
  };
};

const createArrayValues = (values: TagFormValues, size: number): TagFormValues => {
  const base = stripArrayValues(values);
  return {
    ...base,
    usage: 'local',
    defaultValue: undefined,
    dimension: size,
    elements: {},
  };
};

const applyDataTypeDraft = (values: TagFormValues, dataType: DataTypeValue): TagFormValues => {
  const nextUsage: TagUsage = isStructuredType(dataType) ? 'local' : values.usage;
  const next: TagFormValues = {
    ...values,
    usage: nextUsage,
    dataType,
  };

  if (isArrayFormValues(next)) {
    return {
      ...next,
      usage: 'local',
      defaultValue: undefined,
      elements: next.elements ?? {},
      dimension: next.dimension ?? 1,
    };
  }

  return {
    ...stripArrayValues(next),
    defaultValue: toFormDefaultValue(getDefaultValue(dataType)),
  };
};

const tagDefinitionToFormValues = (tag: TagDefinition): TagFormValues => ({
  id: tag.id,
  name: tag.name,
  usage: tag.usage,
  dataType: tag.dataType,
  defaultValue: tag.defaultValue,
  description: tag.description,
  dimension: 'dimension' in tag ? (tag.dimension as number) : undefined,
  elements:
    'elements' in tag && tag.elements
      ? (tag.elements as Record<string, { description?: string; defaultValue?: unknown }>)
      : undefined,
});

const parseArraySizeInput = (input: number | string | null | undefined): number | null => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    const normalized = Math.trunc(input);
    return normalized > 0 ? normalized : null;
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

interface UseTagFormOptions {
  existingNames: Set<string>;
  excludeName?: string;
  initialTag?: TagDefinition;
  onSubmit: (tag: TagDefinition) => void;
}

export function useTagForm({
  existingNames,
  excludeName,
  initialTag,
  onSubmit,
}: UseTagFormOptions) {
  const [values, setValues] = useState<TagFormValues>(() =>
    initialTag ? tagDefinitionToFormValues(initialTag) : createDefaultFormValues(),
  );
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [resetKey, setResetKey] = useState(0);
  const previousInitialTagRef = useRef(initialTag);

  useEffect(() => {
    if (initialTag && initialTag !== previousInitialTagRef.current) {
      previousInitialTagRef.current = initialTag;
      startTransition(() => {
        setValues(tagDefinitionToFormValues(initialTag));
        setErrors({});
      });
    }
  }, [initialTag]);

  const validateName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Name is required';

    const result = TagNameSchema.safeParse(trimmed);
    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Invalid name';
    }

    const lowerName = trimmed.toLowerCase();
    const isExcluded = excludeName && lowerName === excludeName.toLowerCase();
    if (!isExcluded && existingNames.has(lowerName)) {
      return 'Name already exists';
    }

    return null;
  };

  const setValue = <K extends keyof TagFormValues>(key: K, value: TagFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === 'name' && errors.name) {
      setErrors((current) => ({ ...current, name: undefined }));
    }
  };

  const setUsageValue = (usage: TagUsage) => {
    setValues((current) => {
      let next: TagFormValues = { ...current, usage };
      if (usage !== 'local' && isArrayFormValues(next)) {
        next = stripArrayValues(next);
      }

      const allowedTypes = getAvailableDataTypes(usage);
      if (!allowedTypes.includes(next.dataType)) {
        next = applyDataTypeDraft(next, allowedTypes[0]);
      }
      return next;
    });
  };

  const setDataTypeValue = (dataType: DataTypeValue) => {
    setValues((current) => applyDataTypeDraft(current, dataType));
  };

  const setArraySizeValue = (size: number | string | null) => {
    setValues((current) => {
      const parsed = parseArraySizeInput(size);
      if (!parsed) {
        return stripArrayValues(current);
      }
      return createArrayValues(current, parsed);
    });
  };

  const setDefaultValue = (value: number | null | undefined) => {
    if (isArrayFormValues(values)) return;
    setValue('defaultValue', normalizeDefaultValueInput(value, values.dataType));
  };

  const validateAndSubmit = () => {
    const trimmedName = values.name.trim();
    if (!trimmedName) return false;

    const nameError = validateName(values.name);
    if (nameError) {
      setErrors({ name: nameError });
      return false;
    }

    const { id: _unusedId, ...valuesWithoutId } = values;
    void _unusedId;
    const parsePayload = {
      ...valuesWithoutId,
      name: trimmedName,
      ...(initialTag?.id && { id: initialTag.id }),
    };
    const result = TagDefinitionSchema.safeParse(parsePayload);

    if (!result.success) {
      const nameIssue = result.error.issues.find((issue) => issue.path[0] === 'name');
      if (nameIssue) {
        setErrors({ name: nameIssue.message });
      }
      return false;
    }

    onSubmit(result.data);
    return true;
  };

  const reset = () => {
    setValues(createDefaultFormValues());
    setErrors({});
    setResetKey((k) => k + 1);
  };

  const resetToTag = (tag: TagDefinition) => {
    setValues(tagDefinitionToFormValues(tag));
    setErrors({});
  };

  return {
    values,
    errors,
    resetKey,
    setValue,
    setUsageValue,
    setDataTypeValue,
    setArraySizeValue,
    setDefaultValue,
    validateAndSubmit,
    reset,
    resetToTag,
  };
}
