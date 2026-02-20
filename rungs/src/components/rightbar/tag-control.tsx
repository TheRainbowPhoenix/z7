import type { ArrayParameterValue, DataType, ParameterValue } from '@repo/plc-core';
import { DATA_TYPES } from '@repo/plc-core';
import { AtomicEditor } from './atomic-editor';
import type { TagWithValue } from './tag-table';
import { TimerCounterEditor } from './timer-counter-editor';

interface TagControlProps {
  tag: TagWithValue;
  onParameterChange?: (name: string, value: string, dataType: DataType) => void;
  onLocalTagChange?: (
    name: string,
    value: ParameterValue | ArrayParameterValue,
    dataType: DataType,
  ) => void;
}

export function TagControl({ tag, onParameterChange, onLocalTagChange }: TagControlProps) {
  const dataType = tag.dataType.toUpperCase();

  if (dataType === DATA_TYPES.FBD_TIMER || dataType === DATA_TYPES.FBD_COUNTER) {
    return <TimerCounterEditor tag={tag} onLocalTagChange={onLocalTagChange} />;
  }

  const onChange =
    tag.usage === 'input' && onParameterChange
      ? (val: string) => onParameterChange(tag.name, val, tag.dataType)
      : undefined;

  return (
    <AtomicEditor
      tag={tag}
      value={tag.value as ParameterValue | ArrayParameterValue | undefined}
      onChange={onChange}
    />
  );
}
