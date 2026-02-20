import {
  type DataType,
  TimerValueSchema,
  CounterValueSchema,
  FbdTimerValueSchema,
  FbdCounterValueSchema,
  TIMER_MEMBERS,
  COUNTER_MEMBERS,
  FBD_TIMER_MEMBERS,
  FBD_COUNTER_MEMBERS,
} from '@repo/plc-core';
import { AtomicEditor } from './atomic-editor';
import type { TagWithValue } from './tag-table';
import { useFieldValidation } from '@/hooks/use-tag-value';

type StructuredValue = Record<string, number | undefined>;

interface TimerCounterEditorProps {
  tag: TagWithValue;
  indentLevel?: number;
  onChange?: (next: StructuredValue) => void;
  onLocalTagChange?: (name: string, value: StructuredValue, dataType: DataType) => void;
}

const SCHEMAS = {
  TIMER: TimerValueSchema,
  COUNTER: CounterValueSchema,
  FBD_TIMER: FbdTimerValueSchema,
  FBD_COUNTER: FbdCounterValueSchema,
} as const;

const MEMBERS = {
  TIMER: TIMER_MEMBERS,
  COUNTER: COUNTER_MEMBERS,
  FBD_TIMER: FBD_TIMER_MEMBERS,
  FBD_COUNTER: FBD_COUNTER_MEMBERS,
} as const;

type TimerCounterDataType = keyof typeof SCHEMAS;

export function TimerCounterEditor({
  tag,
  indentLevel = 1,
  onChange,
  onLocalTagChange,
}: TimerCounterEditorProps) {
  const dataType = tag.dataType as TimerCounterDataType;
  const schema = SCHEMAS[dataType] ?? SCHEMAS.TIMER;
  const fields = MEMBERS[dataType] ?? MEMBERS.TIMER;

  const parsedValue = schema.safeParse(tag.value ?? {});
  const value: StructuredValue =
    parsedValue.success && parsedValue.data ? (parsedValue.data as StructuredValue) : {};

  const canEdit = Boolean(onChange) || (tag.usage === 'local' && onLocalTagChange);
  const { updateStructuredField } = useFieldValidation();
  const paddingLeft = `${indentLevel * 0.5}rem`;

  const handleFieldUpdate = (field: string, newVal: string, fieldType: DataType) => {
    if (!canEdit) return;

    updateStructuredField(value, field, newVal, fieldType, (updatedValue) => {
      const parsed = schema.safeParse(updatedValue);
      if (!parsed.success || !parsed.data) return;
      const result = parsed.data as StructuredValue;
      if (onChange) {
        onChange(result);
      } else if (onLocalTagChange) {
        onLocalTagChange(tag.name, result, tag.dataType);
      }
    });
  };

  return (
    <>
      {fields.map(({ key, type }) => (
        <tr key={`${tag.name}.${key}`} className="border-t">
          <td className="px-2 py-1 align-top">
            <span
              className="block max-w-full truncate font-mono text-[12px]"
              style={{ paddingLeft }}
              title={`${tag.name}.${key}`}
            >
              {`${tag.name}.${key}`}
            </span>
          </td>
          <td className="px-2 py-1 align-top">
            <div className="flex justify-end">
              <AtomicEditor
                tag={
                  type === 'BOOL'
                    ? {
                        id: tag.id,
                        name: `${tag.name}.${key}`,
                        usage: tag.usage,
                        dataType: 'BOOL' as const,
                      }
                    : {
                        id: tag.id,
                        name: `${tag.name}.${key}`,
                        usage: tag.usage,
                        dataType: 'DINT' as const,
                      }
                }
                value={value[key] ?? 0}
                onChange={canEdit ? (val) => handleFieldUpdate(key, val, type) : undefined}
              />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
