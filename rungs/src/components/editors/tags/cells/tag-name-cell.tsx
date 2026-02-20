import { useRef, useEffect, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import FieldErrorOverlay from '@/components/ui/field-error-overlay';
import { useOptionalEditableRow, type EditableRowContextType } from '../editable-row-context';

type EditingState = Partial<
  Pick<EditableRowContextType, 'isEditing' | 'focusField' | 'onInputKeyDown'>
>;

interface TagNameCellProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  leading?: ReactNode;
  autoFocus?: boolean;
  onClick?: () => void;
  editingState?: EditingState;
}

export function TagNameCell({
  value,
  onChange,
  error,
  placeholder,
  leading,
  autoFocus = false,
  onClick,
  editingState,
}: TagNameCellProps) {
  const editableRow = useOptionalEditableRow();
  const isEditing = editingState?.isEditing ?? editableRow?.isEditing ?? false;
  const focusField = editingState?.focusField ?? editableRow?.focusField ?? null;
  const onInputKeyDown = editingState?.onInputKeyDown ?? editableRow?.onInputKeyDown;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && focusField === 'name') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isEditing, focusField]);

  if (isEditing) {
    return (
      <>
        <Input
          className="h-8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          aria-invalid={!!error}
          title={error ?? undefined}
          placeholder={placeholder}
          autoFocus={autoFocus}
          ref={inputRef}
        />
        <FieldErrorOverlay message={error} />
      </>
    );
  }

  return (
    <div
      className="h-8 flex items-center gap-2 overflow-hidden whitespace-nowrap cursor-pointer"
      onClick={onClick}
    >
      {leading && (
        <span className="inline-flex w-5 h-5 items-center justify-center">{leading}</span>
      )}
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

export default TagNameCell;
