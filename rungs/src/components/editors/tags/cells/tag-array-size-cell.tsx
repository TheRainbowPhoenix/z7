import { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import FieldErrorOverlay from '@/components/ui/field-error-overlay';
import { useOptionalEditableRow, type EditableRowContextType } from '../editable-row-context';

type EditingState = Partial<
  Pick<EditableRowContextType, 'isEditing' | 'focusField' | 'onInputKeyDown'>
>;

interface TagArraySizeCellProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
  displayValue?: number | string | null;
  onClick?: () => void;
  editingState?: EditingState;
}

export function TagArraySizeCell({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Optional',
  displayValue,
  onClick,
  editingState,
}: TagArraySizeCellProps) {
  const editableRow = useOptionalEditableRow();
  const isEditing = editingState?.isEditing ?? editableRow?.isEditing ?? false;
  const focusField = editingState?.focusField ?? editableRow?.focusField ?? null;
  const onInputKeyDown = editingState?.onInputKeyDown ?? editableRow?.onInputKeyDown;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && focusField === 'arraySize') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isEditing, focusField]);

  if (isEditing && !disabled) {
    return (
      <>
        <Input
          className="h-8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          title={error ?? undefined}
          ref={inputRef}
        />
        <FieldErrorOverlay message={error} />
      </>
    );
  }

  return (
    <div
      className={`h-8 flex items-center ${!disabled && !isEditing ? 'cursor-pointer' : ''}`}
      onClick={!disabled ? onClick : undefined}
    >
      <span className={displayValue ? '' : 'text-muted-foreground'}>{displayValue ?? '—'}</span>
    </div>
  );
}

export default TagArraySizeCell;
