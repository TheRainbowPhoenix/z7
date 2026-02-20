import type { TagDefinition, ParameterValue, ArrayParameterValue } from '@repo/plc-core';
import { DATA_TYPES } from '@repo/plc-core';
import { getDefaultValue } from '@/lib/materialize-tag';
import { BoolField } from './bool-field';
import { IntField } from './int-field';
import { RealField } from './real-field';

interface AtomicEditorProps {
  tag: TagDefinition;
  value: ParameterValue | ArrayParameterValue | undefined;
  onChange?: (val: string) => void;
}

export function AtomicEditor({ tag, value, onChange }: AtomicEditorProps) {
  const displayValue = value ?? getDefaultValue(tag.dataType);

  switch (tag.dataType) {
    case DATA_TYPES.BOOL: {
      const boolValue = typeof displayValue === 'number' && displayValue === 1 ? 1 : 0;
      return <BoolField value={boolValue} editable={Boolean(onChange)} onChange={onChange} />;
    }
    case DATA_TYPES.DINT: {
      const intValue = typeof displayValue === 'number' ? displayValue : 0;
      return <IntField value={intValue} editable={Boolean(onChange)} onChange={onChange} />;
    }
    case DATA_TYPES.REAL: {
      const realValue = typeof displayValue === 'number' ? displayValue : 0;
      return <RealField value={realValue} editable={Boolean(onChange)} onChange={onChange} />;
    }
    default:
      throw new Error(`Unsupported atomic data type: ${tag.dataType}`);
  }
}
